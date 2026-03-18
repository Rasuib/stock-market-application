import { describe, it, expect } from "vitest"
import { evaluateTradeForCoaching } from "../evaluate-trade"
import type { EvaluateTradeInput, TradeWithCoaching } from "../types"

// ── Helper to build inputs ──

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

function makeTrade(overrides: Partial<TradeWithCoaching> = {}): TradeWithCoaching {
  return {
    id: Math.random().toString(36),
    type: "buy",
    symbol: "AAPL",
    quantity: 10,
    price: 150,
    cost: 1500,
    timestamp: new Date().toISOString(),
    displayTime: "12:00",
    market: "US",
    currency: "USD",
    coaching: {
      verdict: "mixed",
      score: 50,
      confidence: 0.5,
      summary: "test",
      whatWentRight: [],
      whatWentWrong: [],
      improveNext: [],
      supportingSignals: [],
      contradictorySignals: [],
      riskNotes: [],
      skillTags: [],
      marketSnapshot: {
        sentiment: { label: "neutral", score: 50, confidence: 0.5, source: "finbert" },
        trend: { label: "uncertain", signal: 0, confidence: 0.3, shortMA: 150, longMA: 150, momentum: 0 },
        price: 150,
        currency: "USD",
        market: "US",
        regime: "weak_signal",
      },
      behavioralFlags: [],
      regimeContext: "",
      reward: { total: 0, alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 },
    },
    ...overrides,
  }
}

