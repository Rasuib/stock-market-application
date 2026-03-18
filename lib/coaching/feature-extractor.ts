/**
 * Feature Extractor
 *
 * Extracts a rich, typed feature set from raw trade inputs.
 * These features are what the scoring engine reasons about.
 *
 * Design: Every feature is bounded, explainable, and derivable from observable data.
 * No hidden computation — every value has a clear meaning.
 */

import type { EvaluateTradeInput, ExtractedFeatures, BehaviorPattern, BehavioralFlag } from "./types"
import { classifyMarketRegime } from "./market-regime"

export function extractFeatures(input: EvaluateTradeInput): ExtractedFeatures {
  const { action, sentiment, trend, quantity, price, totalBalance,
    portfolioExposure, existingPositionSize, recentTradeCount,
    recentRewards, tradeHistory } = input

  // ── Signal features ──

  const sentimentDirection = sentiment.label === "bullish" ? 1 : sentiment.label === "bearish" ? -1 : 0
  const sentimentStrength = Math.abs(sentiment.score - 50) / 50  // 0-1 (how far from neutral)

  // Source quality: FinBERT > heuristic > unavailable
  const sourceQuality = sentiment.source === "finbert" ? 1.0
    : sentiment.source === "heuristic-fallback" ? 0.6
    : 0.1
  const sentimentReliability = sourceQuality * sentiment.confidence

  const trendDirection = trend.signal
  const trendStrength = Math.abs(trend.signal)
  const trendReliability = trend.confidence * (trendStrength > 0.1 ? 1.0 : 0.5)

  // Signal agreement: do both indicators point the same direction?
  const signalAgreement = sentimentDirection * trendDirection

  // MA spread (% difference)
  const maSpread = trend.longMA > 0
    ? ((trend.shortMA - trend.longMA) / trend.longMA) * 100
    : 0

  // ── Trade context features ──

  const actionDirection = action === "buy" ? 1 : -1
  const tradeCost = quantity * price
  const positionSizeRatio = totalBalance > 0 ? tradeCost / totalBalance : 0
  const existingExposure = totalBalance > 0 ? (existingPositionSize * price) / totalBalance : 0
  const isAddingToPosition = action === "buy" && existingPositionSize > 0

  // ── Regime ──

  const regime = classifyMarketRegime(input)

  // ── Sell-specific features ──

  const isSell = action === "sell"
  let holdingDuration: number | undefined
  let isWinner: boolean | undefined

  if (isSell) {
    isWinner = input.profit !== undefined ? input.profit > 0 : undefined

    // Estimate holding duration: find most recent buy of this symbol
    const lastBuy = [...tradeHistory].reverse().find(
      t => t.type === "buy" && t.symbol === input.symbol
    )
    if (lastBuy) {
      holdingDuration = Date.now() - new Date(lastBuy.timestamp).getTime()
    }
  }

  // ── History features ──

  let recentAvgReward = 0
  let recentTradeImprovement = 0

  if (recentRewards.length > 0) {
    recentAvgReward = recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length
  }

  if (recentRewards.length >= 6) {
    const half = Math.floor(recentRewards.length / 2)
    const recent = recentRewards.slice(-half)
    const older = recentRewards.slice(0, half)
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    recentTradeImprovement = recentAvg - olderAvg
  }

  // ── Mistake patterns from history ──

  const recentMistakePatterns = detectMistakePatterns(tradeHistory)

  return {
    sentimentDirection,
    sentimentStrength,
    sentimentReliability,
    trendDirection,
    trendStrength,
    trendReliability,
    signalAgreement,
    maSpread,
    momentum: trend.momentum,

    actionDirection,
    positionSizeRatio,
    portfolioExposure,
    existingExposure,
    isAddingToPosition,

    regime,

    isSell,
    profitAmount: input.profit,
    profitPercent: input.profitPercent,
    holdingDuration,
    isWinner,

    recentTradeCount,
    recentAvgReward,
    recentTradeImprovement,
    tradeHistoryLength: tradeHistory.length,
    recentMistakePatterns,
  }
}

/**
 * Detect recurring mistake patterns from trade history.
 * Counts behavioral flags across all history and recent (last 10) trades.
 * Detects whether each pattern is increasing, stable, or decreasing.
 */
function detectMistakePatterns(history: EvaluateTradeInput["tradeHistory"]): BehaviorPattern[] {
  if (history.length < 2) return []

  const allCounts = new Map<BehavioralFlag, number>()
  const recentCounts = new Map<BehavioralFlag, number>()
  const recent10 = history.slice(-10)
  const older = history.slice(0, -10)

  // Count flags across all history
  for (const trade of history) {
    for (const flag of trade.coaching.behavioralFlags) {
      allCounts.set(flag.flag, (allCounts.get(flag.flag) || 0) + 1)
    }
  }

  // Count flags in recent 10
  for (const trade of recent10) {
    for (const flag of trade.coaching.behavioralFlags) {
      recentCounts.set(flag.flag, (recentCounts.get(flag.flag) || 0) + 1)
    }
  }

  const patterns: BehaviorPattern[] = []

  for (const [flag, count] of allCounts.entries()) {
    if (count < 2) continue

    const recentCount = recentCounts.get(flag) || 0

    // Detect trend: compare rate in recent vs older
    let trend: "increasing" | "stable" | "decreasing" = "stable"
    if (older.length >= 5) {
      const olderCount = count - recentCount
      const recentRate = recentCount / Math.max(1, recent10.length)
      const olderRate = olderCount / Math.max(1, older.length)
      if (recentRate > olderRate * 1.5) trend = "increasing"
      else if (recentRate < olderRate * 0.5) trend = "decreasing"
    }

    patterns.push({ flag, count, recentCount, trend })
  }

  return patterns.sort((a, b) => b.recentCount - a.recentCount)
}
