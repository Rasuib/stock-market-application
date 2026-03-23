/**
 * Technical Indicators Library
 *
 * Pure computation functions for common trading indicators.
 * Every function is stateless, well-typed, and independently testable.
 *
 * Indicators implemented:
 *   - SMA  (Simple Moving Average)
 *   - EMA  (Exponential Moving Average)
 *   - RSI  (Relative Strength Index)
 *   - MACD (Moving Average Convergence Divergence)
 *   - Bollinger Bands
 *   - ATR  (Average True Range)
 *   - Stochastic Oscillator
 */

// ── Types ──

export interface OHLCPoint {
  open: number
  high: number
  low: number
  close: number
  volume?: number
  timestamp: number
}

export interface RSIResult {
  value: number           // 0-100
  signal: "overbought" | "oversold" | "neutral"
  strength: number        // 0-1 (how extreme)
}

export interface MACDResult {
  macd: number            // MACD line value
  signal: number          // Signal line value
  histogram: number       // MACD - Signal
  trend: "bullish" | "bearish" | "neutral"
  crossover: "bullish_cross" | "bearish_cross" | "none"
}

export interface BollingerResult {
  upper: number
  middle: number          // SMA
  lower: number
  width: number           // (upper - lower) / middle
  percentB: number        // (price - lower) / (upper - lower), 0-1
  signal: "overbought" | "oversold" | "squeeze" | "neutral"
}

export interface ATRResult {
  value: number
  percent: number         // ATR as % of price
  volatility: "high" | "moderate" | "low"
}

export interface StochasticResult {
  k: number               // %K (fast stochastic), 0-100
  d: number               // %D (slow stochastic), 0-100
  signal: "overbought" | "oversold" | "neutral"
  crossover: "bullish_cross" | "bearish_cross" | "none"
}

export interface IndicatorSnapshot {
  rsi: RSIResult | null
  macd: MACDResult | null
  bollinger: BollingerResult | null
  atr: ATRResult | null
  stochastic: StochasticResult | null
  sma20: number | null
  ema12: number | null
  ema26: number | null
  overallSignal: OverallSignal
}

export interface OverallSignal {
  direction: "bullish" | "bearish" | "neutral"
  strength: number        // 0-1
  confidence: number      // 0-1
  signals: SignalVote[]
}

export interface SignalVote {
  indicator: string
  direction: "bullish" | "bearish" | "neutral"
  weight: number
  reason: string
}

// ── SMA ──

export function sma(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  const slice = prices.slice(-period)
  return slice.reduce((sum, p) => sum + p, 0) / period
}

/**
 * Compute SMA series for each point where enough data exists.
 */
export function smaSeries(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null
    const slice = prices.slice(i - period + 1, i + 1)
    return slice.reduce((sum, p) => sum + p, 0) / period
  })
}

// ── EMA ──

export function ema(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  const series = emaSeries(prices, period)
  return series[series.length - 1]
}

/**
 * Compute EMA series. First value is SMA of first `period` points.
 */
export function emaSeries(prices: number[], period: number): (number | null)[] {
  if (prices.length < period) return prices.map(() => null)

  const multiplier = 2 / (period + 1)
  const result: (number | null)[] = new Array(period - 1).fill(null)

  // Seed with SMA
  let prev = prices.slice(0, period).reduce((s, p) => s + p, 0) / period
  result.push(prev)

  for (let i = period; i < prices.length; i++) {
    prev = (prices[i] - prev) * multiplier + prev
    result.push(prev)
  }

  return result
}

// ── RSI ──

/**
 * Relative Strength Index (Wilder's smoothing method).
 * Default period: 14.
 */
export function computeRSI(prices: number[], period: number = 14): RSIResult | null {
  if (prices.length < period + 1) return null

  let avgGain = 0
  let avgLoss = 0

  // Initial averages
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  // Wilder's smoothing for remaining points
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  const rsi = 100 - (100 / (1 + rs))

  let signal: RSIResult["signal"] = "neutral"
  let strength = 0

  if (rsi >= 70) {
    signal = "overbought"
    strength = Math.min(1, (rsi - 70) / 30)
  } else if (rsi <= 30) {
    signal = "oversold"
    strength = Math.min(1, (30 - rsi) / 30)
  } else {
    strength = 1 - Math.abs(rsi - 50) / 20
  }

  return { value: Math.round(rsi * 100) / 100, signal, strength }
}

