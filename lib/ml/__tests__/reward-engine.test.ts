import { describe, it, expect } from "vitest"
import { computeReward, computeLearningGrade, type TradingState, type RewardHistoryEntry } from "../reward-engine"

const baseState: TradingState = {
  sentimentSignal: 0,
  sentimentConfidence: 0.5,
  trendSignal: 0,
  trendConfidence: 0.5,
  portfolioExposure: 0.3,
  recentTradeCount: 1,
  recentAvgReward: 0,
  winRate: 0.5,
}

describe("computeReward", () => {
  it("rewards buying aligned with bullish sentiment + uptrend", () => {
    const state: TradingState = { ...baseState, sentimentSignal: 1, sentimentConfidence: 0.9, trendSignal: 1, trendConfidence: 0.9 }
    const result = computeReward(state, "buy", undefined, [])
    expect(result.totalReward).toBeGreaterThan(0)
    expect(result.breakdown.alignment).toBeGreaterThan(0)
  })

  it("penalizes buying against bearish sentiment + downtrend", () => {
    const state: TradingState = { ...baseState, sentimentSignal: -1, sentimentConfidence: 0.9, trendSignal: -1, trendConfidence: 0.9 }
    const result = computeReward(state, "buy", undefined, [])
    expect(result.breakdown.alignment).toBeLessThan(0)
  })

  it("rewards selling aligned with bearish signals", () => {
    const state: TradingState = { ...baseState, sentimentSignal: -1, sentimentConfidence: 0.8, trendSignal: -1, trendConfidence: 0.8 }
    const result = computeReward(state, "sell", 100, [])
    expect(result.breakdown.alignment).toBeGreaterThan(0)
    expect(result.breakdown.outcome).toBeGreaterThan(0)
  })

  it("penalizes overconcentration on buy", () => {
    const state: TradingState = { ...baseState, portfolioExposure: 0.85 }
    const result = computeReward(state, "buy", undefined, [])
    expect(result.breakdown.risk).toBeLessThan(0)
    expect(result.breakdown.riskExplanation).toContain("Over-concentrated")
  })

  it("rewards conservative position sizing", () => {
    const state: TradingState = { ...baseState, portfolioExposure: 0.15 }
    const result = computeReward(state, "buy", undefined, [])
    expect(result.breakdown.risk).toBeGreaterThan(0)
  })

  it("penalizes overtrading", () => {
    const state: TradingState = { ...baseState, recentTradeCount: 12 }
    const result = computeReward(state, "buy", undefined, [])
    expect(result.breakdown.discipline).toBeLessThan(0)
    expect(result.breakdown.disciplineExplanation).toContain("Overtrading")
  })

  it("rewards patient trading pace", () => {
    const state: TradingState = { ...baseState, recentTradeCount: 1 }
    const result = computeReward(state, "buy", undefined, [])
    expect(result.breakdown.discipline).toBeGreaterThan(0)
  })

  it("rewards profitable sell trades", () => {
    const result = computeReward(baseState, "sell", 500, [])
    expect(result.breakdown.outcome).toBeGreaterThan(0)
    expect(result.breakdown.outcomeExplanation).toContain("Profitable")
  })

  it("penalizes losing sell trades", () => {
    const result = computeReward(baseState, "sell", -200, [])
    expect(result.breakdown.outcome).toBeLessThan(0)
    expect(result.breakdown.outcomeExplanation).toContain("Loss")
  })

  it("gives no outcome reward for buy trades", () => {
    const result = computeReward(baseState, "buy", undefined, [])
    expect(result.breakdown.outcome).toBe(0)
  })

  it("detects learning improvement from reward history", () => {
    // Older rewards low, recent rewards high → should detect improvement
    const history = [-20, -15, -10, -5, 0, 10, 15, 20, 25, 30]
    const result = computeReward(baseState, "buy", undefined, history)
    expect(result.breakdown.learning).toBeGreaterThan(0)
  })

  it("returns a dominantFactor string", () => {
    const result = computeReward(baseState, "buy", undefined, [])
    expect(result.dominantFactor).toBeTruthy()
    expect(typeof result.dominantFactor).toBe("string")
  })

  it("returns an explanation string", () => {
    const result = computeReward(baseState, "buy", undefined, [])
    expect(result.explanation).toBeTruthy()
    expect(result.explanation.length).toBeGreaterThan(0)
  })

  it("total reward is in roughly [-100, +100] range", () => {
    // Best case: all aligned
    const bestState: TradingState = {
      sentimentSignal: 1, sentimentConfidence: 1, trendSignal: 1, trendConfidence: 1,
      portfolioExposure: 0.1, recentTradeCount: 1, recentAvgReward: 0, winRate: 1,
    }
    const best = computeReward(bestState, "sell", 1000, [])
    expect(best.totalReward).toBeLessThanOrEqual(100)
    expect(best.totalReward).toBeGreaterThan(0)

    // Worst case: all misaligned
    const worstState: TradingState = {
      sentimentSignal: -1, sentimentConfidence: 1, trendSignal: -1, trendConfidence: 1,
      portfolioExposure: 0.9, recentTradeCount: 15, recentAvgReward: -50, winRate: 0,
    }
    const worst = computeReward(worstState, "buy", undefined, [])
    expect(worst.totalReward).toBeGreaterThanOrEqual(-100)
    expect(worst.totalReward).toBeLessThan(0)
  })
})

