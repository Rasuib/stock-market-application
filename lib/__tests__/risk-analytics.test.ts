import { describe, it, expect } from "vitest"
import { computeRiskMetrics } from "../risk-analytics"
import type { TradeWithCoaching, CoachingReport } from "../coaching/types"

// Helper to create minimal trade objects for testing
function makeTrade(
  overrides: Partial<TradeWithCoaching> & { type: "buy" | "sell"; price: number; quantity: number },
): TradeWithCoaching {
  const cost = overrides.price * overrides.quantity
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    symbol: "TEST",
    cost,
    timestamp: new Date().toISOString(),
    displayTime: "12:00:00",
    market: "US",
    currency: "USD",
    coaching: STUB_COACHING,
    ...overrides,
  }
}

const STUB_COACHING: CoachingReport = {
  verdict: "mixed",
  score: 50,
  confidence: 0.5,
  summary: "Test",
  whatWentRight: [],
  whatWentWrong: [],
  improveNext: [],
  supportingSignals: [],
  contradictorySignals: [],
  riskNotes: [],
  skillTags: [],
  marketSnapshot: {
    sentiment: { label: "neutral", score: 50, confidence: 0.5, source: "unavailable" },
    trend: { label: "uncertain", signal: 0, confidence: 0.5, shortMA: 0, longMA: 0, momentum: 0 },
    price: 100,
    currency: "USD",
    market: "US",
    regime: "weak_signal",
  },
  behavioralFlags: [],
  regimeContext: "",
  reward: { total: 0, alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 },
}

describe("computeRiskMetrics", () => {
  it("returns zeros for empty trades", () => {
    const metrics = computeRiskMetrics([], 100000)
    expect(metrics.winRate).toBe(0)
    expect(metrics.averageWin).toBe(0)
    expect(metrics.averageLoss).toBe(0)
    expect(metrics.maxDrawdown).toBe(0)
    expect(metrics.totalSells).toBe(0)
  })

  it("computes win rate correctly", () => {
    const trades = [
      makeTrade({ type: "buy", price: 100, quantity: 10 }),
      makeTrade({ type: "sell", price: 110, quantity: 10, profit: 100 }),   // win
      makeTrade({ type: "buy", price: 100, quantity: 10 }),
      makeTrade({ type: "sell", price: 90, quantity: 10, profit: -100 }),   // loss
      makeTrade({ type: "buy", price: 100, quantity: 10 }),
      makeTrade({ type: "sell", price: 120, quantity: 10, profit: 200 }),   // win
    ]
    const metrics = computeRiskMetrics(trades, 100000)
    expect(metrics.winRate).toBeCloseTo(66.67, 1)
    expect(metrics.totalSells).toBe(3)
  })

  it("computes average win and loss", () => {
    const trades = [
      makeTrade({ type: "sell", price: 100, quantity: 10, profit: 500 }),
      makeTrade({ type: "sell", price: 100, quantity: 10, profit: 300 }),
      makeTrade({ type: "sell", price: 100, quantity: 10, profit: -200 }),
    ]
    const metrics = computeRiskMetrics(trades, 100000)
    expect(metrics.averageWin).toBe(400)     // (500+300)/2
    expect(metrics.averageLoss).toBe(-200)   // -200/1
  })

  it("computes reward:risk ratio", () => {
    const trades = [
      makeTrade({ type: "sell", price: 100, quantity: 10, profit: 600 }),
      makeTrade({ type: "sell", price: 100, quantity: 10, profit: -200 }),
    ]
    const metrics = computeRiskMetrics(trades, 100000)
    expect(metrics.rewardRiskRatio).toBe(3)  // 600/200
  })

  it("computes max drawdown from trade sequence", () => {
    const trades = [
      makeTrade({ type: "buy", price: 100, quantity: 100 }),   // -10000
      makeTrade({ type: "sell", price: 80, quantity: 100 }),    // +8000 (net: -2000)
      makeTrade({ type: "buy", price: 90, quantity: 50 }),      // -4500
      makeTrade({ type: "sell", price: 95, quantity: 50 }),     // +4750
    ]
    const metrics = computeRiskMetrics(trades, 100000)
    // Balance: 100k → 90k → 98k → 93.5k → 98.25k
    // Peak: 100k. Trough: 90k. Drawdown: -10%
    expect(metrics.maxDrawdown).toBeLessThan(0)
    expect(metrics.maxDrawdown).toBe(-10)
  })

  it("handles all-winning trades", () => {
    const trades = [
      makeTrade({ type: "sell", price: 100, quantity: 10, profit: 100 }),
      makeTrade({ type: "sell", price: 100, quantity: 10, profit: 200 }),
    ]
    const metrics = computeRiskMetrics(trades, 100000)
    expect(metrics.winRate).toBe(100)
    expect(metrics.averageLoss).toBe(0)
    expect(metrics.rewardRiskRatio).toBe(999) // capped Infinity
  })
})
