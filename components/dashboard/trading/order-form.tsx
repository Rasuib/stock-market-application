"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TrendingUp, TrendingDown } from "lucide-react"

interface OrderFormProps {
  currentPrice: number
  currencySymbol: string
  quantity: number
  onQuantityChange: (qty: number) => void
  orderType: "market" | "limit"
  onOrderTypeChange: (type: "market" | "limit") => void
  limitPrice: number | null
  onLimitPriceChange: (price: number | null) => void
  thesis: string
  onThesisChange: (thesis: string) => void
  canBuy: boolean
  canSell: boolean
  insufficientBalance: boolean
  limitPriceValid: boolean
  onPreview: (type: "buy" | "sell") => void
}

export default function OrderForm({
  currentPrice,
  currencySymbol,
  quantity,
  onQuantityChange,
  orderType,
  onOrderTypeChange,
  limitPrice,
  onLimitPriceChange,
  thesis,
  onThesisChange,
  canBuy,
  canSell,
  insufficientBalance,
  limitPriceValid,
  onPreview,
}: OrderFormProps) {
  return (
    <div className="space-y-3">
      {/* Order type toggle */}
      <div className="flex gap-2" role="radiogroup" aria-label="Order type">
        <button
          role="radio"
          aria-checked={orderType === "market"}
          onClick={() => onOrderTypeChange("market")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            orderType === "market"
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-surface text-muted-foreground border border-border hover:text-foreground"
          }`}
        >
          Market
        </button>
        <button
          role="radio"
          aria-checked={orderType === "limit"}
          onClick={() => { onOrderTypeChange("limit"); onLimitPriceChange(currentPrice) }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            orderType === "limit"
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-surface text-muted-foreground border border-border hover:text-foreground"
          }`}
        >
          Limit
        </button>
      </div>

      {/* Limit price input */}
      {orderType === "limit" && (
        <div>
          <label htmlFor="limit-price" className="text-xs text-muted-foreground mb-1 block">Limit Price</label>
          <Input
            id="limit-price"
            type="number"
            step="0.01"
            value={limitPrice ?? ""}
            onChange={(e) => onLimitPriceChange(Number.parseFloat(e.target.value) || null)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Order fills only if price reaches {currencySymbol}{limitPrice?.toFixed(2) ?? "\u2014"}
          </p>
        </div>
      )}

      <div>
        <label htmlFor="trade-quantity" className="text-xs text-muted-foreground mb-1 block">Quantity</label>
        <Input
          id="trade-quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => onQuantityChange(Number.parseInt(e.target.value) || 1)}
        />
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
          Est. total: {currencySymbol}{(quantity * currentPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Pre-trade thesis */}
      <div>
        <label htmlFor="trade-thesis" className="text-xs text-muted-foreground mb-1 block">
          Why this trade? <span className="text-muted-foreground/60">(optional, min 10 chars if provided)</span>
        </label>
        <textarea
          id="trade-thesis"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          rows={2}
          maxLength={280}
          placeholder="e.g. Bullish sentiment + uptrend confluence..."
          value={thesis}
          onChange={(e) => onThesisChange(e.target.value)}
        />
        {thesis.length > 0 && thesis.length < 10 && (
          <p className="text-[10px] text-loss mt-0.5">{10 - thesis.length} more characters needed</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => onPreview("buy")}
          className="bg-profit hover:bg-profit/90 text-white h-11 touch-manipulation"
          disabled={!canBuy}
          aria-label={`Buy ${quantity} shares`}
        >
          <TrendingUp className="w-4 h-4 mr-1.5" />
          Buy
        </Button>
        <Button
          onClick={() => onPreview("sell")}
          className="bg-loss hover:bg-loss/90 text-white h-11 touch-manipulation"
          disabled={!canSell}
          aria-label={`Sell ${quantity} shares`}
        >
          <TrendingDown className="w-4 h-4 mr-1.5" />
          Sell
        </Button>
      </div>
      {insufficientBalance && (
        <p className="text-[10px] text-loss">Not enough balance for this order.</p>
      )}
      {orderType === "limit" && !limitPriceValid && (
        <p className="text-[10px] text-loss">Enter a valid limit price greater than 0.</p>
      )}
    </div>
  )
}
