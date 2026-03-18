export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  bio?: string
  createdAt: string
}

export interface TradingStats {
  totalTrades: number
  successfulTrades: number
  totalProfit: number
  totalLoss: number
  winRate: number
  bestTrade: number
  worstTrade: number
  tradingStreak: number
  maxStreak: number
}

export interface LearningProgress {
  userId: string
  totalScore: number
  level: "Novice" | "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Master"
  categories: {
    technicalAnalysis: number
    fundamentalAnalysis: number
    riskManagement: number
    tradingPsychology: number
    marketSentiment: number
  }
  tradingStats: TradingStats
  completedLessons: string[]
  achievements: Achievement[]
  lastUpdated: string
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlockedAt: string
}

export function calculateLevel(totalScore: number): LearningProgress["level"] {
  if (totalScore < 100) return "Novice"
  if (totalScore < 500) return "Beginner"
  if (totalScore < 1500) return "Intermediate"
  if (totalScore < 3000) return "Advanced"
  if (totalScore < 5000) return "Expert"
  return "Master"
}

export function getLevelColor(level: LearningProgress["level"]): string {
  switch (level) {
    case "Novice":
      return "text-gray-400"
    case "Beginner":
      return "text-green-400"
    case "Intermediate":
      return "text-blue-400"
    case "Advanced":
      return "text-purple-400"
    case "Expert":
      return "text-orange-400"
    case "Master":
      return "text-yellow-400"
  }
}

export function getNextLevelThreshold(level: LearningProgress["level"]): number {
  switch (level) {
    case "Novice":
      return 100
    case "Beginner":
      return 500
    case "Intermediate":
      return 1500
    case "Advanced":
      return 3000
    case "Expert":
      return 5000
    case "Master":
      return 10000
  }
}

export function calculateTradeScore(profit: number, isWin: boolean, streak: number): number {
  let score = 0

  // Base score for completing a trade
  score += 5

  // Bonus for profitable trades
  if (isWin) {
    score += 10
    // Extra bonus based on profit amount
    score += Math.min(Math.floor(profit / 100), 20)
    // Streak bonus
    score += streak * 2
  } else {
    // Small consolation points for learning from losses
    score += 2
  }

  return score
}
