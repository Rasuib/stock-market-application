/**
 * Trend Detection Module
 *
 * Analyzes price data to determine market trend using:
 * - Multi-indicator consensus (RSI, MACD, Bollinger, Stochastic, SMA)
 * - Falls back to dual-SMA crossover when insufficient data for full analysis
 * - Trend signal: uptrend (+1), neutral (0), downtrend (-1)
 */

import { computeAllIndicators, type IndicatorSnapshot } from "@/lib/indicators"

export interface TrendSignal {
  trend: "uptrend" | "neutral" | "downtrend"
  signal: 1 | 0 | -1
  confidence: number
  shortMA: number
  longMA: number
  priceChangePercent: number
  /** Full indicator snapshot when enough data is available */
  indicators?: IndicatorSnapshot
}

export interface PricePoint {
  price: number
  timestamp: number
}

/**
 * Calculate Simple Moving Average over n periods.
 */
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0
  const slice = prices.slice(-period)
  return slice.reduce((sum, p) => sum + p, 0) / period
}

/**
 * Calculate price change percentage.
 */
function priceChangePercent(current: number, reference: number): number {
  if (reference === 0) return 0
  return ((current - reference) / reference) * 100
}

/**
 * Detect trend from historical price data.
 *
 * With 26+ data points, uses multi-indicator consensus (RSI, MACD, Bollinger,
 * Stochastic, SMA) for a robust signal. Falls back to dual-MA crossover
 * when data is insufficient for full indicator computation.
 */
export function detectTrend(priceHistory: PricePoint[], shortPeriod = 5, longPeriod = 20): TrendSignal {
  if (priceHistory.length < 2) {
    return { trend: "neutral", signal: 0, confidence: 0, shortMA: 0, longMA: 0, priceChangePercent: 0 }
  }

  const prices = priceHistory.map(p => p.price)
  const currentPrice = prices[prices.length - 1]
  const firstPrice = prices[0]

  const shortMA = calculateSMA(prices, shortPeriod)
  const longMA = calculateSMA(prices, longPeriod)
  const changePct = priceChangePercent(currentPrice, firstPrice)

  // With enough data, use multi-indicator consensus
  if (prices.length >= 35) {
    const snapshot = computeAllIndicators(prices)
    const { direction, confidence } = snapshot.overallSignal

    let trend: "uptrend" | "neutral" | "downtrend"
    let signal: 1 | 0 | -1

    if (direction === "bullish") {
      trend = "uptrend"
      signal = 1
    } else if (direction === "bearish") {
      trend = "downtrend"
      signal = -1
    } else {
      trend = "neutral"
      signal = 0
    }

    return {
      trend,
      signal,
      confidence,
      shortMA: Math.round(shortMA * 100) / 100,
      longMA: Math.round(longMA * 100) / 100,
      priceChangePercent: Math.round(changePct * 100) / 100,
      indicators: snapshot,
    }
  }

  // Fallback: dual-MA crossover for limited data
  const maDiff = shortMA - longMA
  const maDiffPercent = longMA > 0 ? (maDiff / longMA) * 100 : 0

  let signal: 1 | 0 | -1
  let trend: "uptrend" | "neutral" | "downtrend"

  if (maDiffPercent > 0.5 && changePct > 0) {
    signal = 1
    trend = "uptrend"
  } else if (maDiffPercent < -0.5 && changePct < 0) {
    signal = -1
    trend = "downtrend"
  } else {
    signal = 0
    trend = "neutral"
  }

  const confidence = Math.min(1, Math.abs(maDiffPercent) / 5)

  return {
    trend,
    signal,
    confidence,
    shortMA: Math.round(shortMA * 100) / 100,
    longMA: Math.round(longMA * 100) / 100,
    priceChangePercent: Math.round(changePct * 100) / 100,
  }
}
