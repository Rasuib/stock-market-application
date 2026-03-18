// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import {
  loadBehavioralMemory,
  updateBehavioralMemory,
  rebuildBehavioralMemory,
  getPersistentFlagCount,
  getPersistentFlagTrend,
} from "../behavioral-memory-store"
import type { TradeWithCoaching, BehavioralFlag } from "../types"

beforeEach(() => {
  localStorage.clear()
})

function makeTrade(flags: BehavioralFlag[], id = "t1"): TradeWithCoaching {
  return {
    id,
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
        sentiment: { label: "neutral", score: 50, confidence: 0.5, source: "unavailable" },
        trend: { label: "uncertain", signal: 0, confidence: 0.5, shortMA: 0, longMA: 0, momentum: 0 },
        price: 150,
        currency: "USD",
        market: "US",
        regime: "weak_signal",
      },
      behavioralFlags: flags.map(f => ({ flag: f, message: `${f} detected` })),
      regimeContext: "",
      reward: { total: 0, alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 },
    },
  }
}

describe("behavioral-memory-store", () => {
  describe("loadBehavioralMemory", () => {
    it("returns empty store when nothing saved", () => {
      const store = loadBehavioralMemory()
      expect(store.totalTradesAnalyzed).toBe(0)
      expect(Object.keys(store.flagCounts)).toHaveLength(0)
    })
  })

  describe("updateBehavioralMemory", () => {
    it("increments flag counts from new trade", () => {
      const trade = makeTrade(["overtrading", "panic_sell"])
      const store = updateBehavioralMemory(trade, [trade])
      expect(store.flagCounts["overtrading"]).toBe(1)
      expect(store.flagCounts["panic_sell"]).toBe(1)
    })

    it("accumulates counts across multiple updates", () => {
      const t1 = makeTrade(["overtrading"], "t1")
      const t2 = makeTrade(["overtrading"], "t2")
      updateBehavioralMemory(t1, [t1])
      const store = updateBehavioralMemory(t2, [t1, t2])
      expect(store.flagCounts["overtrading"]).toBe(2)
    })

    it("tracks total trades analyzed", () => {
      const t1 = makeTrade(["overtrading"], "t1")
      const t2 = makeTrade([], "t2")
      updateBehavioralMemory(t1, [t1])
      const store = updateBehavioralMemory(t2, [t1, t2])
      expect(store.totalTradesAnalyzed).toBe(2)
    })

    it("identifies active improvement areas for flags with count >= 3", () => {
      const trades: TradeWithCoaching[] = []
      for (let i = 0; i < 4; i++) {
        trades.push(makeTrade(["overtrading"], `t${i}`))
      }
      let store = loadBehavioralMemory()
      for (const t of trades) {
        store = updateBehavioralMemory(t, trades)
      }
      expect(store.activeImprovementAreas).toContain("overtrading")
    })
  })

  describe("rebuildBehavioralMemory", () => {
    it("rebuilds from full trade history", () => {
      const trades = [
        makeTrade(["overtrading", "chasing_loss"], "t1"),
        makeTrade(["overtrading"], "t2"),
        makeTrade(["panic_sell"], "t3"),
      ]
      const store = rebuildBehavioralMemory(trades)
      expect(store.flagCounts["overtrading"]).toBe(2)
      expect(store.flagCounts["chasing_loss"]).toBe(1)
      expect(store.flagCounts["panic_sell"]).toBe(1)
      expect(store.totalTradesAnalyzed).toBe(3)
    })

    it("handles empty trade history", () => {
      const store = rebuildBehavioralMemory([])
      expect(store.totalTradesAnalyzed).toBe(0)
      expect(Object.keys(store.flagCounts)).toHaveLength(0)
    })
  })

  describe("getPersistentFlagCount", () => {
    it("returns 0 for unseen flags", () => {
      expect(getPersistentFlagCount("overtrading")).toBe(0)
    })

    it("returns stored count after updates", () => {
      const trade = makeTrade(["overtrading"])
      updateBehavioralMemory(trade, [trade])
      expect(getPersistentFlagCount("overtrading")).toBe(1)
    })
  })

  describe("getPersistentFlagTrend", () => {
    it("returns stable for unknown flags", () => {
      expect(getPersistentFlagTrend("overtrading")).toBe("stable")
    })
  })
})
