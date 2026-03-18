// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import {
  updateCurriculum,
  getCurriculumTopics,
  getCurrentFocusTopic,
  getStageInfo,
  loadCurriculumProgress,
} from "../curriculum"
import type { LearningSummary, SkillTag } from "../types"

beforeEach(() => {
  localStorage.clear()
})

function makeSummary(overrides: Partial<LearningSummary> = {}): LearningSummary {
  return {
    grade: "C",
    totalTrades: 0,
    totalSells: 0,
    avgScore: 50,
    trajectory: "stable",
    strengths: [],
    weaknesses: [],
    rewardPerformance: { total: 0, avgPerTrade: 0, trend: "stable" },
    ...overrides,
  }
}

describe("curriculum", () => {
  describe("loadCurriculumProgress", () => {
    it("returns default progress when nothing stored", () => {
      const p = loadCurriculumProgress()
      expect(p.stage).toBe("beginner")
      expect(p.unlockedTopicIds).toContain("basics-buy-sell")
      expect(p.currentFocus).toBe("basics-buy-sell")
    })
  })

  describe("updateCurriculum", () => {
    it("stays beginner with 0 trades", () => {
      const p = updateCurriculum(makeSummary({ totalTrades: 0, grade: "F" }))
      expect(p.stage).toBe("beginner")
      expect(p.unlockedTopicIds).toContain("basics-buy-sell")
    })

    it("unlocks reading-sentiment at 2+ trades", () => {
      const p = updateCurriculum(makeSummary({ totalTrades: 3, grade: "D" }))
      expect(p.unlockedTopicIds).toContain("reading-sentiment")
    })

    it("unlocks reading-trends at 3+ trades", () => {
      const p = updateCurriculum(makeSummary({ totalTrades: 3, grade: "D" }))
      expect(p.unlockedTopicIds).toContain("reading-trends")
    })

    it("advances to developing stage at 5+ trades with grade C", () => {
      const p = updateCurriculum(makeSummary({ totalTrades: 6, grade: "C" }))
      expect(p.stage).toBe("developing")
      expect(p.unlockedTopicIds).toContain("signal-alignment")
      expect(p.unlockedTopicIds).toContain("position-sizing")
    })

    it("does NOT unlock developing topics if grade too low", () => {
      const p = updateCurriculum(makeSummary({ totalTrades: 10, grade: "F" }))
      expect(p.stage).toBe("beginner")
      expect(p.unlockedTopicIds).not.toContain("signal-alignment")
    })

    it("advances to intermediate at 15+ trades with grade B", () => {
      const p = updateCurriculum(makeSummary({ totalTrades: 16, grade: "B" }))
      expect(p.stage).toBe("intermediate")
      expect(p.unlockedTopicIds).toContain("market-regimes")
    })

    it("advances to proficient at 30+ trades with grade A", () => {
      const p = updateCurriculum(makeSummary({ totalTrades: 31, grade: "A" }))
      expect(p.stage).toBe("proficient")
      expect(p.unlockedTopicIds).toContain("behavioral-mastery")
    })

    it("auto-completes topic when all skill tags are strengths", () => {
      const p = updateCurriculum(makeSummary({
        totalTrades: 10,
        grade: "B",
        strengths: ["entry_timing" as SkillTag, "exit_timing" as SkillTag],
      }))
      // basics-buy-sell requires entry_timing + exit_timing, minTrades=0
      // Auto-complete requires totalTrades >= minTrades + 5 = 5
      expect(p.completedTopicIds).toContain("basics-buy-sell")
    })

    it("sets currentFocus to first incomplete unlocked topic", () => {
      const p = updateCurriculum(makeSummary({
        totalTrades: 10,
        grade: "B",
        strengths: ["entry_timing" as SkillTag, "exit_timing" as SkillTag],
      }))
      // basics-buy-sell should be completed, focus should advance
      expect(p.currentFocus).not.toBe("basics-buy-sell")
      expect(p.currentFocus).toBeTruthy()
    })
  })

  describe("getCurriculumTopics", () => {
    it("returns all topics with unlock/completed status", () => {
      const progress = updateCurriculum(makeSummary({ totalTrades: 6, grade: "C" }))
      const topics = getCurriculumTopics(progress)
      expect(topics.length).toBeGreaterThan(0)

      const basics = topics.find(t => t.id === "basics-buy-sell")
      expect(basics?.unlocked).toBe(true)

      const advanced = topics.find(t => t.id === "advanced-regime-play")
      expect(advanced?.unlocked).toBe(false)
    })
  })

  describe("getCurrentFocusTopic", () => {
    it("returns the focus topic with unlocked=true", () => {
      const progress = updateCurriculum(makeSummary({ totalTrades: 3 }))
      const focus = getCurrentFocusTopic(progress)
      expect(focus).not.toBeNull()
      expect(focus?.unlocked).toBe(true)
      expect(focus?.completed).toBe(false)
    })

    it("returns null when no focus set", () => {
      const progress = { stage: "beginner" as const, unlockedTopicIds: [], completedTopicIds: [], currentFocus: null, lastUpdated: "" }
      const focus = getCurrentFocusTopic(progress)
      expect(focus).toBeNull()
    })
  })

  describe("getStageInfo", () => {
    it("returns correct labels for each stage", () => {
      expect(getStageInfo("beginner").label).toBe("Beginner")
      expect(getStageInfo("developing").label).toBe("Developing")
      expect(getStageInfo("intermediate").label).toBe("Intermediate")
      expect(getStageInfo("proficient").label).toBe("Proficient")
    })

    it("proficient has no next step", () => {
      expect(getStageInfo("proficient").next).toBeNull()
    })

    it("non-proficient stages have next step text", () => {
      expect(getStageInfo("beginner").next).toBeTruthy()
      expect(getStageInfo("developing").next).toBeTruthy()
      expect(getStageInfo("intermediate").next).toBeTruthy()
    })
  })
})
