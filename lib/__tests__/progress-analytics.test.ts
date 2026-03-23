import { describe, it, expect } from "vitest"
import {
  computeScoreTrend,
  computeFlagFrequency,
  computePeriodDelta,
  computeStreakHistory,
  generateProgressSummary,
} from "../progress-analytics"
import type { TradeWithCoaching, BehavioralFlagDetail } from "../coaching/types"

// ── Test Helpers ──

function makeTrade(overrides: Partial<{
  score: number
  flags: string[]
  type: "buy" | "sell"
  timestamp: string
  verdict: "strong" | "mixed" | "weak"
}>): TradeWithCoaching {
  const {
    score = 65,
    flags = [],
    type = "buy",
    timestamp = new Date().toISOString(),
    verdict = "mixed",
  } = overrides

  return {
    id: `trade-${Math.random().toString(36).slice(2)}`,
    type,
    symbol: "AAPL",
    quantity: 10,
    price: 150,
    cost: 1500,
    timestamp,
    displayTime: "10:00 AM",
    market: "US",
    currency: "USD",
    coaching: {
      verdict,
      score,
      confidence: 0.8,
      summary: "Test trade",
      whatWentRight: [],
      whatWentWrong: [],
      improveNext: [],
      supportingSignals: [],
      contradictorySignals: [],
      riskNotes: [],
      skillTags: [],
      marketSnapshot: {
        sentiment: { label: "neutral", score: 50, confidence: 0.5, source: "unavailable" },
        trend: { label: "uncertain", signal: 0, confidence: 0.5, shortMA: 150, longMA: 150, momentum: 0 },
        price: 150,
        currency: "USD",
        market: "US",
        regime: "weak_signal",
      },
      behavioralFlags: flags.map((f) => ({
        flag: f,
        severity: "warning" as const,
        description: `Test flag: ${f}`,
        recurrence: 1,
        escalated: false,
      })) as BehavioralFlagDetail[],
      regimeContext: "Test regime",
      reward: { total: score / 10, alignment: 5, risk: 5, discipline: 5, outcome: 5, learning: 5 },
    },
  }
}

function makeTrades(count: number, scoreFn: (i: number) => number, flagsFn?: (i: number) => string[]): TradeWithCoaching[] {
  return Array.from({ length: count }, (_, i) =>
    makeTrade({
      score: scoreFn(i),
      flags: flagsFn?.(i) ?? [],
      timestamp: new Date(Date.now() - (count - i) * 3600_000).toISOString(),
    }),
  )
}

// ── Score Trend Tests ──

describe("computeScoreTrend", () => {
  it("returns empty for no trades", () => {
    expect(computeScoreTrend([])).toEqual([])
  })

  it("returns one point per trade with rolling average", () => {
    const trades = makeTrades(5, (i) => 50 + i * 10)
    const trend = computeScoreTrend(trades, 3)

    expect(trend).toHaveLength(5)
    expect(trend[0].tradeIndex).toBe(1)
    expect(trend[0].score).toBe(50)
    expect(trend[0].rollingAvg).toBe(50)

    // Trade 3: avg of [50, 60, 70] = 60
    expect(trend[2].rollingAvg).toBe(60)
  })

  it("respects window size", () => {
    const trades = makeTrades(10, () => 70)
    const trend = computeScoreTrend(trades, 5)
    expect(trend.every((p) => p.rollingAvg === 70)).toBe(true)
  })
})

// ── Flag Frequency Tests ──

describe("computeFlagFrequency", () => {
  it("returns empty for no trades", () => {
    expect(computeFlagFrequency([])).toEqual([])
  })

  it("counts flags across all trades", () => {
    const trades = [
      makeTrade({ flags: ["overtrading", "panic_exit"] }),
      makeTrade({ flags: ["overtrading"] }),
      makeTrade({ flags: [] }),
    ]
    const freq = computeFlagFrequency(trades, 10)

    expect(freq[0].flag).toBe("overtrading")
    expect(freq[0].totalCount).toBe(2)
    expect(freq[1].flag).toBe("panic_exit")
    expect(freq[1].totalCount).toBe(1)
  })

  it("classifies improving trend when recent < previous", () => {
    // Previous window: lots of overtrading, Recent window: fewer
    const previous = makeTrades(10, () => 50, () => ["overtrading"])
    const recent = makeTrades(10, () => 70, (i) => i < 3 ? ["overtrading"] : [])
    const trades = [...previous, ...recent]

    const freq = computeFlagFrequency(trades, 10)
    const overtrading = freq.find((f) => f.flag === "overtrading")
    expect(overtrading).toBeDefined()
    expect(overtrading!.trend).toBe("improving")
  })

  it("classifies worsening trend when recent > previous", () => {
    const previous = makeTrades(10, () => 50, (i) => i < 2 ? ["panic_exit"] : [])
    const recent = makeTrades(10, () => 50, (i) => i < 8 ? ["panic_exit"] : [])
    const trades = [...previous, ...recent]

    const freq = computeFlagFrequency(trades, 10)
    const panic = freq.find((f) => f.flag === "panic_exit")
    expect(panic).toBeDefined()
    expect(panic!.trend).toBe("worsening")
  })
})

