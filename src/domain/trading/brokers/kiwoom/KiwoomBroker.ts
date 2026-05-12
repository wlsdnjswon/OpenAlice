/**
 * KiwoomBroker — IBroker adapter for Kiwoom Securities (키움증권) REST API.
 *
 * Covers KRX (KOSPI/KOSDAQ) equities through Kiwoom OpenAPI+.
 * Auth: appkey + secretkey → OAuth2 Bearer token (24-hour TTL, auto-renewed).
 *
 * Paper trading uses mockapi.kiwoom.com; live uses api.kiwoom.com.
 * Both environments share the same API surface and WebSocket endpoint.
 *
 * Order flow:
 *   placeOrder() → POST /api/dostk/ordr (kt10000/kt10001) → orderId
 *   Real-time fill: WebSocket "00" push → emits internally (not yet wired
 *   to OpenAlice event bus; Phase 3 will add that bridge).
 */

import { z } from 'zod'
import Decimal from 'decimal.js'
import {
  Contract,
  ContractDescription,
  ContractDetails,
  Order,
  OrderState,
  UNSET_DECIMAL,
  type OrderCancel,
} from '@traderalice/ibkr'
import {
  BrokerError,
  type IBroker,
  type AccountCapabilities,
  type AccountInfo,
  type Position,
  type PlaceOrderResult,
  type OpenOrder,
  type Quote,
  type MarketClock,
  type TpSlParams,
} from '../types.js'
import '../../contract-ext.js'
import { buildPosition } from '../contract-builder.js'
import { KiwoomRestClient } from './KiwoomRestClient.js'
import { KiwoomWsClient } from './KiwoomWsClient.js'
import {
  buildKrxContract,
  ibkrOrderTypeToKiwoom,
  makeKiwoomOrderState,
  parseKiwoomAmount,
  parsePrice,
  formatOrderPrice,
} from './kiwoom-mappers.js'
import type {
  KiwoomBrokerConfig,
  KiwoomStockPosition,
  KiwoomSettledPosition,
  KiwoomUnfilledOrder,
} from './kiwoom-types.js'

export class KiwoomBroker implements IBroker {
  // ==================== Self-registration ====================

  static configSchema = z.object({
    paper:     z.boolean().default(true),
    appkey:    z.string().min(1),
    secretkey: z.string().min(1),
  })

  static fromConfig(config: { id: string; label?: string; brokerConfig: Record<string, unknown> }): KiwoomBroker {
    const bc = KiwoomBroker.configSchema.parse(config.brokerConfig)
    return new KiwoomBroker(config.id, config.label ?? '키움증권', bc)
  }

  // ==================== Fields ====================

  readonly id: string
  readonly label: string

  private readonly cfg: KiwoomBrokerConfig
  private readonly rest: KiwoomRestClient
  private ws: KiwoomWsClient | null = null

  private constructor(id: string, label: string, cfg: KiwoomBrokerConfig) {
    this.id    = id
    this.label = label
    this.cfg   = cfg
    this.rest  = new KiwoomRestClient(cfg)
  }

  // ==================== Lifecycle ====================

  async init(): Promise<void> {
    // Validate credentials by fetching a token
    await this.rest.ensureToken()
    // Wire up WebSocket for real-time order fills
    this.ws = new KiwoomWsClient(
      this.rest.wsBaseUrl,
      () => this.rest.getToken(),
    )
    await this.ws.connect()
  }

  async close(): Promise<void> {
    this.ws?.disconnect()
    this.ws = null
    await this.rest.revokeToken()
  }

  // ==================== Contract search ====================

  /**
   * Kiwoom REST API has no symbol-name fuzzy search endpoint.
   * We attempt to resolve `pattern` as a 6-digit stock code directly.
   * If it looks like a code (numeric), call ka10001 to verify existence.
   */
  async searchContracts(pattern: string): Promise<ContractDescription[]> {
    const code = pattern.trim().replace(/^A/, '')
    if (!/^\d{1,6}$/.test(code)) {
      // Non-numeric: return empty — callers can fall back to market-data search
      return []
    }
    const paddedCode = code.padStart(6, '0')
    try {
      const info = await this.rest.post<{ stk_nm: string; return_code: number; return_msg: string }>(
        'ka10001', '/api/dostk/stkinfo', { stk_cd: paddedCode },
      )
      const contract = buildKrxContract(paddedCode, info.stk_nm)
      const desc = new ContractDescription()
      desc.contract = contract
      return [desc]
    } catch {
      return []
    }
  }

