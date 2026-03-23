/**
 * Limit-order correctness + order validation tests
 *
 * Tests: validateOrder(), executeOrder() limit behavior,
 * runtime guards for impossible states.
 */

import { describe, it, expect } from "vitest"
import {
  executeOrder,
  validateOrder,
  type RNG,
} from "../engine"
import type { OrderRequest, ExecutionConfig } from "../types"

const fixedRNG: RNG = () => 0.5

const config: ExecutionConfig = {
  commissionPerShare: 0.01,
  spreadBps: { liquid: 5, mid: 15, small: 35 },
  slippageBpsRange: [2, 15],
  delayMsRange: [500, 2000],
}

const baseOrder: OrderRequest = {
  type: "market",
  action: "buy",
  symbol: "AAPL",
  quantity: 10,
  marketPrice: 185.00,
  currency: "USD",
  market: "US",
}

// ═══════════════════════════════════════════════════
// validateOrder
// ═══════════════════════════════════════════════════

describe("validateOrder", () => {
  it("accepts valid market order", () => {
    expect(validateOrder(baseOrder)).toBeNull()
  })

  it("accepts valid limit order with limitPrice > 0", () => {
    expect(validateOrder({ ...baseOrder, type: "limit", limitPrice: 186 })).toBeNull()
  })

  it("rejects limit order with missing limitPrice", () => {
    const result = validateOrder({ ...baseOrder, type: "limit" })
    expect(result).toContain("Limit price is required")
  })

  it("rejects limit order with limitPrice = 0", () => {
    const result = validateOrder({ ...baseOrder, type: "limit", limitPrice: 0 })
    expect(result).toContain("Limit price must be a positive number")
  })

  it("rejects limit order with negative limitPrice", () => {
    const result = validateOrder({ ...baseOrder, type: "limit", limitPrice: -10 })
    expect(result).toContain("Limit price must be a positive number")
  })

  it("rejects limit order with NaN limitPrice", () => {
    const result = validateOrder({ ...baseOrder, type: "limit", limitPrice: NaN })
    expect(result).toContain("Limit price must be a positive number")
  })

  it("rejects negative quantity", () => {
    const result = validateOrder({ ...baseOrder, quantity: -5 })
    expect(result).toContain("Quantity must be a positive number")
  })

  it("rejects zero quantity", () => {
    const result = validateOrder({ ...baseOrder, quantity: 0 })
    expect(result).toContain("Quantity must be a positive number")
  })

  it("rejects NaN quantity", () => {
    const result = validateOrder({ ...baseOrder, quantity: NaN })
    expect(result).toContain("Quantity must be a positive number")
  })

  it("rejects Infinity quantity", () => {
    const result = validateOrder({ ...baseOrder, quantity: Infinity })
    expect(result).toContain("Quantity must be a positive number")
  })

  it("rejects negative marketPrice", () => {
    const result = validateOrder({ ...baseOrder, marketPrice: -100 })
    expect(result).toContain("Market price must be a positive number")
  })

  it("rejects NaN marketPrice", () => {
    const result = validateOrder({ ...baseOrder, marketPrice: NaN })
    expect(result).toContain("Market price must be a positive number")
  })
})

// ═══════════════════════════════════════════════════
// executeOrder — limit order fill behavior
// ═══════════════════════════════════════════════════

describe("executeOrder limit fill behavior", () => {
  it("rejects limit order without limitPrice", () => {
    const result = executeOrder({ ...baseOrder, type: "limit" }, config, fixedRNG)
    expect(result.status).toBe("rejected")
    expect(result.rejectReason).toContain("Limit price is required")
    expect(result.commissionPaid).toBe(0)
  })

  it("fills buy limit when limitPrice is generous (above fill)", () => {
    const result = executeOrder(
      { ...baseOrder, type: "limit", limitPrice: 190 },
      config,
      fixedRNG,
    )
    expect(result.status).toBe("filled")
    expect(result.fillPrice).toBeLessThanOrEqual(190)
    expect(result.commissionPaid).toBeGreaterThan(0)
  })

  it("rejects buy limit when limitPrice is below fill", () => {
    // Fill price for a buy is above market price, so setting limit at market should reject
    const result = executeOrder(
      { ...baseOrder, type: "limit", limitPrice: 185.00 },
      config,
      fixedRNG,
    )
    expect(result.status).toBe("rejected")
    expect(result.rejectReason).toContain("exceeds limit")
  })

  it("fills sell limit when limitPrice is below fill (generous)", () => {
    const result = executeOrder(
      { ...baseOrder, action: "sell", type: "limit", limitPrice: 180 },
      config,
      fixedRNG,
    )
    expect(result.status).toBe("filled")
    expect(result.fillPrice).toBeGreaterThanOrEqual(180)
  })

  it("rejects sell limit when limitPrice is above fill", () => {
    // Fill price for a sell is below market price, so setting limit at market should reject
    const result = executeOrder(
      { ...baseOrder, action: "sell", type: "limit", limitPrice: 185.00 },
      config,
      fixedRNG,
    )
    expect(result.status).toBe("rejected")
    expect(result.rejectReason).toContain("below limit")
  })

  it("rejected orders have zero commission", () => {
    const result = executeOrder(
      { ...baseOrder, type: "limit", limitPrice: 185.00 },
      config,
      fixedRNG,
    )
    expect(result.status).toBe("rejected")
    expect(result.commissionPaid).toBe(0)
  })
})

// ═══════════════════════════════════════════════════
// executeOrder — runtime guards for impossible states
// ═══════════════════════════════════════════════════

describe("executeOrder runtime guards", () => {
  it("rejects order with NaN market price", () => {
    const result = executeOrder({ ...baseOrder, marketPrice: NaN }, config, fixedRNG)
    expect(result.status).toBe("rejected")
    expect(result.rejectReason).toContain("Market price")
  })

  it("rejects order with zero quantity", () => {
    const result = executeOrder({ ...baseOrder, quantity: 0 }, config, fixedRNG)
    expect(result.status).toBe("rejected")
    expect(result.rejectReason).toContain("Quantity")
  })

  it("rejects order with negative quantity", () => {
    const result = executeOrder({ ...baseOrder, quantity: -1 }, config, fixedRNG)
    expect(result.status).toBe("rejected")
    expect(result.rejectReason).toContain("Quantity")
  })
})
