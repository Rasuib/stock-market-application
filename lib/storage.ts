/**
 * Centralized Storage Service
 *
 * All localStorage access goes through this module.
 * No component should call localStorage directly.
 *
 * Features:
 * - Type-safe get/set with localStorage as fast cache
 * - Background sync to server via /api/user-data
 * - Automatic recovery: loads from server if localStorage is empty
 * - Single place to manage keys, migrations, and error handling
 */

import type { TradeWithCoaching } from "./coaching/types"
import type { Notification } from "@/types/dashboard"

// ── Storage Keys ──

const KEYS = {
  balance: "tradia_balance",
  positions: "tradia_positions",
  trades: "tradia_trades_v2",       // v2 = TradeWithCoaching format
  legacyTrades: "tradia_trades",    // v1 = old Trade format
  notifications: "tradia_notifications",
  rewardHistory: "tradia_reward_history",
  user: "tradia_user",
  learningProgress: "tradia_learning_progress",
  lastSyncTime: "tradia_last_sync",
} as const

// ── Position Type ──

export interface StoredPosition {
  quantity: number
  avgPrice: number
}

// ── Generic Helpers ──

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function setItem(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage full or unavailable
  }
}

// ── Balance ──

export function loadBalance(): number {
  if (typeof window === "undefined") return 100_000
  try {
    const raw = localStorage.getItem(KEYS.balance)
    if (raw === null) return 100_000
    const parsed = Number(raw)
    return Number.isNaN(parsed) || parsed < 0 ? 100_000 : parsed
  } catch {
    return 100_000
  }
}

export function saveBalance(balance: number): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEYS.balance, String(balance))
  } catch { /* */ }
}

// ── Positions ──

export function loadPositions(): Record<string, StoredPosition> {
  const raw = getItem<Record<string, unknown>>(KEYS.positions, {})
  const normalized: Record<string, StoredPosition> = {}
  for (const [symbol, pos] of Object.entries(raw)) {
    if (typeof pos === "number") {
      normalized[symbol] = { quantity: pos, avgPrice: 0 }
    } else if (pos && typeof pos === "object") {
      const p = pos as Record<string, unknown>
      normalized[symbol] = {
        quantity: typeof p.quantity === "number" ? p.quantity : 0,
        avgPrice: typeof p.avgPrice === "number" ? p.avgPrice : 0,
      }
    }
  }
  return normalized
}

export function savePositions(positions: Record<string, StoredPosition>): void {
  setItem(KEYS.positions, positions)
}

// ── Trades (v2 = TradeWithCoaching) ──

export function loadTrades(): TradeWithCoaching[] {
  const v2 = getItem<TradeWithCoaching[]>(KEYS.trades, [])
  if (v2.length > 0) return v2

  // Migration: try loading v1 trades
  const v1 = getItem<LegacyTrade[]>(KEYS.legacyTrades, [])
  if (v1.length > 0) {
    const migrated = v1.map(migrateLegacyTrade)
    saveTrades(migrated)
    return migrated
  }

  return []
}

export function saveTrades(trades: TradeWithCoaching[]): void {
  // Keep last 500 trades
  const trimmed = trades.slice(-500)
  setItem(KEYS.trades, trimmed)
}

// ── Notifications ──

export function loadNotifications(): Notification[] {
  return getItem<Notification[]>(KEYS.notifications, [])
}

export function saveNotifications(notifications: Notification[]): void {
  setItem(KEYS.notifications, notifications.slice(-50))
}

// ── Legacy Trade Migration ──

interface LegacyTrade {
  type: "buy" | "sell"
  quantity: number
  price: number
  timestamp: string
  displayTime?: string
  symbol: string
  market?: "US" | "IN"
  profit?: number
  sentimentSignal?: number
  sentimentScore?: number
  sentimentSource?: string
  trendSignal?: number
  trendConfidence?: number
  evaluationScore?: number
  evaluationQuality?: string
  reward?: number
  rewardBreakdown?: {
    alignment: number
    risk: number
    discipline: number
    outcome: number
    learning: number
  }
}

// ── Reward History ──

export function loadRewardHistory(): number[] {
  return getItem<number[]>(KEYS.rewardHistory, [])
}

export function saveRewardHistory(history: number[]): void {
  setItem(KEYS.rewardHistory, history.slice(-200))
}

// ── User ID ──

export function getUserId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(KEYS.user)
    if (!raw) return null
    const user = JSON.parse(raw)
    return user?.username || null
  } catch {
    return null
  }
}

// ── Server Sync ──

const SYNC_DEBOUNCE_MS = 5_000 // sync at most once every 5 seconds
let syncTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSyncToServer(): void {
  if (typeof window === "undefined") return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => syncToServer(), SYNC_DEBOUNCE_MS)
}

