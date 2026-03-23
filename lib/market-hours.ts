/**
 * Market Hours Awareness
 *
 * Timezone-aware market session detection for US and Indian markets.
 * Pure functions — deterministic and testable with injectable clock.
 */

export type MarketId = "US" | "IN"

export interface MarketSession {
  market: MarketId
  name: string
  timezone: string
  /** Is the market currently open? */
  isOpen: boolean
  /** Current status label */
  status: "open" | "pre-market" | "after-hours" | "closed"
  /** Human-readable status string */
  statusLabel: string
  /** Time until next open/close event, in minutes */
  minutesUntilChange: number
  /** Spread multiplier for closed-market simulation */
  spreadMultiplier: number
}

interface MarketSchedule {
  name: string
  timezone: string
  /** Open time as [hour, minute] in market's local timezone */
  openTime: [number, number]
  /** Close time as [hour, minute] in market's local timezone */
  closeTime: [number, number]
  /** Pre-market start [hour, minute] — US only */
  preMarketStart?: [number, number]
  /** After-hours end [hour, minute] — US only */
  afterHoursEnd?: [number, number]
  /** Days open (0=Sun, 1=Mon, ..., 6=Sat) */
  tradingDays: number[]
}

const SCHEDULES: Record<MarketId, MarketSchedule> = {
  US: {
    name: "NYSE / NASDAQ",
    timezone: "America/New_York",
    openTime: [9, 30],
    closeTime: [16, 0],
    preMarketStart: [4, 0],
    afterHoursEnd: [20, 0],
    tradingDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  IN: {
    name: "NSE / BSE",
    timezone: "Asia/Kolkata",
    openTime: [9, 15],
    closeTime: [15, 30],
    tradingDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
}

/**
 * Get the current time in a specific timezone.
 * Injectable `now` for testing.
 */
function getLocalTime(timezone: string, now: Date = new Date()): {
  hour: number
  minute: number
  dayOfWeek: number
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const hour = Number(parts.find(p => p.type === "hour")?.value ?? 0)
  const minute = Number(parts.find(p => p.type === "minute")?.value ?? 0)
  const weekdayStr = parts.find(p => p.type === "weekday")?.value ?? "Mon"

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const dayOfWeek = dayMap[weekdayStr] ?? 1

  return { hour, minute, dayOfWeek }
}

function timeToMinutes(h: number, m: number): number {
  return h * 60 + m
}

/**
 * Get market session status for a given market.
 * Injectable `now` for deterministic testing.
 */
export function getMarketSession(
  market: MarketId,
  now: Date = new Date(),
): MarketSession {
  const schedule = SCHEDULES[market]
  const local = getLocalTime(schedule.timezone, now)
  const currentMinutes = timeToMinutes(local.hour, local.minute)
  const openMinutes = timeToMinutes(...schedule.openTime)
  const closeMinutes = timeToMinutes(...schedule.closeTime)

  const isTradingDay = schedule.tradingDays.includes(local.dayOfWeek)

  if (!isTradingDay) {
    return {
      market,
      name: schedule.name,
      timezone: schedule.timezone,
      isOpen: false,
      status: "closed",
      statusLabel: "Closed — Weekend",
      minutesUntilChange: minutesUntilNextTradingDay(local.dayOfWeek, openMinutes, currentMinutes, schedule.tradingDays),
      spreadMultiplier: 3,
    }
  }

  // During regular trading hours
  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return {
      market,
      name: schedule.name,
      timezone: schedule.timezone,
      isOpen: true,
      status: "open",
      statusLabel: `Open — closes in ${closeMinutes - currentMinutes}m`,
      minutesUntilChange: closeMinutes - currentMinutes,
      spreadMultiplier: 1,
    }
  }

  // US-specific: pre-market and after-hours
  if (market === "US") {
    const preStart = timeToMinutes(...schedule.preMarketStart!)
    const afterEnd = timeToMinutes(...schedule.afterHoursEnd!)

    if (currentMinutes >= preStart && currentMinutes < openMinutes) {
      return {
        market,
        name: schedule.name,
        timezone: schedule.timezone,
        isOpen: false,
        status: "pre-market",
        statusLabel: `Pre-market — opens in ${openMinutes - currentMinutes}m`,
        minutesUntilChange: openMinutes - currentMinutes,
        spreadMultiplier: 2.5,
      }
    }

    if (currentMinutes >= closeMinutes && currentMinutes < afterEnd) {
      return {
        market,
        name: schedule.name,
        timezone: schedule.timezone,
        isOpen: false,
        status: "after-hours",
        statusLabel: `After-hours — wider spreads`,
        minutesUntilChange: afterEnd - currentMinutes,
        spreadMultiplier: 2.5,
      }
    }
  }

  // Closed
  const minutesUntilOpen = currentMinutes < openMinutes
    ? openMinutes - currentMinutes
    : (24 * 60 - currentMinutes) + openMinutes

  return {
    market,
    name: schedule.name,
    timezone: schedule.timezone,
    isOpen: false,
    status: "closed",
    statusLabel: `Closed — opens in ${minutesUntilOpen}m`,
    minutesUntilChange: minutesUntilOpen,
    spreadMultiplier: 3,
  }
}

function minutesUntilNextTradingDay(
  currentDay: number,
  openMinutes: number,
  currentMinutes: number,
  tradingDays: number[],
): number {
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (currentDay + offset) % 7
    if (tradingDays.includes(nextDay)) {
      return (offset * 24 * 60) - currentMinutes + openMinutes
    }
  }
  return 24 * 60 // fallback: 1 day
}
