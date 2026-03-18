"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle, XCircle, AlertTriangle, Lightbulb, TrendingUp, TrendingDown,
  Shield, Target, ChevronDown, ChevronUp, BarChart3, ThumbsUp, ThumbsDown,
} from "lucide-react"
import { useState } from "react"
import type { CoachingReport } from "@/lib/coaching/types"

interface TradeReviewCardProps {
  coaching: CoachingReport
  action: "buy" | "sell"
  symbol: string
  quantity: number
  price: number
  currency: "USD" | "INR"
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
  price,
  currency,
  expanded: initialExpanded = true,
  onRate,
}: TradeReviewCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [rated, setRated] = useState<boolean | null>(coaching.rating?.helpful ?? null)
  const currencySymbol = currency === "INR" ? "\u20B9" : "$"

  function handleRate(helpful: boolean) {
    setRated(helpful)
    onRate?.(helpful)
  }

  const verdictConfig = {
    strong: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle, label: "Strong Trade" },
    mixed: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertTriangle, label: "Mixed Signals" },
    weak: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Weak Trade" },
  }

  const v = verdictConfig[coaching.verdict]

  return (
    <Card className="bg-gray-900/70 border-gray-700 overflow-hidden">
      {/* Header - always visible */}
      <CardHeader
        className="pb-2 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-base text-white">Trade Review</CardTitle>
            <Badge className={v.color}>
              <v.icon className="w-3 h-3 mr-1" />
              {v.label}
            </Badge>
            <span className="text-sm text-gray-400 font-mono">{coaching.score}/100</span>
            {coaching.confidence < 0.5 && (
              <span className="text-[10px] text-gray-500 font-mono">(low confidence)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={action === "buy"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
            }>
              {action.toUpperCase()} {quantity} {symbol}
            </Badge>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
        <p className="text-sm text-gray-300 mt-1">{coaching.summary}</p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Score Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  coaching.score >= 65 ? "bg-green-500" :
                  coaching.score >= 40 ? "bg-yellow-500" :
                  "bg-red-500"
                }`}
                style={{ width: `${coaching.score}%` }}
              />
            </div>
            <span className="text-sm font-mono text-gray-400 w-12 text-right">{coaching.score}/100</span>
          </div>

          {/* Market Regime Context */}
          {coaching.regimeContext && (
            <div className="text-xs text-gray-400 bg-gray-800/50 rounded px-3 py-2 border border-gray-700/50">
              <span className="text-gray-500 font-semibold">Market: </span>
              {coaching.regimeContext}
            </div>
          )}

          {/* What went right */}
          {coaching.whatWentRight.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">What you did right</span>
              </div>
              {coaching.whatWentRight.map((item, i) => (
                <p key={i} className="text-sm text-gray-300 pl-6">{item}</p>
              ))}
            </div>
          )}

          {/* What went wrong */}
          {coaching.whatWentWrong.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">What went wrong</span>
              </div>
              {coaching.whatWentWrong.map((item, i) => (
                <p key={i} className="text-sm text-gray-300 pl-6">{item}</p>
              ))}
            </div>
          )}

          {/* Improve next */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-blue-400">
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm font-semibold">What to improve next</span>
            </div>
            {coaching.improveNext.map((item, i) => (
              <p key={i} className="text-sm text-gray-300 pl-6">{item}</p>
            ))}
          </div>

          {/* Signal context */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {coaching.supportingSignals.length > 0 && (
              <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-green-400 mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">Supporting Signals</span>
                </div>
                {coaching.supportingSignals.map((s, i) => (
                  <p key={i} className="text-xs text-gray-400">{s}</p>
                ))}
              </div>
            )}
            {coaching.contradictorySignals.length > 0 && (
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-red-400 mb-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">Contradictory Signals</span>
                </div>
                {coaching.contradictorySignals.map((s, i) => (
                  <p key={i} className="text-xs text-gray-400">{s}</p>
                ))}
              </div>
            )}
          </div>

          {/* Reward breakdown */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-purple-400 mb-2">
              <Target className="w-4 h-4" />
              <span className="text-sm font-semibold">Skill Breakdown</span>
              <span className={`text-xs font-mono ${coaching.reward.total >= 0 ? "text-green-400" : "text-red-400"}`}>
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
                <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${value >= 0 ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, Math.abs(value) * 100)}%` }}
                  />
                </div>
                <span className={`text-xs w-10 text-right font-mono ${value >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {value >= 0 ? "+" : ""}{(value * 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>

          {/* Behavioral flags */}
          {coaching.behavioralFlags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-semibold">Behavioral Patterns</span>
              </div>
              {coaching.behavioralFlags.map((flag, i) => (
                <div key={i} className={`text-xs px-3 py-2 rounded flex items-start gap-2 ${
                  flag.severity === "critical" ? "bg-red-500/10 text-red-300 border border-red-500/20" :
                  flag.severity === "warning" ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" :
                  "bg-gray-500/10 text-gray-400 border border-gray-600/20"
                }`}>
                  <span className="shrink-0 mt-0.5">
                    {flag.severity === "critical" ? "!!" : flag.severity === "warning" ? "!" : "i"}
                  </span>
                  <span>
                    {flag.description}
                    {flag.escalated && (
                      <span className="ml-1 text-red-400 font-semibold">[ESCALATED]</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Feedback rating */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <span className="text-xs text-gray-500">Was this review helpful?</span>
            {rated === null ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRate(true) }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Yes
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRate(false) }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> No
                </button>
              </div>
            ) : (
              <span className={`text-xs flex items-center gap-1 ${rated ? "text-green-400" : "text-red-400"}`}>
                {rated ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                {rated ? "Marked helpful" : "Marked unhelpful"}
              </span>
            )}
          </div>

          {/* Data provenance */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-700">
              Sentiment: {coaching.marketSnapshot.sentiment.source === "finbert" ? "FinBERT NLP" : coaching.marketSnapshot.sentiment.source === "heuristic-fallback" ? "Keyword heuristic" : "Unavailable"}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-700">
              Trend: SMA crossover
            </Badge>
            <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-700">
              Regime: {coaching.marketSnapshot.regime?.replace(/_/g, " ") || "unknown"}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-700">
              Confidence: {(coaching.confidence * 100).toFixed(0)}%
            </Badge>
            {coaching.skillTags.length > 0 && (
              <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-700">
                Skills: {coaching.skillTags.slice(0, 3).map(t => t.replace(/_/g, " ")).join(", ")}
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