  async getContractDetails(query: Contract): Promise<ContractDetails | null> {
    const code = query.localSymbol ?? query.symbol ?? ''
    if (!code) return null
    try {
      const info = await this.rest.post<{
        stk_nm: string; cur_prc: string; fav: string;
        per: string; eps: string; bps: string; pbr: string;
        upl_pric: string; lst_pric: string; return_code: number; return_msg: string
      }>('ka10001', '/api/dostk/stkinfo', { stk_cd: code })

      const contract = buildKrxContract(code, info.stk_nm)
      return {
        contract,
        longName: info.stk_nm,
        minTick: 1,
        priceMagnifier: 1,
        validExchanges: 'KRX',
        tradingHours: 'KST:0900-1530',
        liquidHours: 'KST:0900-1530',
        marketName: 'KRX',
        stockType: 'COMMON',
        industry: '',
        category: '',
        subcategory: '',
      } as unknown as ContractDetails
    } catch {
      return null
    }
  }

  // ==================== Account ====================

  async getAccount(): Promise<AccountInfo> {
    const overview = await this.rest.post<{
      entr: string; tot_est_amt: string; aset_evlt_amt: string;
      tot_pur_amt: string; lspft_amt: string; lspft_rt: string;
      ord_alow_amt?: string; pymn_alow_amt?: string;
      return_code: number; return_msg: string
    }>('kt00004', '/api/dostk/acnt', { qry_tp: '0', dmst_stex_tp: 'KRX' })

    // Also fetch balance for buying power (kt00001 has ord_alow_amt)
    const balance = await this.rest.post<{
      entr: string; ord_alow_amt: string; repl_amt: string;
      profa_ch: string; d2_entra?: string;
      return_code: number; return_msg: string
    }>('kt00001', '/api/dostk/acnt', { qry_tp: '3' }).catch(() => null)

    const netLiq   = parseKiwoomAmount(overview.tot_est_amt)
    const cash     = parseKiwoomAmount(overview.entr)
    const bpRaw    = balance?.ord_alow_amt ?? overview.ord_alow_amt ?? '0'
    const bp       = parseKiwoomAmount(bpRaw)
    const unrlPnL  = parseKiwoomAmount(overview.lspft_amt)

    return {
      baseCurrency:    'KRW',
      netLiquidation:  netLiq.toString(),
      totalCashValue:  cash.toString(),
      unrealizedPnL:   unrlPnL.toString(),
      buyingPower:     bp.toString(),
    }
  }

  // ==================== Positions ====================

  async getPositions(): Promise<Position[]> {
    const overview = await this.rest.post<{
      stk_acnt_evlt_prst: KiwoomStockPosition[];
      return_code: number; return_msg: string
    }>('kt00004', '/api/dostk/acnt', { qry_tp: '0', dmst_stex_tp: 'KRX' })

    return overview.stk_acnt_evlt_prst
      .filter(p => parseKiwoomAmount(p.rmnd_qty).gt(0))
      .map(p => this.mapStockPosition(p))
  }

  private mapStockPosition(p: KiwoomStockPosition): Position {
    const qty      = parseKiwoomAmount(p.rmnd_qty)
    const avgCost  = parseKiwoomAmount(p.avg_prc)
    const curPrice = parseKiwoomAmount(p.cur_prc)
    const evltAmt  = parseKiwoomAmount(p.evlt_amt)
    const plAmt    = parseKiwoomAmount(p.pl_amt)
    const contract = buildKrxContract(p.stk_cd, p.stk_nm)

    return buildPosition({
      contract,
      currency:      'KRW',
      side:          'long',   // KRX cash equity: always long
      quantity:      qty,
      avgCost:       avgCost.toString(),
      marketPrice:   curPrice.abs().toString(),
      realizedPnL:   '0',
      multiplier:    '1',
      marketValue:   evltAmt.toString(),
      unrealizedPnL: plAmt.toString(),
      avgCostSource: 'broker',
    })
  }

  // ==================== Orders ====================

  async placeOrder(contract: Contract, order: Order, _tpsl?: TpSlParams): Promise<PlaceOrderResult> {
    const code = contract.localSymbol ?? contract.symbol ?? ''
    if (!code) return { success: false, error: 'Contract has no symbol' }

    const trde_tp = ibkrOrderTypeToKiwoom(order.orderType ?? 'LMT')
    if (!trde_tp) {
      return { success: false, error: `Unsupported order type for KRX: ${order.orderType}` }
    }

    const isBuy = order.action === 'BUY'
    const apiId = isBuy ? 'kt10000' : 'kt10001'
    const rawQty = order.totalQuantity instanceof Decimal ? order.totalQuantity.toNumber() : (order.totalQuantity ?? 0)
    const qty   = String(Math.abs(rawQty))
    const rawPx = order.lmtPrice instanceof Decimal ? order.lmtPrice.toNumber() : (order.lmtPrice ?? 0)
    const price = formatOrderPrice(rawPx, order.orderType ?? 'LMT')

    try {
      const res = await this.rest.post<{
        ord_no: string; dmst_stex_tp?: string;
        return_code: number; return_msg: string
      }>(apiId, '/api/dostk/ordr', {
        dmst_stex_tp: 'KRX',
        stk_cd: code,
        ord_qty: qty,
        ord_uv: price,
        trde_tp,
        cond_uv: '',
      })

      return {
        success: true,
        orderId: res.ord_no,
        message: res.return_msg,
      }
    } catch (err) {
      const be = BrokerError.from(err)
      return { success: false, error: be.message }
    }
  }

