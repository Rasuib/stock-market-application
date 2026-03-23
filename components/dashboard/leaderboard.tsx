"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import { useTradingStore } from "@/stores/trading-store"
import { generateLearningSummary } from "@/lib/coaching"
import { computeLevel, getLevelTitle } from "@/lib/gamification"

/**
 * Personal Stats Card
 *
 * Replaced the fake leaderboard. Shows only the user's own real data.
 * No simulated traders, no fake rankings.
 */
export default function Leaderboard({ compact = false }: { compact?: boolean }) {
  const trades = useTradingStore((s) => s.trades)
  const gamification = useTradingStore((s) => s.gamification)

  const stats = useMemo(() => {
    const summary = generateLearningSummary(trades)
    const { level } = computeLevel(gamification.xp)
    const title = getLevelTitle(level)
    return { summary, level, title }
  }, [trades, gamification.xp])

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-warning flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Your Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Complete some trades to see your performance stats.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-warning flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Your Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Level & Title */}
        <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-surface-border">
          <div>
            <p className="text-sm font-bold">Level {stats.level}</p>
            <p className="text-xs text-muted-foreground">{stats.title}</p>
          </div>
          <Badge variant="outline-warning" className="text-xs font-mono">
            {gamification.xp} XP
          </Badge>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-surface rounded-lg border border-surface-border text-center">
            <p className={`text-lg font-mono font-bold ${
              stats.summary.grade.startsWith("A") || stats.summary.grade === "S" ? "text-profit" :
              stats.summary.grade.startsWith("B") ? "text-primary" :
              stats.summary.grade.startsWith("C") ? "text-warning" : "text-loss"
            }`}>
              {stats.summary.grade}
            </p>
            <p className="text-xs text-muted-foreground">Grade</p>
          </div>
          <div className="p-2.5 bg-surface rounded-lg border border-surface-border text-center">
            <p className="text-lg font-mono font-bold">{stats.summary.winRate}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
          <div className="p-2.5 bg-surface rounded-lg border border-surface-border text-center">
            <p className={`text-lg font-mono font-bold ${stats.summary.totalPnL >= 0 ? "text-profit" : "text-loss"}`}>
              {stats.summary.totalPnL >= 0 ? "+" : ""}${Math.abs(stats.summary.totalPnL).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground">Total P&L</p>
          </div>
          <div className="p-2.5 bg-surface rounded-lg border border-surface-border text-center">
            <p className="text-lg font-mono font-bold">{trades.length}</p>
            <p className="text-xs text-muted-foreground">Trades</p>
          </div>
        </div>

        {/* Trajectory */}
        {!compact && stats.summary.trajectory !== "stable" && (
          <div className={`text-xs text-center py-2 rounded-lg border ${
            stats.summary.trajectory === "improving"
              ? "bg-profit/10 border-profit/20 text-profit"
              : stats.summary.trajectory === "declining"
              ? "bg-loss/10 border-loss/20 text-loss"
              : "bg-surface border-surface-border text-muted-foreground"
          }`}>
            Trajectory: {stats.summary.trajectory}
          </div>
        )}

        {/* Strengths */}
        {!compact && stats.summary.strengths.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {stats.summary.strengths.map(s => (
              <Badge key={s} variant="outline" className="text-[10px] text-profit border-profit/30">
                {s.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
