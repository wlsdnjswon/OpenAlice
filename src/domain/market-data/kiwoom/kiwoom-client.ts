/**
 * Kiwoom REST API client.
 * Handles token injection, pagination (cont-yn / next-key headers),
 * and wraps the KRX-specific endpoints used by OpenAlice.
 *
 * All methods return empty arrays / objects gracefully when the API
 * is unreachable or credentials are missing.
 */

import type { KiwoomAuth } from './kiwoom-auth.js'

const BASE_URL = 'https://api.kiwoom.com'
const MAX_PAGES = 10 // safety cap for paginated calls

// ─── Low-level request helper ────────────────────────────────────────────────

interface KiwoomResponse<T> {
  data: T
  contYn: string
  nextKey: string
  returnCode?: number
  returnMsg?: string
}

async function callKiwoom<T>(
  auth: KiwoomAuth,
  apiId: string,
  urlPath: string,
  body: Record<string, unknown>,
  contYn = 'N',
  nextKey = '',
): Promise<KiwoomResponse<T>> {
  const token = await auth.getToken()
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: 'POST',
    headers: {
      'api-id': apiId,
      'authorization': `Bearer ${token}`,
      'cont-yn': contYn,
      'next-key': nextKey,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Kiwoom ${apiId} failed: ${res.status} ${text}`)
  }

  const data = await res.json() as T & { return_code?: number; return_msg?: string }

  // Kiwoom can return HTTP 200 with a non-zero return_code for API-level errors
  // (invalid symbol, insufficient permissions, etc.). Fail fast so callers see the real error.
  if (data.return_code !== undefined && data.return_code !== 0) {
    throw new Error(`Kiwoom ${apiId} API error ${data.return_code}: ${data.return_msg ?? 'unknown'}`)
  }

  return {
    data,
    contYn: res.headers.get('cont-yn') ?? 'N',
    nextKey: res.headers.get('next-key') ?? '',
    returnCode: data.return_code,
    returnMsg: data.return_msg,
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KrxStockEntry {
  code: string       // 6-digit code
  name: string
  listCount: string
  auditInfo: string
  regDay: string
  lastPrice: string
  state: string
  marketCode: string
  marketName: string // "코스피" | "코스닥"
  upName: string     // sector
  upSizeName: string
}

export interface ForeignFlowRow {
  dt: string          // YYYYMMDD
  close_pric: string
  pred_pre: string    // 전일대비
  trde_qty: string
  chg_qty: string     // 변동수량
  poss_stkcnt: string // 보유주식수
  wght: string        // 비중 %
  gain_pos_stkcnt: string
  frgnr_limit: string
  frgnr_limit_irds: string
  limit_exh_rt: string // 한도소진율
}

export interface InstitTrendRow {
  dt: string
  close_pric: string
  pre_sig: string
  pred_pre: string
  flu_rt: string             // 등락율
  trde_qty: string
  orgn_dt_acc: string        // 기관기간누적
  orgn_daly_nettrde_qty: string // 기관일별순매매수량
  for_dt_acc: string         // 외인기간누적
  for_daly_nettrde_qty: string  // 외인일별순매매수량
  limit_exh_rt: string       // 한도소진율
}

export interface ThemeGroup {
  thema_grp_cd: string
  thema_nm: string
  stk_num: string
  flu_sig: string
  flu_rt?: string
  dt_prft_rt?: string
}

export interface StockBasicInfo {
  stk_cd: string
  stk_nm: string
  per: string          // PER
  eps: string          // EPS
  roe: string          // ROE
  pbr: string          // PBR
  bps: string          // BPS
  mac: string          // 시가총액
  mac_wght: string     // 시가총액비중
  crd_rt: string       // 신용비율
  for_exh_rt: string   // 외인소진률
  oyr_hgst: string     // 연중최고
  oyr_lwst: string     // 연중최저
  '250hgst'?: string   // 250일 최고 (≈ 52주 최고)
  '250lwst'?: string   // 250일 최저 (≈ 52주 최저)
  flo_stk: string      // 상장주식수
  base_pric: string    // 기준가
  upl_pric: string     // 상한가
  lst_pric: string     // 하한가
  open_pric: string    // 시가
  high_pric: string    // 고가
  low_pric: string     // 저가
  sale_amt: string     // 매출액
  bus_pro: string      // 영업이익
  cup_nga: string      // 당기순이익
}

export interface ShortSellingRow {
  dt: string
  close_pric: string
  trde_qty: string        // 거래량
  shrts_qty: string       // 공매도량
  ovr_shrts_qty: string   // 누적공매도량
  trde_wght: string       // 매매비중(%)
  shrts_trde_prica: string // 공매도거래대금
}

export interface CreditTrendRow {
  dt: string
  cur_prc: string
  trde_qty: string   // 거래량
  new: string        // 신규(융자신규)
  rpya: string       // 상환
  remn: string       // 잔고
  remn_rt: string    // 잔고율
}

export interface ExecutionStrengthDailyRow {
  dt: string
  cur_prc: string
  trde_qty: string       // 거래량
  cntr_str: string       // 체결강도
  cntr_str_5min: string  // 체결강도5일
  cntr_str_20min: string // 체결강도20일
  cntr_str_60min: string // 체결강도60일
}

export interface InvestorDetailRow {
  dt: string
  cur_prc: string
  flu_rt: string         // 등락율
  acc_trde_qty: string   // 누적거래량
  acc_trde_prica: string // 누적거래대금
  ind_invsr: string      // 개인투자자
  frgnr_invsr: string    // 외국인투자자
  orgn: string           // 기관계
  fnnc_invt: string      // 금융투자
  insrnc: string         // 보험
  invtrt: string         // 투신
  bank: string           // 은행
  etc_fnnc: string       // 기타금융
}

// ─── KiwoomClient ─────────────────────────────────────────────────────────────

export class KiwoomClient {
  constructor(private auth: KiwoomAuth) {}

  /**
   * ka10099 — fetch full stock list for a market.
   * mrkt_tp: "0" = KOSPI, "10" = KOSDAQ
   * Paginates automatically; returns all entries.
   */
  async getStockList(mrktTp: '0' | '10'): Promise<KrxStockEntry[]> {
    const entries: KrxStockEntry[] = []
    let contYn = 'N'
    let nextKey = ''

    for (let page = 0; page < MAX_PAGES; page++) {
      const r = await callKiwoom<{ list?: KrxStockEntry[] }>(
        this.auth, 'ka10099', '/api/dostk/stkinfo',
        { mrkt_tp: mrktTp },
        contYn, nextKey,
      )
      const batch = r.data.list ?? []
      entries.push(...batch)
      if (r.contYn !== 'Y' || !r.nextKey) break
      contYn = 'Y'
      nextKey = r.nextKey
    }
    return entries
  }

  /**
   * ka10008 — 주식외국인종목별매매동향.
   * stk_cd: 6-digit code (e.g. "005930")
   */
  async getForeignFlow(stkCd: string): Promise<ForeignFlowRow[]> {
    const r = await callKiwoom<{ stk_frgnr?: ForeignFlowRow[] }>(
      this.auth, 'ka10008', '/api/dostk/frgnistt',
      { stk_cd: stkCd },
    )
    return r.data.stk_frgnr ?? []
  }

  /**
   * ka10045 — 종목별기관매매추이요청.
   * Returns per-day institutional + foreign combined trend.
   */
  async getInstitTrend(
    stkCd: string,
    strtDt: string, // YYYYMMDD
    endDt: string,  // YYYYMMDD
  ): Promise<{ rows: InstitTrendRow[]; orgnAvg: string; forAvg: string }> {
    const r = await callKiwoom<{
      orgn_prsm_avg_pric?: string
      for_prsm_avg_pric?: string
      stk_orgn_trde_trnsn?: InstitTrendRow[]
    }>(
      this.auth, 'ka10045', '/api/dostk/mrkcond',
      { stk_cd: stkCd, strt_dt: strtDt, end_dt: endDt, orgn_prsm_unp_tp: '1', for_prsm_unp_tp: '1' },
    )
    return {
      rows: r.data.stk_orgn_trde_trnsn ?? [],
      orgnAvg: r.data.orgn_prsm_avg_pric ?? '',
      forAvg: r.data.for_prsm_avg_pric ?? '',
    }
  }

  /**
   * ka90001 — 테마그룹별요청 (stock search mode).
   * Finds theme groups that contain the given stock code.
   */
  async getThemesByStock(stkCd: string): Promise<ThemeGroup[]> {
    const r = await callKiwoom<{ thema_grp?: ThemeGroup[] }>(
      this.auth, 'ka90001', '/api/dostk/thme',
      { qry_tp: '2', stk_cd: stkCd, date_tp: '20', flu_pl_amt_tp: '1', stex_tp: '1' },
    )
    return r.data.thema_grp ?? []
  }

  /**
   * ka10001 — 주식기본정보요청.
   * Returns PER, EPS, ROE, PBR, 시가총액, 신용비율, 외인소진률, 52주 고저 등.
   */
  async getStockBasicInfo(stkCd: string): Promise<StockBasicInfo | null> {
    const r = await callKiwoom<StockBasicInfo>(
      this.auth, 'ka10001', '/api/dostk/stkinfo',
      { stk_cd: stkCd },
    )
    return r.data.stk_cd ? r.data : null
  }

  /**
   * ka10014 — 공매도추이요청.
   * Returns short selling volume, amount, and ratio per day.
   * strtDt/endDt: YYYYMMDD
   */
  async getShortSelling(
    stkCd: string,
    strtDt: string,
    endDt: string,
  ): Promise<ShortSellingRow[]> {
    const r = await callKiwoom<{ shrts_trnsn?: ShortSellingRow[] }>(
      this.auth, 'ka10014', '/api/dostk/shsa',
      { stk_cd: stkCd, tm_tp: '1', strt_dt: strtDt, end_dt: endDt },
    )
    return r.data.shrts_trnsn ?? []
  }

  /**
   * ka10013 — 신용매매동향요청.
   * qryTp: '1' = 융자, '2' = 대주. Returns credit balance trend.
   */
  async getCreditTrend(
    stkCd: string,
    dt: string, // YYYYMMDD
    qryTp: '1' | '2' = '1',
  ): Promise<CreditTrendRow[]> {
    const r = await callKiwoom<{ crd_trde_trend?: CreditTrendRow[] }>(
      this.auth, 'ka10013', '/api/dostk/stkinfo',
      { stk_cd: stkCd, dt, qry_tp: qryTp },
    )
    return r.data.crd_trde_trend ?? []
  }

  /**
   * ka10047 — 체결강도추이일별요청.
   * Returns daily execution strength (매수체결량/매도체결량 ratio) + 5/20/60-day averages.
   */
  async getExecutionStrengthDaily(stkCd: string): Promise<ExecutionStrengthDailyRow[]> {
    const r = await callKiwoom<{ cntr_str_daly?: ExecutionStrengthDailyRow[] }>(
      this.auth, 'ka10047', '/api/dostk/mrkcond',
      { stk_cd: stkCd },
    )
    return r.data.cntr_str_daly ?? []
  }

  /**
   * ka10059 — 종목별투자자기관별요청.
   * Returns per-day net buy/sell breakdown by investor type (개인/외국인/기관/금융투자/보험/투신/은행).
   * amtQtyTp: '1' = 금액, '2' = 수량
   * trdeTp: '0' = 순매수, '1' = 매수, '2' = 매도
   */
  async getInvestorDetail(
    stkCd: string,
    dt: string, // YYYYMMDD
    amtQtyTp: '1' | '2' = '1',
    trdeTp: '0' | '1' | '2' = '0',
  ): Promise<InvestorDetailRow[]> {
    const r = await callKiwoom<{ stk_invsr_orgn?: InvestorDetailRow[] }>(
      this.auth, 'ka10059', '/api/dostk/stkinfo',
      { stk_cd: stkCd, dt, amt_qty_tp: amtQtyTp, trde_tp: trdeTp, unit_tp: '1000' },
    )
    return r.data.stk_invsr_orgn ?? []
  }
}
