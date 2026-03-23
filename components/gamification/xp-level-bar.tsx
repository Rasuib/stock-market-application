"use client"

import { useTradingStore } from "@/stores/trading-store"
import { computeLevel, getLevelTitle } from "@/lib/gamification"
import { Zap } from "lucide-react"

export default function XPLevelBar() {
  const xp = useTradingStore((s) => s.gamification.xp)
  const { level, currentLevelXP, nextLevelXP } = computeLevel(xp)
  const progress = nextLevelXP > 0 ? (currentLevelXP / nextLevelXP) * 100 : 100
  const title = getLevelTitle(level)

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10 border border-amber-500/30 shrink-0">
        <span className="text-warning font-mono font-bold text-sm">{level}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-foreground/80 truncate">{title}</span>
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <Zap className="w-3 h-3 text-warning" />
            {xp.toLocaleString()} XP
          </span>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] font-mono text-gray-600">{currentLevelXP} / {nextLevelXP}</span>
          <span className="text-[9px] font-mono text-gray-600">Lv.{level + 1}</span>
        </div>
      </div>
    </div>
  )
}
