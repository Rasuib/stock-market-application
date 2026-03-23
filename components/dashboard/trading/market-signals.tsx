"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"
import { SignalsSkeleton } from "../loading-skeletons"

interface MarketSignalsProps {
  sentiment: { label: string; source?: string } | null
  trend: { label: string } | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export default function MarketSignals({ sentiment, trend, loading, error, onRefresh }: MarketSignalsProps) {
  if (loading) return <SignalsSkeleton />

  if (error) {
    return (
      <div className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/20 rounded-lg" role="alert">
        <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
        <p className="text-warning text-xs flex-1">Signals unavailable. You can still trade.</p>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-warning hover:text-warning/80" onClick={onRefresh}>
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
    )
  }

  if (!sentiment && !trend) return null

  return (
    <div className="flex gap-1.5 flex-wrap items-center" aria-label="Market signals">
      {sentiment && (
        <Badge
          variant={
            sentiment.label === "bullish" ? "outline-success" :
            sentiment.label === "bearish" ? "outline-destructive" :
            "secondary"
          }
          className="text-[10px]"
        >
          {sentiment.label}
          {sentiment.source === "finbert" && <span className="ml-1 opacity-60">(NLP)</span>}
        </Badge>
      )}
      {trend && (
        <Badge
          variant={
            trend.label === "uptrend" ? "outline-success" :
            trend.label === "downtrend" ? "outline-destructive" :
            "secondary"
          }
          className="text-[10px]"
        >
          {trend.label}
        </Badge>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        onClick={onRefresh}
        aria-label="Refresh market signals"
      >
        <RefreshCw className="w-3 h-3" />
      </Button>
    </div>
  )
}