  async modifyOrder(orderId: string, changes: Partial<Order>): Promise<PlaceOrderResult> {
    const contract = (changes as Order & { contract?: Contract }).contract
    const code = contract?.localSymbol ?? contract?.symbol ?? ''
    if (!code) return { success: false, error: 'modifyOrder requires contract.symbol in changes' }

    const rawQty2 = changes.totalQuantity instanceof Decimal ? changes.totalQuantity.toNumber() : (changes.totalQuantity ?? 0)
    const qty   = String(Math.abs(rawQty2))
    const rawPx2 = changes.lmtPrice instanceof Decimal ? changes.lmtPrice.toNumber() : (changes.lmtPrice ?? 0)
    const price = String(rawPx2)

    try {
      const res = await this.rest.post<{
        ord_no: string; return_code: number; return_msg: string
      }>('kt10002', '/api/dostk/ordr', {
        dmst_stex_tp: 'KRX',
        orig_ord_no: orderId.padStart(7, '0'),
        stk_cd: code,
        mdfy_qty: qty,
        mdfy_uv: price,
        mdfy_cond_uv: '',
      })
      return { success: true, orderId: res.ord_no, message: res.return_msg }
    } catch (err) {
      return { success: false, error: BrokerError.from(err).message }
    }
  }

  async cancelOrder(orderId: string, _orderCancel?: OrderCancel): Promise<PlaceOrderResult> {
    // We need the stock code to cancel; retrieve from unfilled orders
    const unfilled = await this.getUnfilledOrders()
    const target = unfilled.find(o => o.ord_no.replace(/^0+/, '') === orderId.replace(/^0+/, ''))
    if (!target) return { success: false, error: `Order ${orderId} not found in unfilled orders` }

    const code = target.stk_cd.startsWith('A') ? target.stk_cd.slice(1) : target.stk_cd

    try {
      const res = await this.rest.post<{
        ord_no: string; return_code: number; return_msg: string
      }>('kt10003', '/api/dostk/ordr', {
        dmst_stex_tp: 'KRX',
        orig_ord_no: orderId.padStart(7, '0'),
        stk_cd: code,
        cncl_qty: '0',   // 0 = 전체 취소
      })
      return { success: true, orderId: res.ord_no, message: res.return_msg }
    } catch (err) {
      return { success: false, error: BrokerError.from(err).message }
    }
  }

  async closePosition(contract: Contract, quantity?: Decimal): Promise<PlaceOrderResult> {
    const positions = await this.getPositions()
    const code = contract.localSymbol ?? contract.symbol ?? ''
    const pos = positions.find(p => (p.contract.localSymbol ?? p.contract.symbol) === code)
    if (!pos) return { success: false, error: `No open position for ${code}` }

    const sellQty = quantity ?? pos.quantity
    const sellOrder = new Order()
    sellOrder.action = 'SELL'
    sellOrder.orderType = 'MKT'
    sellOrder.totalQuantity = sellQty

    return this.placeOrder(contract, sellOrder)
  }

  // ==================== Query orders ====================

  async getOrders(orderIds: string[]): Promise<OpenOrder[]> {
    // Fetch order history (당일 전체)
    const res = await this.rest.post<{
      acnt_ord_cntr_prps_dtl: Array<{
        ord_no: string; stk_cd: string; stk_nm: string;
        trde_tp: string; io_tp_nm: string; ord_qty: string;
        ord_uv: string; cntr_qty: string; cntr_uv: string;
        ord_remnq: string; mdfy_cncl: string; dmst_stex_tp: string;
        ord_tm: string; ori_ord: string
      }>;
      return_code: number; return_msg: string
    }>('kt00007', '/api/dostk/acnt', {
      ord_dt: '',
      qry_tp: '1',
      stk_bond_tp: '0',
      sell_tp: '0',
      stk_cd: '',
      fr_ord_no: '',
      dmst_stex_tp: '%',
    })

    const items = res.acnt_ord_cntr_prps_dtl ?? []
    const filtered = orderIds.length > 0
      ? items.filter(o => orderIds.includes(o.ord_no.replace(/^0+/, '')))
      : items

    return filtered.map(o => {
      const contract = buildKrxContract(o.stk_cd, o.stk_nm)
      const isBuy = o.io_tp_nm.includes('매수')
      const order = new Order()
      order.orderId = parseInt(o.ord_no, 10)
      order.action = isBuy ? 'BUY' : 'SELL'
      order.orderType = o.trde_tp.includes('시장가') ? 'MKT' : 'LMT'
      order.totalQuantity = new Decimal(parseInt(o.ord_qty, 10) || 0)
      order.lmtPrice = new Decimal(parseInt(o.ord_uv, 10) || 0)

      const filledQty = parseInt(o.cntr_qty, 10) || 0
      const remQty    = parseInt(o.ord_remnq, 10) || 0
      const kiwoomStatus = filledQty > 0 && remQty === 0 ? '전체체결'
        : filledQty > 0 ? '부분체결' : '접수'
      const orderState = makeKiwoomOrderState(kiwoomStatus)

      return {
        contract,
        order,
        orderState,
        avgFillPrice: o.cntr_uv ? String(parsePrice(o.cntr_uv)) : undefined,
      } as OpenOrder
    })
  }

