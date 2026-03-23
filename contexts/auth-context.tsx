"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react"
import type { User, LearningProgress, TradingStats } from "@/types/user"
import { calculateLevel, calculateTradeScore } from "@/types/user"

interface AuthContextType {
  user: User | null
  learningProgress: LearningProgress | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  signup: (name: string, email: string, password: string, bio?: string, avatar?: string) => Promise<"ok" | "verify" | "error">
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  updateLearningProgress: (score: number, category?: keyof LearningProgress["categories"]) => void
  recordTrade: (profit: number, tradeType: "buy" | "sell", category?: keyof LearningProgress["categories"]) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

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

/**
 * Inner provider that reads from NextAuth session.
 * Keeps learning progress in localStorage (same as before) since it's
 * game state, not sensitive auth data.
 */
function AuthContextProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [learningProgress, setLearningProgress] = useState<LearningProgress | null>(null)

  // Derive user from NextAuth session
  const user: User | null = session?.user
    ? {
        id: session.user.id ?? "",
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        avatar: session.user.image ?? undefined,
        bio: undefined,
        createdAt: "",
      }
    : null

  const isAuthenticated = status === "authenticated" && !!user

  // Load learning progress from localStorage when session changes.
  // Wrapped in microtask to avoid synchronous setState-in-effect lint warning.
  useEffect(() => {
    const userId = user?.id
    const nextProgress: LearningProgress | null = (() => {
      if (!userId) return null
      try {
        const saved = localStorage.getItem(`tradia_progress_${userId}`)
        if (saved) {
          const progress = JSON.parse(saved) as LearningProgress
          if (!progress.tradingStats) progress.tradingStats = defaultTradingStats
          return progress
        }
        // Initialize default progress for new user
        const newProgress: LearningProgress = {
          userId,
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
        localStorage.setItem(`tradia_progress_${userId}`, JSON.stringify(newProgress))
        return newProgress
      } catch {
        return null
      }
    })()

    queueMicrotask(() => {
      setLearningProgress(nextProgress)
    })
  }, [user?.id])

  const userId = user?.id
  const saveProgress = useCallback(
    (progress: LearningProgress) => {
      setLearningProgress(progress)
      if (userId) {
        try {
          localStorage.setItem(`tradia_progress_${userId}`, JSON.stringify(progress))
        } catch {
          // localStorage unavailable
        }
      }
    },
    [userId],
  )

  const login = async (email: string, password: string): Promise<boolean> => {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    return result?.ok === true
  }

  const signup = async (
    name: string,
    email: string,
    password: string,
    bio?: string,
  ): Promise<"ok" | "verify" | "error"> => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, bio }),
      })
      if (!res.ok) return "error"

      const data = await res.json()

      // If email verification is required, redirect to verify page instead of auto sign-in
      if (data.requiresVerification) {
        return "verify"
      }

      // Auto sign-in after successful signup (fallback if verification not required)
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })
      return result?.ok === true ? "ok" : "error"
    } catch {
      return "error"
    }
  }

  const logout = () => {
    signOut({ callbackUrl: "/login" })
  }

  const updateUser = async (updates: Partial<User>) => {
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: updates.name, bio: updates.bio }),
      })
      if (!res.ok) return
      // Trigger session refresh so the sidebar picks up the new name
      window.location.reload()
    } catch {
      // silently fail
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

    saveProgress(updatedProgress)
  }

  const recordTrade = (profit: number, tradeType: "buy" | "sell", category?: keyof LearningProgress["categories"]) => {
    if (!learningProgress) return

    const currentStats = learningProgress.tradingStats || defaultTradingStats

    const isSell = tradeType === "sell"
    const isWin = isSell && profit > 0
    const isLoss = isSell && profit <= 0

    const newStreak = isWin ? currentStats.tradingStreak + 1 : isLoss ? 0 : currentStats.tradingStreak
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

    const tradeScore = isSell ? calculateTradeScore(profit, isWin, newStreak) : 5
    const newTotalScore = learningProgress.totalScore + tradeScore
    const newLevel = calculateLevel(newTotalScore)

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
        icon: "target",
        unlockedAt: new Date().toISOString(),
      })
    }

    if (newTotalTrades >= 10 && !newAchievements.find((a) => a.id === "active_trader")) {
      newAchievements.push({
        id: "active_trader",
        title: "Active Trader",
        description: "Completed 10 trades",
        icon: "chart",
        unlockedAt: new Date().toISOString(),
      })
    }

    if (newStreak >= 5 && !newAchievements.find((a) => a.id === "hot_streak")) {
      newAchievements.push({
        id: "hot_streak",
        title: "Hot Streak",
        description: "5 profitable trades in a row",
        icon: "fire",
        unlockedAt: new Date().toISOString(),
      })
    }

    if (updatedStats.winRate >= 70 && newTotalTrades >= 10 && !newAchievements.find((a) => a.id === "sharp_trader")) {
      newAchievements.push({
        id: "sharp_trader",
        title: "Sharp Trader",
        description: "Maintain 70% win rate with 10+ trades",
        icon: "diamond",
        unlockedAt: new Date().toISOString(),
      })
    }

    updatedProgress.achievements = newAchievements
    saveProgress(updatedProgress)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        learningProgress,
        isAuthenticated,
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

/**
 * Top-level auth provider wrapping NextAuth's SessionProvider
 * and our custom AuthContext.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextProvider>{children}</AuthContextProvider>
    </SessionProvider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
