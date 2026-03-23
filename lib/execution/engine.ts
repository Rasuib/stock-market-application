/**
 * Execution Engine
 *
 * Simulates realistic trade execution with spread, slippage, commission, and delay.
 * All randomness is injectable for deterministic testing.
 */

import type {
  ExecutionConfig,
  OrderRequest,
  OrderPreview,
  ExecutionResult,
} from "./types"

// ── Default Config (overridable via env) ──

function parseFloat(envVal: string | undefined, fallback: number): number {
  if (!envVal) return fallback
  const n = Number(envVal)
  return Number.isNaN(n) ? fallback : n
}

export function getDefaultConfig(): ExecutionConfig {
  const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}
  return {
    commissionPerShare: parseFloat(env.NEXT_PUBLIC_COMMISSION_PER_SHARE, 0.01),
    spreadBps: {
      liquid: parseFloat(env.NEXT_PUBLIC_SPREAD_BPS_LIQUID, 5),    // 0.05%
      mid: parseFloat(env.NEXT_PUBLIC_SPREAD_BPS_MID, 15),         // 0.15%
      small: parseFloat(env.NEXT_PUBLIC_SPREAD_BPS_SMALL, 35),     // 0.35%
    },
    slippageBpsRange: [2, 15],  // 0.02% - 0.15%
    delayMsRange: [500, 2000],
  }
}

// ── Liquidity Classification ──

/** Well-known large-cap tickers treated as "liquid" */
const LIQUID_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
  "JPM", "V", "JNJ", "WMT", "PG", "UNH", "MA", "HD", "DIS", "BAC",
  "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
  "RELIANCE.BO", "TCS.BO", "INFY.BO",
  // Bare tickers commonly searched
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "ADANIGREEN",
])

const MID_TICKERS = new Set([
  "NFLX", "PYPL", "AMD", "INTC", "CRM", "ADBE", "ORCL", "CSCO",
  "WIPRO.NS", "TATASTEEL.NS", "SBIN.NS", "LT.NS", "BAJFINANCE.NS",
  "WIPRO", "TATASTEEL", "SBIN", "LT", "BAJFINANCE",
])

export type LiquidityTier = "liquid" | "mid" | "small"

export function classifyLiquidity(symbol: string): LiquidityTier {
  const upper = symbol.toUpperCase()
  if (LIQUID_TICKERS.has(upper)) return "liquid"
  if (MID_TICKERS.has(upper)) return "mid"
  return "small"
}

// ── RNG (injectable for tests) ──

export type RNG = () => number // returns 0-1

const defaultRNG: RNG = () => Math.random()

function randomInRange(min: number, max: number, rng: RNG): number {
  return min + rng() * (max - min)
}

// ── Spread Computation ──

export function computeSpreadBps(
  symbol: string,
  config: ExecutionConfig,
): number {
  const tier = classifyLiquidity(symbol)
  return config.spreadBps[tier]
}

// ── Order Preview ──

export function previewOrder(
  order: OrderRequest,
  config: ExecutionConfig = getDefaultConfig(),
): OrderPreview {
  const spreadBps = computeSpreadBps(order.symbol, config)
  const spreadFraction = spreadBps / 10000
  const midSlippageBps = (config.slippageBpsRange[0] + config.slippageBpsRange[1]) / 2
  const slippageFraction = midSlippageBps / 10000

  // For buys, price goes UP by half-spread + slippage
  // For sells, price goes DOWN by half-spread + slippage
  const direction = order.action === "buy" ? 1 : -1
  const priceImpact = direction * (spreadFraction / 2 + slippageFraction)
  const estimatedFillPrice = order.marketPrice * (1 + priceImpact)

  const commission = order.quantity * config.commissionPerShare
  const spreadCost = Math.abs(order.marketPrice * spreadFraction / 2) * order.quantity
  const slippageCost = Math.abs(order.marketPrice * slippageFraction) * order.quantity
  const totalCost = order.quantity * estimatedFillPrice + commission

  let warning: string | null = null
  if (order.type === "market") {
    warning = "Market order — final fill price may vary from estimate."
  }
  if (spreadBps >= 30) {
    warning = (warning ? warning + " " : "") + "Wide spread — this stock has lower liquidity."
  }

  return {
    estimatedFillPrice: round(estimatedFillPrice),
    estimatedSpreadCost: round(spreadCost),
    estimatedCommission: round(commission),
    estimatedSlippageCost: round(slippageCost),
    estimatedTotalCost: round(totalCost),
    spreadBps,
    slippageBps: midSlippageBps,
    orderType: order.type,
    warning,
  }
}

