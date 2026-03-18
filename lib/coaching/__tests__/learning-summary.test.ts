import { describe, it, expect } from "vitest"
import { generateLearningSummary } from "../learning-summary"
import type { TradeWithCoaching } from "../types"

function makeTrade(overrides: Partial<TradeWithCoaching> = {}): TradeWithCoaching {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    type: "buy",
    symbol: "AAPL",
    quantity: 10,
    price: 150,
    cost: 1500,
    timestamp: new Date().toISOString(),
    displayTime: "10:00:00 AM",
    market: "US",
    currency: "USD",
    coaching: {
      verdict: "mixed",
      score: 50,
      confidence: 0.5,
      summary: "Test trade.",
      whatWentRight: ["Good timing."],
      whatWentWrong: [],
      improveNext: ["Keep learning."],
      supportingSignals: [],
      contradictorySignals: [],
      riskNotes: [],
      skillTags: ["signal_alignment"],
      behavioralFlags: [],
      marketSnapshot: {
        sentiment: { label: "neutral", score: 50, confidence: 0.5, source: "finbert" },
        trend: { label: "uncertain", signal: 0, confidence: 0.3, shortMA: 0, longMA: 0, momentum: 0 },
        price: 150, currency: "USD", market: "US",
        regime: "weak_signal",
      },
      regimeContext: "",
      reward: { total: 10, alignment: 0.3, risk: 0.2, discipline: 0.5, outcome: 0, learning: 0.1 },
    },
    ...overrides,
  }
}

describe("generateLearningSummary", () => {
  it("returns empty state for no trades", () => {
    const summary = generateLearningSummary([])
    expect(summary.grade).toBe("-")
    expect(summary.totalTrades).toBe(0)
    expect(summary.focusArea).toContain("first trade")
    expect(summary.winRate).toBe(0)
    expect(summary.totalPnL).toBe(0)
  })

  it("computes grade from average reward", () => {
    const goodTrades = Array.from({ length: 5 }, () =>
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: 30, alignment: 0.5, risk: 0.4, discipline: 0.6, outcome: 0.3, learning: 0.2 } } })
    )
    const summary = generateLearningSummary(goodTrades)
    expect(summary.grade).toBe("A")
    expect(summary.score).toBeGreaterThanOrEqual(20)
  })

  it("detects improving trajectory", () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: i * 5 - 10, alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 } } })
    )
    const summary = generateLearningSummary(trades)
    expect(summary.trajectory).toBe("improving")
    expect(summary.trajectoryDetail).toBeTruthy()
  })

  it("detects declining trajectory", () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: 30 - i * 8, alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 } } })
    )
    const summary = generateLearningSummary(trades)
    expect(summary.trajectory).toBe("declining")
    expect(summary.trajectoryDetail).toBeTruthy()
  })

  it("identifies recurring behavioral flags with trend", () => {
    const trades = Array.from({ length: 5 }, () =>
      makeTrade({
        coaching: {
          ...makeTrade().coaching,
          behavioralFlags: [
            { flag: "overtrading", severity: "warning", description: "Too many trades", recurrence: 1, escalated: false },
            { flag: "trend_fighting", severity: "warning", description: "Against trend", recurrence: 1, escalated: false },
          ],
        },
      })
    )
    const summary = generateLearningSummary(trades)
    expect(summary.recurringMistakes.length).toBeGreaterThan(0)
    expect(summary.recurringMistakes[0].count).toBe(5)
    expect(summary.recurringMistakes[0].trend).toBeDefined()
    expect(summary.focusArea).toBeTruthy()
  })

  it("computes component averages correctly", () => {
    const trades = [
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: 20, alignment: 0.8, risk: 0.4, discipline: 0.6, outcome: 0.2, learning: 0.1 } } }),
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: 10, alignment: 0.4, risk: 0.2, discipline: 0.4, outcome: 0.0, learning: 0.3 } } }),
    ]
    const summary = generateLearningSummary(trades)

    expect(summary.componentAverages.alignment).toBeCloseTo(0.6)
    expect(summary.componentAverages.risk).toBeCloseTo(0.3)
    expect(summary.componentAverages.discipline).toBeCloseTo(0.5)
  })

  it("computes recency-weighted averages", () => {
    // Many old trades with low alignment, then recent trades with high alignment
    const oldTrades = Array.from({ length: 15 }, () =>
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: 0, alignment: -0.5, risk: 0, discipline: 0, outcome: 0, learning: 0 } } })
    )
    const recentTrades = Array.from({ length: 5 }, () =>
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: 20, alignment: 0.8, risk: 0, discipline: 0, outcome: 0, learning: 0 } } })
    )
    const trades = [...oldTrades, ...recentTrades]
    const summary = generateLearningSummary(trades)

    // Recency-weighted should be higher than equal average (recent high alignment weighted more)
    expect(summary.recentComponentAverages.alignment).toBeGreaterThan(summary.componentAverages.alignment)
  })

  it("always provides a focusArea", () => {
    const trades = [makeTrade()]
    const summary = generateLearningSummary(trades)
    expect(summary.focusArea).toBeTruthy()
    expect(summary.focusArea.length).toBeGreaterThan(10)
  })

  it("assigns correct poor grade for bad trades", () => {
    const badTrades = Array.from({ length: 5 }, () =>
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: -40, alignment: -0.8, risk: -0.5, discipline: -0.7, outcome: -0.5, learning: -0.3 } } })
    )
    const summary = generateLearningSummary(badTrades)
    expect(summary.grade).toBe("F")
  })

  it("computes win rate from sell trades", () => {
    const trades = [
      makeTrade({ type: "sell", profit: 100, profitPercent: 5 }),
      makeTrade({ type: "sell", profit: -50, profitPercent: -3 }),
      makeTrade({ type: "sell", profit: 200, profitPercent: 10 }),
      makeTrade({ type: "buy" }), // buys don't count toward win rate
    ]
    const summary = generateLearningSummary(trades)
    expect(summary.winRate).toBe(67) // 2/3 sells were profitable
    expect(summary.totalPnL).toBe(250) // 100 - 50 + 200
  })

  it("tracks best and worst trade scores", () => {
    const trades = [
      makeTrade({ coaching: { ...makeTrade().coaching, score: 85 } }),
      makeTrade({ coaching: { ...makeTrade().coaching, score: 20 } }),
      makeTrade({ coaching: { ...makeTrade().coaching, score: 55 } }),
    ]
    const summary = generateLearningSummary(trades)
    expect(summary.bestTradeScore).toBe(85)
    expect(summary.worstTradeScore).toBe(20)
  })

  it("provides trajectoryDetail string", () => {
    const trades = Array.from({ length: 8 }, (_, i) =>
      makeTrade({ coaching: { ...makeTrade().coaching, reward: { total: i * 3, alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 } } })
    )
    const summary = generateLearningSummary(trades)
    expect(summary.trajectoryDetail).toBeTruthy()
    expect(typeof summary.trajectoryDetail).toBe("string")
    expect(summary.trajectoryDetail.length).toBeGreaterThan(10)
  })
})