describe("computeLearningGrade", () => {
  it("returns dash grade for empty history", () => {
    const report = computeLearningGrade([])
    expect(report.grade).toBe("—")
    expect(report.totalTrades).toBe(0)
    expect(report.trajectory).toBe("stable")
  })

  const makeEntry = (reward: number, i: number): RewardHistoryEntry => ({
    timestamp: new Date(Date.now() - (100 - i) * 60000).toISOString(),
    symbol: "AAPL",
    action: "buy",
    reward,
    breakdown: { alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0, alignmentExplanation: "", riskExplanation: "", disciplineExplanation: "", outcomeExplanation: "", learningExplanation: "" },
    cumulativeReward: reward * (i + 1),
    grade: "",
  })

  it("returns S grade for exceptional performance", () => {
    const history = Array.from({ length: 10 }, (_, i) => makeEntry(50, i))
    const report = computeLearningGrade(history)
    expect(report.grade).toBe("S")
    expect(report.score).toBeGreaterThanOrEqual(40)
  })

  it("returns F grade for poor performance", () => {
    const history = Array.from({ length: 10 }, (_, i) => makeEntry(-50, i))
    const report = computeLearningGrade(history)
    expect(report.grade).toBe("F")
    expect(report.score).toBeLessThan(-30)
  })

  it("detects improving trajectory", () => {
    // First 5 bad, last 5 good
    const history = [
      ...Array.from({ length: 5 }, (_, i) => makeEntry(-20, i)),
      ...Array.from({ length: 5 }, (_, i) => makeEntry(30, i + 5)),
    ]
    const report = computeLearningGrade(history)
    expect(report.trajectory).toBe("improving")
  })

  it("detects declining trajectory", () => {
    // First 5 good, last 5 bad
    const history = [
      ...Array.from({ length: 5 }, (_, i) => makeEntry(30, i)),
      ...Array.from({ length: 5 }, (_, i) => makeEntry(-20, i + 5)),
    ]
    const report = computeLearningGrade(history)
    expect(report.trajectory).toBe("declining")
  })

  it("returns correct totalTrades count", () => {
    const history = Array.from({ length: 7 }, (_, i) => makeEntry(10, i))
    const report = computeLearningGrade(history)
    expect(report.totalTrades).toBe(7)
  })

  it("returns reward history for charting", () => {
    const history = Array.from({ length: 5 }, (_, i) => makeEntry(10, i))
    const report = computeLearningGrade(history)
    expect(report.rewardHistory).toHaveLength(5)
    expect(report.rewardHistory[0]).toHaveProperty("timestamp")
    expect(report.rewardHistory[0]).toHaveProperty("reward")
    expect(report.rewardHistory[0]).toHaveProperty("cumulative")
  })

  it("identifies strengths and weaknesses", () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      ...makeEntry(10, i),
      breakdown: {
        alignment: 0.8, risk: -0.5, discipline: 0.3, outcome: 0.1, learning: 0,
        alignmentExplanation: "", riskExplanation: "", disciplineExplanation: "", outcomeExplanation: "", learningExplanation: "",
      },
    }))
    const report = computeLearningGrade(history)
    expect(report.strengths).toContain("Signal Alignment")
    expect(report.weaknesses).toContain("Risk Management")
  })
})
