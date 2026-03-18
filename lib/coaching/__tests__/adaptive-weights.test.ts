// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import {
  loadAdaptiveWeights,
  saveAdaptiveWeights,
  updateWeightsFromFeedback,
  getEffectiveWeights,
  resetAdaptiveWeights,
} from "../adaptive-weights"
import type { CoachingReport } from "../types"

beforeEach(() => {
  localStorage.clear()
})

function makeReport(rewards: {
  alignment: number; risk: number; discipline: number; outcome: number; learning: number
}): CoachingReport {
  return {
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
      sentiment: { label: "neutral", score: 50, confidence: 0.5, source: "unavailable" },
      trend: { label: "uncertain", signal: 0, confidence: 0.5, shortMA: 0, longMA: 0, momentum: 0 },
      price: 100,
      currency: "USD",
      market: "US",
      regime: "weak_signal",
    },
    behavioralFlags: [],
    regimeContext: "",
    reward: { total: 0, ...rewards },
  } as CoachingReport
}

describe("adaptive-weights", () => {
  describe("loadAdaptiveWeights", () => {
    it("returns defaults when nothing stored", () => {
      const w = loadAdaptiveWeights()
      expect(w.alignment).toBeCloseTo(0.28)
      expect(w.sampleCount).toBe(0)
    })

    it("loads stored weights", () => {
      const stored = {
        alignment: 0.3, risk: 0.2, discipline: 0.2, outcome: 0.2, learning: 0.1,
        sampleCount: 10, lastUpdated: "2025-01-01",
      }
      localStorage.setItem("tradia_adaptive_weights", JSON.stringify(stored))
      const w = loadAdaptiveWeights()
      expect(w.alignment).toBeCloseTo(0.3)
      expect(w.sampleCount).toBe(10)
    })
  })

  describe("updateWeightsFromFeedback", () => {
    it("increments sample count on each call", () => {
      const report = makeReport({ alignment: 5, risk: 3, discipline: 2, outcome: 4, learning: 1 })
      const w1 = updateWeightsFromFeedback(report, true)
      expect(w1.sampleCount).toBe(1)
      const w2 = updateWeightsFromFeedback(report, true)
      expect(w2.sampleCount).toBe(2)
    })

    it("weights sum to ~1 after helpful feedback", () => {
      const report = makeReport({ alignment: 10, risk: 0, discipline: 0, outcome: 0, learning: 0 })
      const w = updateWeightsFromFeedback(report, true)
      const sum = w.alignment + w.risk + w.discipline + w.outcome + w.learning
      expect(sum).toBeCloseTo(1, 4)
    })

    it("weights sum to ~1 after unhelpful feedback", () => {
      const report = makeReport({ alignment: 5, risk: 3, discipline: 2, outcome: 4, learning: 1 })
      const w = updateWeightsFromFeedback(report, false)
      const sum = w.alignment + w.risk + w.discipline + w.outcome + w.learning
      expect(sum).toBeCloseTo(1, 4)
    })

    it("unhelpful feedback shifts weights toward equal distribution", () => {
      const report = makeReport({ alignment: 5, risk: 3, discipline: 2, outcome: 4, learning: 1 })
      // Start from default (alignment=0.28 is highest)
      const w = updateWeightsFromFeedback(report, false)
      // Alignment should decrease toward 0.20
      expect(w.alignment).toBeLessThan(0.28)
    })
  })

  describe("getEffectiveWeights", () => {
    it("returns default weights when sampleCount < 5", () => {
      const stored = {
        alignment: 0.5, risk: 0.1, discipline: 0.1, outcome: 0.2, learning: 0.1,
        sampleCount: 3, lastUpdated: "2025-01-01",
      }
      localStorage.setItem("tradia_adaptive_weights", JSON.stringify(stored))
      const eff = getEffectiveWeights()
      expect(eff.alignment).toBeCloseTo(0.28)
    })

    it("blends toward adaptive weights when sampleCount >= 5", () => {
      const stored = {
        alignment: 0.5, risk: 0.1, discipline: 0.1, outcome: 0.2, learning: 0.1,
        sampleCount: 10, lastUpdated: "2025-01-01",
      }
      localStorage.setItem("tradia_adaptive_weights", JSON.stringify(stored))
      const eff = getEffectiveWeights()
      // Should be between default (0.28) and adaptive (0.5)
      expect(eff.alignment).toBeGreaterThan(0.28)
      expect(eff.alignment).toBeLessThan(0.5)
    })

    it("effective weights sum to ~1", () => {
      const stored = {
        alignment: 0.4, risk: 0.15, discipline: 0.15, outcome: 0.2, learning: 0.1,
        sampleCount: 20, lastUpdated: "2025-01-01",
      }
      localStorage.setItem("tradia_adaptive_weights", JSON.stringify(stored))
      const eff = getEffectiveWeights()
      const sum = eff.alignment + eff.risk + eff.discipline + eff.outcome + eff.learning
      expect(sum).toBeCloseTo(1, 2)
    })
  })

  describe("resetAdaptiveWeights", () => {
    it("resets to default weights with sampleCount 0", () => {
      const report = makeReport({ alignment: 5, risk: 3, discipline: 2, outcome: 4, learning: 1 })
      updateWeightsFromFeedback(report, true)
      const reset = resetAdaptiveWeights()
      expect(reset.sampleCount).toBe(0)
      expect(reset.alignment).toBeCloseTo(0.28)
    })
  })
})
