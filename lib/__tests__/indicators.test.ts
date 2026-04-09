import { describe, it, expect } from "vitest"
import {
  sma, smaSeries, ema, emaSeries,
  computeRSI, rsiSeries,
  computeMACD, macdSeries,
  computeBollinger, bollingerSeries,
  computeATR, computeATRFromPrices,
  computeStochastic, computeStochasticFromPrices,
  computeAllIndicators,
  type OHLCPoint,
} from "../indicators"

// ── Helper: generate trending price data ──

function trendingUp(start: number, n: number, step: number = 0.5): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step + Math.sin(i) * 0.3)
}

function trendingDown(start: number, n: number, step: number = 0.5): number[] {
  return Array.from({ length: n }, (_, i) => start - i * step + Math.sin(i) * 0.3)
}

function oscillating(center: number, n: number, amplitude: number = 5): number[] {
  return Array.from({ length: n }, (_, i) => center + amplitude * Math.sin(i * 0.5))
}

function generateOHLC(closes: number[]): OHLCPoint[] {
  return closes.map((close, i) => ({
    open: close - (Math.random() - 0.5) * 2,
    high: close + Math.abs(Math.random() * 3),
    low: close - Math.abs(Math.random() * 3),
    close,
    volume: 1000 + Math.floor(Math.random() * 5000),
    timestamp: Date.now() + i * 60000,
  }))
}

// ═══════════════════════════════════════════════════════════
// SMA Tests
// ═══════════════════════════════════════════════════════════

describe("SMA", () => {
  it("returns null when not enough data", () => {
    expect(sma([1, 2, 3], 5)).toBeNull()
  })

  it("computes correct SMA for exact period length", () => {
    expect(sma([10, 20, 30, 40, 50], 5)).toBe(30)
  })

  it("uses last N prices", () => {
    expect(sma([1, 2, 10, 20, 30, 40, 50], 5)).toBe(30)
  })

  it("smaSeries returns array of correct length", () => {
    const result = smaSeries([10, 20, 30, 40, 50], 3)
    expect(result).toHaveLength(5)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
    expect(result[2]).toBe(20) // (10+20+30)/3
    expect(result[3]).toBe(30) // (20+30+40)/3
    expect(result[4]).toBe(40) // (30+40+50)/3
  })
})

// ═══════════════════════════════════════════════════════════
// EMA Tests
// ═══════════════════════════════════════════════════════════

describe("EMA", () => {
  it("returns null when not enough data", () => {
    expect(ema([1, 2], 5)).toBeNull()
  })

  it("first EMA value equals SMA seed", () => {
    const prices = [10, 20, 30, 40, 50]
    const series = emaSeries(prices, 3)
    // First 2 are null, third is SMA(10,20,30) = 20
    expect(series[0]).toBeNull()
    expect(series[1]).toBeNull()
    expect(series[2]).toBe(20)
  })

  it("EMA responds faster to recent prices than SMA", () => {
    const prices = [10, 10, 10, 10, 10, 50, 50, 50]
    const emaVal = ema(prices, 5)
    const smaVal = sma(prices, 5)
    // EMA should be closer to 50 (recent) than SMA
    expect(emaVal).not.toBeNull()
    expect(smaVal).not.toBeNull()
    expect(emaVal!).toBeGreaterThan(smaVal!)
  })

  it("emaSeries has correct length", () => {
    const result = emaSeries([1, 2, 3, 4, 5, 6, 7], 3)
    expect(result).toHaveLength(7)
    expect(result.filter(v => v !== null)).toHaveLength(5)
  })
})

// ═══════════════════════════════════════════════════════════
// RSI Tests
// ═══════════════════════════════════════════════════════════

