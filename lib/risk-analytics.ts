/**
 * Risk Analytics
 *
 * Pure functions for computing risk metrics from trade history.
 * No side effects, no state — all deterministic and testable.
 */

import type { TradeWithCoaching } from "./coaching/types"

export interface RiskMetrics {
  /** Largest peak-to-trough decline in portfolio value (negative number) */
  maxDrawdown: number
  /** Percentage of sell trades that were profitable */
  winRate: number
  /** Average profit on winning sells */
  averageWin: number
  /** Average loss on losing sells (negative number) */
  averageLoss: number
  /** Ratio of averageWin to |averageLoss|. >1 is good. */
  rewardRiskRatio: number
  /** Standard deviation of position sizes as fraction of balance */
  positionSizingConsistency: number
  /** Total number of sell trades analyzed */
  totalSells: number
}

export interface BenchmarkResult {
  /** User portfolio return % over the period */
  userReturnPct: number
  /** S&P 500 buy-and-hold return % over the same period */
  sp500ReturnPct: number
  /** Cash baseline (0%) */
  cashReturnPct: number
  /** Period start date */
  periodStart: string
  /** Period end date */
  periodEnd: string
}

/**
 * Compute risk metrics from trade history.
 * Requires at least 1 sell trade for meaningful results.
 */
export function computeRiskMetrics(
  trades: TradeWithCoaching[],
  initialBalance: number,
): RiskMetrics {
  const sells = trades.filter(t => t.type === "sell" && t.profit !== undefined)

  const wins = sells.filter(t => (t.profit ?? 0) > 0)
  const losses = sells.filter(t => (t.profit ?? 0) <= 0)

  const winRate = sells.length > 0 ? (wins.length / sells.length) * 100 : 0
  const averageWin = wins.length > 0
    ? wins.reduce((sum, t) => sum + (t.profit ?? 0), 0) / wins.length
    : 0
  const averageLoss = losses.length > 0
    ? losses.reduce((sum, t) => sum + (t.profit ?? 0), 0) / losses.length
    : 0

  const rewardRiskRatio = averageLoss !== 0
    ? Math.abs(averageWin / averageLoss)
    : averageWin > 0 ? Infinity : 0

  // Max drawdown: simulate balance progression
  const maxDrawdown = computeMaxDrawdown(trades, initialBalance)

  // Position sizing consistency: std dev of (cost / balance at time)
  const positionSizingConsistency = computePositionSizingConsistency(trades, initialBalance)

  return {
    maxDrawdown,
    winRate: round(winRate),
    averageWin: round(averageWin),
    averageLoss: round(averageLoss),
    rewardRiskRatio: rewardRiskRatio === Infinity ? 999 : round(rewardRiskRatio),
    positionSizingConsistency: round(positionSizingConsistency),
    totalSells: sells.length,
  }
}

/**
 * Compute max drawdown from trade history.
 * Simulates balance after each trade and finds max peak-to-trough drop.
 *
 * Cost semantics (defined in trading-simulator):
 *   Buy trade.cost  = quantity × fillPrice + commissionPaid  (total cash outflow, commission included)
 *   Sell trade.cost = quantity × fillPrice                   (gross proceeds, commission NOT included)
 *
 * Therefore:
 *   Buy:  balance -= trade.cost                     (commission already in cost)
 *   Sell: balance += trade.cost - commissionPaid     (net of commission)
 */
function computeMaxDrawdown(trades: TradeWithCoaching[], initialBalance: number): number {
  if (trades.length === 0) return 0

  let balance = initialBalance
  let peak = balance
  let maxDD = 0

  for (const trade of trades) {
    if (trade.type === "buy") {
      // trade.cost already includes commission — do NOT add commission again
      balance -= trade.cost
    } else {
      // trade.cost is gross proceeds — subtract commission for net
      balance += trade.cost - (trade.execution?.commissionPaid ?? 0)
    }

    if (balance > peak) {
      peak = balance
    }

    const drawdown = (balance - peak) / peak
    if (drawdown < maxDD) {
      maxDD = drawdown
    }
  }

  return round(maxDD * 100) // as percentage
}

/**
 * Compute standard deviation of position sizes (cost / running balance).
 * Lower = more consistent sizing = better risk management.
 *
 * Uses same cost semantics as computeMaxDrawdown (see above).
 */
function computePositionSizingConsistency(
  trades: TradeWithCoaching[],
  initialBalance: number,
): number {
  if (trades.length < 2) return 0

  let balance = initialBalance
  const ratios: number[] = []

  for (const trade of trades) {
    if (trade.type === "buy") {
      // trade.cost includes commission
      const ratio = balance > 0 ? trade.cost / balance : 0
      ratios.push(ratio)
      balance -= trade.cost
    } else {
      // net of commission
      balance += trade.cost - (trade.execution?.commissionPaid ?? 0)
    }
  }

  if (ratios.length < 2) return 0

  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length
  const variance = ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length
  return Math.sqrt(variance)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
