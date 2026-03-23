"use client"

import { useCallback } from "react"
import { useTradingStore } from "@/stores/trading-store"
import { processTradeForGamification, getLevelTitle, getAchievementDef } from "@/lib/gamification"
import { generateLearningSummary } from "@/lib/coaching"
import { toast } from "sonner"

/**
 * Hook to trigger gamification processing after a trade.
 * Call `processTrade()` after every buy/sell.
 */
export function useGamification() {
  const processTrade = useCallback(() => {
    const state = useTradingStore.getState()
    const { trades, balance, positions, gamification } = state

    if (trades.length === 0) return

    const summary = generateLearningSummary(trades)
    const result = processTradeForGamification(
      gamification,
      trades,
      summary,
      balance,
      positions,
    )

    // Update store
    state.setGamification(result.newState)

    // Show XP gain toast
    if (result.xpGained > 0) {
      toast.success(`+${result.xpGained} XP`, {
        description: result.leveledUp
          ? `Level up! You're now Level ${result.newLevel}: ${getLevelTitle(result.newLevel)}`
          : undefined,
        duration: result.leveledUp ? 5000 : 2000,
      })
    }

    // Show achievement toasts
    for (const achievement of result.newAchievements) {
      const def = getAchievementDef(achievement.id)
      if (def) {
        toast.success(`Achievement Unlocked: ${def.title}`, {
          description: `${def.description} (+${def.xpReward} XP)`,
          duration: 4000,
        })
      }
    }
  }, [])

  return { processTrade }
}
