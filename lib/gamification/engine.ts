/**
 * Gamification Engine
 *
 * Computes XP, checks achievement conditions, tracks quality streaks.
 * Pure functions — no side effects, no state mutation.
 *
 * Key design: gamification ALIGNS with coaching — quality > quantity.
 * - XP scales primarily with coaching score
 * - Repeated behavioral flags cause XP decay
 * - Quality streak tracks consecutive trades with score > 60
 * - No daily streak (removed — it incentivized overtrading)
 */

import type { TradeWithCoaching, LearningSummary } from "@/lib/coaching/types"
import type { StoredPosition } from "@/lib/storage"
import {
  ACHIEVEMENTS,
  LEVEL_THRESHOLDS,
  LEVEL_TITLES,
  type AchievementDef,
  type GamificationState,
  type UnlockedAchievement,
  type XPState,
  type StreakState,
} from "./types"

// ── XP Computation ──

/** XP earned per trade based on coaching score, with decay for repeated flags */
export function xpForTrade(
  coaching: TradeWithCoaching["coaching"],
  recentFlagCounts: Record<string, number>,
): number {
  const base = 5
  // Quadratic scaling — rewards high scores much more
  const scoreBonus = Math.max(0, coaching.score - 30) * 0.5
  const verdictBonus = coaching.verdict === "strong" ? 15 : coaching.verdict === "mixed" ? 5 : 0

  let rawXP = base + scoreBonus + verdictBonus

  // XP decay for repeated behavioral flags (same flag ≥3 times in rolling window)
  for (const flag of coaching.behavioralFlags) {
    const count = recentFlagCounts[flag.flag] ?? 0
    if (count >= 3) {
      // Each repeated flag above threshold reduces XP by 20%
      rawXP *= 0.8
    }
  }

  return Math.max(1, Math.round(rawXP))
}

/** Compute level info from total XP */
export function computeLevel(totalXP: number): XPState {
  let level = 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
      break
    }
  }

  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? currentThreshold + 5000
  const currentLevelXP = totalXP - currentThreshold
  const nextLevelXP = nextThreshold - currentThreshold

  return { totalXP, level, currentLevelXP, nextLevelXP }
}

/** Get title for a level */
export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, 20)] ?? `Level ${level}`
}

// ── Quality Streak Tracking ──

/**
 * Update quality streak based on latest trade's coaching score.
 * A quality streak counts consecutive trades with score > 60.
 */
export function updateStreak(current: StreakState, latestScore: number): StreakState {
  if (latestScore > 60) {
    const newStreak = current.currentStreak + 1
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(current.longestStreak, newStreak),
      lastTradeDate: new Date().toISOString().split("T")[0],
    }
  }

  // Streak broken
  return {
    currentStreak: 0,
    longestStreak: current.longestStreak,
    lastTradeDate: new Date().toISOString().split("T")[0],
  }
}

// ── Achievement Checking ──

interface CheckContext {
  trades: TradeWithCoaching[]
  summary: LearningSummary
  balance: number
  positions: Record<string, StoredPosition>
  streak: StreakState
}

type CheckFn = (ctx: CheckContext) => boolean

const CHECKS: Record<string, CheckFn> = {
  // Trading
  first_trade: (ctx) => ctx.trades.length >= 1,
  ten_trades: (ctx) => ctx.trades.length >= 10,
  fifty_trades: (ctx) => ctx.trades.length >= 50,
  hundred_trades: (ctx) => ctx.trades.length >= 100,
  first_profit: (ctx) => ctx.trades.some((t) => t.type === "sell" && (t.profit ?? 0) > 0),
  big_win: (ctx) => ctx.trades.some((t) => t.type === "sell" && (t.profit ?? 0) >= 1000),

  // Learning
  grade_c: (ctx) => gradeRank(ctx.summary.grade) >= gradeRank("C"),
  grade_b: (ctx) => gradeRank(ctx.summary.grade) >= gradeRank("B"),
  grade_a: (ctx) => gradeRank(ctx.summary.grade) >= gradeRank("A"),
  grade_s: (ctx) => gradeRank(ctx.summary.grade) >= gradeRank("S"),
  improving: (ctx) => ctx.summary.trajectory === "improving",
  win_rate_60: (ctx) => {
    const sells = ctx.trades.filter((t) => t.type === "sell")
    return sells.length >= 10 && ctx.summary.winRate >= 60
  },

  // Quality streaks (replaces daily streaks)
  quality_streak_3: (ctx) => ctx.streak.longestStreak >= 3,
  quality_streak_5: (ctx) => ctx.streak.longestStreak >= 5,
  quality_streak_10: (ctx) => ctx.streak.longestStreak >= 10,
  quality_streak_20: (ctx) => ctx.streak.longestStreak >= 20,

  // Portfolio
  portfolio_110k: (ctx) => totalPortfolioValue(ctx) >= 110_000,
  portfolio_150k: (ctx) => totalPortfolioValue(ctx) >= 150_000,
  portfolio_200k: (ctx) => totalPortfolioValue(ctx) >= 200_000,
  diversified: (ctx) => Object.values(ctx.positions).filter((p) => p.quantity > 0).length >= 3,

  // Mastery
  no_mistakes_5: (ctx) => {
    const last5 = ctx.trades.slice(-5)
    return last5.length >= 5 && last5.every((t) => t.coaching.behavioralFlags.length === 0)
  },
  strong_trade_3: (ctx) => {
    const last3 = ctx.trades.slice(-3)
    return last3.length >= 3 && last3.every((t) => t.coaching.verdict === "strong")
  },
  all_skills: (ctx) => {
    const c = ctx.summary.recentComponentAverages
    return c.alignment > 0 && c.risk > 0 && c.discipline > 0 && c.outcome > 0 && c.learning > 0
  },

  // New quality-focused achievements
  selective_week: (ctx) => {
    // 2 trades in last 7 days, both score >= 70
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentTrades = ctx.trades.filter(t => new Date(t.timestamp).getTime() > weekAgo)
    return recentTrades.length >= 2 && recentTrades.length <= 5 && recentTrades.every(t => t.coaching.score >= 70)
  },
  patient_trader: (ctx) => {
    // 5 consecutive trades with >= 24h gap between them
    if (ctx.trades.length < 5) return false
    const last5 = ctx.trades.slice(-5)
    for (let i = 1; i < last5.length; i++) {
      const gap = new Date(last5[i].timestamp).getTime() - new Date(last5[i - 1].timestamp).getTime()
      if (gap < 24 * 60 * 60 * 1000) return false
    }
    return true
  },
}

