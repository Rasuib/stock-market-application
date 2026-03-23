"use client"

import { useTradingStore } from "@/stores/trading-store"
import { ACHIEVEMENTS } from "@/lib/gamification"
import { AchievementBadge } from "./achievement-badge"
import XPLevelBar from "./xp-level-bar"
import StreakCounter from "./streak-counter"
import { Trophy, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function GamificationCard() {
  const gamification = useTradingStore((s) => s.gamification)

  const recentAchievements = [...gamification.achievements]
    .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
    .slice(0, 3)

  const unlockedCount = gamification.achievements.length
  const totalCount = ACHIEVEMENTS.length

  return (
    <Card className="border-surface-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-warning flex items-center gap-2 text-base">
          <Trophy className="w-5 h-5" />
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* XP Bar */}
        <XPLevelBar />

        {/* Streak */}
        <StreakCounter />

        {/* Achievement count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-warning" />
            <span className="text-xs font-mono text-foreground/80">Achievements</span>
          </div>
          <span className="text-xs font-mono text-warning">
            {unlockedCount}/{totalCount}
          </span>
        </div>

        {/* Recent achievements */}
        {recentAchievements.length > 0 ? (
          <div className="space-y-2">
            {recentAchievements.map((a) => (
              <AchievementBadge key={a.id} achievement={a} />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-xs font-mono">Start trading to earn achievements!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
