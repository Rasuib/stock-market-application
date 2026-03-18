/**
 * Persistent Behavioral Memory Store
 *
 * Stores behavioral patterns in a dedicated localStorage key that persists
 * independently from the 500-trade limit. This ensures behavioral memory
 * survives even if localStorage is partially cleared or trades are trimmed.
 *
 * Also syncs to server storage when available.
 */

import type {
  BehavioralFlag,
  BehavioralMemoryStore,
  TradeWithCoaching,
} from "./types"

const STORAGE_KEY = "tradia_behavioral_memory"

// ── Default Store ──

function defaultStore(): BehavioralMemoryStore {
  return {
    flagCounts: {},
    recentFlagCounts: {},
    flagTrends: {},
    activeImprovementAreas: [],
    totalTradesAnalyzed: 0,
    lastUpdated: new Date().toISOString(),
  }
}

// ── Load / Save ──

export function loadBehavioralMemory(): BehavioralMemoryStore {
  if (typeof window === "undefined") return defaultStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStore()
    return JSON.parse(raw) as BehavioralMemoryStore
  } catch {
    return defaultStore()
  }
}

export function saveBehavioralMemory(store: BehavioralMemoryStore): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch { /* localStorage full */ }
}

// ── Update from a new trade ──

export function updateBehavioralMemory(
  trade: TradeWithCoaching,
  allTrades: TradeWithCoaching[],
): BehavioralMemoryStore {
  const store = loadBehavioralMemory()

  // Increment flag counts from this trade
  for (const flag of trade.coaching.behavioralFlags) {
    store.flagCounts[flag.flag] = (store.flagCounts[flag.flag] || 0) + 1
  }

  // Recompute recent counts from last 10 trades
  const recent10 = allTrades.slice(-10)
  store.recentFlagCounts = {}
  for (const t of recent10) {
    for (const f of t.coaching.behavioralFlags) {
      store.recentFlagCounts[f.flag] = (store.recentFlagCounts[f.flag] || 0) + 1
    }
  }

  // Compute trends
  const olderTrades = allTrades.slice(0, -10)
  for (const flagName of Object.keys(store.flagCounts)) {
    const totalCount = store.flagCounts[flagName] || 0
    const recentCount = store.recentFlagCounts[flagName] || 0
    const olderCount = totalCount - recentCount

    if (olderTrades.length >= 5) {
      const recentRate = recentCount / Math.max(1, recent10.length)
      const olderRate = olderCount / Math.max(1, olderTrades.length)
      if (recentRate > olderRate * 1.5) {
        store.flagTrends[flagName] = "increasing"
      } else if (recentRate < olderRate * 0.5) {
        store.flagTrends[flagName] = "decreasing"
      } else {
        store.flagTrends[flagName] = "stable"
      }
    } else {
      store.flagTrends[flagName] = "stable"
    }
  }

  // Active improvement areas = flags that are increasing or have high counts
  store.activeImprovementAreas = Object.entries(store.flagCounts)
    .filter(([flag]) =>
      store.flagTrends[flag] === "increasing" ||
      (store.flagCounts[flag] || 0) >= 3
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([flag]) => flag)

  store.totalTradesAnalyzed = allTrades.length
  store.lastUpdated = new Date().toISOString()

  saveBehavioralMemory(store)
  return store
}

// ── Rebuild from full trade history (recovery) ──

export function rebuildBehavioralMemory(trades: TradeWithCoaching[]): BehavioralMemoryStore {
  const store = defaultStore()

  for (const trade of trades) {
    for (const flag of trade.coaching.behavioralFlags) {
      store.flagCounts[flag.flag] = (store.flagCounts[flag.flag] || 0) + 1
    }
  }

  // Recompute recent counts
  const recent10 = trades.slice(-10)
  for (const t of recent10) {
    for (const f of t.coaching.behavioralFlags) {
      store.recentFlagCounts[f.flag] = (store.recentFlagCounts[f.flag] || 0) + 1
    }
  }

  // Compute trends
  const olderTrades = trades.slice(0, -10)
  for (const flagName of Object.keys(store.flagCounts)) {
    const recentCount = store.recentFlagCounts[flagName] || 0
    const olderCount = (store.flagCounts[flagName] || 0) - recentCount
    if (olderTrades.length >= 5) {
      const recentRate = recentCount / Math.max(1, recent10.length)
      const olderRate = olderCount / Math.max(1, olderTrades.length)
      if (recentRate > olderRate * 1.5) store.flagTrends[flagName] = "increasing"
      else if (recentRate < olderRate * 0.5) store.flagTrends[flagName] = "decreasing"
      else store.flagTrends[flagName] = "stable"
    }
  }

  store.activeImprovementAreas = Object.entries(store.flagCounts)
    .filter(([flag]) =>
      store.flagTrends[flag] === "increasing" ||
      (store.flagCounts[flag] || 0) >= 3
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([flag]) => flag)

  store.totalTradesAnalyzed = trades.length
  store.lastUpdated = new Date().toISOString()

  saveBehavioralMemory(store)
  return store
}

// ── Get flag count from persistent memory (for behavior-memory.ts) ──

export function getPersistentFlagCount(flag: BehavioralFlag): number {
  const store = loadBehavioralMemory()
  return store.flagCounts[flag] || 0
}

// ── Get trend from persistent memory ──

export function getPersistentFlagTrend(flag: BehavioralFlag): "increasing" | "stable" | "decreasing" {
  const store = loadBehavioralMemory()
  return (store.flagTrends[flag] as "increasing" | "stable" | "decreasing") || "stable"
}
