/**
 * Enforceable Trading Challenges
 *
 * Active constraints that validate before trade execution.
 * If a challenge is active and the trade would violate it, the trade is blocked.
 * Pure functions — no side effects.
 */

import type { TradeWithCoaching } from "./coaching/types"
import type { StoredPosition } from "./storage"

// ── Types ──

export interface ChallengeRule {
  id: string
  title: string
  description: string
  category: "risk" | "discipline" | "quality"
  /** Whether this challenge is active by default for new users */
  defaultActive: boolean
  /** Validate whether a trade is allowed. Returns null if OK, or a reason string if blocked. */
  validate: (ctx: ChallengeContext) => string | null
}

export interface ChallengeContext {
  action: "buy" | "sell"
  symbol: string
  quantity: number
  price: number
  balance: number
  positions: Record<string, StoredPosition>
  trades: TradeWithCoaching[]
  /** Total portfolio value (balance + positions at avg price) */
  totalPortfolioValue: number
}

// ── Challenge Definitions ──

export const CHALLENGE_RULES: ChallengeRule[] = [
  {
    id: "max_position_size",
    title: "Position Size Limit",
    description: "No single position can exceed 20% of portfolio value",
    category: "risk",
    defaultActive: true,
    validate: (ctx) => {
      if (ctx.action !== "buy") return null
      const tradeCost = ctx.quantity * ctx.price
      const existingValue = (ctx.positions[ctx.symbol]?.quantity ?? 0) * (ctx.positions[ctx.symbol]?.avgPrice ?? 0)
      const newPositionValue = existingValue + tradeCost
      const maxAllowed = ctx.totalPortfolioValue * 0.2
      if (newPositionValue > maxAllowed) {
        return `Position in ${ctx.symbol} would be ${((newPositionValue / ctx.totalPortfolioValue) * 100).toFixed(0)}% of portfolio (limit: 20%). Reduce quantity or diversify.`
      }
      return null
    },
  },
  {
    id: "max_trades_per_day",
    title: "Daily Trade Limit",
    description: "Maximum 10 trades per day to prevent overtrading",
    category: "discipline",
    defaultActive: true,
    validate: (ctx) => {
      const today = new Date().toISOString().split("T")[0]
      const todayTrades = ctx.trades.filter(t => t.timestamp.startsWith(today))
      if (todayTrades.length >= 10) {
        return `You've made ${todayTrades.length} trades today (limit: 10). Take a break and review your trades.`
      }
      return null
    },
  },
  {
    id: "min_balance_reserve",
    title: "Cash Reserve",
    description: "Always keep at least 10% of starting capital ($10,000) in cash",
    category: "risk",
    defaultActive: true,
    validate: (ctx) => {
      if (ctx.action !== "buy") return null
      const tradeCost = ctx.quantity * ctx.price
      const remainingBalance = ctx.balance - tradeCost
      if (remainingBalance < 10_000) {
        return `This trade would leave only $${remainingBalance.toLocaleString()} in cash (minimum reserve: $10,000). Reduce quantity.`
      }
      return null
    },
  },
  {
    id: "cooldown_after_loss",
    title: "Loss Cooldown",
    description: "Wait 5 minutes after a losing trade before trading again",
    category: "discipline",
    defaultActive: false,
    validate: (ctx) => {
      if (ctx.trades.length === 0) return null
      const lastTrade = ctx.trades[ctx.trades.length - 1]
      if (lastTrade.type === "sell" && (lastTrade.profit ?? 0) < 0) {
        const timeSince = Date.now() - new Date(lastTrade.timestamp).getTime()
        const cooldownMs = 5 * 60 * 1000
        if (timeSince < cooldownMs) {
          const remaining = Math.ceil((cooldownMs - timeSince) / 60000)
          return `Cooldown active: wait ${remaining} more minute${remaining !== 1 ? "s" : ""} after your last losing trade. Use this time to reflect.`
        }
      }
      return null
    },
  },
  {
    id: "no_rapid_reversal",
    title: "No Rapid Reversals",
    description: "Cannot sell a stock within 2 minutes of buying it",
    category: "discipline",
    defaultActive: true,
    validate: (ctx) => {
      if (ctx.action !== "sell") return null
      const recentBuy = [...ctx.trades].reverse().find(
        t => t.type === "buy" && t.symbol === ctx.symbol
      )
      if (recentBuy) {
        const timeSince = Date.now() - new Date(recentBuy.timestamp).getTime()
        if (timeSince < 2 * 60 * 1000) {
          const secondsLeft = Math.ceil((2 * 60 * 1000 - timeSince) / 1000)
          return `Hold period: wait ${secondsLeft}s before selling ${ctx.symbol}. Rapid reversals indicate emotional trading.`
        }
      }
      return null
    },
  },
]

// ── Validation ──

/**
 * Get active challenge IDs from localStorage.
 * Returns Set of challenge IDs that are currently active.
 */
export function getActiveChallenges(): Set<string> {
  if (typeof window === "undefined") return new Set(CHALLENGE_RULES.filter(r => r.defaultActive).map(r => r.id))
  try {
    const raw = localStorage.getItem("tradia_active_challenges")
    if (raw) return new Set(JSON.parse(raw))
    // Default: activate all default-active rules
    return new Set(CHALLENGE_RULES.filter(r => r.defaultActive).map(r => r.id))
  } catch {
    return new Set(CHALLENGE_RULES.filter(r => r.defaultActive).map(r => r.id))
  }
}

export function setActiveChallenges(ids: Set<string>): void {
  if (typeof window === "undefined") return
  localStorage.setItem("tradia_active_challenges", JSON.stringify([...ids]))
}

/**
 * Validate a pending trade against all active challenges.
 * Returns array of violation messages (empty = trade allowed).
 */
export function validateTradeAgainstChallenges(ctx: ChallengeContext): string[] {
  const activeIds = getActiveChallenges()
  const violations: string[] = []

  for (const rule of CHALLENGE_RULES) {
    if (!activeIds.has(rule.id)) continue
    const violation = rule.validate(ctx)
    if (violation) violations.push(violation)
  }

  return violations
}
