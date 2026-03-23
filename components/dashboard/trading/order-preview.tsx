"use client"

import { Button } from "@/components/ui/button"
import { Info, Clock } from "lucide-react"
import type { OrderPreview as OrderPreviewType } from "@/lib/execution/types"
import type { MarketSession } from "@/lib/market-hours"

interface OrderPreviewProps {
  preview: OrderPreviewType
  type: "buy" | "sell"
  orderTypeName: string
  currencySymbol: string
  marketSession: MarketSession
  onConfirm: () => void
  onCancel: () => void
}

export default function OrderPreview({
  preview,
  type,
  orderTypeName,
  currencySymbol,
  marketSession,
  onConfirm,
  onCancel,
}: OrderPreviewProps) {
  return (
    <div className="p-3 bg-surface-elevated border border-primary/30 rounded-lg space-y-2" role="dialog" aria-label="Order preview">
      <p className="text-xs font-semibold text-primary">Order Preview</p>
      <div className="space-y-1 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type</span>
          <span className="uppercase">{orderTypeName} {type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Est. Fill Price</span>
          <span>{currencySymbol}{preview.estimatedFillPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Spread</span>
          <span>{preview.spreadBps} bps ({currencySymbol}{preview.estimatedSpreadCost.toFixed(2)})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Commission</span>
          <span>{currencySymbol}{preview.estimatedCommission.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Est. Slippage</span>
          <span>{currencySymbol}{preview.estimatedSlippageCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold">
          <span>Est. Total</span>
          <span>{currencySymbol}{preview.estimatedTotalCost.toFixed(2)}</span>
        </div>
      </div>
      {preview.warning && (
        <div className="flex items-start gap-1.5 text-[10px] text-warning">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{preview.warning}</span>
        </div>
      )}
      {!marketSession.isOpen && (
        <div className="flex items-start gap-1.5 text-[10px] text-warning">
          <Clock className="w-3 h-3 shrink-0 mt-0.5" />
          <span>Market is {marketSession.status}. Spreads are {marketSession.spreadMultiplier}x wider.</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          className={type === "buy" ? "bg-profit hover:bg-profit/90 text-white" : "bg-loss hover:bg-loss/90 text-white"}
        >
          Confirm {type === "buy" ? "Buy" : "Sell"}
        </Button>
      </div>
    </div>
  )
}
