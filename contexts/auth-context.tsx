"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User, LearningProgress, TradingStats } from "@/types/user"
import { calculateLevel, calculateTradeScore } from "@/types/user"

interface AuthContextType {
  user: User | null
  learningProgress: LearningProgress | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  signup: (name: string, email: string, password: string, bio?: string, avatar?: string) => Promise<boolean>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  updateLearningProgress: (score: number, category?: keyof LearningProgress["categories"]) => void
  recordTrade: (profit: number, tradeType: "buy" | "sell", category?: keyof LearningProgress["categories"]) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Password hashing using SHA-256 via Web Crypto API.
 *
 * SECURITY NOTE: This is client-side hashing for an educational simulator.
 * For a production trading platform, you would need:
 * - Server-side auth (e.g. NextAuth, Clerk, or custom JWT)
 * - bcrypt/argon2 with per-user salts
 * - HTTPS-only cookies, not localStorage
 *
 * The current approach prevents plaintext storage and is adequate for
 * a simulator where no real money or sensitive data is involved.
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + "tradia_salt_v1")
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

const defaultTradingStats: TradingStats = {
  totalTrades: 0,
  successfulTrades: 0,
  totalProfit: 0,
  totalLoss: 0,
  winRate: 0,
  bestTrade: 0,
  worstTrade: 0,
  tradingStreak: 0,
  maxStreak: 0,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [learningProgress, setLearningProgress] = useState<LearningProgress | null>(null)

  useEffect(() => {
    // Load user from localStorage on mount
    const savedUser = localStorage.getItem("tradia_user")
    const savedProgress = localStorage.getItem("tradia_learning_progress")

    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    if (savedProgress) {
      const progress = JSON.parse(savedProgress)
      // Ensure trading stats exist
      if (!progress.tradingStats) {
        progress.tradingStats = defaultTradingStats
      }
      setLearningProgress(progress)
    }
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    const savedUser = localStorage.getItem(`tradia_user_${email}`)
    if (savedUser) {
      const userData = JSON.parse(savedUser)
      const hashedInput = await hashPassword(password)
      const matches = userData.password === hashedInput
      if (matches) {
        if (!userData.progress.tradingStats) {
          userData.progress.tradingStats = defaultTradingStats
        }
        setUser(userData.user)
        setLearningProgress(userData.progress)
        localStorage.setItem("tradia_user", JSON.stringify(userData.user))
        localStorage.setItem("tradia_learning_progress", JSON.stringify(userData.progress))
        return true
      }
    }
    return false
  }

  const signup = async (
    name: string,
    email: string,
    password: string,
    bio?: string,
    avatar?: string,
  ): Promise<boolean> => {
    // Check if user already exists
    if (localStorage.getItem(`tradia_user_${email}`)) {
      return false
    }

    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      bio,
      avatar: avatar || "/trader-avatar.jpg",
      createdAt: new Date().toISOString(),
    }

    const newProgress: LearningProgress = {
      userId: newUser.id,
      totalScore: 0,
      level: "Novice",
      categories: {
        technicalAnalysis: 0,
        fundamentalAnalysis: 0,
        riskManagement: 0,
        tradingPsychology: 0,
        marketSentiment: 0,
      },
      tradingStats: defaultTradingStats,
      completedLessons: [],
      achievements: [],
      lastUpdated: new Date().toISOString(),
    }

    // Save user with hashed password
    const hashedPw = await hashPassword(password)
    localStorage.setItem(
      `tradia_user_${email}`,
      JSON.stringify({
        user: newUser,
        password: hashedPw,
        progress: newProgress,
      }),
    )

    setUser(newUser)
    setLearningProgress(newProgress)
    localStorage.setItem("tradia_user", JSON.stringify(newUser))
    localStorage.setItem("tradia_learning_progress", JSON.stringify(newProgress))

    return true
  }

  const logout = () => {
    setUser(null)
    setLearningProgress(null)
    localStorage.removeItem("tradia_user")
    localStorage.removeItem("tradia_learning_progress")
  }

  const updateUser = (updates: Partial<User>) => {
    if (!user) return

    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)
    localStorage.setItem("tradia_user", JSON.stringify(updatedUser))

    // Update in the user storage as well
    const savedUserData = localStorage.getItem(`tradia_user_${user.email}`)
    if (savedUserData) {
      const userData = JSON.parse(savedUserData)
      userData.user = updatedUser
      localStorage.setItem(`tradia_user_${user.email}`, JSON.stringify(userData))
    }
  }

  const updateLearningProgress = (score: number, category?: keyof LearningProgress["categories"]) => {
    if (!learningProgress) return

    const newTotalScore = learningProgress.totalScore + score
    const newLevel = calculateLevel(newTotalScore)

    const updatedProgress: LearningProgress = {
      ...learningProgress,
      totalScore: newTotalScore,
      level: newLevel,
      lastUpdated: new Date().toISOString(),
    }

    if (category) {
      updatedProgress.categories = {
        ...learningProgress.categories,
        [category]: learningProgress.categories[category] + score,
      }
    }

    setLearningProgress(updatedProgress)
    localStorage.setItem("tradia_learning_progress", JSON.stringify(updatedProgress))

    // Update in the user storage as well
    if (user) {
      const savedUserData = localStorage.getItem(`tradia_user_${user.email}`)
      if (savedUserData) {
        const userData = JSON.parse(savedUserData)
        userData.progress = updatedProgress
        localStorage.setItem(`tradia_user_${user.email}`, JSON.stringify(userData))
      }
    }
  }

  const recordTrade = (profit: number, tradeType: "buy" | "sell", category?: keyof LearningProgress["categories"]) => {
    if (!learningProgress) return

    const currentStats = learningProgress.tradingStats || defaultTradingStats

    // Buy trades are position entries — don't count as win/loss
    const isSell = tradeType === "sell"
    const isWin = isSell && profit > 0
    const isLoss = isSell && profit <= 0

    // Only sell trades update win/loss stats; buys just increment total trades
    const newStreak = isWin ? currentStats.tradingStreak + 1 : (isLoss ? 0 : currentStats.tradingStreak)
    const newTotalTrades = currentStats.totalTrades + 1
    const newSuccessfulTrades = isWin ? currentStats.successfulTrades + 1 : currentStats.successfulTrades

    const updatedStats: TradingStats = {
      totalTrades: newTotalTrades,
      successfulTrades: newSuccessfulTrades,
      totalProfit: isWin ? currentStats.totalProfit + profit : currentStats.totalProfit,
      totalLoss: isLoss ? currentStats.totalLoss + Math.abs(profit) : currentStats.totalLoss,
      winRate: newSuccessfulTrades > 0 ? Math.round((newSuccessfulTrades / newTotalTrades) * 100) : 0,
      bestTrade: isWin ? Math.max(currentStats.bestTrade, profit) : currentStats.bestTrade,
      worstTrade: isLoss ? Math.min(currentStats.worstTrade, profit) : currentStats.worstTrade,
      tradingStreak: newStreak,
      maxStreak: Math.max(currentStats.maxStreak, newStreak),
    }

    // Calculate score based on trade performance (buys get base participation score)
    const tradeScore = isSell ? calculateTradeScore(profit, isWin, newStreak) : 5
    const newTotalScore = learningProgress.totalScore + tradeScore
    const newLevel = calculateLevel(newTotalScore)

    // Determine category based on trade type
    const tradeCategory = category || (tradeType === "sell" ? "riskManagement" : "technicalAnalysis")

    const updatedProgress: LearningProgress = {
      ...learningProgress,
      totalScore: newTotalScore,
      level: newLevel,
      tradingStats: updatedStats,
      categories: {
        ...learningProgress.categories,
        [tradeCategory]: learningProgress.categories[tradeCategory] + Math.floor(tradeScore / 2),
      },
      lastUpdated: new Date().toISOString(),
    }

    // Check for achievements
    const newAchievements = [...(learningProgress.achievements || [])]

    if (newTotalTrades === 1 && !newAchievements.find((a) => a.id === "first_trade")) {
      newAchievements.push({
        id: "first_trade",
        title: "First Trade",
        description: "Completed your first trade",
        icon: "🎯",
        unlockedAt: new Date().toISOString(),
      })
    }

    if (newTotalTrades >= 10 && !newAchievements.find((a) => a.id === "active_trader")) {
      newAchievements.push({
        id: "active_trader",
        title: "Active Trader",
        description: "Completed 10 trades",
        icon: "📈",
        unlockedAt: new Date().toISOString(),
      })
    }

    if (newStreak >= 5 && !newAchievements.find((a) => a.id === "hot_streak")) {
      newAchievements.push({
        id: "hot_streak",
        title: "Hot Streak",
        description: "5 profitable trades in a row",
        icon: "🔥",
        unlockedAt: new Date().toISOString(),
      })
    }

    if (updatedStats.winRate >= 70 && newTotalTrades >= 10 && !newAchievements.find((a) => a.id === "sharp_trader")) {
      newAchievements.push({
        id: "sharp_trader",
        title: "Sharp Trader",
        description: "Maintain 70% win rate with 10+ trades",
        icon: "💎",
        unlockedAt: new Date().toISOString(),
      })
    }

    updatedProgress.achievements = newAchievements

    setLearningProgress(updatedProgress)
    localStorage.setItem("tradia_learning_progress", JSON.stringify(updatedProgress))

    // Update in the user storage as well
    if (user) {
      const savedUserData = localStorage.getItem(`tradia_user_${user.email}`)
      if (savedUserData) {
        const userData = JSON.parse(savedUserData)
        userData.progress = updatedProgress
        localStorage.setItem(`tradia_user_${user.email}`, JSON.stringify(userData))
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        learningProgress,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        updateUser,
        updateLearningProgress,
        recordTrade,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
