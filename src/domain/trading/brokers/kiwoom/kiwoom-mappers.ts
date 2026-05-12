/**
 * kiwoom-mappers — Kiwoom API response → IBroker domain types.
 *
 * Responsibilities:
 *  - KRX 호가 단위(tick size) rounding for limit orders
 *  - IBKR orderType → Kiwoom trde_tp mapping
 *  - Kiwoom order status → IBKR OrderStatus mapping
 *  - Stock code → Contract building
 */

import Decimal from 'decimal.js'
import { Contract, OrderState } from '@traderalice/ibkr'
import type { KiwoomTradeType } from './kiwoom-types.js'
import { buildContract } from '../contract-builder.js'

// ==================== Tick size (호가 단위) ====================

/**
 * Round a price to the nearest KRX tick size.
 * Applies only to KOSPI/KOSDAQ regular session orders.
 * Source: KRX market operation rules.
 */
export function roundToTickSize(price: number): number {
  if (price < 1_000)    return Math.round(price / 1) * 1
  if (price < 5_000)    return Math.round(price / 5) * 5
  if (price < 10_000)   return Math.round(price / 10) * 10
  if (price < 50_000)   return Math.round(price / 50) * 50
  if (price < 100_000)  return Math.round(price / 100) * 100
  if (price < 500_000)  return Math.round(price / 500) * 500
  return Math.round(price / 1_000) * 1_000
}

// ==================== Order type mapping ====================

/**
 * IBKR orderType → Kiwoom trde_tp.
 * Returns null when the IBKR type has no KRX equivalent.
 */
export function ibkrOrderTypeToKiwoom(orderType: string): KiwoomTradeType | null {
  switch (orderType) {
    case 'MKT':     return '03'  // 시장가
    case 'LMT':     return '00'  // 지정가
    case 'STP':     return '05'  // 조건부지정가 (closest analogue)
    case 'MOC':     return '03'  // market-on-close → 시장가
    case 'LOC':     return '62'  // limit-on-close → 시간외단일가
    default:        return null
  }
}

// ==================== Order status mapping ====================

/**
 * Kiwoom order status string → IBKR OrderState status string.
 * Values from WS "00" type field 913: "접수", "체결", "확인", "거부", "취소"
 * and REST kt00075 ord_stt field.
 */
export function kiwoomStatusToIbkr(status: string): string {
  const s = status.trim()
  if (s.includes('체결') || s === '전체체결') return 'Filled'
  if (s.includes('접수') || s.includes('주문')) return 'Submitted'
  if (s.includes('확인'))  return 'PreSubmitted'
  if (s.includes('취소'))  return 'Cancelled'
  if (s.includes('거부') || s.includes('거절')) return 'Inactive'
  return 'Submitted'
}

/** Create an IBKR OrderState from a Kiwoom status string. */
export function makeKiwoomOrderState(kiwoomStatus: string): OrderState {
  const s = new OrderState()
  s.status = kiwoomStatusToIbkr(kiwoomStatus)
  return s
}

// ==================== Contract building ====================

/**
 * Build an IBKR Contract from a Kiwoom stock code.
 * All KRX stocks are secType='STK', exchange='KRX', currency='KRW'.
 */
export function buildKrxContract(rawCode: string, stockName?: string): Contract {
  const code = rawCode.startsWith('A') ? rawCode.slice(1) : rawCode
  return buildContract({
    symbol: code,
    localSymbol: code,
    secType: 'STK',
    exchange: 'KRX',
    currency: 'KRW',
    ...(stockName && { description: stockName }),
  })
}

// ==================== Price parsing ====================

/**
 * Parse a Kiwoom monetary string to a Decimal.
 * Handles zero-padded ("000000124500") and sign-prefixed ("+60700", "-60150").
 */
export function parseKiwoomAmount(s: string): Decimal {
  if (!s || s.trim() === '') return new Decimal(0)
  // Remove leading zeros after optional sign
  const cleaned = s.replace(/\s/g, '')
  return new Decimal(cleaned)
}

/**
 * Parse a price string that may include sign prefix.
 * e.g. "+86800" → 86800, "-60150" → -60150
 */
export function parsePrice(s: string): number {
  return parseInt(s.replace(/\s/g, ''), 10) || 0
}

/**
 * Format a number as a Kiwoom order price string.
 * Limit orders need a price; market orders pass "".
 */
export function formatOrderPrice(price: number, orderType: string): string {
  if (orderType === 'MKT' || orderType === 'MOC') return ''
  return String(roundToTickSize(price))
}
