/**
 * Execution Model Types
 *
 * Realistic trade execution with commission, spread, slippage, and order types.
 */

export type OrderType = "market" | "limit"
export type OrderStatus = "filled" | "pending" | "rejected"

export interface ExecutionConfig {
  /** Commission per share in trade currency (default: 0.01) */
  commissionPerShare: number
  /** Spread basis points by liquidity tier */
  spreadBps: { liquid: number; mid: number; small: number }
  /** Slippage range in basis points [min, max] */
  slippageBpsRange: [number, number]
  /** Execution delay range in ms [min, max] */
  delayMsRange: [number, number]
}

export interface OrderRequest {
  type: OrderType
  action: "buy" | "sell"
  symbol: string
  quantity: number
  /** Current market price at time of order */
  marketPrice: number
  /** Limit price — required for limit orders */
  limitPrice?: number
  /** Currency of the trade */
  currency: "USD" | "INR"
  /** Market (US stocks tend to be more liquid) */
  market: "US" | "IN"
}

export interface OrderPreview {
  estimatedFillPrice: number
  estimatedSpreadCost: number
  estimatedCommission: number
  estimatedSlippageCost: number
  estimatedTotalCost: number
  spreadBps: number
  slippageBps: number
  orderType: OrderType
  warning: string | null
}

export interface ExecutionResult {
  status: OrderStatus
  /** Reason for rejection (limit not met, insufficient balance, etc.) */
  rejectReason?: string
  /** Actual fill price after spread + slippage */
  fillPrice: number
  /** Requested price at order time */
  requestedPrice: number
  /** Spread in basis points applied */
  spreadBps: number
  /** Commission paid */
  commissionPaid: number
  /** Slippage in basis points */
  slippageBps: number
  /** Simulated execution delay in ms */
  executionDelayMs: number
  /** Order type */
  orderType: OrderType
}

/** Execution metadata persisted on TradeWithCoaching */
export interface ExecutionMetadata {
  requestedPrice: number
  fillPrice: number
  spreadBps: number
  commissionPaid: number
  slippageBps: number
  executionDelayMs: number
  orderType: OrderType
}
