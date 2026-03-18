import { describe, it, expect } from "vitest"
import { detectTrend, type PricePoint } from "../trend-detection"

function makePrices(values: number[], startTimestamp = 1000000): PricePoint[] {
  return values.map((price, i) => ({ price, timestamp: startTimestamp + i * 60000 }))
}

describe("detectTrend", () => {
  it("returns neutral for fewer than 2 data points", () => {
    const result = detectTrend([{ price: 100, timestamp: 1 }])
    expect(result.trend).toBe("neutral")
    expect(result.signal).toBe(0)
    expect(result.confidence).toBe(0)
  })

  it("detects uptrend when prices are consistently rising", () => {
    // 25 points rising from 100 to 124
    const prices = makePrices(Array.from({ length: 25 }, (_, i) => 100 + i))
    const result = detectTrend(prices)
    expect(result.trend).toBe("uptrend")
    expect(result.signal).toBe(1)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.priceChangePercent).toBeGreaterThan(0)
  })

  it("detects downtrend when prices are consistently falling", () => {
    const prices = makePrices(Array.from({ length: 25 }, (_, i) => 200 - i))
    const result = detectTrend(prices)
    expect(result.trend).toBe("downtrend")
    expect(result.signal).toBe(-1)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.priceChangePercent).toBeLessThan(0)
  })

  it("returns neutral for flat prices", () => {
    const prices = makePrices(Array.from({ length: 25 }, () => 150))
    const result = detectTrend(prices)
    expect(result.trend).toBe("neutral")
    expect(result.signal).toBe(0)
    expect(result.priceChangePercent).toBe(0)
  })

  it("calculates shortMA and longMA correctly", () => {
    const values = Array.from({ length: 25 }, (_, i) => 100 + i)
    const prices = makePrices(values)
    const result = detectTrend(prices, 5, 20)

    // shortMA should be average of last 5 prices: 120,121,122,123,124 = 122
    expect(result.shortMA).toBeCloseTo(122, 0)
    // longMA should be average of last 20 prices: 105..124 = 114.5
    expect(result.longMA).toBeCloseTo(114.5, 0)
  })

  it("handles very short price histories (2-4 points)", () => {
    const prices = makePrices([100, 110])
    const result = detectTrend(prices)
    // With only 2 points and 10% rise, should detect uptrend
    expect(result.priceChangePercent).toBe(10)
    expect(["uptrend", "neutral"]).toContain(result.trend)
  })
})
