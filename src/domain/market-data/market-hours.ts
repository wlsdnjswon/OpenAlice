/**
 * Market Hours — per-exchange open/close schedule and holiday calendars.
 *
 * All times are in the exchange's local timezone. `isOpen` checks convert
 * the query timestamp to the local timezone before comparing against the
 * session window.
 */

export interface MarketSession {
  /** Local time (HH:MM, 24h) */
  open: string
  close: string
}

export interface MarketHoursSpec {
  /** IANA timezone string */
  timezone: string
  /** Days open: 0=Sunday … 6=Saturday */
  tradingDays: number[]
  /** Regular session */
  session: MarketSession
  /** ISO date strings (YYYY-MM-DD) in the exchange's local date */
  holidays: string[]
}

// ==================== Exchange definitions ====================

/** KRX (KOSPI + KOSDAQ): 09:00 – 15:30 KST */
export const KRX_HOURS: MarketHoursSpec = {
  timezone: 'Asia/Seoul',
  tradingDays: [1, 2, 3, 4, 5],
  session: { open: '09:00', close: '15:30' },
  // 2026 Korean public holidays (official government calendar)
  holidays: [
    '2026-01-01', // New Year's Day
    '2026-01-28', // Lunar New Year's Eve
    '2026-01-29', // Lunar New Year (설날)
    '2026-01-30', // Lunar New Year Holiday
    '2026-03-01', // Independence Movement Day (삼일절)
    '2026-05-05', // Children's Day (어린이날)
    '2026-05-25', // Buddha's Birthday (부처님오신날)
    '2026-06-06', // Memorial Day (현충일)
    '2026-08-15', // Liberation Day (광복절)
    '2026-09-24', // Chuseok Eve
    '2026-09-25', // Chuseok (추석)
    '2026-09-26', // Chuseok Holiday
    '2026-10-03', // National Foundation Day (개천절)
    '2026-10-09', // Hangul Day (한글날)
    '2026-12-25', // Christmas
  ],
}

/** NYSE/NASDAQ: 09:30 – 16:00 ET */
export const NYSE_HOURS: MarketHoursSpec = {
  timezone: 'America/New_York',
  tradingDays: [1, 2, 3, 4, 5],
  session: { open: '09:30', close: '16:00' },
  // 2026 NYSE holidays
  holidays: [
    '2026-01-01', // New Year's Day
    '2026-01-19', // MLK Day
    '2026-02-16', // Presidents' Day
    '2026-04-03', // Good Friday
    '2026-05-25', // Memorial Day
    '2026-07-03', // Independence Day (observed)
    '2026-09-07', // Labor Day
    '2026-11-26', // Thanksgiving
    '2026-12-25', // Christmas
  ],
}

// ==================== Internal helpers ====================

interface LocalComponents {
  /** YYYY-MM-DD in the exchange timezone */
  date: string
  /** 0=Sun … 6=Sat in the exchange timezone */
  dayOfWeek: number
  /** Minutes since midnight in the exchange timezone */
  minuteOfDay: number
}

/**
 * Decompose a UTC timestamp into date/time components in a given IANA timezone.
 * Uses Intl.DateTimeFormat so it works without any manual UTC math.
 */
function toLocalComponents(ts: Date, timezone: string): LocalComponents {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })

  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(ts)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }

  // en-CA date: "YYYY-MM-DD"
  const date = `${parts.year}-${parts.month}-${parts.day}`

  // Weekday short in en-CA: "Mon", "Tue", …
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const dayOfWeek = weekdayMap[parts.weekday] ?? -1

  // hour/minute in 24h
  const h = parseInt(parts.hour === '24' ? '0' : parts.hour, 10)
  const m = parseInt(parts.minute, 10)
  const minuteOfDay = h * 60 + m

  return { date, dayOfWeek, minuteOfDay }
}

function sessionMinutes(session: MarketSession): { open: number; close: number } {
  const [oh, om] = session.open.split(':').map(Number)
  const [ch, cm] = session.close.split(':').map(Number)
  return { open: oh * 60 + om, close: ch * 60 + cm }
}

// ==================== Public API ====================

/**
 * Given a MarketHoursSpec and an optional timestamp (default: now),
 * return whether the market is currently open.
 */
export function isMarketOpen(spec: MarketHoursSpec, at?: Date): boolean {
  const ts = at ?? new Date()
  const { date, dayOfWeek, minuteOfDay } = toLocalComponents(ts, spec.timezone)

  if (!spec.tradingDays.includes(dayOfWeek)) return false
  if (spec.holidays.includes(date)) return false

  const { open, close } = sessionMinutes(spec.session)
  return minuteOfDay >= open && minuteOfDay < close
}

/**
 * Returns the next session open time (as a UTC Date) for the given spec.
 * Searches up to 14 days ahead to skip weekends + holidays.
 * Returns null only if no open day is found within 14 days (shouldn't happen).
 */
export function nextMarketOpen(spec: MarketHoursSpec, from?: Date): Date | null {
  const base = from ?? new Date()
  const { open: openMin } = sessionMinutes(spec.session)
  const [openH, openM] = spec.session.open.split(':').map(Number)

  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    // Advance to candidate day (noon UTC to avoid DST-boundary issues)
    const candidate = new Date(base.getTime() + dayOffset * 86_400_000)
    const { date, dayOfWeek } = toLocalComponents(candidate, spec.timezone)

    if (!spec.tradingDays.includes(dayOfWeek)) continue
    if (spec.holidays.includes(date)) continue

    // Build the open time: start at midnight UTC for that local date, then
    // use a bisection trick — add the UTC offset by finding when the local
    // time equals the open time.
    const [y, mo, d] = date.split('-').map(Number)

    // Construct the open moment by adjusting: try midnight UTC of that date
    // then nudge by the UTC offset to land at open time in the local tz.
    const midnightUtc = Date.UTC(y, mo - 1, d, 0, 0, 0)

    // Find UTC ms for the open time in the local tz by searching within ±14h
    // of the nominal "midnight UTC + openH hours + openM minutes"
    const nominalUtcMs = midnightUtc + (openH * 60 + openM) * 60_000
    const openUtc = bisectLocalTime(spec.timezone, date, openMin, nominalUtcMs)
    if (openUtc === null) continue
    if (openUtc > base) return openUtc
  }
  return null
}

/**
 * Binary-search for the UTC millisecond where local time in `timezone`
 * equals `targetMinuteOfDay` on `targetLocalDate`.
 */
function bisectLocalTime(
  timezone: string,
  targetLocalDate: string,
  targetMinuteOfDay: number,
  seedUtcMs: number,
): Date | null {
  let lo = seedUtcMs - 14 * 3_600_000 // ±14h around seed
  let hi = seedUtcMs + 14 * 3_600_000

  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2)
    const { date, minuteOfDay } = toLocalComponents(new Date(mid), timezone)
    if (date !== targetLocalDate) {
      // Wrong calendar day — push toward seed
      if (mid < seedUtcMs) lo = mid
      else hi = mid
      continue
    }
    if (Math.abs(minuteOfDay - targetMinuteOfDay) <= 0) return new Date(mid)
    if (minuteOfDay < targetMinuteOfDay) lo = mid + 60_000
    else hi = mid
  }
  // Fallback: return closest within tolerance (within 2 minutes)
  const candidate = new Date(Math.floor((lo + hi) / 2))
  const { minuteOfDay } = toLocalComponents(candidate, timezone)
  if (Math.abs(minuteOfDay - targetMinuteOfDay) <= 2) return candidate
  return null
}
