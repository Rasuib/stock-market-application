"use client"

import { create } from "zustand"
import type { TradeWithCoaching } from "@/lib/coaching/types"
import type { GamificationState } from "@/lib/gamification/types"
import {
  loadBalance, saveBalance,
  loadPositions, savePositions,
  loadTrades, saveTrades,
  loadGamification, saveGamification,
  type StoredPosition,
} from "@/lib/storage"
import {
  fetchServerState,
  scheduleSync,
  setServerVersion,
  attachNetworkListeners,
  replayQueue,
  patchServer,
  type ServerSnapshot,
} from "@/lib/sync"

// ── Shared Types ──

export interface SelectedStock {
  symbol: string
  price: number
  name: string
  market?: string
}

export interface WatchlistStock {
  symbol: string
  name: string
  price: string
  change: string
  isPositive: boolean
  sector?: string
  market?: string
}

// ── Constants ──

export const INITIAL_BALANCE = 100_000
const WATCHLIST_KEY = "tradia_watchlist"
const PERSIST_DEBOUNCE_MS = 300

// ── Store Shape ──

const DEFAULT_GAMIFICATION: GamificationState = {
  xp: 0,
  achievements: [],
  streak: { currentStreak: 0, longestStreak: 0, lastTradeDate: null },
  lastXPGainTimestamp: null,
}

export type OnboardingStatus = "not_started" | "step1_search" | "step2_trade" | "step3_review" | "completed" | "skipped"

interface TradingState {
  balance: number
  positions: Record<string, StoredPosition>
  trades: TradeWithCoaching[]
  watchlist: WatchlistStock[]
  selectedStock: SelectedStock | null
  previousStock: SelectedStock | null
  gamification: GamificationState
  onboardingStatus: OnboardingStatus
  _hydrated: boolean
  _serverHydrated: boolean
}

interface TradingActions {
  setBalance: (balance: number) => void
  setPositions: (
    updater:
      | Record<string, StoredPosition>
      | ((prev: Record<string, StoredPosition>) => Record<string, StoredPosition>),
  ) => void
  setTrades: (
    updater: TradeWithCoaching[] | ((prev: TradeWithCoaching[]) => TradeWithCoaching[]),
  ) => void
  selectStock: (stock: SelectedStock | null) => void
  addToWatchlist: (stock: WatchlistStock) => boolean
  removeFromWatchlist: (symbol: string) => void
  setGamification: (
    updater: GamificationState | ((prev: GamificationState) => GamificationState),
  ) => void
  setOnboardingStatus: (status: OnboardingStatus) => void
}

export type TradingStore = TradingState & TradingActions

// ── Create Store ──

export const useTradingStore = create<TradingStore>()((set, get) => ({
  balance: INITIAL_BALANCE,
  positions: {},
  trades: [],
  watchlist: [],
  selectedStock: null,
  previousStock: null,
  gamification: DEFAULT_GAMIFICATION,
  onboardingStatus: "not_started" as OnboardingStatus,
  _hydrated: false,
  _serverHydrated: false,

  setBalance: (balance) => set({ balance }),

  setPositions: (updater) => {
    if (typeof updater === "function") {
      set((state) => ({ positions: updater(state.positions) }))
    } else {
      set({ positions: updater })
    }
  },

  setTrades: (updater) => {
    if (typeof updater === "function") {
      set((state) => ({ trades: updater(state.trades) }))
    } else {
      set({ trades: updater })
    }
  },

  selectStock: (stock) => {
    const current = get().selectedStock
    if (stock && current && stock.symbol !== current.symbol) {
      set({ previousStock: current, selectedStock: stock })
    } else {
      set({ selectedStock: stock })
    }
  },

  addToWatchlist: (stock) => {
    if (get().watchlist.some((s) => s.symbol === stock.symbol)) return false
    set((state) => ({ watchlist: [...state.watchlist, stock] }))
    // Non-blocking server sync
    fetch("/api/user/watchlist", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: stock.symbol, name: stock.name, market: stock.market || "US" }),
    }).catch(() => {})
    return true
  },

  removeFromWatchlist: (symbol) => {
    set((state) => ({ watchlist: state.watchlist.filter((s) => s.symbol !== symbol) }))
    // Non-blocking server sync
    fetch("/api/user/watchlist", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    }).catch(() => {})
  },

  setGamification: (updater) => {
    if (typeof updater === "function") {
      set((state) => ({ gamification: updater(state.gamification) }))
    } else {
      set({ gamification: updater })
    }
  },

  setOnboardingStatus: (status) => {
    set({ onboardingStatus: status })
    // Fire lightweight PATCH to server (non-blocking)
    patchServer({ onboardingStatus: status }).catch(() => {})
  },
}))

