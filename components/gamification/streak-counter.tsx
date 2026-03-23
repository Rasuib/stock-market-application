"use client"

import { useTradingStore } from "@/stores/trading-store"
import { Flame } from "lucide-react"

export default function StreakCounter() {
  const streak = useTradingStore((s) => s.gamification.streak)

  if (streak.currentStreak === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-border">
        <Flame className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-mono text-muted-foreground">No quality streak — score above 60 to start!</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      streak.currentStreak >= 10
        ? "bg-orange-500/10 border-orange-500/30"
        : streak.currentStreak >= 5
        ? "bg-warning/10 border-amber-500/30"
        : "bg-surface border-surface-border"
    }`}>
      <Flame className={`w-4 h-4 ${
        streak.currentStreak >= 10 ? "text-orange-400" :
        streak.currentStreak >= 5 ? "text-warning" : "text-muted-foreground"
      }`} />
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-mono font-bold ${
          streak.currentStreak >= 10 ? "text-orange-400" :
          streak.currentStreak >= 5 ? "text-warning" : "text-foreground/80"
        }`}>
          {streak.currentStreak}
        </span>
        <span className="text-xs text-muted-foreground">quality trade{streak.currentStreak !== 1 ? "s" : ""} in a row</span>
      </div>
      {streak.longestStreak > streak.currentStreak && (
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
          Best: {streak.longestStreak}
        </span>
      )}
    </div>
  )
}
