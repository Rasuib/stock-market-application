import { describe, it, expect } from "vitest"
import { keywordFallback, finbertToSentimentLabel, finbertToScore } from "../finbert"

describe("keywordFallback", () => {
  it("returns positive for bullish headlines", () => {
    const result = keywordFallback("Stock surges after strong earnings beat estimates")
    expect(result.label).toBe("positive")
    expect(result.scores.positive).toBeGreaterThan(result.scores.negative)
    expect(result.source).toBe("heuristic-fallback")
  })

  it("returns negative for bearish headlines", () => {
    const result = keywordFallback("Market crash fears as recession risk grows")
    expect(result.label).toBe("negative")
    expect(result.scores.negative).toBeGreaterThan(result.scores.positive)
    expect(result.source).toBe("heuristic-fallback")
  })

  it("returns neutral for ambiguous text", () => {
    const result = keywordFallback("Company announces quarterly results today")
    expect(result.label).toBe("neutral")
    expect(result.scores.neutral).toBeGreaterThan(0.5)
    expect(result.source).toBe("heuristic-fallback")
  })

  it("returns neutral for empty-ish text", () => {
    const result = keywordFallback("The market is open")
    expect(result.label).toBe("neutral")
  })

  it("handles mixed sentiment text", () => {
    const result = keywordFallback("Stock rallies despite recession fears")
    // Has both positive (rally) and negative (recession, fear) keywords
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.scores.positive + result.scores.negative + result.scores.neutral).toBeCloseTo(1, 1)
  })

  it("scores always sum to approximately 1", () => {
    const texts = [
      "Massive surge in tech stocks",
      "Complete market collapse",
      "Trading volume is average today",
    ]
    for (const text of texts) {
      const result = keywordFallback(text)
      const sum = result.scores.positive + result.scores.negative + result.scores.neutral
      expect(sum).toBeCloseTo(1, 1)
    }
  })
})

describe("finbertToSentimentLabel", () => {
  it("maps positive to bullish", () => {
    expect(finbertToSentimentLabel("positive")).toBe("bullish")
  })

  it("maps negative to bearish", () => {
    expect(finbertToSentimentLabel("negative")).toBe("bearish")
  })

  it("maps neutral to neutral", () => {
    expect(finbertToSentimentLabel("neutral")).toBe("neutral")
  })
})

describe("finbertToScore", () => {
  it("returns 100 for perfectly positive", () => {
    const score = finbertToScore({
      label: "positive",
      scores: { positive: 1, negative: 0, neutral: 0 },
      confidence: 1,
      source: "finbert",
    })
    expect(score).toBe(100)
  })

  it("returns 0 for perfectly negative", () => {
    const score = finbertToScore({
      label: "negative",
      scores: { positive: 0, negative: 1, neutral: 0 },
      confidence: 1,
      source: "finbert",
    })
    expect(score).toBe(0)
  })

  it("returns 50 for neutral", () => {
    const score = finbertToScore({
      label: "neutral",
      scores: { positive: 0.33, negative: 0.33, neutral: 0.34 },
      confidence: 0.34,
      source: "finbert",
    })
    expect(score).toBe(50)
  })

  it("returns value between 0 and 100", () => {
    const score = finbertToScore({
      label: "positive",
      scores: { positive: 0.6, negative: 0.2, neutral: 0.2 },
      confidence: 0.6,
      source: "finbert",
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