describe("evaluateTradeForCoaching — expert system", () => {
  // ── Scenario 1: Bullish alignment → strong ──
  it("rates aligned bullish buy as strong", () => {
    const result = evaluateTradeForCoaching(makeInput({
      action: "buy",
      sentiment: { label: "bullish", score: 80, confidence: 0.8, source: "finbert" },
      trend: { label: "uptrend", signal: 0.8, confidence: 0.7, shortMA: 155, longMA: 148, momentum: 2.5 },
    }))

    expect(result.verdict).toBe("strong")
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.whatWentRight.length).toBeGreaterThan(0)
    expect(result.supportingSignals.length).toBeGreaterThan(0)
    expect(result.improveNext.length).toBeGreaterThan(0)
    expect(result.summary).toContain("Buy")
  })

  // ── Scenario 2: Buy against all signals → weak ──
  it("rates buy against bearish+downtrend+overexposed as weak", () => {
    const result = evaluateTradeForCoaching(makeInput({
      action: "buy",
      sentiment: { label: "bearish", score: 20, confidence: 0.8, source: "finbert" },
      trend: { label: "downtrend", signal: -0.8, confidence: 0.7, shortMA: 140, longMA: 155, momentum: -3 },
      recentTradeCount: 8,
      portfolioExposure: 0.85,
    }))

    expect(result.verdict).toBe("weak")
    expect(result.score).toBeLessThan(40)
    expect(result.whatWentWrong.length).toBeGreaterThan(0)
    expect(result.contradictorySignals.length).toBeGreaterThan(0)
    expect(result.behavioralFlags.some(f => f.flag === "trend_fighting")).toBe(true)
  })

  // ── Scenario 3: Oversized buy ──
  it("flags oversized position", () => {
    const result = evaluateTradeForCoaching(makeInput({
      action: "buy",
      quantity: 400,
      price: 150,
      totalBalance: 100000,
    }))

    expect(result.behavioralFlags.some(f => f.flag === "oversized_position")).toBe(true)
    expect(result.riskNotes.length).toBeGreaterThan(0)
  })

  // ── Scenario 4: Profitable sell with alignment ──
  it("rates aligned profitable sell as strong", () => {
    const result = evaluateTradeForCoaching(makeInput({
      action: "sell",
      quantity: 10,
      price: 165,
      profit: 500,
      profitPercent: 10,
      sentiment: { label: "bearish", score: 30, confidence: 0.6, source: "finbert" },
      trend: { label: "downtrend", signal: -0.5, confidence: 0.5, shortMA: 160, longMA: 165, momentum: -1.5 },
    }))

    expect(result.verdict).toBe("strong")
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.whatWentRight.length).toBeGreaterThan(0)
  })

  // ── Scenario 5: Panic sell ──
  it("detects panic exit on quick loss sell", () => {
    const recentBuy = makeTrade({
      type: "buy",
      symbol: "AAPL",
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    })

    const result = evaluateTradeForCoaching(makeInput({
      action: "sell",
      symbol: "AAPL",
      profit: -50,
      profitPercent: -3,
      tradeHistory: [recentBuy],
    }))

    expect(result.behavioralFlags.some(f => f.flag === "panic_exit")).toBe(true)
    expect(result.whatWentWrong.length).toBeGreaterThan(0)
  })

  // ── Scenario 6: Overtrading detection ──
  it("detects overtrading with high trade count", () => {
    const result = evaluateTradeForCoaching(makeInput({
      recentTradeCount: 12,
    }))

    expect(result.behavioralFlags.some(f => f.flag === "overtrading")).toBe(true)
  })

  // ── Scenario 7: Report structure completeness ──
  it("always produces a complete report structure", () => {
    const result = evaluateTradeForCoaching(makeInput())

    expect(result).toHaveProperty("verdict")
    expect(result).toHaveProperty("score")
    expect(result).toHaveProperty("confidence")
    expect(result).toHaveProperty("summary")
    expect(result).toHaveProperty("whatWentRight")
    expect(result).toHaveProperty("whatWentWrong")
    expect(result).toHaveProperty("improveNext")
    expect(result).toHaveProperty("supportingSignals")
    expect(result).toHaveProperty("contradictorySignals")
    expect(result).toHaveProperty("riskNotes")
    expect(result).toHaveProperty("skillTags")
    expect(result).toHaveProperty("marketSnapshot")
    expect(result).toHaveProperty("behavioralFlags")
    expect(result).toHaveProperty("regimeContext")
    expect(result).toHaveProperty("reward")

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.improveNext.length).toBeGreaterThan(0)
    expect(result.whatWentRight.length).toBeGreaterThan(0)
  })

  // ── Scenario 8: Market regime included in report ──
  it("includes market regime in report", () => {
    const result = evaluateTradeForCoaching(makeInput({
      sentiment: { label: "bullish", score: 80, confidence: 0.8, source: "finbert" },
      trend: { label: "uptrend", signal: 0.8, confidence: 0.7, shortMA: 155, longMA: 148, momentum: 2.5 },
    }))

    expect(result.marketSnapshot.regime).toBeDefined()
    expect(result.regimeContext).toBeTruthy()
    expect(typeof result.regimeContext).toBe("string")
  })

  // ── Scenario 9: Confidence scales with signal quality ──
  it("reports higher confidence with better signals", () => {
    const highConf = evaluateTradeForCoaching(makeInput({
      sentiment: { label: "bullish", score: 80, confidence: 0.9, source: "finbert" },
      trend: { label: "uptrend", signal: 0.8, confidence: 0.8, shortMA: 155, longMA: 148, momentum: 2 },
    }))

    const lowConf = evaluateTradeForCoaching(makeInput({
      sentiment: { label: "bullish", score: 60, confidence: 0.3, source: "unavailable" },
      trend: { label: "uncertain", signal: 0.2, confidence: 0.2, shortMA: 150, longMA: 150, momentum: 0 },
    }))

    expect(highConf.confidence).toBeGreaterThan(lowConf.confidence)
  })

  // ── Scenario 10: Sell-side intelligence — disciplined loss cut ──
  it("rewards disciplined loss-cutting sell", () => {
    const result = evaluateTradeForCoaching(makeInput({
      action: "sell",
      profit: -30,
      profitPercent: -2,
      sentiment: { label: "bearish", score: 25, confidence: 0.6, source: "finbert" },
      trend: { label: "downtrend", signal: -0.5, confidence: 0.6, shortMA: 145, longMA: 155, momentum: -2 },
      tradeHistory: [makeTrade({
        type: "buy",
        symbol: "AAPL",
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })],
    }))

    expect(result.score).toBeGreaterThanOrEqual(40)
    expect(result.reward.outcome).toBeGreaterThan(-0.5)
  })

  // ── Scenario 11: Selling winners early ──
  it("flags selling small profit in uptrend", () => {
    const result = evaluateTradeForCoaching(makeInput({
      action: "sell",
      profit: 15,
      profitPercent: 1,
      sentiment: { label: "bullish", score: 70, confidence: 0.7, source: "finbert" },
      trend: { label: "uptrend", signal: 0.6, confidence: 0.6, shortMA: 155, longMA: 150, momentum: 1.5 },
    }))

    expect(result.behavioralFlags.some(f => f.flag === "selling_winners_early")).toBe(true)
  })

  // ── Scenario 12: Late chase detection ──
  it("flags buying after large momentum move", () => {
    const result = evaluateTradeForCoaching(makeInput({
      action: "buy",
      sentiment: { label: "bullish", score: 70, confidence: 0.6, source: "finbert" },
      trend: { label: "uptrend", signal: 0.5, confidence: 0.6, shortMA: 160, longMA: 150, momentum: 5 },
    }))

    expect(result.behavioralFlags.some(f => f.flag === "late_chase")).toBe(true)
  })

  // ── Scenario 13: Improving trajectory ──
  it("rewards improving learning trajectory", () => {
    const result = evaluateTradeForCoaching(makeInput({
      recentRewards: [-20, -15, -10, -5, 0, 5, 10, 15, 20, 25],
    }))

    expect(result.reward.learning).toBeGreaterThan(0)
  })

  // ── Scenario 14: Patient trader in uncertain market ──
  it("rewards patience in uncertain market", () => {
    const result = evaluateTradeForCoaching(makeInput({
      recentTradeCount: 1,
      sentiment: { label: "neutral", score: 50, confidence: 0.3, source: "unavailable" },
      trend: { label: "uncertain", signal: 0, confidence: 0.2, shortMA: 150, longMA: 150, momentum: 0 },
    }))

    expect(result.reward.discipline).toBeGreaterThan(0)
  })

  // ── Scenario 15: Repeated-mistake severity escalation ──
  it("escalates severity for repeated behavioral patterns", () => {
    // Create history with multiple overtrading flags
    const overtradingTrade = makeTrade({
      coaching: {
        ...makeTrade().coaching,
        behavioralFlags: [
          { flag: "overtrading", severity: "warning", description: "test", recurrence: 1, escalated: false },
        ],
      },
    })

    const result = evaluateTradeForCoaching(makeInput({
      recentTradeCount: 8,
      tradeHistory: [overtradingTrade, overtradingTrade, overtradingTrade, overtradingTrade],
    }))

    const overtradingFlag = result.behavioralFlags.find(f => f.flag === "overtrading")
    expect(overtradingFlag).toBeDefined()
    expect(overtradingFlag!.escalated).toBe(true)
    expect(overtradingFlag!.recurrence).toBeGreaterThanOrEqual(4)
  })

  // ── Scenario 16: Behavior memory across trades ──
  it("includes recurrence count in behavioral flags", () => {
    const trendFightTrade = makeTrade({
      coaching: {
        ...makeTrade().coaching,
        behavioralFlags: [
          { flag: "trend_fighting", severity: "warning", description: "test", recurrence: 1, escalated: false },
        ],
      },
    })

    const result = evaluateTradeForCoaching(makeInput({
      action: "buy",
      sentiment: { label: "bearish", score: 20, confidence: 0.7, source: "finbert" },
      trend: { label: "downtrend", signal: -0.6, confidence: 0.6, shortMA: 145, longMA: 155, momentum: -1 },
      tradeHistory: [trendFightTrade, trendFightTrade],
    }))

    const flag = result.behavioralFlags.find(f => f.flag === "trend_fighting")
    expect(flag).toBeDefined()
    expect(flag!.recurrence).toBeGreaterThanOrEqual(2)
    expect(flag!.description).toContain("times")
  })
})