export async function syncToServer(): Promise<boolean> {
  const userId = getUserId()
  if (!userId) return false

  try {
    const data = {
      trades: loadTrades(),
      positions: loadPositions(),
      balance: loadBalance(),
      behavioralMemory: getItem("tradia_behavioral_memory", null),
      curriculumProgress: getItem("tradia_curriculum_progress", null),
      adaptiveWeights: getItem("tradia_adaptive_weights", null),
      rewardHistory: loadRewardHistory(),
    }

    const response = await fetch("/api/user-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, data }),
    })

    if (response.ok) {
      setItem(KEYS.lastSyncTime, new Date().toISOString())
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function syncFromServer(): Promise<boolean> {
  const userId = getUserId()
  if (!userId) return false

  try {
    const response = await fetch(`/api/user-data?userId=${encodeURIComponent(userId)}`)
    if (!response.ok) return false

    const { data, exists } = await response.json()
    if (!exists || !data) return false

    // Only restore if localStorage is empty (recovery scenario)
    const localTrades = loadTrades()
    if (localTrades.length > 0) return false // local has data, don't overwrite

    // Restore from server
    if (data.trades?.length > 0) saveTrades(data.trades)
    if (data.positions && Object.keys(data.positions).length > 0) savePositions(data.positions)
    if (data.balance) saveBalance(data.balance)
    if (data.behavioralMemory) setItem("tradia_behavioral_memory", data.behavioralMemory)
    if (data.curriculumProgress) setItem("tradia_curriculum_progress", data.curriculumProgress)
    if (data.adaptiveWeights) setItem("tradia_adaptive_weights", data.adaptiveWeights)
    if (data.rewardHistory?.length > 0) saveRewardHistory(data.rewardHistory)

    return true
  } catch {
    return false
  }
}

// ── Legacy Trade Migration ──

function migrateLegacyTrade(t: LegacyTrade): TradeWithCoaching {
  const score = t.evaluationScore !== undefined ? Math.max(0, Math.min(100, (t.evaluationScore + 100) / 2)) : 50
  const rewardTotal = t.reward ?? 0
  const breakdown = t.rewardBreakdown ?? { alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 }

  return {
    id: `legacy-${t.timestamp}-${t.symbol}`,
    type: t.type,
    symbol: t.symbol,
    quantity: t.quantity,
    price: t.price,
    cost: t.quantity * t.price,
    timestamp: t.timestamp,
    displayTime: t.displayTime || new Date(t.timestamp).toLocaleTimeString(),
    market: (t.market || "US") as "US" | "IN",
    currency: t.market === "IN" ? "INR" : "USD",
    profit: t.profit,
    coaching: {
      verdict: score >= 65 ? "strong" : score >= 40 ? "mixed" : "weak",
      score: Math.round(score),
      confidence: 0.5,
      summary: `Migrated from earlier trade data. Score: ${Math.round(score)}/100.`,
      whatWentRight: t.evaluationQuality === "excellent" || t.evaluationQuality === "good"
        ? ["Trade was aligned with available signals."]
        : ["Trade executed successfully."],
      whatWentWrong: t.evaluationQuality === "poor" || t.evaluationQuality === "risky"
        ? ["Trade was misaligned with market signals."]
        : [],
      improveNext: ["Review this trade's context for learning insights."],
      supportingSignals: [],
      contradictorySignals: [],
      riskNotes: [],
      skillTags: [],
      marketSnapshot: {
        sentiment: {
          label: t.sentimentSignal === 1 ? "bullish" : t.sentimentSignal === -1 ? "bearish" : "neutral",
          score: t.sentimentScore ?? 50,
          confidence: 0.5,
          source: (t.sentimentSource as "finbert" | "heuristic-fallback") || "unavailable",
        },
        trend: {
          label: t.trendSignal === 1 ? "uptrend" : t.trendSignal === -1 ? "downtrend" : "uncertain",
          signal: t.trendSignal ?? 0,
          confidence: t.trendConfidence ?? 0.5,
          shortMA: 0,
          longMA: 0,
          momentum: 0,
        },
        price: t.price,
        currency: t.market === "IN" ? "INR" : "USD",
        market: (t.market || "US") as "US" | "IN",
        regime: "weak_signal" as const,
      },
      behavioralFlags: [],
      regimeContext: "Migrated trade — market regime was not recorded.",
      reward: {
        total: rewardTotal,
        alignment: breakdown.alignment,
        risk: breakdown.risk,
        discipline: breakdown.discipline,
        outcome: breakdown.outcome,
        learning: breakdown.learning,
      },
    },
  }
}
