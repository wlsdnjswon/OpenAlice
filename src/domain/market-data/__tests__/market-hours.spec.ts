import { describe, it, expect } from 'vitest'
import { KRX_HOURS, NYSE_HOURS, isMarketOpen, nextMarketOpen } from '../market-hours.js'

// Helper: construct a Date at a specific Seoul local time on a given date
function seoulTime(dateStr: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  // Build a UTC timestamp that corresponds to the given Seoul local time (UTC+9)
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h - 9, m))
}

describe('KRX_HOURS spec', () => {
  it('has correct timezone', () => {
    expect(KRX_HOURS.timezone).toBe('Asia/Seoul')
  })

  it('trades Mon–Fri only', () => {
    expect(KRX_HOURS.tradingDays).toEqual([1, 2, 3, 4, 5])
  })

  it('session is 09:00–15:30', () => {
    expect(KRX_HOURS.session.open).toBe('09:00')
    expect(KRX_HOURS.session.close).toBe('15:30')
  })

  it('includes Liberation Day holiday', () => {
    expect(KRX_HOURS.holidays).toContain('2026-08-15')
  })
})

describe('isMarketOpen — KRX', () => {
  it('is open at 10:00 KST on a regular Tuesday', () => {
    // 2026-01-06 is a Tuesday, not a holiday
    const t = seoulTime('2026-01-06', '10:00')
    expect(isMarketOpen(KRX_HOURS, t)).toBe(true)
  })

  it('is closed before open (08:59 KST)', () => {
    const t = seoulTime('2026-01-06', '08:59')
    expect(isMarketOpen(KRX_HOURS, t)).toBe(false)
  })

  it('is closed after close (15:30 KST)', () => {
    const t = seoulTime('2026-01-06', '15:30')
    expect(isMarketOpen(KRX_HOURS, t)).toBe(false)
  })

  it('is open at exactly 09:00 KST', () => {
    const t = seoulTime('2026-01-06', '09:00')
    expect(isMarketOpen(KRX_HOURS, t)).toBe(true)
  })

  it('is closed on Saturday', () => {
    // 2026-01-03 is a Saturday
    const t = seoulTime('2026-01-03', '10:00')
    expect(isMarketOpen(KRX_HOURS, t)).toBe(false)
  })

  it('is closed on Sunday', () => {
    // 2026-01-04 is a Sunday
    const t = seoulTime('2026-01-04', '10:00')
    expect(isMarketOpen(KRX_HOURS, t)).toBe(false)
  })

  it('is closed on Liberation Day (2026-08-15, Saturday would be anyway)', () => {
    // 2026-08-15 is a Saturday; but the holiday list is the extra guard
    // Pick a year where Liberation Day falls on a weekday to test the holiday path
    // 2025-08-15 is a Friday — use a Friday to test holiday closure
    const spec = { ...KRX_HOURS, holidays: ['2025-08-15'] }
    const t = seoulTime('2025-08-15', '10:00')
    expect(isMarketOpen(spec, t)).toBe(false)
  })

  it('is closed on Lunar New Year', () => {
    const t = seoulTime('2026-01-29', '10:00')
    expect(isMarketOpen(KRX_HOURS, t)).toBe(false)
  })
})

describe('isMarketOpen — NYSE', () => {
  it('is open at 10:00 ET on a regular Wednesday', () => {
    // 2026-01-07 is a Wednesday
    const nyc = new Date('2026-01-07T15:00:00Z') // 10:00 ET (UTC-5)
    expect(isMarketOpen(NYSE_HOURS, nyc)).toBe(true)
  })

  it('is closed before NYSE open (09:29 ET)', () => {
    const nyc = new Date('2026-01-07T14:29:00Z') // 09:29 ET
    expect(isMarketOpen(NYSE_HOURS, nyc)).toBe(false)
  })
})

describe('nextMarketOpen', () => {
  it('returns next Monday morning if called on Friday after close', () => {
    // 2026-01-09 is a Friday; after KRX close
    const friday = seoulTime('2026-01-09', '16:00')
    const next = nextMarketOpen(KRX_HOURS, friday)
    expect(next).not.toBeNull()
    // Next open should be Monday 2026-01-12 at 09:00 KST
    const nextStr = next!.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    expect(nextStr).toBe('2026-01-12')
  })

  it('skips holidays', () => {
    // 2026-01-28 is Lunar New Year Eve (Wednesday, holiday)
    // 2026-01-29 is Lunar New Year (Thursday, holiday)
    // 2026-01-30 is Lunar New Year holiday (Friday, holiday)
    // Next open should be 2026-01-31 (Saturday is skipped) → 2026-02-02 (Monday)
    // Wait, 2026-01-31 is Saturday so next open is 2026-02-02 Monday
    const beforeHolidays = seoulTime('2026-01-27', '16:00')
    const next = nextMarketOpen(KRX_HOURS, beforeHolidays)
    expect(next).not.toBeNull()
    const nextStr = next!.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    // 2026-01-28 (Wed, holiday), 01-29 (Thu, holiday), 01-30 (Fri, holiday),
    // 01-31 (Sat, skip), 02-01 (Sun, skip), 02-02 (Mon) → first open
    expect(nextStr).toBe('2026-02-02')
  })
})