/**
 * Compute RSI series for charting.
 */
export function rsiSeries(prices: number[], period: number = 14): (number | null)[] {
  if (prices.length < period + 1) return prices.map(() => null)

  const result: (number | null)[] = new Array(period).fill(null)
  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss
  result.push(100 - (100 / (1 + rs0)))

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push(100 - (100 / (1 + rs)))
  }

  return result
}

// ── MACD ──

/**
 * MACD with standard 12/26/9 parameters.
 */
export function computeMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MACDResult | null {
  if (prices.length < slowPeriod + signalPeriod) return null

  const fastEMA = emaSeries(prices, fastPeriod)
  const slowEMA = emaSeries(prices, slowPeriod)

  // MACD line = fast EMA - slow EMA
  const macdLine: number[] = []
  for (let i = 0; i < prices.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine.push(fastEMA[i]! - slowEMA[i]!)
    }
  }

  if (macdLine.length < signalPeriod) return null

  // Signal line = EMA of MACD line
  const signalLine = emaSeries(macdLine, signalPeriod)
  const lastMACD = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1]

  if (lastSignal === null) return null

  const histogram = lastMACD - lastSignal
  const prevMACD = macdLine.length >= 2 ? macdLine[macdLine.length - 2] : lastMACD
  const prevSignal = signalLine.length >= 2 ? (signalLine[signalLine.length - 2] ?? lastSignal) : lastSignal

  // Detect crossover
  let crossover: MACDResult["crossover"] = "none"
  if (prevMACD <= prevSignal && lastMACD > lastSignal) {
    crossover = "bullish_cross"
  } else if (prevMACD >= prevSignal && lastMACD < lastSignal) {
    crossover = "bearish_cross"
  }

  // Trend determined by MACD line position (not histogram)
  // MACD > 0 means fast EMA above slow EMA = bullish trend
  const trend: MACDResult["trend"] =
    lastMACD > 0.01 ? "bullish" :
    lastMACD < -0.01 ? "bearish" : "neutral"

  return {
    macd: Math.round(lastMACD * 10000) / 10000,
    signal: Math.round(lastSignal * 10000) / 10000,
    histogram: Math.round(histogram * 10000) / 10000,
    trend,
    crossover,
  }
}

/**
 * Compute MACD series for charting.
 * Returns { macd, signal, histogram } arrays.
 */
export function macdSeries(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEMA = emaSeries(prices, fastPeriod)
  const slowEMA = emaSeries(prices, slowPeriod)

  const macdLine: (number | null)[] = prices.map((_, i) => {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      return fastEMA[i]! - slowEMA[i]!
    }
    return null
  })

  // Signal line from non-null MACD values
  const nonNullMACD = macdLine.filter((v): v is number => v !== null)
  const signalEMA = emaSeries(nonNullMACD, signalPeriod)

  // Map signal back to full length
  const signalLine: (number | null)[] = new Array(prices.length).fill(null)
  let signalIdx = 0
  for (let i = 0; i < prices.length; i++) {
    if (macdLine[i] !== null) {
      signalLine[i] = signalEMA[signalIdx] ?? null
      signalIdx++
    }
  }

  const histogram: (number | null)[] = prices.map((_, i) => {
    if (macdLine[i] !== null && signalLine[i] !== null) {
      return macdLine[i]! - signalLine[i]!
    }
    return null
  })

  return { macd: macdLine, signal: signalLine, histogram }
}

// ── Bollinger Bands ──

/**
 * Bollinger Bands with 20-period SMA and 2 standard deviations.
 */