// ── Selectors ──

export const selectActivePositionCount = (s: TradingStore) =>
  Object.values(s.positions).filter((p) => p.quantity > 0).length

// ── Watchlist localStorage helpers ──

function loadWatchlist(): WatchlistStock[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveWatchlist(watchlist: WatchlistStock[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
  } catch { /* quota exceeded */ }
}

// ── Hydration + Persistence ──

let persistTimer: ReturnType<typeof setTimeout> | null = null

/** Build sync payload from current store state */
function buildSyncPayload() {
  const s = useTradingStore.getState()
  return {
    trades: s.trades,
    positions: s.positions,
    balance: s.balance,
    behavioralMemory: null, // populated by coaching module
    curriculumProgress: null,
    adaptiveWeights: null,
    rewardHistory: [] as number[],
    gamification: s.gamification,
    onboardingStatus: s.onboardingStatus,
  }
}

/** Apply server snapshot to store */
function applyServerSnapshot(snapshot: ServerSnapshot) {
  const { setState } = useTradingStore

  const gamification = snapshot.gamification ?? DEFAULT_GAMIFICATION
  const onboardingStatus = (snapshot.onboardingStatus || "not_started") as OnboardingStatus

  setState({
    balance: snapshot.balance,
    positions: snapshot.positions ?? {},
    trades: snapshot.trades ?? [],
    gamification,
    onboardingStatus,
    _serverHydrated: true,
  })

  // Also update localStorage cache
  saveBalance(snapshot.balance)
  savePositions(snapshot.positions ?? {})
  saveTrades(snapshot.trades ?? [])
  saveGamification(gamification)
}

/**
 * Initialize the trading store.
 * 1. Immediately hydrate from localStorage (fast)
 * 2. Attempt server hydration (authoritative)
 * 3. Set up persistence + sync
 *
 * Returns cleanup function.
 */
export function initTradingStore(): () => void {
  const { getState, setState, subscribe } = useTradingStore

  // 1. Fast hydrate from localStorage
  setState({
    balance: loadBalance(),
    positions: loadPositions(),
    trades: loadTrades(),
    watchlist: loadWatchlist(),
    gamification: loadGamification(),
    _hydrated: true,
  })

  // 2. Server hydration (async, replaces local if server has data)
  fetchServerState()
    .then(({ snapshot, version }) => {
      if (snapshot) {
        setServerVersion(version)
        applyServerSnapshot(snapshot)
      } else {
        // No server data — push local state to server as initial seed
        setState({ _serverHydrated: true })
        const localTrades = getState().trades
        if (localTrades.length > 0) {
          scheduleSync(buildSyncPayload())
        }
      }
    })
    .catch(() => {
      // Server unreachable — continue with local data
      setState({ _serverHydrated: true })
      // Try replaying any queued writes
      replayQueue().catch(() => {})
    })

  // 2b. Hydrate watchlist from server (merge with local)
  fetch("/api/user/watchlist", { credentials: "include" })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (!data?.items) return
      const localWl = getState().watchlist
      const localSymbols = new Set(localWl.map((s) => s.symbol))
      const serverItems: WatchlistStock[] = data.items
        .filter((item: { symbol: string }) => !localSymbols.has(item.symbol))
        .map((item: { symbol: string; name: string; market?: string }) => ({
          symbol: item.symbol,
          name: item.name,
          price: "--",
          change: "--",
          isPositive: true,
          market: item.market || "US",
        }))
      if (serverItems.length > 0) {
        setState({ watchlist: [...localWl, ...serverItems] })
      }
    })
    .catch(() => {})

  // 3. Attach network listeners for online/offline
  const detachNetwork = attachNetworkListeners()

  // 4. Debounced persistence on every state change
  const unsub = subscribe(() => {
    if (!getState()._hydrated) return
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      const s = getState()
      // Local cache
      saveBalance(s.balance)
      savePositions(s.positions)
      saveTrades(s.trades)
      saveWatchlist(s.watchlist)
      saveGamification(s.gamification)
      // Server sync (debounced internally)
      scheduleSync(buildSyncPayload())
    }, PERSIST_DEBOUNCE_MS)
  })

  return () => {
    unsub()
    detachNetwork()
  }
}
