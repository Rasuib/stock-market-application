"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle, XCircle, AlertTriangle, Lightbulb, TrendingUp, TrendingDown,
  Shield, Target, ChevronDown, ChevronUp, BarChart3, ThumbsUp, ThumbsDown,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { CoachingReport } from "@/lib/coaching/types"

interface TradeReviewCardProps {
  coaching: CoachingReport
  action: "buy" | "sell"
  symbol: string
  quantity: number
  currency: "USD" | "INR"
  /** Execution metadata if available */
  execution?: {
    requestedPrice: number
    fillPrice: number
    spreadBps: number
    commissionPaid: number
    slippageBps: number
    executionDelayMs: number
    orderType: "market" | "limit"
  }
  /** Pre-trade thesis */
  thesis?: string
  /** If true, render full-size. If false, render compact (for trade history). */
  expanded?: boolean
  /** Callback when user rates the coaching */
  onRate?: (helpful: boolean) => void
}

export default function TradeReviewCard({
  coaching,
  action,
  symbol,
  quantity,
  currency: _currency,
  execution,
  thesis,
  expanded: initialExpanded = true,
  onRate,
}: TradeReviewCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [showDetails, setShowDetails] = useState(false)
  const [rated, setRated] = useState<boolean | null>(coaching.rating?.helpful ?? null)

  function handleRate(helpful: boolean) {
    setRated(helpful)
    onRate?.(helpful)
  }

  const verdictConfig = {
    strong: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle, label: "Strong Trade" },
    mixed: { color: "bg-warning/20 text-warning border-warning/30", icon: AlertTriangle, label: "Mixed Signals" },
    weak: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle, label: "Weak Trade" },
  }

  const v = verdictConfig[coaching.verdict]

  return (
    <Card className="overflow-hidden">
      {/* Header — always visible: verdict + score + trade info */}
      <CardHeader
        className="pb-2 cursor-pointer hover:bg-surface-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
        aria-label={`Trade review: ${v.label}`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-chart-4 shrink-0" />
            <CardTitle className="text-sm">Trade Review</CardTitle>
            <Badge className={cn(v.color, "text-xs")}>
              <v.icon className="w-3 h-3 mr-1" />
              {v.label}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{coaching.score}/100</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={action === "buy" ? "outline-success" : "outline-destructive"} className="text-xs">
              {action.toUpperCase()} {quantity} {symbol}
            </Badge>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{coaching.summary}</p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Score Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  coaching.score >= 65 ? "bg-success" :
                  coaching.score >= 40 ? "bg-warning" :
                  "bg-destructive"
                }`}
                style={{ width: `${coaching.score}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground w-12 text-right">{coaching.score}/100</span>
          </div>

          {/* Thesis — if provided */}
          {thesis && (
            <div className="text-xs bg-primary/5 border border-primary/20 rounded px-3 py-2">
              <span className="font-semibold text-primary">Your thesis: </span>
              <span className="text-muted-foreground">{thesis}</span>
            </div>
          )}

          {/* Execution details — if available */}
          {execution && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px] font-mono text-muted-foreground">
                <div className="bg-surface rounded px-2 py-1.5 border border-surface-border">
                  <span className="block text-muted-foreground/60">Requested</span>
                  <span>${execution.requestedPrice.toFixed(2)}</span>
                </div>
                <div className="bg-surface rounded px-2 py-1.5 border border-surface-border">
                  <span className="block text-muted-foreground/60">Fill</span>
                  <span>${execution.fillPrice.toFixed(2)}</span>
                </div>
                <div className="bg-surface rounded px-2 py-1.5 border border-surface-border">
                  <span className="block text-muted-foreground/60">Slippage</span>
                  <span>{execution.slippageBps}bps</span>
                </div>
                <div className="bg-surface rounded px-2 py-1.5 border border-surface-border">
                  <span className="block text-muted-foreground/60">Spread</span>
                  <span>{execution.spreadBps}bps</span>
                </div>
                <div className="bg-surface rounded px-2 py-1.5 border border-surface-border">
                  <span className="block text-muted-foreground/60">Commission</span>
                  <span>${execution.commissionPaid.toFixed(2)}</span>
                </div>
                <div className="bg-surface rounded px-2 py-1.5 border border-surface-border">
                  <span className="block text-muted-foreground/60">Type</span>
                  <span className="uppercase">{execution.orderType}</span>
                </div>
              </div>
              {execution.requestedPrice !== execution.fillPrice && (
                <p className="text-[11px] text-muted-foreground/70 pl-0.5" title="Fill price differs from requested price due to spread and slippage applied during execution.">
                  Fill differs from requested by {((Math.abs(execution.fillPrice - execution.requestedPrice) / execution.requestedPrice) * 10000).toFixed(1)}bps — due to spread ({execution.spreadBps}bps) + slippage ({execution.slippageBps}bps).
                </p>
              )}
            </div>
          )}

          {/* What went right */}
          {coaching.whatWentRight.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-success">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold">What you did right</span>
              </div>
              {coaching.whatWentRight.map((item, i) => (
                <p key={i} className="text-sm text-muted-foreground pl-5">{item}</p>
              ))}
            </div>
          )}

          {/* What went wrong */}
          {coaching.whatWentWrong.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-destructive">
                <XCircle className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold">What went wrong</span>
              </div>
              {coaching.whatWentWrong.map((item, i) => (
                <p key={i} className="text-sm text-muted-foreground pl-5">{item}</p>
              ))}
            </div>
          )}

          {/* Improve next */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-primary">
              <Lightbulb className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">What to improve</span>
            </div>
            {coaching.improveNext.map((item, i) => (
              <p key={i} className="text-sm text-muted-foreground pl-5">{item}</p>
            ))}
          </div>

          {/* Behavioral flags — always visible if present (important) */}
          {coaching.behavioralFlags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-warning">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold">Behavioral Patterns</span>
              </div>
              {coaching.behavioralFlags.map((flag, i) => (
                <div key={i} className={`text-xs px-3 py-2 rounded flex items-start gap-2 ${
                  flag.severity === "critical" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                  flag.severity === "warning" ? "bg-warning/10 text-warning border border-warning/20" :
                  "bg-muted text-muted-foreground border border-border"
                }`}>
                  <span className="shrink-0 mt-0.5">
                    {flag.severity === "critical" ? "!!" : flag.severity === "warning" ? "!" : "i"}
                  </span>
                  <span>
                    {flag.description}
                    {flag.escalated && (
                      <span className="ml-1 text-destructive font-semibold">[ESCALATED]</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Feedback rating */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Was this helpful?</span>
            {rated === null ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRate(true) }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-success hover:bg-success/10 transition-colors touch-manipulation"
                  aria-label="Mark review as helpful"
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Yes
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRate(false) }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
                  aria-label="Mark review as unhelpful"
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> No
                </button>
              </div>
            ) : (
              <span className={`text-xs flex items-center gap-1 ${rated ? "text-success" : "text-destructive"}`}>
                {rated ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                {rated ? "Helpful" : "Not helpful"}
              </span>
            )}
          </div>

          {/* Detailed breakdown — collapsed by default (progressive disclosure) */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full touch-manipulation"
            aria-expanded={showDetails}
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showDetails && "rotate-180")} />
            {showDetails ? "Hide detailed breakdown" : "Show detailed breakdown"}
          </button>

          {showDetails && (
            <div className="space-y-4 pt-1 border-t border-border">
              {/* Market Regime Context */}
              {coaching.regimeContext && (
                <div className="text-xs text-muted-foreground bg-surface rounded px-3 py-2 border border-surface-border">
                  <span className="font-semibold">Market regime: </span>
                  {coaching.regimeContext}
                </div>
              )}

              {/* Signal context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coaching.supportingSignals.length > 0 && (
                  <div className="p-3 bg-success/5 border border-success/20 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 text-success mb-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Supporting</span>
                    </div>
                    {coaching.supportingSignals.map((s, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{s}</p>
                    ))}
                  </div>
                )}
                {coaching.contradictorySignals.length > 0 && (
                  <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 text-destructive mb-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Contradictory</span>
                    </div>
                    {coaching.contradictorySignals.map((s, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{s}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Skill breakdown */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-chart-4 mb-2">
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">Skill Breakdown</span>
                  <span className={`text-xs font-mono ${coaching.reward.total >= 0 ? "text-profit" : "text-loss"}`}>
                    {coaching.reward.total >= 0 ? "+" : ""}{coaching.reward.total} pts
                  </span>
                </div>
                {[
                  { label: "Signal Alignment", value: coaching.reward.alignment },
                  { label: "Risk Management", value: coaching.reward.risk },
                  { label: "Discipline", value: coaching.reward.discipline },
                  { label: "Outcome", value: coaching.reward.outcome },
                  { label: "Learning", value: coaching.reward.learning },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${value >= 0 ? "bg-success" : "bg-destructive"}`}
                        style={{ width: `${Math.min(100, Math.abs(value) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs w-10 text-right font-mono ${value >= 0 ? "text-profit" : "text-loss"}`}>
                      {value >= 0 ? "+" : ""}{(value * 100).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Data provenance */}
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[11px]">
                  Sentiment: {coaching.marketSnapshot.sentiment.source === "finbert" ? "FinBERT NLP" : coaching.marketSnapshot.sentiment.source === "heuristic-fallback" ? "Keyword heuristic" : "Unavailable"}
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  Trend: SMA crossover
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  Regime: {coaching.marketSnapshot.regime?.replace(/_/g, " ") || "unknown"}
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  Confidence: {(coaching.confidence * 100).toFixed(0)}%
                </Badge>
                {coaching.skillTags.length > 0 && (
                  <Badge variant="outline" className="text-[11px] text-chart-4 border-chart-4/30">
                    Skills: {coaching.skillTags.slice(0, 3).map(t => t.replace(/_/g, " ")).join(", ")}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
