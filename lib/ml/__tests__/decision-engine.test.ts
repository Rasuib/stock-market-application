import { describe, it, expect } from "vitest"
import { evaluateTrade, type SentimentInput, type TrendInput } from "../decision-engine"

const bullish: SentimentInput = { sentiment: "bullish", score: 75, confidence: 0.8 }
const bearish: SentimentInput = { sentiment: "bearish", score: 25, confidence: 0.8 }
const neutralSentiment: SentimentInput = { sentiment: "neutral", score: 50, confidence: 0.5 }

const uptrend: TrendInput = { trend: "uptrend", signal: 1, confidence: 0.8 }
const downtrend: TrendInput = { trend: "downtrend", signal: -1, confidence: 0.8 }
const neutralTrend: TrendInput = { trend: "neutral", signal: 0, confidence: 0.5 }

describe("evaluateTrade", () => {
  it("rates buying in uptrend + bullish sentiment as excellent/good", () => {
    const result = evaluateTrade("buy", bullish, uptrend)
    expect(result.score).toBeGreaterThan(0)
    expect(["excellent", "good"]).toContain(result.quality)
    expect(result.featureVector).toEqual([1, 1, 1])
  })

  it("rates selling in downtrend + bearish sentiment as excellent/good", () => {
    const result = evaluateTrade("sell", bearish, downtrend)
    expect(result.score).toBeGreaterThan(0)
    expect(["excellent", "good"]).toContain(result.quality)
    expect(result.featureVector).toEqual([-1, -1, -1])
  })

  it("rates buying in downtrend + bearish sentiment as poor/risky", () => {
    const result = evaluateTrade("buy", bearish, downtrend)
    expect(result.score).toBeLessThan(0)
    expect(["poor", "risky"]).toContain(result.quality)
    expect(result.featureVector).toEqual([-1, -1, 1])
  })

  it("rates selling in uptrend + bullish sentiment as poor/risky", () => {
    const result = evaluateTrade("sell", bullish, uptrend)
    expect(result.score).toBeLessThan(0)
    expect(["poor", "risky"]).toContain(result.quality)
  })

  it("returns neutral score for neutral signals", () => {
    const result = evaluateTrade("buy", neutralSentiment, neutralTrend)
    expect(result.score).toBe(0)
    expect(result.quality).toBe("neutral")
  })

  it("score stays within [-100, +100]", () => {
    const actions = ["buy", "sell"] as const
    const sentiments = [bullish, bearish, neutralSentiment]
    const trends = [uptrend, downtrend, neutralTrend]

    for (const action of actions) {
      for (const sentiment of sentiments) {
        for (const trend of trends) {
          const result = evaluateTrade(action, sentiment, trend)
          expect(result.score).toBeGreaterThanOrEqual(-100)
          expect(result.score).toBeLessThanOrEqual(100)
        }
      }
    }
  })

  it("always includes an explanation string", () => {
    const result = evaluateTrade("buy", bullish, uptrend)
    expect(result.explanation).toBeTruthy()
    expect(typeof result.explanation).toBe("string")
    expect(result.explanation.length).toBeGreaterThan(10)
  })

  it("includes factors with positive/negative/neutral impacts", () => {
    const result = evaluateTrade("buy", bearish, uptrend)
    expect(result.factors.length).toBeGreaterThanOrEqual(2)

    const impacts = result.factors.map(f => f.impact)
    expect(impacts).toContain("positive") // trend aligned
    expect(impacts).toContain("negative") // sentiment conflict
  })

  it("lower confidence reduces absolute score", () => {
    const highConf = evaluateTrade("buy", { ...bullish, confidence: 0.9 }, { ...uptrend, confidence: 0.9 })
    const lowConf = evaluateTrade("buy", { ...bullish, confidence: 0.2 }, { ...uptrend, confidence: 0.2 })
    expect(Math.abs(highConf.score)).toBeGreaterThan(Math.abs(lowConf.score))
  })
})