function gradeRank(grade: string): number {
  const ranks: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 }
  return ranks[grade] ?? 0
}

function totalPortfolioValue(ctx: CheckContext): number {
  const positionValue = Object.values(ctx.positions).reduce(
    (sum, p) => sum + p.quantity * p.avgPrice, 0
  )
  return ctx.balance + positionValue
}

/** Check all achievements and return newly unlocked ones */
export function checkAchievements(
  state: GamificationState,
  trades: TradeWithCoaching[],
  summary: LearningSummary,
  balance: number,
  positions: Record<string, StoredPosition>,
): UnlockedAchievement[] {
  const unlockedIds = new Set(state.achievements.map((a) => a.id))
  const ctx: CheckContext = { trades, summary, balance, positions, streak: state.streak }
  const newlyUnlocked: UnlockedAchievement[] = []

  for (const def of ACHIEVEMENTS) {
    if (unlockedIds.has(def.id)) continue
    const check = CHECKS[def.checkId]
    if (check && check(ctx)) {
      newlyUnlocked.push({
        id: def.id,
        unlockedAt: new Date().toISOString(),
        seen: false,
      })
    }
  }

  return newlyUnlocked
}

/** Get achievement definition by ID */
export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

/**
 * Count recent behavioral flags from last N trades (for XP decay).
 */
export function getRecentFlagCounts(trades: TradeWithCoaching[], windowSize: number = 20): Record<string, number> {
  const counts: Record<string, number> = {}
  const recent = trades.slice(-windowSize)
  for (const trade of recent) {
    for (const flag of trade.coaching.behavioralFlags) {
      counts[flag.flag] = (counts[flag.flag] ?? 0) + 1
    }
  }
  return counts
}

/** Process a new trade: compute XP gain, update streak, check achievements */
export function processTradeForGamification(
  currentState: GamificationState,
  trades: TradeWithCoaching[],
  summary: LearningSummary,
  balance: number,
  positions: Record<string, StoredPosition>,
): {
  newState: GamificationState
  xpGained: number
  newAchievements: UnlockedAchievement[]
  leveledUp: boolean
  newLevel: number
} {
  const latestTrade = trades[trades.length - 1]
  if (!latestTrade) {
    return { newState: currentState, xpGained: 0, newAchievements: [], leveledUp: false, newLevel: computeLevel(currentState.xp).level }
  }

  // 1. Update quality streak (based on coaching score, not daily trading)
  const newStreak = updateStreak(currentState.streak, latestTrade.coaching.score)

  // 2. Compute XP with flag-decay
  const recentFlagCounts = getRecentFlagCounts(trades)
  const tradeXP = xpForTrade(latestTrade.coaching, recentFlagCounts)

  // 3. Check achievements with updated streak
  const stateWithStreak = { ...currentState, streak: newStreak }
  const newAchievements = checkAchievements(stateWithStreak, trades, summary, balance, positions)

  // 4. Total XP gain (trade XP + achievement rewards)
  const achievementXP = newAchievements.reduce((sum, a) => {
    const def = getAchievementDef(a.id)
    return sum + (def?.xpReward ?? 0)
  }, 0)
  const totalXPGain = tradeXP + achievementXP

  // 5. Compute new level
  const oldLevel = computeLevel(currentState.xp).level
  const newXP = currentState.xp + totalXPGain
  const newLevel = computeLevel(newXP).level

  return {
    newState: {
      xp: newXP,
      achievements: [...currentState.achievements, ...newAchievements],
      streak: newStreak,
      lastXPGainTimestamp: new Date().toISOString(),
    },
    xpGained: totalXPGain,
    newAchievements,
    leveledUp: newLevel > oldLevel,
    newLevel,
  }
}
