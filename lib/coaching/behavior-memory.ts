/**
 * Behavioral Memory System
 *
 * Detects behavioral patterns across the user's trade history and adjusts
 * severity based on repetition. Implements:
 *
 * 1. Pattern detection: identify 11 distinct behavioral flags
 * 2. Severity escalation: repeated mistakes get stronger warnings
 * 3. Improvement recognition: decreased patterns get noted
 * 4. Personalization: coaching adapts to the user's specific patterns
 *
 * Design: All detections use explainable, feature-based rules.
 * Every flag includes evidence and recurrence count.
 */

import type {
  EvaluateTradeInput,
  ExtractedFeatures,
  BehavioralFlagDetail,
  BehavioralFlag,
} from "./types"

/**
 * Detect all behavioral flags for the current trade,
 * accounting for patterns in trade history.
 */
export function detectBehavioralFlags(
  input: EvaluateTradeInput,
  features: ExtractedFeatures,
): BehavioralFlagDetail[] {
  const flags: BehavioralFlagDetail[] = []
  const { action, symbol, tradeHistory } = input

  // Count how many times each flag appeared in recent history
  const historicalCounts = countHistoricalFlags(tradeHistory)

  // ── 1. Overtrading ──
  if (features.recentTradeCount > 10) {
    flags.push(escalate("overtrading", "critical",
      `${features.recentTradeCount} trades in the last hour. This is excessive — slow down and trade with intention.`,
      historicalCounts))
  } else if (features.recentTradeCount > 6) {
    flags.push(escalate("overtrading", "warning",
      `${features.recentTradeCount} trades recently. High trading frequency often leads to worse outcomes.`,
      historicalCounts))
  }

  // ── 2. Oversized position ──
  if (action === "buy" && features.positionSizeRatio > 0.3) {
    const pct = (features.positionSizeRatio * 100).toFixed(0)
    const baseSeverity = features.positionSizeRatio > 0.5 ? "critical" : "warning"
    flags.push(escalate("oversized_position", baseSeverity,
      `This trade uses ${pct}% of your capital. Professional traders typically risk 2-5% per trade.`,
      historicalCounts))
  }

  // ── 3. Trend fighting ──
  if (features.trendReliability > 0.3) {
    const alignment = features.actionDirection * features.trendDirection
    if (alignment < -0.3) {
      const dir = action === "buy" ? "buying into a downtrend" : "selling into an uptrend"
      flags.push(escalate("trend_fighting", "warning",
        `You're ${dir} (trend confidence: ${(input.trend.confidence * 100).toFixed(0)}%). Trading against the trend is one of the most common beginner mistakes.`,
        historicalCounts))
    }
  }

  // ── 4. Sentiment ignoring ──
  if (features.sentimentReliability > 0.3) {
    const alignment = features.actionDirection * features.sentimentDirection
    if (alignment < -0.3) {
      const src = input.sentiment.source === "finbert" ? "FinBERT NLP analysis" : "keyword analysis"
      flags.push(escalate("sentiment_ignoring", "warning",
        `Market sentiment is ${input.sentiment.label} (via ${src}), which conflicts with your ${action}. News sentiment often drives short-term price moves.`,
        historicalCounts))
    }
  }

  // ── 5. Panic exit ──
  if (action === "sell" && features.isWinner === false && features.holdingDuration !== undefined) {
    const minutesHeld = features.holdingDuration / (1000 * 60)
    if (minutesHeld < 5) {
      flags.push(escalate("panic_exit", "warning",
        `You sold at a loss within ${minutesHeld < 1 ? "less than a minute" : `${Math.round(minutesHeld)} minutes`} of buying. This looks like an emotional exit rather than a planned stop-loss.`,
        historicalCounts))
    }
  }

  // ── 6. Late chase ──
  if (action === "buy" && Math.abs(features.momentum) > 3) {
    const dir = features.momentum > 0 ? "up" : "down"
    if (features.momentum > 3 && features.actionDirection === 1) {
      flags.push(escalate("late_chase", "warning",
        `The stock has already moved ${features.momentum.toFixed(1)}% ${dir}. Chasing momentum after a big move often means buying near a short-term top.`,
        historicalCounts))
    }
  }

  // ── 7. Impulsive reversal ──
  if (tradeHistory.length > 0) {
    const lastTrade = tradeHistory[tradeHistory.length - 1]
    if (lastTrade.symbol === symbol && lastTrade.type !== action) {
      const timeSince = Date.now() - new Date(lastTrade.timestamp).getTime()
      if (timeSince < 3 * 60 * 1000) {
        flags.push(escalate("impulsive_reversal", "warning",
          `You reversed your position on ${symbol} within minutes. Quick reversals suggest you didn't have a clear plan before entering.`,
          historicalCounts))
      }
    }
  }

  // ── 8. Concentration risk ──
  if (action === "buy" && tradeHistory.length >= 5) {
    const symbolTrades = tradeHistory.filter(t => t.symbol === symbol)
    const uniqueSymbols = new Set(tradeHistory.map(t => t.symbol))
    if (uniqueSymbols.size <= 2 && tradeHistory.length >= 8) {
      flags.push(escalate("concentration_risk", "info",
        `${tradeHistory.length} trades across only ${uniqueSymbols.size} stock${uniqueSymbols.size > 1 ? "s" : ""}. Diversifying across sectors helps reduce risk.`,
        historicalCounts))
    } else if (symbolTrades.length > 5 && features.portfolioExposure > 0.5) {
      flags.push(escalate("concentration_risk", "info",
        `You're heavily concentrated in ${symbol} (${symbolTrades.length} trades). Consider spreading across different stocks.`,
        historicalCounts))
    }
  }

  // ── 9. Poor risk discipline ──
  if (action === "buy" && features.portfolioExposure > 0.75) {
    flags.push(escalate("poor_risk_discipline", "warning",
      `You're buying more when ${(features.portfolioExposure * 100).toFixed(0)}% of capital is already invested. Keep at least 20-25% in cash for protection.`,
      historicalCounts))
  }

  // ── 10. Selling winners early ──
  if (action === "sell" && features.isWinner === true && features.profitPercent !== undefined) {
    // Check if selling a small profit in a strong uptrend
    if (features.profitPercent < 3 && features.trendDirection > 0.3 && features.trendReliability > 0.4) {
      flags.push(escalate("selling_winners_early", "info",
        `You took a small ${features.profitPercent.toFixed(1)}% profit while the trend is still positive. Consider letting winners run with a trailing stop-loss.`,
        historicalCounts))
    }
  }

  // ── 11. Holding losers ──
  if (action === "sell" && features.isWinner === false && features.profitPercent !== undefined) {
    if (features.profitPercent < -10 && features.holdingDuration !== undefined) {
      const hoursHeld = features.holdingDuration / (1000 * 60 * 60)
      if (hoursHeld > 1) {
        flags.push(escalate("holding_losers", "warning",
          `You held a ${features.profitPercent.toFixed(1)}% loss for ${hoursHeld > 24 ? `${Math.round(hoursHeld / 24)} days` : `${Math.round(hoursHeld)} hours`}. Set stop-losses to cut losses early.`,
          historicalCounts))
      }
    }
  }

  return flags
}

