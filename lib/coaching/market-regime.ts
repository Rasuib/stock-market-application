/**
 * Market Regime Classifier
 *
 * Classifies the current market environment using simple, explainable inputs.
 * The regime affects how the coaching engine weights different factors:
 *
 *   trending_up     → reward alignment, punish fighting the trend
 *   trending_down   → reward caution, punish blind buying
 *   range_bound     → punish chasing, reward patience
 *   high_uncertainty → reward smaller sizes, emphasize waiting
 *   weak_signal     → conservative feedback, lower confidence
 *
 * Inputs: MA spread, momentum, signal confidence, trend/sentiment agreement
 */

import type { MarketRegime, MarketRegimeDetail, EvaluateTradeInput } from "./types"

export function classifyMarketRegime(input: EvaluateTradeInput): MarketRegimeDetail {
  const { trend, sentiment } = input

  // ── Feature extraction ──

  // MA spread: how far apart the short and long MAs are (% of long MA)
  const maSpread = trend.longMA > 0
    ? ((trend.shortMA - trend.longMA) / trend.longMA) * 100
    : 0

  // Signal agreement: do trend and sentiment point the same direction?
  const sentimentDir = sentiment.label === "bullish" ? 1 : sentiment.label === "bearish" ? -1 : 0
  const trendDir = trend.signal
  const signalAgreement = sentimentDir * trendDir  // -1 to +1

  // Aggregate confidence
  const avgConfidence = (trend.confidence + sentiment.confidence) / 2

  // Momentum magnitude
  const absMomentum = Math.abs(trend.momentum)

  // ── Classification rules (explainable) ──

  let regime: MarketRegime
  let confidence: number
  let description: string

  // Rule 1: Weak signal — both signals have low confidence
  if (avgConfidence < 0.35) {
    regime = "weak_signal"
    confidence = 0.3 + avgConfidence
    description = "Market signals are weak or unreliable. Both sentiment and trend have low confidence."
  }
  // Rule 2: High uncertainty — signals disagree strongly
  else if (signalAgreement < -0.3 && avgConfidence > 0.4) {
    regime = "high_uncertainty"
    confidence = Math.min(0.7, avgConfidence)
    description = `Sentiment (${sentiment.label}) and trend (${trend.label}) disagree. Mixed signals create uncertainty.`
  }
  // Rule 3: Trending up — strong upward signals
  else if (
    maSpread > 0.5 &&
    trend.signal > 0.3 &&
    trend.confidence > 0.4 &&
    absMomentum > 0.3
  ) {
    regime = "trending_up"
    confidence = Math.min(0.95, (trend.confidence + 0.3) * (1 + signalAgreement * 0.2))
    description = `Market is trending upward. Short MA is ${maSpread.toFixed(1)}% above long MA with ${(absMomentum).toFixed(1)}% momentum.`
  }
  // Rule 4: Trending down — strong downward signals
  else if (
    maSpread < -0.5 &&
    trend.signal < -0.3 &&
    trend.confidence > 0.4 &&
    absMomentum > 0.3
  ) {
    regime = "trending_down"
    confidence = Math.min(0.95, (trend.confidence + 0.3) * (1 + signalAgreement * 0.2))
    description = `Market is trending downward. Short MA is ${Math.abs(maSpread).toFixed(1)}% below long MA with negative momentum.`
  }
  // Rule 5: Range-bound — low momentum, narrow MA spread
  else if (Math.abs(maSpread) < 0.5 && absMomentum < 0.5 && avgConfidence > 0.3) {
    regime = "range_bound"
    confidence = 0.5 + (1 - absMomentum) * 0.3
    description = "Market appears range-bound. MAs are close together and momentum is low."
  }
  // Default: weak signal (not enough to classify clearly)
  else {
    regime = "weak_signal"
    confidence = Math.min(0.5, avgConfidence)
    description = "No clear market regime identified. Signals are inconclusive."
  }

  return {
    regime,
    confidence: Math.round(confidence * 100) / 100,
    maSpread: Math.round(maSpread * 100) / 100,
    signalAgreement: Math.round(signalAgreement * 100) / 100,
    description,
  }
}

/**
 * Regime-specific weight adjustments.
 * Returns multipliers for each scoring component based on market regime.
 */
export function getRegimeWeightAdjustments(regime: MarketRegime): {
  alignmentMultiplier: number
  riskMultiplier: number
  disciplineMultiplier: number
  outcomeMultiplier: number
} {
  switch (regime) {
    case "trending_up":
    case "trending_down":
      // In strong trends, alignment matters more, discipline is baseline
      return { alignmentMultiplier: 1.3, riskMultiplier: 1.0, disciplineMultiplier: 0.9, outcomeMultiplier: 1.0 }

    case "range_bound":
      // In range markets, risk and discipline matter more, alignment is less clear
      return { alignmentMultiplier: 0.8, riskMultiplier: 1.2, disciplineMultiplier: 1.2, outcomeMultiplier: 1.0 }

    case "high_uncertainty":
      // In uncertain markets, risk and discipline are critical
      return { alignmentMultiplier: 0.7, riskMultiplier: 1.4, disciplineMultiplier: 1.3, outcomeMultiplier: 0.8 }

    case "weak_signal":
      // With weak signals, reduce alignment impact, increase discipline
      return { alignmentMultiplier: 0.5, riskMultiplier: 1.2, disciplineMultiplier: 1.4, outcomeMultiplier: 0.8 }
  }
}
