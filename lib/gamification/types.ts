/**
 * Gamification Types
 *
 * XP/Level system, achievements, streaks, and milestone tracking.
 */

// ── XP & Levels ──

export interface XPState {
  totalXP: number
  level: number
  currentLevelXP: number    // XP earned toward next level
  nextLevelXP: number       // XP needed for next level
}

/** XP needed for each level (cumulative thresholds) */
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  300,    // Level 3
  600,    // Level 4
  1000,   // Level 5
  1500,   // Level 6
  2200,   // Level 7
  3000,   // Level 8
  4000,   // Level 9
  5200,   // Level 10
  6600,   // Level 11
  8200,   // Level 12
  10000,  // Level 13
  12000,  // Level 14
  14500,  // Level 15
  17500,  // Level 16
  21000,  // Level 17
  25000,  // Level 18
  30000,  // Level 19
  36000,  // Level 20
] as const

export const LEVEL_TITLES: Record<number, string> = {
  1: "Paper Trader",
  2: "Market Watcher",
  3: "Chart Reader",
  4: "Signal Follower",
  5: "Risk Aware",
  6: "Pattern Spotter",
  7: "Disciplined Trader",
  8: "Trend Analyst",
  9: "Strategy Builder",
  10: "Market Veteran",
  11: "Portfolio Manager",
  12: "Signal Master",
  13: "Risk Expert",
  14: "Trade Strategist",
  15: "Market Sage",
  16: "Elite Analyst",
  17: "Trading Scholar",
  18: "Market Authority",
  19: "Trading Legend",
  20: "Grand Master",
}

// ── Streaks ──

export interface StreakState {
  currentStreak: number
  longestStreak: number
  lastTradeDate: string | null   // ISO date string (YYYY-MM-DD)
}

// ── Achievements ──

export type AchievementCategory = "trading" | "learning" | "streak" | "portfolio" | "mastery"

export interface AchievementDef {
  id: string
  title: string
  description: string
  category: AchievementCategory
  icon: string                     // emoji or icon key
  xpReward: number
  /** Check function name — resolved at runtime */
  checkId: string
}

export interface UnlockedAchievement {
  id: string
  unlockedAt: string               // ISO timestamp
  seen: boolean                    // false until user has seen the notification
}

// ── Gamification Store ──

export interface GamificationState {
  xp: number
  achievements: UnlockedAchievement[]
  streak: StreakState
  lastXPGainTimestamp: string | null
}

// ── Achievement Definitions ──

export const ACHIEVEMENTS: AchievementDef[] = [
  // Trading milestones
  { id: "first_trade", title: "First Steps", description: "Place your first trade", category: "trading", icon: "rocket", xpReward: 25, checkId: "first_trade" },
  { id: "ten_trades", title: "Getting Started", description: "Complete 10 trades", category: "trading", icon: "chart", xpReward: 50, checkId: "ten_trades" },
  { id: "fifty_trades", title: "Active Trader", description: "Complete 50 trades", category: "trading", icon: "fire", xpReward: 100, checkId: "fifty_trades" },
  { id: "hundred_trades", title: "Centurion", description: "Complete 100 trades", category: "trading", icon: "trophy", xpReward: 200, checkId: "hundred_trades" },
  { id: "first_profit", title: "In the Green", description: "Close your first profitable trade", category: "trading", icon: "money", xpReward: 30, checkId: "first_profit" },
  { id: "big_win", title: "Big Winner", description: "Earn $1,000+ profit on a single trade", category: "trading", icon: "star", xpReward: 75, checkId: "big_win" },

  // Learning milestones
  { id: "grade_c", title: "Passing Grade", description: "Achieve a C grade or higher", category: "learning", icon: "book", xpReward: 40, checkId: "grade_c" },
  { id: "grade_b", title: "Good Student", description: "Achieve a B grade or higher", category: "learning", icon: "medal", xpReward: 75, checkId: "grade_b" },
  { id: "grade_a", title: "Honor Roll", description: "Achieve an A grade", category: "learning", icon: "crown", xpReward: 150, checkId: "grade_a" },
  { id: "grade_s", title: "Legendary", description: "Achieve an S grade", category: "learning", icon: "gem", xpReward: 300, checkId: "grade_s" },
  { id: "improving", title: "On the Rise", description: "Learning trajectory shows \"improving\"", category: "learning", icon: "arrow_up", xpReward: 50, checkId: "improving" },
  { id: "win_rate_60", title: "Consistent Winner", description: "Maintain 60%+ win rate (min 10 sells)", category: "learning", icon: "target", xpReward: 100, checkId: "win_rate_60" },

  // Quality streak milestones (consecutive trades with coaching score > 60)
  { id: "quality_streak_3", title: "Quality Run", description: "3 consecutive trades with coaching score > 60", category: "streak", icon: "flame", xpReward: 30, checkId: "quality_streak_3" },
  { id: "quality_streak_5", title: "Consistent Quality", description: "5 consecutive quality trades", category: "streak", icon: "flame", xpReward: 75, checkId: "quality_streak_5" },
  { id: "quality_streak_10", title: "Quality Machine", description: "10 consecutive quality trades", category: "streak", icon: "flame", xpReward: 150, checkId: "quality_streak_10" },
  { id: "quality_streak_20", title: "Quality Legend", description: "20 consecutive quality trades", category: "streak", icon: "flame", xpReward: 300, checkId: "quality_streak_20" },

  // Quality-focused achievements
  { id: "selective_week", title: "Selective Trader", description: "2-5 trades in a week, all scoring 70+", category: "mastery", icon: "target", xpReward: 75, checkId: "selective_week" },
  { id: "patient_trader", title: "Patient Trader", description: "5 consecutive trades with 24h+ gaps", category: "mastery", icon: "clock", xpReward: 100, checkId: "patient_trader" },

  // Portfolio milestones
  { id: "portfolio_110k", title: "Growing Capital", description: "Grow portfolio to $110,000", category: "portfolio", icon: "chart_up", xpReward: 50, checkId: "portfolio_110k" },
  { id: "portfolio_150k", title: "Wealth Builder", description: "Grow portfolio to $150,000", category: "portfolio", icon: "chart_up", xpReward: 150, checkId: "portfolio_150k" },
  { id: "portfolio_200k", title: "Double Up", description: "Double your starting capital to $200,000", category: "portfolio", icon: "chart_up", xpReward: 300, checkId: "portfolio_200k" },
  { id: "diversified", title: "Diversified", description: "Hold positions in 3+ different stocks", category: "portfolio", icon: "pie", xpReward: 40, checkId: "diversified" },

  // Mastery
  { id: "no_mistakes_5", title: "Clean Streak", description: "5 trades in a row with no behavioral flags", category: "mastery", icon: "shield", xpReward: 75, checkId: "no_mistakes_5" },
  { id: "strong_trade_3", title: "Hat Trick", description: "Get 3 \"strong\" verdict trades in a row", category: "mastery", icon: "star", xpReward: 100, checkId: "strong_trade_3" },
  { id: "all_skills", title: "Well-Rounded", description: "Have all 5 skill components above 0", category: "mastery", icon: "compass", xpReward: 100, checkId: "all_skills" },
]
