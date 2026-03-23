/**
 * Risk Analytics — Commission handling and deterministic drawdown tests
 *
 * Validates that:
 *   - Max drawdown does not double-count commission
 *   - Buy cost already includes commission (no extra subtraction)
 *   - Sell proceeds are net of commission
 *   - Risk:reward ratio is correct with commission factored in
 */

import { describe, it, expect } from "vitest"
import { computeRiskMetrics } from "../risk-analytics"
import type { TradeWithCoaching } from "../coaching/types"

// Minimal coaching report for test trades
const minCoaching = {
  verdict: "mixed" as const,
  score: 50,
  confidence: 0.5,
  summary: "",
  whatWentRight: [],
  whatWentWrong: [],
  improveNext: [],
  supportingSignals: [],
  contradictorySignals: [],
  riskNotes: [],
  skillTags: [],
  marketSnapshot: {
    sentiment: { label: "neutral" as const, score: 50, confidence: 0.5, source: "unavailable" as const },
    trend: { label: "uncertain" as const, signal: 0, confidence: 0.5, shortMA: 0, longMA: 0, momentum: 0 },
    price: 100,
    currency: "USD" as const,
    market: "US" as const,
    regime: "range_bound" as const,
  },
  behavioralFlags: [],
  regimeContext: "",
  reward: { total: 0, alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 },
}

function makeTrade(overrides: Partial<TradeWithCoaching>): TradeWithCoaching {
  return {
    id: "test-" + Math.random(),
    type: "buy",
    symbol: "TEST",
    quantity: 10,
    price: 100,
    cost: 1000,
    timestamp: new Date().toISOString(),
    displayTime: "10:00:00 AM",
    market: "US",
    currency: "USD",
    coaching: minCoaching,
    ...overrides,
  }
}

describe("computeRiskMetrics — commission handling", () => {
  it("does not double-count commission on buy trades", () => {
    // Buy: cost = quantity(10) * fillPrice(100) + commission(1.00) = $1001
    // The balance should drop by exactly $1001 (not $1001 + $1.00 again)
    const trades: TradeWithCoaching[] = [
      makeTrade({
        type: "buy",
        quantity: 10,
        price: 100,
        cost: 1001, // includes $1 commission
        execution: {
          requestedPrice: 100,
          fillPrice: 100,
          spreadBps: 0,
          commissionPaid: 1.00,
          slippageBps: 0,
          executionDelayMs: 0,
          orderType: "market",
        },
      }),
    ]

    const metrics = computeRiskMetrics(trades, 10000)

    // After buy: balance = 10000 - 1001 = 8999
    // Max drawdown = (8999 - 10000) / 10000 = -10.01%
    expect(metrics.maxDrawdown).toBeCloseTo(-10.01, 1)
  })

  it("correctly handles sell commission (net proceeds)", () => {
    // Buy then sell with commission
    const trades: TradeWithCoaching[] = [
      makeTrade({
        type: "buy",
        quantity: 10,
        price: 100,
        cost: 1001, // 10 * 100 + $1 commission
        execution: {
          requestedPrice: 100, fillPrice: 100,
          spreadBps: 0, commissionPaid: 1.00, slippageBps: 0,
          executionDelayMs: 0, orderType: "market",
        },
      }),
      makeTrade({
        type: "sell",
        quantity: 10,
        price: 110,
        cost: 1100, // 10 * 110 (gross proceeds, commission NOT included)
        profit: 98, // (110-100)*10 - 1 commission = 99, but let's say 98 for 2 total commissions
        execution: {
          requestedPrice: 110, fillPrice: 110,
          spreadBps: 0, commissionPaid: 1.00, slippageBps: 0,
          executionDelayMs: 0, orderType: "market",
        },
      }),
    ]

    const metrics = computeRiskMetrics(trades, 10000)

    // After buy:  balance = 10000 - 1001 = 8999
    // After sell: balance = 8999 + (1100 - 1.00) = 10098
    // Peak rises to 10098
    // Max drawdown was after buy: (8999 - 10000) / 10000 = -10.01%
    expect(metrics.maxDrawdown).toBeCloseTo(-10.01, 1)
    // Win rate = 100% (1 profitable sell)
    expect(metrics.winRate).toBe(100)
    expect(metrics.averageWin).toBe(98)
  })

  it("computes R:R ratio correctly with commission", () => {
    const trades: TradeWithCoaching[] = [
      // Buy 1: cost $1001 (incl $1 commission)
      makeTrade({
        type: "buy", quantity: 10, price: 100, cost: 1001,
        execution: { requestedPrice: 100, fillPrice: 100, spreadBps: 0, commissionPaid: 1, slippageBps: 0, executionDelayMs: 0, orderType: "market" },
      }),
      // Sell 1: winning trade, profit = $48 (after commission)
      makeTrade({
        type: "sell", quantity: 10, price: 105, cost: 1050, profit: 48,
        execution: { requestedPrice: 105, fillPrice: 105, spreadBps: 0, commissionPaid: 1, slippageBps: 0, executionDelayMs: 0, orderType: "market" },
      }),
      // Buy 2
      makeTrade({
        type: "buy", quantity: 10, price: 100, cost: 1001,
        execution: { requestedPrice: 100, fillPrice: 100, spreadBps: 0, commissionPaid: 1, slippageBps: 0, executionDelayMs: 0, orderType: "market" },
      }),
      // Sell 2: losing trade, profit = -22 (after commission)
      makeTrade({
        type: "sell", quantity: 10, price: 98, cost: 980, profit: -22,
        execution: { requestedPrice: 98, fillPrice: 98, spreadBps: 0, commissionPaid: 1, slippageBps: 0, executionDelayMs: 0, orderType: "market" },
      }),
    ]

    const metrics = computeRiskMetrics(trades, 10000)

    expect(metrics.winRate).toBe(50) // 1 win, 1 loss
    expect(metrics.averageWin).toBe(48)
    expect(metrics.averageLoss).toBe(-22)
    // R:R = |48 / -22| = 2.18
    expect(metrics.rewardRiskRatio).toBeCloseTo(2.18, 1)
  })

  it("returns zero drawdown for empty trades", () => {
    const metrics = computeRiskMetrics([], 10000)
    expect(metrics.maxDrawdown).toBe(0)
  })

  it("handles trades without execution metadata (legacy)", () => {
    const trades: TradeWithCoaching[] = [
      makeTrade({ type: "buy", cost: 1000 }),
      makeTrade({ type: "sell", cost: 1100, profit: 100 }),
    ]

    const metrics = computeRiskMetrics(trades, 10000)
    // Buy: balance = 10000 - 1000 = 9000
    // Sell: balance = 9000 + 1100 - 0 (no commission metadata) = 10100
    expect(metrics.maxDrawdown).toBeCloseTo(-10, 0)
    expect(metrics.winRate).toBe(100)
  })
})