/**
 * Count how many times each behavioral flag appeared in trade history.
 */
function countHistoricalFlags(history: EvaluateTradeInput["tradeHistory"]): Map<BehavioralFlag, number> {
  const counts = new Map<BehavioralFlag, number>()
  for (const trade of history) {
    for (const flag of trade.coaching.behavioralFlags) {
      counts.set(flag.flag, (counts.get(flag.flag) || 0) + 1)
    }
  }
  return counts
}

/**
 * Escalate severity if this pattern has occurred repeatedly.
 * After 3+ occurrences, info → warning, warning → critical.
 * The description is also adjusted to acknowledge repetition.
 */
function escalate(
  flag: BehavioralFlag,
  baseSeverity: "info" | "warning" | "critical",
  description: string,
  historicalCounts: Map<BehavioralFlag, number>,
): BehavioralFlagDetail {
  const recurrence = historicalCounts.get(flag) || 0
  let severity = baseSeverity
  let escalated = false

  if (recurrence >= 3) {
    // Escalate severity
    if (baseSeverity === "info") {
      severity = "warning"
      escalated = true
    } else if (baseSeverity === "warning") {
      severity = "critical"
      escalated = true
    }
  }

  // Add recurrence context to description
  let finalDescription = description
  if (recurrence >= 5) {
    finalDescription += ` This is a persistent pattern (${recurrence + 1} times). Breaking this habit should be your top priority.`
  } else if (recurrence >= 3) {
    finalDescription += ` This has happened ${recurrence + 1} times now. Focus on correcting this pattern.`
  } else if (recurrence >= 1) {
    finalDescription += ` (seen ${recurrence + 1} times)`
  }

  return { flag, severity, description: finalDescription, recurrence: recurrence + 1, escalated }
}
