/**
 * Trend Detection Module
 *
 * Analyzes price data to determine market trend using:
 * - Simple Moving Averages (SMA)
 * - Price change percentage
 * - Trend signal: uptrend (+1), neutral (0), downtrend (-1)
 */

export interface TrendSignal {
  trend: "uptrend" | "neutral" | "downtrend"
  signal: 1 | 0 | -1
  confidence: number
  shortMA: number
  longMA: number
  priceChangePercent: number
}

export interface PricePoint {
  price: number
  timestamp: number
}

/**
 * Calculate Simple Moving Average over n periods.
 * MA = (1/n) * Σ Pi
 */
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0
  const slice = prices.slice(-period)
  return slice.reduce((sum, p) => sum + p, 0) / period
}

/**
 * Calculate price change percentage.
 * ΔP = (Pt - P0) / P0
 */
function priceChangePercent(current: number, reference: number): number {
  if (reference === 0) return 0
  return ((current - reference) / reference) * 100
}

/**
 * Detect trend from historical price data.
 *
 * Uses dual moving average crossover:
 * - Short MA (5 periods) vs Long MA (20 periods)
 * - If shortMA > longMA → uptrend
 * - If shortMA < longMA → downtrend
 * - Otherwise → neutral
 *
 * Confidence is based on the divergence between the two MAs.
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

  // MA crossover signal
  const maDiff = shortMA - longMA
  const maDiffPercent = longMA > 0 ? (maDiff / longMA) * 100 : 0

  // Combine MA crossover with price momentum
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

  // Confidence: how strong is the MA divergence (0 to 1)
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