  async getOrder(orderId: string): Promise<OpenOrder | null> {
    const orders = await this.getOrders([orderId])
    return orders[0] ?? null
  }

  // ==================== Market data ====================

  async getQuote(contract: Contract): Promise<Quote> {
    const code = contract.localSymbol ?? contract.symbol ?? ''
    const info = await this.rest.post<{
      stk_nm: string; cur_prc: string; trde_qty: string;
      high_pric: string; low_pric: string;
      return_code: number; return_msg: string
    }>('ka10001', '/api/dostk/stkinfo', { stk_cd: code })

    const price = Math.abs(parsePrice(info.cur_prc))

    return {
      contract: buildKrxContract(code, info.stk_nm),
      last:   String(price),
      bid:    String(price),   // ka10001 doesn't return bid/ask; use last as proxy
      ask:    String(price),
      volume: String(Math.abs(parsePrice(info.trde_qty))),
      high:   info.high_pric ? String(Math.abs(parsePrice(info.high_pric))) : undefined,
      low:    info.low_pric  ? String(Math.abs(parsePrice(info.low_pric)))  : undefined,
      timestamp: new Date(),
    }
  }

  async getMarketClock(): Promise<MarketClock> {
    const now = new Date()
    // Convert to KST (UTC+9)
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const day  = kst.getDay()   // 0=Sun, 6=Sat
    const mins = kst.getHours() * 60 + kst.getMinutes()

    const isWeekday = day >= 1 && day <= 5
    // Regular session: 09:00 (540 min) ~ 15:30 (930 min)
    const isOpen = isWeekday && mins >= 540 && mins < 930

    // Calculate next open / close
    let nextOpen: Date | undefined
    let nextClose: Date | undefined

    if (isOpen) {
      // Close today at 15:30 KST
      nextClose = kstHHMM(kst, 15, 30)
    } else if (isWeekday && mins < 540) {
      // Opens today at 09:00
      nextOpen = kstHHMM(kst, 9, 0)
    } else {
      // Next weekday 09:00
      nextOpen = nextWeekdayOpen(kst)
    }

    return { isOpen, nextOpen, nextClose, timestamp: now }
  }

  // ==================== Capabilities & identity ====================

  getCapabilities(): AccountCapabilities {
    return {
      supportedSecTypes: ['STK'],
      supportedOrderTypes: ['MKT', 'LMT', 'STP'],
    }
  }

  getNativeKey(contract: Contract): string {
    return contract.localSymbol ?? contract.symbol ?? ''
  }

  resolveNativeKey(nativeKey: string): Contract {
    return buildKrxContract(nativeKey)
  }

  // ==================== Internal helpers ====================

  private async getUnfilledOrders(): Promise<KiwoomUnfilledOrder[]> {
    const res = await this.rest.post<{
      oso: KiwoomUnfilledOrder[];
      return_code: number; return_msg: string
    }>('ka10075', '/api/dostk/acnt', {
      all_stk_tp: '0',
      trde_tp: '0',
      stk_cd: '',
      stex_tp: '0',
    }).catch(() => ({ oso: [], return_code: 0, return_msg: '' }))
    return res.oso ?? []
  }
}

// ==================== Market clock helpers ====================

function kstHHMM(kstDate: Date, hour: number, minute: number): Date {
  const d = new Date(kstDate)
  d.setHours(hour, minute, 0, 0)
  // kstDate is in local (which may not be KST), but toLocaleString() already
  // converted so treat it as-is. Subtract 9h to get UTC.
  return new Date(d.getTime() - 9 * 3600 * 1000)
}

function nextWeekdayOpen(kst: Date): Date {
  const d = new Date(kst)
  d.setHours(9, 0, 0, 0)
  do {
    d.setDate(d.getDate() + 1)
  } while (d.getDay() === 0 || d.getDay() === 6)
  return new Date(d.getTime() - 9 * 3600 * 1000)
}