export function computeBollinger(
  prices: number[],
  period: number = 20,
  stdMultiplier: number = 2,
): BollingerResult | null {
  if (prices.length < period) return null

  const slice = prices.slice(-period)
  const middle = slice.reduce((s, p) => s + p, 0) / period
  const variance = slice.reduce((s, p) => s + (p - middle) ** 2, 0) / period
  const stdDev = Math.sqrt(variance)

  const upper = middle + stdMultiplier * stdDev
  const lower = middle - stdMultiplier * stdDev
  const currentPrice = prices[prices.length - 1]
  const width = middle > 0 ? (upper - lower) / middle : 0
  const bandRange = upper - lower
  const percentB = bandRange > 0 ? (currentPrice - lower) / bandRange : 0.5

  let signal: BollingerResult["signal"] = "neutral"
  if (width < 0.02) {
    signal = "squeeze"
  } else if (percentB > 0.95) {
    signal = "overbought"
  } else if (percentB < 0.05) {
    signal = "oversold"
  }

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    width: Math.round(width * 10000) / 10000,
    percentB: Math.round(percentB * 10000) / 10000,
    signal,
  }
}

/**
 * Compute Bollinger Band series for charting.
 */
export function bollingerSeries(
  prices: number[],
  period: number = 20,
  stdMultiplier: number = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = []
  const middle: (number | null)[] = []
  const lower: (number | null)[] = []

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(null)
      middle.push(null)
      lower.push(null)
      continue
    }

    const slice = prices.slice(i - period + 1, i + 1)
    const mean = slice.reduce((s, p) => s + p, 0) / period
    const variance = slice.reduce((s, p) => s + (p - mean) ** 2, 0) / period
    const stdDev = Math.sqrt(variance)

    upper.push(mean + stdMultiplier * stdDev)
    middle.push(mean)
    lower.push(mean - stdMultiplier * stdDev)
  }

  return { upper, middle, lower }
}

// ── ATR (Average True Range) ──

/**
 * ATR using Wilder's smoothing, requires OHLC data.
 * Falls back to price-based estimation when only close prices available.
 */
export function computeATR(data: OHLCPoint[], period: number = 14): ATRResult | null {
  if (data.length < period + 1) return null

  // Calculate True Range for each bar
  const trueRanges: number[] = []
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )
    trueRanges.push(tr)
  }

  // Initial ATR = SMA of first `period` TRs
  let atr = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period

  // Wilder's smoothing
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
  }

  const lastPrice = data[data.length - 1].close
  const percent = lastPrice > 0 ? (atr / lastPrice) * 100 : 0

  let volatility: ATRResult["volatility"] = "moderate"
  if (percent > 3) volatility = "high"
  else if (percent < 1) volatility = "low"

  return {
    value: Math.round(atr * 100) / 100,
    percent: Math.round(percent * 100) / 100,
    volatility,
  }
}

/**
 * Estimate ATR from close prices only (when OHLC not available).
 * Uses absolute price changes as a proxy for True Range.
 */
export function computeATRFromPrices(prices: number[], period: number = 14): ATRResult | null {
  if (prices.length < period + 1) return null

  const ranges: number[] = []
  for (let i = 1; i < prices.length; i++) {
    ranges.push(Math.abs(prices[i] - prices[i - 1]))
  }

  let atr = ranges.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < ranges.length; i++) {
    atr = (atr * (period - 1) + ranges[i]) / period
  }

  const lastPrice = prices[prices.length - 1]
  const percent = lastPrice > 0 ? (atr / lastPrice) * 100 : 0

  let volatility: ATRResult["volatility"] = "moderate"
  if (percent > 3) volatility = "high"
  else if (percent < 1) volatility = "low"

  return {
    value: Math.round(atr * 100) / 100,
    percent: Math.round(percent * 100) / 100,
    volatility,
  }
}

// ── Stochastic Oscillator ──

/**
 * Stochastic Oscillator (%K and %D).
 * Default: 14-period lookback, 3-period %K smoothing, 3-period %D smoothing.
 */
