/**
 * Decision Evaluation Engine
 *
 * Implements the Feature Fusion Layer + Decision Engine from the architecture:
 *
 * Feature Vector = [Sentiment, Trend, Action]
 *   Sentiment ∈ {-1, 0, 1}
 *   Trend ∈ {-1, 0, 1}
 *   Action ∈ {-1 (sell), 1 (buy)}
 *
 * Decision Quality Score:
 *   DQ = w1 * (Action * Trend) + w2 * (Action * Sentiment)
 *
 * Provides explainable rule-based reasoning for trade evaluation.
 */

export interface SentimentInput {
  sentiment: "bullish" | "bearish" | "neutral"
  score: number       // 0-100
  confidence: number  // 0-1
}

export interface TrendInput {
  trend: "uptrend" | "neutral" | "downtrend"
  signal: 1 | 0 | -1
  confidence: number
}

export type TradeAction = "buy" | "sell"

export interface TradeEvaluation {
  /** Score from -100 to +100. Positive = good trade, negative = risky */
  score: number
  /** Quality label */
  quality: "excellent" | "good" | "neutral" | "risky" | "poor"
  /** Human-readable explanation of why the trade is rated this way */
  explanation: string
  /** Specific factors that contributed to the evaluation */
  factors: EvaluationFactor[]
  /** The encoded feature vector [sentiment, trend, action] */
  featureVector: [number, number, number]
}

export interface EvaluationFactor {
  label: string
  impact: "positive" | "negative" | "neutral"
  description: string
}

// Weights for the decision quality formula
const W_TREND = 0.55    // Trend alignment weight
const W_SENTIMENT = 0.45 // Sentiment alignment weight

function encodeSentiment(input: SentimentInput): number {
  if (input.sentiment === "bullish") return 1
  if (input.sentiment === "bearish") return -1
  return 0
}

function encodeTrend(input: TrendInput): number {
  return input.signal
}

function encodeAction(action: TradeAction): number {
  return action === "buy" ? 1 : -1
}

/**
 * Evaluate a trade decision against market conditions.
 *
 * Core formula: DQ = w1 * (A * T) + w2 * (A * S)
 * Scaled to [-100, +100]
 */
export function evaluateTrade(
  action: TradeAction,
  sentiment: SentimentInput,
  trend: TrendInput,
): TradeEvaluation {
  const S = encodeSentiment(sentiment)
  const T = encodeTrend(trend)
  const A = encodeAction(action)

  const featureVector: [number, number, number] = [S, T, A]

  // Core decision quality score
  const trendAlignment = A * T   // +1 if aligned, -1 if opposed, 0 if neutral
  const sentimentAlignment = A * S

  // Raw DQ in [-1, 1]
  const rawDQ = W_TREND * trendAlignment + W_SENTIMENT * sentimentAlignment

  // Scale to [-100, +100], weighted by confidence
  const avgConfidence = (sentiment.confidence + trend.confidence) / 2
  const confidenceMultiplier = 0.5 + 0.5 * avgConfidence // range [0.5, 1.0]
  const score = Math.round(rawDQ * 100 * confidenceMultiplier)

  // Build explanation factors
  const factors: EvaluationFactor[] = []

  // Trend factor
  if (trendAlignment > 0) {
    factors.push({
      label: "Trend Alignment",
      impact: "positive",
      description: `${action === "buy" ? "Buying" : "Selling"} aligns with the current ${trend.trend}.`,
    })
  } else if (trendAlignment < 0) {
    factors.push({
      label: "Trend Conflict",
      impact: "negative",
      description: `${action === "buy" ? "Buying" : "Selling"} conflicts with the current ${trend.trend}. Consider waiting for a trend reversal.`,
    })
  } else {
    factors.push({
      label: "No Clear Trend",
      impact: "neutral",
      description: "Market shows no clear trend direction. Trade with caution.",
    })
  }

  // Sentiment factor
  if (sentimentAlignment > 0) {
    factors.push({
      label: "Sentiment Alignment",
      impact: "positive",
      description: `Market sentiment is ${sentiment.sentiment} (score: ${sentiment.score}/100), supporting your ${action} decision.`,
    })
  } else if (sentimentAlignment < 0) {
    factors.push({
      label: "Sentiment Conflict",
      impact: "negative",
      description: `Market sentiment is ${sentiment.sentiment} (score: ${sentiment.score}/100), which conflicts with your ${action} decision.`,
    })
  } else {
    factors.push({
      label: "Neutral Sentiment",
      impact: "neutral",
      description: "Market sentiment is neutral. Neither supporting nor opposing your trade.",
    })
  }

  // Confidence factor
  if (avgConfidence < 0.4) {
    factors.push({
      label: "Low Confidence Data",
      impact: "neutral",
      description: "Limited data available. This evaluation has lower confidence. Consider gathering more information.",
    })
  }

  // Determine quality label
  let quality: TradeEvaluation["quality"]
  if (score >= 60) quality = "excellent"
  else if (score >= 20) quality = "good"
  else if (score >= -20) quality = "neutral"
  else if (score >= -60) quality = "risky"
  else quality = "poor"

  // Generate human-readable explanation
  const explanation = generateExplanation(action, sentiment, trend, score, quality)

  return { score, quality, explanation, factors, featureVector }
}

function generateExplanation(
  action: TradeAction,
  sentiment: SentimentInput,
  trend: TrendInput,
  score: number,
  quality: TradeEvaluation["quality"],
): string {
  const actionWord = action === "buy" ? "Buying" : "Selling"

  if (quality === "excellent") {
    return `${actionWord} is well-aligned with both market sentiment (${sentiment.sentiment}) and price trend (${trend.trend}). This trade shows strong fundamentals.`
  }

  if (quality === "good") {
    return `${actionWord} is supported by current market conditions. Sentiment is ${sentiment.sentiment} and the trend is ${trend.trend}.`
  }

  if (quality === "neutral") {
    return `${actionWord} has mixed signals. Consider monitoring the stock further before committing. Sentiment: ${sentiment.sentiment}, Trend: ${trend.trend}.`
  }

  if (quality === "risky") {
    if (action === "buy" && sentiment.sentiment === "bearish") {
      return `Caution: ${actionWord} conflicts with negative market sentiment (score: ${sentiment.score}/100). The market is showing bearish signals.`
    }
    if (action === "sell" && sentiment.sentiment === "bullish") {
      return `Caution: ${actionWord} conflicts with positive market sentiment (score: ${sentiment.score}/100). You may be selling too early.`
    }
    return `${actionWord} carries risk given current conditions. Trend: ${trend.trend}, Sentiment: ${sentiment.sentiment}.`
  }

  // poor
  return `Warning: ${actionWord} strongly conflicts with both market sentiment (${sentiment.sentiment}) and trend (${trend.trend}). Reconsider this trade.`
}