// ── Validation ──

/**
 * Validate an order request. Returns null if valid, or an error message.
 * Enforces: limit orders MUST have limitPrice > 0.
 */
export function validateOrder(order: OrderRequest): string | null {
  if (order.quantity <= 0 || !Number.isFinite(order.quantity)) {
    return "Quantity must be a positive number."
  }
  if (order.marketPrice <= 0 || !Number.isFinite(order.marketPrice)) {
    return "Market price must be a positive number."
  }
  if (order.type === "limit") {
    if (order.limitPrice === undefined || order.limitPrice === null) {
      return "Limit price is required for limit orders."
    }
    if (order.limitPrice <= 0 || !Number.isFinite(order.limitPrice)) {
      return "Limit price must be a positive number."
    }
  }
  return null
}

// ── Execute Order ──

export function executeOrder(
  order: OrderRequest,
  config: ExecutionConfig = getDefaultConfig(),
  rng: RNG = defaultRNG,
): ExecutionResult {
  // Validate order inputs
  const validationError = validateOrder(order)
  if (validationError) {
    return {
      status: "rejected",
      rejectReason: validationError,
      fillPrice: 0,
      requestedPrice: order.marketPrice,
      spreadBps: 0,
      commissionPaid: 0,
      slippageBps: 0,
      executionDelayMs: 0,
      orderType: order.type,
    }
  }

  const spreadBps = computeSpreadBps(order.symbol, config)
  const spreadFraction = spreadBps / 10000

  // Randomized slippage
  const slippageBps = Math.round(randomInRange(
    config.slippageBpsRange[0],
    config.slippageBpsRange[1],
    rng,
  ))
  const slippageFraction = slippageBps / 10000

  // Randomized delay
  const executionDelayMs = Math.round(randomInRange(
    config.delayMsRange[0],
    config.delayMsRange[1],
    rng,
  ))

  // Compute fill price
  const direction = order.action === "buy" ? 1 : -1
  const priceImpact = direction * (spreadFraction / 2 + slippageFraction)
  const fillPrice = round(order.marketPrice * (1 + priceImpact))

  // Commission
  const commissionPaid = round(order.quantity * config.commissionPerShare)

  // Limit order check
  if (order.type === "limit" && order.limitPrice !== undefined) {
    const limitMet = order.action === "buy"
      ? fillPrice <= order.limitPrice
      : fillPrice >= order.limitPrice

    if (!limitMet) {
      return {
        status: "rejected",
        rejectReason: order.action === "buy"
          ? `Fill price ${formatPrice(fillPrice)} exceeds limit ${formatPrice(order.limitPrice)}`
          : `Fill price ${formatPrice(fillPrice)} is below limit ${formatPrice(order.limitPrice)}`,
        fillPrice,
        requestedPrice: order.marketPrice,
        spreadBps,
        commissionPaid: 0,
        slippageBps,
        executionDelayMs,
        orderType: order.type,
      }
    }
  }

  return {
    status: "filled",
    fillPrice,
    requestedPrice: order.marketPrice,
    spreadBps,
    commissionPaid,
    slippageBps,
    executionDelayMs,
    orderType: order.type,
  }
}

// ── Helpers ──

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function formatPrice(n: number): string {
  return n.toFixed(2)
}