// ── Period Delta Tests ──

describe("computePeriodDelta", () => {
  it("returns null for insufficient trades", () => {
    const trades = makeTrades(5, () => 60)
    expect(computePeriodDelta(trades, 10)).toBeNull()
  })

  it("returns null when no previous window", () => {
    const trades = makeTrades(10, () => 60)
    expect(computePeriodDelta(trades, 10)).toBeNull()
  })

  it("classifies improving when score goes up", () => {
    const previous = makeTrades(10, () => 45)
    const recent = makeTrades(10, () => 75)
    const trades = [...previous, ...recent]

    const delta = computePeriodDelta(trades, 10)
    expect(delta).not.toBeNull()
    expect(delta!.classification).toBe("improving")
    expect(delta!.scoreDelta).toBeGreaterThan(0)
  })

  it("classifies declining when score goes down", () => {
    const previous = makeTrades(10, () => 80)
    const recent = makeTrades(10, () => 40)
    const trades = [...previous, ...recent]

    const delta = computePeriodDelta(trades, 10)
    expect(delta).not.toBeNull()
    expect(delta!.classification).toBe("declining")
    expect(delta!.scoreDelta).toBeLessThan(0)
  })

  it("classifies stable when scores are similar", () => {
    const previous = makeTrades(10, () => 60)
    const recent = makeTrades(10, () => 62)
    const trades = [...previous, ...recent]

    const delta = computePeriodDelta(trades, 10)
    expect(delta).not.toBeNull()
    expect(delta!.classification).toBe("stable")
  })
})

// ── Streak History Tests ──

describe("computeStreakHistory", () => {
  it("returns empty for no trades", () => {
    expect(computeStreakHistory([])).toEqual([])
  })

  it("finds quality streaks (score > 60)", () => {
    const trades = [
      makeTrade({ score: 70 }),
      makeTrade({ score: 75 }),
      makeTrade({ score: 80 }),
      makeTrade({ score: 40 }),  // breaks streak
      makeTrade({ score: 65 }),
      makeTrade({ score: 70 }),
    ]

    const history = computeStreakHistory(trades)
    expect(history).toHaveLength(2)
    expect(history[0].length).toBe(3)
    expect(history[1].length).toBe(2)
  })

  it("ignores single-trade 'streaks'", () => {
    const trades = [
      makeTrade({ score: 70 }),
      makeTrade({ score: 40 }),
      makeTrade({ score: 80 }),
      makeTrade({ score: 40 }),
    ]

    const history = computeStreakHistory(trades)
    expect(history).toHaveLength(0) // all streaks are length 1
  })

  it("handles all-quality trades as one segment", () => {
    const trades = makeTrades(10, () => 75)
    const history = computeStreakHistory(trades)
    expect(history).toHaveLength(1)
    expect(history[0].length).toBe(10)
  })

  it("handles no quality trades", () => {
    const trades = makeTrades(5, () => 30)
    const history = computeStreakHistory(trades)
    expect(history).toHaveLength(0)
  })
})

// ── Progress Summary Tests ──

describe("generateProgressSummary", () => {
  it("returns default message when no delta", () => {
    const summary = generateProgressSummary(null, [])
    expect(summary).toContain("Keep trading")
  })

  it("mentions score improvement", () => {
    const delta = {
      recentAvgScore: 75,
      previousAvgScore: 60,
      scoreDelta: 15,
      recentFlagRate: 0.5,
      previousFlagRate: 0.8,
      flagRateDelta: -0.3,
      classification: "improving" as const,
    }

    const summary = generateProgressSummary(delta, [])
    expect(summary).toContain("+15.0")
  })

  it("mentions flag improvements", () => {
    const flags = [
      { flag: "overtrading" as const, totalCount: 5, recentCount: 1, previousCount: 4, trend: "improving" as const },
    ]
    const delta = {
      recentAvgScore: 65,
      previousAvgScore: 65,
      scoreDelta: 0,
      recentFlagRate: 0.5,
      previousFlagRate: 0.5,
      flagRateDelta: 0,
      classification: "stable" as const,
    }

    const summary = generateProgressSummary(delta, flags)
    expect(summary.toLowerCase()).toContain("overtrading")
  })
})
