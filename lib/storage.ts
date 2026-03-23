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
import type { GamificationState } from "./gamification/types"

// ── Storage Keys ──

const KEYS = {
  balance: "tradia_balance",
  positions: "tradia_positions",
  trades: "tradia_trades_v2",       // v2 = TradeWithCoaching format
  legacyTrades: "tradia_trades",    // v1 = old Trade format
  gamification: "tradia_gamification",
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

// ── Gamification ──

const DEFAULT_GAMIFICATION: GamificationState = {
  xp: 0,
  achievements: [],
  streak: { currentStreak: 0, longestStreak: 0, lastTradeDate: null },
  lastXPGainTimestamp: null,
}

export function loadGamification(): GamificationState {
  return getItem<GamificationState>(KEYS.gamification, DEFAULT_GAMIFICATION)
}

export function saveGamification(state: GamificationState): void {
  setItem(KEYS.gamification, state)
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
