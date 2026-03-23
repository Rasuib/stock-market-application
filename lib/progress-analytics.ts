/**
 * Progress Analytics
 *
 * Computes coaching trend data, behavioral flag frequency deltas,
 * quality streak history, and auto-generated improvement summaries.
 *
 * All functions are pure — no side effects, deterministic for same inputs.
 */

import type { TradeWithCoaching, BehavioralFlag } from "./coaching/types"

// ── Score Trend ──

export interface ScoreTrendPoint {
  tradeIndex: number
  score: number
  /** Rolling average over window */
  rollingAvg: number
  timestamp: string
}

/**
 * Compute coaching score trend with rolling average.
 * Returns one point per trade.
 */
export function computeScoreTrend(
  trades: TradeWithCoaching[],
  windowSize = 5,
): ScoreTrendPoint[] {
  if (trades.length === 0) return []

  const points: ScoreTrendPoint[] = []
  for (let i = 0; i < trades.length; i++) {
    const windowStart = Math.max(0, i - windowSize + 1)
    const window = trades.slice(windowStart, i + 1)
    const rollingAvg = window.reduce((sum, t) => sum + t.coaching.score, 0) / window.length

    points.push({
      tradeIndex: i + 1,
      score: trades[i].coaching.score,
      rollingAvg: Math.round(rollingAvg * 10) / 10,
      timestamp: trades[i].timestamp,
    })
  }

  return points
}

// ── Behavioral Flag Frequency ──

export interface FlagFrequency {
  flag: BehavioralFlag
  totalCount: number
  recentCount: number   // last N trades
  previousCount: number // previous N trades
  trend: "improving" | "stable" | "worsening"
}

/**
 * Compute frequency of each behavioral flag in recent vs previous window.
 */
export function computeFlagFrequency(
  trades: TradeWithCoaching[],
  windowSize = 10,
): FlagFrequency[] {
  if (trades.length === 0) return []

  const recentTrades = trades.slice(-windowSize)
  const previousTrades = trades.slice(-windowSize * 2, -windowSize)

  // Count all flags
  const allCounts: Record<string, number> = {}
  const recentCounts: Record<string, number> = {}
  const previousCounts: Record<string, number> = {}

  for (const t of trades) {
    for (const f of t.coaching.behavioralFlags) {
      allCounts[f.flag] = (allCounts[f.flag] ?? 0) + 1
    }
  }

  for (const t of recentTrades) {
    for (const f of t.coaching.behavioralFlags) {
      recentCounts[f.flag] = (recentCounts[f.flag] ?? 0) + 1
    }
  }

  for (const t of previousTrades) {
    for (const f of t.coaching.behavioralFlags) {
      previousCounts[f.flag] = (previousCounts[f.flag] ?? 0) + 1
    }
  }

  // Build frequency entries, sorted by total count descending
  const flags = Object.keys(allCounts) as BehavioralFlag[]
  return flags
    .map((flag) => {
      const recentCount = recentCounts[flag] ?? 0
      const previousCount = previousCounts[flag] ?? 0
      const trend = classifyFlagTrend(recentCount, previousCount)

      return {
        flag,
        totalCount: allCounts[flag],
        recentCount,
        previousCount,
        trend,
      }
    })
    .sort((a, b) => b.totalCount - a.totalCount)
}

function classifyFlagTrend(recent: number, previous: number): "improving" | "stable" | "worsening" {
  if (previous === 0 && recent === 0) return "stable"
  if (previous === 0) return "worsening"
  const change = (recent - previous) / previous
  if (change <= -0.3) return "improving"
  if (change >= 0.3) return "worsening"
  return "stable"
}

// ── Period Delta Comparison ──

export type DeltaClassification = "improving" | "stable" | "declining"

export interface PeriodDelta {
  recentAvgScore: number
  previousAvgScore: number
  scoreDelta: number
  recentFlagRate: number     // flags per trade in recent window
  previousFlagRate: number
  flagRateDelta: number
  classification: DeltaClassification
}

/**
 * Compare last N trades vs previous N trades.
 */
