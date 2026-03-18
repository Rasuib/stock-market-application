/**
 * Behavior Analysis Module
 *
 * Tracks user trade history and detects behavioral patterns:
 * - Overtrading: excessive trades in a short time window
 * - Trend ignoring: consistently trading against the trend
 * - Sentiment ignoring: consistently trading against sentiment
 * - Frequent reversals: buying then immediately selling (or vice versa)
 *
 * Purpose: provide learning feedback to beginner investors.
 */

export interface TradeRecord {
  type: "buy" | "sell"
  symbol: string
  price: number
  quantity: number
  timestamp: string  // ISO string
  trendSignal?: number   // -1, 0, 1 at time of trade
  sentimentSignal?: number // -1, 0, 1 at time of trade
}

export interface BehaviorAlert {
  type: "overtrading" | "trend_ignoring" | "sentiment_ignoring" | "frequent_reversals" | "concentration_risk"
  severity: "info" | "warning" | "critical"
  title: string
  message: string
  recommendation: string
}

export interface BehaviorReport {
  alerts: BehaviorAlert[]
  patterns: {
    tradesPerHour: number
    trendAlignmentRate: number   // 0-100%
    sentimentAlignmentRate: number // 0-100%
    reversalRate: number          // 0-100%
    uniqueSymbols: number
  }
}

const OVERTRADING_THRESHOLD_PER_HOUR = 10
const REVERSAL_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Analyze a list of trades for behavioral patterns.
 */
export function analyzeBehavior(trades: TradeRecord[]): BehaviorReport {
  if (trades.length < 2) {
    return {
      alerts: [],
      patterns: {
        tradesPerHour: 0,
        trendAlignmentRate: 100,
        sentimentAlignmentRate: 100,
        reversalRate: 0,
        uniqueSymbols: new Set(trades.map(t => t.symbol)).size,
      },
    }
  }

  const alerts: BehaviorAlert[] = []

  // --- Overtrading detection ---
  const tradesPerHour = detectOvertrading(trades)
  if (tradesPerHour > OVERTRADING_THRESHOLD_PER_HOUR) {
    alerts.push({
      type: "overtrading",
      severity: tradesPerHour > 20 ? "critical" : "warning",
      title: "Overtrading Detected",
      message: `You're averaging ${tradesPerHour.toFixed(1)} trades/hour. Frequent trading often leads to higher costs and emotional decisions.`,
      recommendation: "Take a step back and plan your trades. Quality over quantity. Set specific entry/exit criteria before trading.",
    })
  }

  // --- Trend ignoring ---
  const trendAlignmentRate = detectTrendIgnoring(trades)
  if (trendAlignmentRate < 40 && trades.filter(t => t.trendSignal !== undefined).length >= 5) {
    alerts.push({
      type: "trend_ignoring",
      severity: trendAlignmentRate < 25 ? "critical" : "warning",
      title: "Trading Against the Trend",
      message: `Only ${trendAlignmentRate}% of your recent trades align with the market trend. "The trend is your friend" — fighting it increases risk.`,
      recommendation: "Before each trade, check the moving averages. Consider trading in the direction of the dominant trend.",
    })
  }

  // --- Sentiment ignoring ---
  const sentimentAlignmentRate = detectSentimentIgnoring(trades)
  if (sentimentAlignmentRate < 40 && trades.filter(t => t.sentimentSignal !== undefined).length >= 5) {
    alerts.push({
      type: "sentiment_ignoring",
      severity: sentimentAlignmentRate < 25 ? "critical" : "warning",
      title: "Ignoring Market Sentiment",
      message: `Only ${sentimentAlignmentRate}% of your trades align with market sentiment. News and sentiment drive short-term price movements.`,
      recommendation: "Check the news sentiment before trading. Buying into bearish sentiment or selling into bullish sentiment carries extra risk.",
    })
  }

  // --- Frequent reversals ---
  const reversalRate = detectReversals(trades)
  if (reversalRate > 30) {
    alerts.push({
      type: "frequent_reversals",
      severity: reversalRate > 50 ? "critical" : "warning",
      title: "Frequent Position Reversals",
      message: `${reversalRate}% of your trades are quick reversals (buy→sell or sell→buy within 5 minutes). This suggests indecision.`,
      recommendation: "Set a clear plan before entering a trade. Decide your target price and stop-loss level in advance.",
    })
  }

  // --- Concentration risk ---
  const uniqueSymbols = new Set(trades.map(t => t.symbol)).size
  if (trades.length >= 10 && uniqueSymbols === 1) {
    alerts.push({
      type: "concentration_risk",
      severity: "info",
      title: "Portfolio Concentration",
      message: `All your recent trades are in a single stock. Diversification helps manage risk.`,
      recommendation: "Consider exploring stocks in different sectors to spread your risk.",
    })
  }

  return {
    alerts,
    patterns: {
      tradesPerHour,
      trendAlignmentRate,
      sentimentAlignmentRate,
      reversalRate,
      uniqueSymbols,
    },
  }
}

function detectOvertrading(trades: TradeRecord[]): number {
  if (trades.length < 2) return 0

  const timestamps = trades.map(t => new Date(t.timestamp).getTime()).sort()
  const timeSpanMs = timestamps[timestamps.length - 1] - timestamps[0]
  const timeSpanHours = timeSpanMs / (1000 * 60 * 60)

  if (timeSpanHours < 0.01) return trades.length // essentially all at once
  return trades.length / timeSpanHours
}

function detectTrendIgnoring(trades: TradeRecord[]): number {
  const tradesWithTrend = trades.filter(t => t.trendSignal !== undefined && t.trendSignal !== 0)
  if (tradesWithTrend.length === 0) return 100

  const aligned = tradesWithTrend.filter(t => {
    const action = t.type === "buy" ? 1 : -1
    return action * (t.trendSignal ?? 0) > 0 // same direction = aligned
  })

  return Math.round((aligned.length / tradesWithTrend.length) * 100)
}

function detectSentimentIgnoring(trades: TradeRecord[]): number {
  const tradesWithSentiment = trades.filter(t => t.sentimentSignal !== undefined && t.sentimentSignal !== 0)
  if (tradesWithSentiment.length === 0) return 100

  const aligned = tradesWithSentiment.filter(t => {
    const action = t.type === "buy" ? 1 : -1
    return action * (t.sentimentSignal ?? 0) > 0
  })

  return Math.round((aligned.length / tradesWithSentiment.length) * 100)
}

function detectReversals(trades: TradeRecord[]): number {
  if (trades.length < 2) return 0

  let reversalCount = 0
  const sorted = [...trades].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    if (prev.symbol !== curr.symbol) continue
    if (prev.type === curr.type) continue // same direction, not a reversal

    const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()
    if (timeDiff < REVERSAL_WINDOW_MS) {
      reversalCount++
    }
  }

  return Math.round((reversalCount / (trades.length - 1)) * 100)
}
