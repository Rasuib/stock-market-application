import { describe, it, expect } from "vitest"
import { classifyMarketRegime, getRegimeWeightAdjustments } from "../market-regime"
import type { EvaluateTradeInput } from "../types"

function makeInput(overrides: Partial<EvaluateTradeInput> = {}): EvaluateTradeInput {
  return {
    action: "buy",
    symbol: "AAPL",
    quantity: 10,
    price: 150,
    market: "US",
    currency: "USD",
    sentiment: { label: "neutral", score: 50, confidence: 0.5, source: "finbert" },
    trend: { label: "uncertain", signal: 0, confidence: 0.3, shortMA: 150, longMA: 150, momentum: 0 },
    portfolioExposure: 0.3,
    recentTradeCount: 1,
    existingPositionSize: 0,
    totalBalance: 100000,
    recentRewards: [],
    tradeHistory: [],
    ...overrides,
  }
}

describe("classifyMarketRegime", () => {
  it("classifies strong uptrend correctly", () => {
    const result = classifyMarketRegime(makeInput({
      sentiment: { label: "bullish", score: 80, confidence: 0.8, source: "finbert" },
      trend: { label: "uptrend", signal: 0.8, confidence: 0.7, shortMA: 155, longMA: 148, momentum: 2.5 },
    }))

    expect(result.regime).toBe("trending_up")
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.maSpread).toBeGreaterThan(0)
    expect(result.description).toContain("trending upward")
  })

  it("classifies strong downtrend correctly", () => {
    const result = classifyMarketRegime(makeInput({
      sentiment: { label: "bearish", score: 20, confidence: 0.8, source: "finbert" },
      trend: { label: "downtrend", signal: -0.8, confidence: 0.7, shortMA: 140, longMA: 155, momentum: -3 },
    }))

    expect(result.regime).toBe("trending_down")
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.maSpread).toBeLessThan(0)
  })

  it("classifies range-bound market", () => {
    const result = classifyMarketRegime(makeInput({
      sentiment: { label: "neutral", score: 50, confidence: 0.5, source: "finbert" },
      trend: { label: "range", signal: 0.1, confidence: 0.5, shortMA: 150.5, longMA: 150, momentum: 0.2 },
    }))

    expect(result.regime).toBe("range_bound")
  })

  it("classifies high uncertainty when signals disagree", () => {
    const result = classifyMarketRegime(makeInput({
      sentiment: { label: "bullish", score: 75, confidence: 0.7, source: "finbert" },
      trend: { label: "downtrend", signal: -0.6, confidence: 0.6, shortMA: 145, longMA: 155, momentum: -1 },
    }))

    expect(result.regime).toBe("high_uncertainty")
    expect(result.signalAgreement).toBeLessThan(0)
    expect(result.description).toContain("disagree")
  })

  it("classifies weak signal when confidence is low", () => {
    const result = classifyMarketRegime(makeInput({
      sentiment: { label: "neutral", score: 50, confidence: 0.2, source: "unavailable" },
      trend: { label: "uncertain", signal: 0, confidence: 0.2, shortMA: 150, longMA: 150, momentum: 0 },
    }))

    expect(result.regime).toBe("weak_signal")
    expect(result.confidence).toBeLessThanOrEqual(0.5)
  })

  it("signal agreement is positive when both agree", () => {
    const result = classifyMarketRegime(makeInput({
      sentiment: { label: "bullish", score: 75, confidence: 0.7, source: "finbert" },
      trend: { label: "uptrend", signal: 0.7, confidence: 0.7, shortMA: 155, longMA: 148, momentum: 2 },
    }))

    expect(result.signalAgreement).toBeGreaterThan(0)
  })
})

describe("getRegimeWeightAdjustments", () => {
  it("increases alignment weight for trending markets", () => {
    const adj = getRegimeWeightAdjustments("trending_up")
    expect(adj.alignmentMultiplier).toBeGreaterThan(1)
  })

  it("increases risk/discipline weight for uncertain markets", () => {
    const adj = getRegimeWeightAdjustments("high_uncertainty")
    expect(adj.riskMultiplier).toBeGreaterThan(1)
    expect(adj.disciplineMultiplier).toBeGreaterThan(1)
    expect(adj.alignmentMultiplier).toBeLessThan(1)
  })

  it("increases discipline weight for weak signal markets", () => {
    const adj = getRegimeWeightAdjustments("weak_signal")
    expect(adj.disciplineMultiplier).toBeGreaterThan(1)
    expect(adj.alignmentMultiplier).toBeLessThan(1)
  })
})
