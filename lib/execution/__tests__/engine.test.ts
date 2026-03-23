import { describe, it, expect } from "vitest"
import {
  executeOrder,
  previewOrder,
  classifyLiquidity,
  computeSpreadBps,
  getDefaultConfig,
  type RNG,
} from "../engine"
import type { OrderRequest, ExecutionConfig } from "../types"

// Deterministic RNG for tests — always returns 0.5
const fixedRNG: RNG = () => 0.5

const config: ExecutionConfig = {
  commissionPerShare: 0.01,
  spreadBps: { liquid: 5, mid: 15, small: 35 },
  slippageBpsRange: [2, 15],
  delayMsRange: [500, 2000],
}

const baseBuyOrder: OrderRequest = {
  type: "market",
  action: "buy",
  symbol: "AAPL",
  quantity: 10,
  marketPrice: 185.00,
  currency: "USD",
  market: "US",
}

describe("classifyLiquidity", () => {
  it("classifies AAPL as liquid", () => {
    expect(classifyLiquidity("AAPL")).toBe("liquid")
  })

  it("classifies RELIANCE as liquid", () => {
    expect(classifyLiquidity("RELIANCE")).toBe("liquid")
  })

  it("classifies NFLX as mid", () => {
    expect(classifyLiquidity("NFLX")).toBe("mid")
  })

  it("classifies unknown ticker as small", () => {
    expect(classifyLiquidity("OBSCURETICKER")).toBe("small")
  })

  it("is case-insensitive", () => {
    expect(classifyLiquidity("aapl")).toBe("liquid")
  })
})

describe("computeSpreadBps", () => {
  it("returns liquid spread for AAPL", () => {
    expect(computeSpreadBps("AAPL", config)).toBe(5)
  })

  it("returns mid spread for NFLX", () => {
    expect(computeSpreadBps("NFLX", config)).toBe(15)
  })

  it("returns small spread for unknown", () => {
    expect(computeSpreadBps("XYZ", config)).toBe(35)
  })
})

describe("previewOrder", () => {
  it("returns correct preview for a market buy", () => {
    const preview = previewOrder(baseBuyOrder, config)
    expect(preview.orderType).toBe("market")
    expect(preview.spreadBps).toBe(5)
    expect(preview.estimatedFillPrice).toBeGreaterThan(185.00)
    expect(preview.estimatedCommission).toBe(0.10) // 10 * 0.01
    expect(preview.warning).toContain("Market order")
  })

  it("shows wide spread warning for small-cap", () => {
    const order = { ...baseBuyOrder, symbol: "OBSCURE" }
    const preview = previewOrder(order, config)
    expect(preview.warning).toContain("Wide spread")
    expect(preview.spreadBps).toBe(35)
  })

  it("returns lower fill price for sells", () => {
    const sellOrder = { ...baseBuyOrder, action: "sell" as const }
    const preview = previewOrder(sellOrder, config)
    expect(preview.estimatedFillPrice).toBeLessThan(185.00)
  })
})

describe("executeOrder", () => {
  it("fills a market buy with deterministic RNG", () => {
    const result = executeOrder(baseBuyOrder, config, fixedRNG)
    expect(result.status).toBe("filled")
    expect(result.fillPrice).toBeGreaterThan(185.00)
    expect(result.requestedPrice).toBe(185.00)
    expect(result.spreadBps).toBe(5)
    expect(result.commissionPaid).toBe(0.10)
    expect(result.orderType).toBe("market")
    // With RNG=0.5, slippage should be midpoint of [2,15] = 8.5 → rounded to 9
    expect(result.slippageBps).toBe(9)
    // Delay should be midpoint of [500,2000] = 1250
    expect(result.executionDelayMs).toBe(1250)
  })

  it("fills a market sell below market price", () => {
    const sellOrder = { ...baseBuyOrder, action: "sell" as const }
    const result = executeOrder(sellOrder, config, fixedRNG)
    expect(result.status).toBe("filled")
    expect(result.fillPrice).toBeLessThan(185.00)
  })

  it("fills a limit buy when fill price is within limit", () => {
    const limitOrder: OrderRequest = {
      ...baseBuyOrder,
      type: "limit",
      limitPrice: 186.00, // generous limit
    }
    const result = executeOrder(limitOrder, config, fixedRNG)
    expect(result.status).toBe("filled")
    expect(result.fillPrice).toBeLessThanOrEqual(186.00)
  })

  it("rejects a limit buy when fill price exceeds limit", () => {
    const limitOrder: OrderRequest = {
      ...baseBuyOrder,
      type: "limit",
      limitPrice: 185.00, // too tight — fill will be above this
    }
    const result = executeOrder(limitOrder, config, fixedRNG)
    expect(result.status).toBe("rejected")
    expect(result.rejectReason).toContain("exceeds limit")
    expect(result.commissionPaid).toBe(0) // no commission on rejected
  })

  it("rejects a limit sell when fill price is below limit", () => {
    const limitSell: OrderRequest = {
      ...baseBuyOrder,
      action: "sell",
      type: "limit",
      limitPrice: 185.00, // fill will be below 185
    }
    const result = executeOrder(limitSell, config, fixedRNG)
    expect(result.status).toBe("rejected")
    expect(result.rejectReason).toContain("below limit")
  })

  it("uses different slippage with different RNG values", () => {
    const lowRNG: RNG = () => 0.0
    const highRNG: RNG = () => 0.99

    const resultLow = executeOrder(baseBuyOrder, config, lowRNG)
    const resultHigh = executeOrder(baseBuyOrder, config, highRNG)

    expect(resultLow.slippageBps).toBeLessThan(resultHigh.slippageBps)
    expect(resultLow.fillPrice).toBeLessThan(resultHigh.fillPrice)
  })

  it("computes commission correctly for large orders", () => {
    const bigOrder = { ...baseBuyOrder, quantity: 1000 }
    const result = executeOrder(bigOrder, config, fixedRNG)
    expect(result.commissionPaid).toBe(10.00) // 1000 * 0.01
  })
})

describe("getDefaultConfig", () => {
  it("returns valid default config", () => {
    const cfg = getDefaultConfig()
    expect(cfg.commissionPerShare).toBeGreaterThanOrEqual(0)
    expect(cfg.spreadBps.liquid).toBeLessThan(cfg.spreadBps.mid)
    expect(cfg.spreadBps.mid).toBeLessThan(cfg.spreadBps.small)
    expect(cfg.slippageBpsRange[0]).toBeLessThan(cfg.slippageBpsRange[1])
    expect(cfg.delayMsRange[0]).toBeLessThan(cfg.delayMsRange[1])
  })
})