export function computeStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3,
): StochasticResult | null {
  const len = Math.min(highs.length, lows.length, closes.length)
  if (len < kPeriod + kSmooth + dSmooth - 2) return null

  // Raw %K values
  const rawK: number[] = []
  for (let i = kPeriod - 1; i < len; i++) {
    const highSlice = highs.slice(i - kPeriod + 1, i + 1)
    const lowSlice = lows.slice(i - kPeriod + 1, i + 1)
    const highestHigh = Math.max(...highSlice)
    const lowestLow = Math.min(...lowSlice)
    const range = highestHigh - lowestLow
    rawK.push(range > 0 ? ((closes[i] - lowestLow) / range) * 100 : 50)
  }

  // Smooth %K with SMA
  const smoothedK: number[] = []
  for (let i = kSmooth - 1; i < rawK.length; i++) {
    const slice = rawK.slice(i - kSmooth + 1, i + 1)
    smoothedK.push(slice.reduce((s, v) => s + v, 0) / kSmooth)
  }

  // %D = SMA of smoothed %K
  const dValues: number[] = []
  for (let i = dSmooth - 1; i < smoothedK.length; i++) {
    const slice = smoothedK.slice(i - dSmooth + 1, i + 1)
    dValues.push(slice.reduce((s, v) => s + v, 0) / dSmooth)
  }

  if (smoothedK.length === 0 || dValues.length === 0) return null

  const k = smoothedK[smoothedK.length - 1]
  const d = dValues[dValues.length - 1]

  // Detect crossover
  let crossover: StochasticResult["crossover"] = "none"
  if (smoothedK.length >= 2 && dValues.length >= 2) {
    const prevK = smoothedK[smoothedK.length - 2]
    const prevD = dValues[dValues.length - 2]
    if (prevK <= prevD && k > d) crossover = "bullish_cross"
    else if (prevK >= prevD && k < d) crossover = "bearish_cross"
  }

  let signal: StochasticResult["signal"] = "neutral"
  if (k > 80 && d > 80) signal = "overbought"
  else if (k < 20 && d < 20) signal = "oversold"

  return {
    k: Math.round(k * 100) / 100,
    d: Math.round(d * 100) / 100,
    signal,
    crossover,
  }
}

/**
 * Stochastic from close prices only (estimate highs/lows from closes).
 */
export function computeStochasticFromPrices(
  prices: number[],
  kPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3,
): StochasticResult | null {
  // Estimate high/low from close prices with small buffer
  const highs = prices.map((p, i) => {
    if (i === 0) return p
    return Math.max(p, prices[i - 1])
  })
  const lows = prices.map((p, i) => {
    if (i === 0) return p
    return Math.min(p, prices[i - 1])
  })
  return computeStochastic(highs, lows, prices, kPeriod, kSmooth, dSmooth)
}

// ── Multi-Indicator Consensus ──

/**
 * Compute all indicators from close prices and produce an overall signal.
 */
export function computeAllIndicators(prices: number[]): IndicatorSnapshot {
  const rsi = computeRSI(prices)
  const macd = computeMACD(prices)
  const bollinger = computeBollinger(prices)
  const atr = computeATRFromPrices(prices)
  const stochastic = computeStochasticFromPrices(prices)
  const sma20 = sma(prices, 20)
  const ema12 = ema(prices, 12)
  const ema26 = ema(prices, 26)

  const overallSignal = computeConsensusSignal(prices, rsi, macd, bollinger, stochastic, sma20)

  return { rsi, macd, bollinger, atr, stochastic, sma20, ema12, ema26, overallSignal }
}