describe("RSI", () => {
  it("returns null with insufficient data", () => {
    expect(computeRSI([1, 2, 3, 4, 5])).toBeNull()
  })

  it("RSI is high (overbought) for strong uptrend", () => {
    const prices = trendingUp(100, 30, 2)
    const result = computeRSI(prices)
    expect(result).not.toBeNull()
    expect(result!.value).toBeGreaterThan(60)
    expect(result!.signal).toBe("overbought")
  })

  it("RSI is low (oversold) for strong downtrend", () => {
    const prices = trendingDown(100, 30, 2)
    const result = computeRSI(prices)
    expect(result).not.toBeNull()
    expect(result!.value).toBeLessThan(40)
    expect(result!.signal).toBe("oversold")
  })

  it("RSI is near 50 for oscillating prices", () => {
    const prices = oscillating(100, 40, 2)
    const result = computeRSI(prices)
    expect(result).not.toBeNull()
    expect(result!.value).toBeGreaterThan(30)
    expect(result!.value).toBeLessThan(70)
    expect(result!.signal).toBe("neutral")
  })

  it("RSI is bounded 0-100", () => {
    const prices = trendingUp(10, 50, 5)
    const result = computeRSI(prices)
    expect(result!.value).toBeGreaterThanOrEqual(0)
    expect(result!.value).toBeLessThanOrEqual(100)
  })

  it("RSI reaches 100 when there are no losses", () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 2)
    const result = computeRSI(prices)
    expect(result).not.toBeNull()
    expect(result!.value).toBe(100)
  })

  it("rsiSeries has correct length", () => {
    const prices = trendingUp(100, 30)
    const series = rsiSeries(prices)
    expect(series).toHaveLength(30)
    // First 14 should be null
    expect(series.slice(0, 14).every(v => v === null)).toBe(true)
    // Rest should be numbers
    expect(series.slice(14).every(v => typeof v === "number")).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// MACD Tests
// ═══════════════════════════════════════════════════════════

describe("MACD", () => {
  it("returns null with insufficient data", () => {
    expect(computeMACD([1, 2, 3])).toBeNull()
  })

  it("MACD is bullish for uptrend", () => {
    const prices = trendingUp(100, 50, 1)
    const result = computeMACD(prices)
    expect(result).not.toBeNull()
    expect(result!.macd).toBeGreaterThan(0)
    expect(result!.trend).toBe("bullish")
  })

  it("MACD is bearish for downtrend", () => {
    const prices = trendingDown(200, 50, 1)
    const result = computeMACD(prices)
    expect(result).not.toBeNull()
    expect(result!.macd).toBeLessThan(0)
    expect(result!.trend).toBe("bearish")
  })

  it("MACD histogram = MACD - Signal", () => {
    const prices = trendingUp(100, 50)
    const result = computeMACD(prices)
    expect(result).not.toBeNull()
    const expectedHistogram = Math.round((result!.macd - result!.signal) * 10000) / 10000
    expect(result!.histogram).toBe(expectedHistogram)
  })

  it("detects bullish crossover", () => {
    // Down then up = crossover happens
    const prices = [...trendingDown(150, 30, 1), ...trendingUp(120, 25, 1.5)]
    const result = computeMACD(prices)
    expect(result).not.toBeNull()
    // After recovery the MACD should be bullish or crossing
    expect(["bullish", "neutral"]).toContain(result!.trend)
  })

  it("macdSeries returns three arrays of correct length", () => {
    const prices = trendingUp(100, 50)
    const series = macdSeries(prices)
    expect(series.macd).toHaveLength(50)
    expect(series.signal).toHaveLength(50)
    expect(series.histogram).toHaveLength(50)
  })
})

// ═══════════════════════════════════════════════════════════
// Bollinger Bands Tests
// ═══════════════════════════════════════════════════════════

describe("Bollinger Bands", () => {
  it("returns null with insufficient data", () => {
    expect(computeBollinger([1, 2, 3])).toBeNull()
  })

  it("upper > middle > lower always", () => {
    const prices = oscillating(100, 30, 5)
    const result = computeBollinger(prices)
    expect(result).not.toBeNull()
    expect(result!.upper).toBeGreaterThan(result!.middle)
    expect(result!.middle).toBeGreaterThan(result!.lower)
  })

  it("percentB is near 1 when price at upper band", () => {
    // Rising prices = near upper band
    const prices = trendingUp(100, 25, 2)
    const result = computeBollinger(prices)
    expect(result).not.toBeNull()
    expect(result!.percentB).toBeGreaterThan(0.5)
  })

  it("percentB is near 0 when price at lower band", () => {
    const prices = trendingDown(200, 25, 2)
    const result = computeBollinger(prices)
    expect(result).not.toBeNull()
    expect(result!.percentB).toBeLessThan(0.5)
  })

  it("width is positive", () => {
    const prices = oscillating(100, 30)
    const result = computeBollinger(prices)
    expect(result!.width).toBeGreaterThan(0)
  })

  it("squeeze detected for tight price range", () => {
    // Very flat prices → tiny bands → squeeze
    const prices = Array.from({ length: 25 }, () => 100 + (Math.random() - 0.5) * 0.01)
    const result = computeBollinger(prices)
    expect(result).not.toBeNull()
    expect(result!.signal).toBe("squeeze")
  })

  it("bollingerSeries returns arrays of correct length", () => {
    const prices = oscillating(100, 30)
    const series = bollingerSeries(prices)
    expect(series.upper).toHaveLength(30)
    expect(series.middle).toHaveLength(30)
    expect(series.lower).toHaveLength(30)
  })
})

// ═══════════════════════════════════════════════════════════
// ATR Tests
// ═══════════════════════════════════════════════════════════

describe("ATR", () => {
  it("returns null with insufficient OHLC data", () => {
    const data = generateOHLC([100, 101, 102])
    expect(computeATR(data)).toBeNull()
  })

  it("ATR is positive for volatile data", () => {
    const closes = oscillating(100, 30, 10)
    const data = generateOHLC(closes)
    const result = computeATR(data)
    expect(result).not.toBeNull()
    expect(result!.value).toBeGreaterThan(0)
  })

  it("ATR percent is relative to price", () => {
    const closes = oscillating(100, 20, 3)
    const data = generateOHLC(closes)
    const result = computeATR(data)
    expect(result).not.toBeNull()
    expect(result!.percent).toBeGreaterThan(0)
  })

  it("computeATRFromPrices works with close-only data", () => {
    const prices = oscillating(100, 30, 5)
    const result = computeATRFromPrices(prices)
    expect(result).not.toBeNull()
    expect(result!.value).toBeGreaterThan(0)
  })

  it("high volatility detected for large price swings", () => {
    const prices = oscillating(100, 30, 20)
    const result = computeATRFromPrices(prices)
    expect(result).not.toBeNull()
    expect(result!.volatility).toBe("high")
  })
})

// ═══════════════════════════════════════════════════════════
// Stochastic Tests
// ═══════════════════════════════════════════════════════════

describe("Stochastic", () => {
  it("returns null with insufficient data", () => {
    expect(computeStochasticFromPrices([1, 2, 3])).toBeNull()
  })

  it("%K and %D are bounded 0-100", () => {
    const prices = oscillating(100, 40, 5)
    const result = computeStochasticFromPrices(prices)
    expect(result).not.toBeNull()
    expect(result!.k).toBeGreaterThanOrEqual(0)
    expect(result!.k).toBeLessThanOrEqual(100)
    expect(result!.d).toBeGreaterThanOrEqual(0)
    expect(result!.d).toBeLessThanOrEqual(100)
  })

  it("high %K in strong uptrend", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 50 + i * 2)
    const result = computeStochasticFromPrices(prices)
    expect(result).not.toBeNull()
    expect(result!.k).toBeGreaterThan(50)
  })

  it("low %K in strong downtrend", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 200 - i * 2)
    const result = computeStochasticFromPrices(prices)
    expect(result).not.toBeNull()
    expect(result!.k).toBeLessThan(50)
  })

  it("works with OHLC data", () => {
    const closes = oscillating(100, 40, 5)
    const highs = closes.map(c => c + 3)
    const lows = closes.map(c => c - 3)
    const result = computeStochastic(highs, lows, closes)
    expect(result).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════
// Multi-Indicator Consensus Tests
// ═══════════════════════════════════════════════════════════

describe("computeAllIndicators", () => {
  it("returns full snapshot for sufficient data", () => {
    const prices = trendingUp(100, 50)
    const result = computeAllIndicators(prices)
    expect(result.rsi).not.toBeNull()
    expect(result.macd).not.toBeNull()
    expect(result.bollinger).not.toBeNull()
    expect(result.atr).not.toBeNull()
    expect(result.stochastic).not.toBeNull()
    expect(result.sma20).not.toBeNull()
    expect(result.ema12).not.toBeNull()
    expect(result.ema26).not.toBeNull()
  })

  it("overall signal is bullish for strong uptrend", () => {
    // Monotonic uptrend — no sinusoidal noise
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2)
    const result = computeAllIndicators(prices)
    expect(result.overallSignal.direction).toBe("bullish")
    expect(result.overallSignal.strength).toBeGreaterThan(0)
  })

  it("overall signal is bearish for strong downtrend", () => {
    // Monotonic downtrend
    const prices = Array.from({ length: 50 }, (_, i) => 200 - i * 2)
    const result = computeAllIndicators(prices)
    expect(result.overallSignal.direction).toBe("bearish")
    expect(result.overallSignal.strength).toBeGreaterThan(0)
  })

  it("overall signal has confidence based on available indicators", () => {
    const prices = trendingUp(100, 50)
    const result = computeAllIndicators(prices)
    expect(result.overallSignal.confidence).toBeGreaterThan(0)
    expect(result.overallSignal.confidence).toBeLessThanOrEqual(1)
  })

  it("confidence is reduced when MACD is unavailable", () => {
    const prices = trendingUp(100, 30)
    const result = computeAllIndicators(prices)
    expect(result.macd).toBeNull()
    expect(result.overallSignal.confidence).toBeCloseTo(0.7, 5)
  })

  it("signal votes list all contributing indicators", () => {
    const prices = trendingUp(100, 50)
    const result = computeAllIndicators(prices)
    const indicatorNames = result.overallSignal.signals.map(s => s.indicator)
    expect(indicatorNames).toContain("RSI")
    expect(indicatorNames).toContain("MACD")
    expect(indicatorNames).toContain("Bollinger")
    expect(indicatorNames).toContain("SMA Trend")
  })

  it("handles insufficient data gracefully", () => {
    const prices = [100, 101, 102]
    const result = computeAllIndicators(prices)
    expect(result.rsi).toBeNull()
    expect(result.macd).toBeNull()
    // Should still produce an overallSignal (even if no votes)
    expect(result.overallSignal).toBeDefined()
    expect(result.overallSignal.direction).toBe("neutral")
  })
})
