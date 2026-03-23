"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useTradingStore } from "@/stores/trading-store"
import {
  computeScoreTrend,
  computeFlagFrequency,
  computePeriodDelta,
  computeStreakHistory,
  generateProgressSummary,
  type ScoreTrendPoint,
  type FlagFrequency,
  type DeltaClassification,
} from "@/lib/progress-analytics"
import { TrendingUp, TrendingDown, Minus, Flame, AlertTriangle, ArrowDown, ArrowUp, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Score Trend Chart (simple inline SVG) ──

function ScoreTrendChart({ data }: { data: ScoreTrendPoint[] }) {
  if (data.length < 2) return null

  const width = 400
  const height = 120
  const padding = { top: 10, right: 10, bottom: 20, left: 30 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const scores = data.map((d) => d.rollingAvg)
  const minScore = Math.max(0, Math.min(...scores) - 5)
  const maxScore = Math.min(100, Math.max(...scores) + 5)

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * plotW
  const yScale = (v: number) => padding.top + plotH - ((v - minScore) / (maxScore - minScore)) * plotH

  // Rolling average line
  const avgLine = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d.rollingAvg).toFixed(1)}`).join(" ")

  // Individual score dots
  const dots = data.map((d, i) => ({
    cx: xScale(i),
    cy: yScale(d.score),
    score: d.score,
  }))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Coaching score trend chart">
      {/* Y-axis labels */}
      <text x={padding.left - 4} y={padding.top + 4} className="fill-muted-foreground text-[10px]" textAnchor="end">{Math.round(maxScore)}</text>
      <text x={padding.left - 4} y={padding.top + plotH + 4} className="fill-muted-foreground text-[10px]" textAnchor="end">{Math.round(minScore)}</text>

      {/* Grid line at 60 (quality threshold) */}
      {60 >= minScore && 60 <= maxScore && (
        <line
          x1={padding.left}
          y1={yScale(60)}
          x2={width - padding.right}
          y2={yScale(60)}
          stroke="currentColor"
          className="text-muted-foreground/20"
          strokeDasharray="4 4"
        />
      )}

      {/* Rolling average line */}
      <path d={avgLine} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />

      {/* Score dots */}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r="2.5"
          className={cn(
            "transition-colors",
            d.score > 60 ? "fill-profit" : d.score > 40 ? "fill-primary" : "fill-loss",
          )}
        />
      ))}

      {/* X-axis: trade index labels */}
      <text x={padding.left} y={height - 2} className="fill-muted-foreground text-[9px]">1</text>
      <text x={width - padding.right} y={height - 2} className="fill-muted-foreground text-[9px]" textAnchor="end">{data.length}</text>
    </svg>
  )
}

// ── Flag Trend Row ──

const FLAG_LABELS: Record<string, string> = {
  overtrading: "Overtrading",
  oversized_position: "Oversized Position",
  trend_fighting: "Trend Fighting",
  sentiment_ignoring: "Ignoring Sentiment",
  panic_exit: "Panic Exit",
  late_chase: "Late Chase",
  poor_risk_discipline: "Poor Risk Discipline",
  impulsive_reversal: "Impulsive Reversal",
  concentration_risk: "Concentration Risk",
  selling_winners_early: "Selling Winners Early",
  holding_losers: "Holding Losers",
}

function FlagRow({ freq }: { freq: FlagFrequency }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm">{FLAG_LABELS[freq.flag] ?? freq.flag}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">{freq.recentCount}x recent</span>
        {freq.trend === "improving" && (
          <Badge variant="outline" className="text-profit border-profit/30 text-xs px-1.5 py-0">
            <ArrowDown className="w-3 h-3 mr-0.5" />
            Improving
          </Badge>
        )}
        {freq.trend === "worsening" && (
          <Badge variant="outline" className="text-loss border-loss/30 text-xs px-1.5 py-0">
            <ArrowUp className="w-3 h-3 mr-0.5" />
            Rising
          </Badge>
        )}
        {freq.trend === "stable" && (
          <Badge variant="outline" className="text-muted-foreground border-border text-xs px-1.5 py-0">
            <Minus className="w-3 h-3 mr-0.5" />
            Stable
          </Badge>
        )}
      </div>
    </div>
  )
}

// ── Delta Classification Badge ──

function DeltaBadge({ classification }: { classification: DeltaClassification }) {
  const config = {
    improving: { label: "Improving", icon: TrendingUp, className: "text-profit border-profit/30" },
    stable: { label: "Stable", icon: Minus, className: "text-muted-foreground border-border" },
    declining: { label: "Declining", icon: TrendingDown, className: "text-loss border-loss/30" },
  }
  const c = config[classification]
  return (
    <Badge variant="outline" className={cn("text-sm font-medium", c.className)}>
      <c.icon className="w-3.5 h-3.5 mr-1" />
      {c.label}
    </Badge>
  )
}

// ── Main Component ──

export default function CoachingProgress({ compact = false }: { compact?: boolean }) {
  const trades = useTradingStore((s) => s.trades)
  const gamification = useTradingStore((s) => s.gamification)

  const scoreTrend = useMemo(() => computeScoreTrend(trades), [trades])
  const flagFrequency = useMemo(() => computeFlagFrequency(trades), [trades])
  const delta = useMemo(() => computePeriodDelta(trades), [trades])
  const streakHistory = useMemo(() => computeStreakHistory(trades), [trades])
  const summary = useMemo(() => generateProgressSummary(delta, flagFrequency), [delta, flagFrequency])

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            Start trading to see your coaching progress here.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Summary */}
          <p className="text-xs text-muted-foreground">{summary}</p>

          {/* Mini trend chart */}
          {scoreTrend.length >= 3 && <ScoreTrendChart data={scoreTrend} />}

          {/* Delta badge */}
          {delta && <DeltaBadge classification={delta.classification} />}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Coaching Progress
            </CardTitle>
            {delta && <DeltaBadge classification={delta.classification} />}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground mb-4">{summary}</p>

          {/* Score trend chart */}
          {scoreTrend.length >= 3 && (
            <div>
              <h4 className="text-xs text-muted-foreground mb-2 font-mono uppercase">Score Trend (rolling avg)</h4>
              <ScoreTrendChart data={scoreTrend} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period comparison */}
      {delta && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase">Last 10 vs Previous 10</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold">{delta.recentAvgScore}</span>
                  <span className={cn(
                    "text-sm font-mono",
                    delta.scoreDelta > 0 ? "text-profit" : delta.scoreDelta < 0 ? "text-loss" : "text-muted-foreground",
                  )}>
                    {delta.scoreDelta > 0 ? "+" : ""}{delta.scoreDelta}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">was {delta.previousAvgScore}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Flags per Trade</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold">{delta.recentFlagRate}</span>
                  <span className={cn(
                    "text-sm font-mono",
                    delta.flagRateDelta < 0 ? "text-profit" : delta.flagRateDelta > 0 ? "text-loss" : "text-muted-foreground",
                  )}>
                    {delta.flagRateDelta > 0 ? "+" : ""}{delta.flagRateDelta}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">was {delta.previousFlagRate}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Behavioral flags */}
      {flagFrequency.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase">Behavioral Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {flagFrequency.slice(0, 6).map((freq) => (
                <FlagRow key={freq.flag} freq={freq} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Streak History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" />
            Quality Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 sm:gap-6 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-2xl font-mono font-bold">{gamification.streak.currentStreak}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Best</p>
              <p className="text-2xl font-mono font-bold">{gamification.streak.longestStreak}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Streaks</p>
              <p className="text-2xl font-mono font-bold">{streakHistory.length}</p>
            </div>
          </div>

          {streakHistory.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground mb-2">Recent streaks (score &gt; 60)</p>
              {streakHistory.slice(-5).reverse().map((seg, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">Trades {seg.startIndex + 1}–{seg.startIndex + seg.length}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono">{seg.length} in a row</span>
                    <Badge variant="outline" className="text-xs font-mono">avg {seg.avgScore}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Score above 60 on consecutive trades to build quality streaks.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
