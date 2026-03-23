"use client"

import { getAchievementDef, type UnlockedAchievement } from "@/lib/gamification"
import {
  Rocket, BarChart3, Flame, Trophy, Banknote, Star,
  BookOpen, Medal, Crown, Gem, TrendingUp, Target,
  ShieldCheck, Compass, PieChart,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const ICON_MAP: Record<string, LucideIcon> = {
  rocket: Rocket,
  chart: BarChart3,
  fire: Flame,
  trophy: Trophy,
  money: Banknote,
  star: Star,
  book: BookOpen,
  medal: Medal,
  crown: Crown,
  gem: Gem,
  arrow_up: TrendingUp,
  target: Target,
  flame: Flame,
  chart_up: TrendingUp,
  pie: PieChart,
  shield: ShieldCheck,
  compass: Compass,
}

const CATEGORY_COLORS = {
  trading: "from-primary/20 to-cyan-500/20 border-blue-500/30 text-primary",
  learning: "from-chart-4/20 to-pink-500/20 border-purple-500/30 text-chart-4",
  streak: "from-orange-500/20 to-warning/20 border-orange-500/30 text-orange-400",
  portfolio: "from-emerald-500/20 to-green-500/20 border-emerald-500/30 text-emerald-400",
  mastery: "from-warning/20 to-warning/20 border-yellow-500/30 text-warning",
}

export function AchievementBadge({ achievement, compact }: {
  achievement: UnlockedAchievement
  compact?: boolean
}) {
  const def = getAchievementDef(achievement.id)
  if (!def) return null

  const Icon = ICON_MAP[def.icon] ?? Star
  const colors = CATEGORY_COLORS[def.category]

  if (compact) {
    return (
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br border ${colors}`}
        title={`${def.title}: ${def.description}`}
      >
        <Icon className="w-4 h-4" />
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r border ${colors}`}>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-black/30 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono font-semibold truncate">{def.title}</p>
        <p className="text-[10px] font-mono text-muted-foreground truncate">{def.description}</p>
      </div>
      <span className="text-[10px] font-mono text-gray-600 shrink-0">+{def.xpReward} XP</span>
    </div>
  )
}

export function LockedAchievementBadge({ id }: { id: string }) {
  const def = getAchievementDef(id)
  if (!def) return null

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-surface-border opacity-50">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface shrink-0">
        <span className="text-gray-600 text-lg">?</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono font-semibold text-muted-foreground truncate">{def.title}</p>
        <p className="text-[10px] font-mono text-gray-600 truncate">{def.description}</p>
      </div>
      <span className="text-[10px] font-mono text-gray-700 shrink-0">+{def.xpReward} XP</span>
    </div>
  )
}