export function computePeriodDelta(
  trades: TradeWithCoaching[],
  windowSize = 10,
): PeriodDelta | null {
  if (trades.length < windowSize) return null

  const recent = trades.slice(-windowSize)
  const previous = trades.slice(-windowSize * 2, -windowSize)

  if (previous.length === 0) return null

  const recentAvgScore = avg(recent.map((t) => t.coaching.score))
  const previousAvgScore = avg(previous.map((t) => t.coaching.score))
  const scoreDelta = recentAvgScore - previousAvgScore

  const recentFlagRate = recent.reduce((sum, t) => sum + t.coaching.behavioralFlags.length, 0) / recent.length
  const previousFlagRate = previous.reduce((sum, t) => sum + t.coaching.behavioralFlags.length, 0) / previous.length
  const flagRateDelta = recentFlagRate - previousFlagRate

  // Classification: improving if score up 5+ AND flags not increasing
  // Declining if score down 5+ OR flags up significantly
  let classification: DeltaClassification = "stable"
  if (scoreDelta >= 5 && flagRateDelta <= 0.2) {
    classification = "improving"
  } else if (scoreDelta <= -5 || flagRateDelta >= 0.5) {
    classification = "declining"
  }

  return {
    recentAvgScore: round1(recentAvgScore),
    previousAvgScore: round1(previousAvgScore),
    scoreDelta: round1(scoreDelta),
    recentFlagRate: round1(recentFlagRate),
    previousFlagRate: round1(previousFlagRate),
    flagRateDelta: round1(flagRateDelta),
    classification,
  }
}

// ── Quality Streak History ──

export interface StreakSegment {
  startIndex: number
  length: number
  avgScore: number
}

/**
 * Extract quality streak segments (consecutive trades with score > 60).
 */
export function computeStreakHistory(trades: TradeWithCoaching[]): StreakSegment[] {
  const segments: StreakSegment[] = []
  let currentStart = -1
  let currentScores: number[] = []

  for (let i = 0; i < trades.length; i++) {
    if (trades[i].coaching.score > 60) {
      if (currentStart === -1) currentStart = i
      currentScores.push(trades[i].coaching.score)
    } else {
      if (currentStart !== -1 && currentScores.length >= 2) {
        segments.push({
          startIndex: currentStart,
          length: currentScores.length,
          avgScore: round1(avg(currentScores)),
        })
      }
      currentStart = -1
      currentScores = []
    }
  }

  // Close any open streak
  if (currentStart !== -1 && currentScores.length >= 2) {
    segments.push({
      startIndex: currentStart,
      length: currentScores.length,
      avgScore: round1(avg(currentScores)),
    })
  }

  return segments
}

// ── Auto-Summary ──

const FLAG_LABELS: Record<string, string> = {
  overtrading: "overtrading",
  oversized_position: "oversized positions",
  trend_fighting: "trend fighting",
  sentiment_ignoring: "ignoring sentiment",
  panic_exit: "panic exits",
  late_chase: "late chasing",
  poor_risk_discipline: "poor risk discipline",
  impulsive_reversal: "impulsive reversals",
  concentration_risk: "concentration risk",
  selling_winners_early: "selling winners early",
  holding_losers: "holding losers",
}

/**
 * Generate 1-2 sentence data-derived improvement summary.
 */
export function generateProgressSummary(
  delta: PeriodDelta | null,
  flagFrequencies: FlagFrequency[],
): string {
  if (!delta) return "Keep trading to build your progress history."

  const parts: string[] = []

  // Score change
  if (delta.scoreDelta > 0) {
    parts.push(`Average coaching score improved by +${delta.scoreDelta.toFixed(1)} points`)
  } else if (delta.scoreDelta < -3) {
    parts.push(`Average coaching score dropped ${Math.abs(delta.scoreDelta).toFixed(1)} points`)
  }

  // Flag improvements
  const improving = flagFrequencies.filter((f) => f.trend === "improving")
  if (improving.length > 0) {
    const topImproving = improving.slice(0, 2).map((f) => FLAG_LABELS[f.flag] ?? f.flag)
    parts.push(`reduced ${topImproving.join(" and ")} flags`)
  }

  // Flag worsening
  const worsening = flagFrequencies.filter((f) => f.trend === "worsening")
  if (worsening.length > 0) {
    const topWorsening = worsening.slice(0, 1).map((f) => FLAG_LABELS[f.flag] ?? f.flag)
    parts.push(`watch for increasing ${topWorsening.join("")} patterns`)
  }

  if (parts.length === 0) {
    return "Performance is steady — keep trading thoughtfully to see trends."
  }

  // Join with proper capitalization
  const sentence = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  if (parts.length === 1) return sentence + "."
  return sentence + ", and " + parts.slice(1).join(". ") + "."
}

// ── Helpers ──

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