function computeConsensusSignal(
  prices: number[],
  rsi: RSIResult | null,
  macd: MACDResult | null,
  bollinger: BollingerResult | null,
  stochastic: StochasticResult | null,
  sma20: number | null,
): OverallSignal {
  const votes: SignalVote[] = []
  const currentPrice = prices[prices.length - 1]

  // RSI vote (weight: 0.15) — momentum with extreme-level reversal
  if (rsi) {
    let direction: SignalVote["direction"] = "neutral"
    let reason = `RSI at ${rsi.value.toFixed(0)}`
    if (rsi.value < 30) { direction = "bullish"; reason += " (oversold — potential reversal up)" }
    else if (rsi.value > 80) { direction = "bearish"; reason += " (extreme overbought — likely reversal)" }
    else if (rsi.value > 50 && rsi.value <= 70) { direction = "bullish"; reason += " (bullish momentum)" }
    else if (rsi.value > 70) { direction = "neutral"; reason += " (overbought — caution)" }
    else if (rsi.value >= 30 && rsi.value < 50) { direction = "bearish"; reason += " (bearish momentum)" }
    votes.push({ indicator: "RSI", direction, weight: 0.15, reason })
  }

  // MACD vote (weight: 0.30) — trend-following based on MACD line position
  if (macd) {
    let direction: SignalVote["direction"] = "neutral"
    let reason = `MACD line: ${macd.macd > 0 ? "+" : ""}${macd.macd.toFixed(4)}`
    if (macd.macd > 0) { direction = "bullish"; reason += " (fast EMA above slow EMA)" }
    else if (macd.macd < 0) { direction = "bearish"; reason += " (fast EMA below slow EMA)" }
    if (macd.crossover === "bullish_cross") { reason += " (bullish crossover!)" }
    else if (macd.crossover === "bearish_cross") { reason += " (bearish crossover!)" }
    votes.push({ indicator: "MACD", direction, weight: 0.30, reason })
  }

  // Bollinger vote (weight: 0.15) — position relative to middle band
  if (bollinger) {
    let direction: SignalVote["direction"] = "neutral"
    let reason = `Price at ${(bollinger.percentB * 100).toFixed(0)}% of band`
    if (bollinger.percentB >= 0.5 && bollinger.percentB <= 0.95) { direction = "bullish"; reason += " (above middle band)" }
    else if (bollinger.percentB < 0.5 && bollinger.percentB >= 0.05) { direction = "bearish"; reason += " (below middle band)" }
    else if (bollinger.percentB > 0.95) { direction = "neutral"; reason += " (extreme upper — caution)" }
    else if (bollinger.percentB < 0.05) { direction = "neutral"; reason += " (extreme lower — caution)" }
    if (bollinger.signal === "squeeze") { reason += " (squeeze — breakout expected)" }
    votes.push({ indicator: "Bollinger", direction, weight: 0.15, reason })
  }

  // Stochastic vote (weight: 0.15) — momentum based on %K level
  if (stochastic) {
    let direction: SignalVote["direction"] = "neutral"
    let reason = `%K: ${stochastic.k.toFixed(0)}, %D: ${stochastic.d.toFixed(0)}`
    if (stochastic.k > 50) { direction = "bullish"; reason += " (bullish momentum)" }
    else if (stochastic.k < 50) { direction = "bearish"; reason += " (bearish momentum)" }
    if (stochastic.crossover === "bullish_cross") { direction = "bullish"; reason += " (bullish cross)" }
    else if (stochastic.crossover === "bearish_cross") { direction = "bearish"; reason += " (bearish cross)" }
    votes.push({ indicator: "Stochastic", direction, weight: 0.15, reason })
  }

  // SMA20 trend vote (weight: 0.25) — trend-following
  if (sma20 !== null && currentPrice) {
    const pctAbove = ((currentPrice - sma20) / sma20) * 100
    let direction: SignalVote["direction"] = "neutral"
    let reason = `Price ${pctAbove >= 0 ? "+" : ""}${pctAbove.toFixed(1)}% from SMA(20)`
    if (pctAbove > 1) { direction = "bullish"; reason += " (above trend)" }
    else if (pctAbove < -1) { direction = "bearish"; reason += " (below trend)" }
    votes.push({ indicator: "SMA Trend", direction, weight: 0.25, reason })
  }

  // Compute weighted consensus
  let bullishScore = 0
  let bearishScore = 0
  let totalWeight = 0

  for (const vote of votes) {
    totalWeight += vote.weight
    if (vote.direction === "bullish") bullishScore += vote.weight
    else if (vote.direction === "bearish") bearishScore += vote.weight
  }

  const bullishPct = totalWeight > 0 ? bullishScore / totalWeight : 0
  const bearishPct = totalWeight > 0 ? bearishScore / totalWeight : 0

  let direction: OverallSignal["direction"] = "neutral"
  let strength = 0

  if (bullishPct > bearishPct + 0.1) {
    direction = "bullish"
    strength = Math.min(1, bullishPct * 1.5)
  } else if (bearishPct > bullishPct + 0.1) {
    direction = "bearish"
    strength = Math.min(1, bearishPct * 1.5)
  } else {
    strength = 1 - Math.abs(bullishPct - bearishPct) * 2
  }

  const confidence = Math.min(1, totalWeight / 0.8) // Full confidence when >= 80% of indicators available

  return { direction, strength, confidence, signals: votes }
}
