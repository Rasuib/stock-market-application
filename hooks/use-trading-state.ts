"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TradeWithCoaching } from "@/lib/coaching/types"
import {
  loadBalance, saveBalance,
  loadPositions, savePositions,
  loadTrades, saveTrades,
  syncFromServer,
  type StoredPosition,
} from "@/lib/storage"

const INITIAL_BALANCE = 100_000

/**
 * Encapsulates all trading state: balance, positions, trades, persistence.
 * Trades are stored as TradeWithCoaching (includes coaching report).
 */
export function useTradingState() {
  const [balance, setBalance] = useState(INITIAL_BALANCE)
  const [positions, setPositions] = useState<Record<string, StoredPosition>>({})
  const [trades, setTrades] = useState<TradeWithCoaching[]>([])
  const hydratedRef = useRef(false)

  // Load ALL state from storage on mount, with server recovery fallback
  useEffect(() => {
    if (typeof window === "undefined") return

    const localTrades = loadTrades()
    setBalance(loadBalance())
    setPositions(loadPositions())
    setTrades(localTrades)
    hydratedRef.current = true

    // If localStorage is empty, try recovering from server
    if (localTrades.length === 0) {
      syncFromServer().then((recovered) => {
        if (recovered) {
          setBalance(loadBalance())
          setPositions(loadPositions())
          setTrades(loadTrades())
        }
      })
    }
  }, [])

  // Auto-persist on every state change (skip before hydration)
  useEffect(() => {
    if (typeof window === "undefined" || !hydratedRef.current) return
    saveBalance(balance)
    savePositions(positions)
    saveTrades(trades)
  }, [balance, positions, trades])

  const updateBalance = useCallback((newBalance: number) => {
    setBalance(newBalance)
  }, [])

  const updatePositions = useCallback((
    newPositions:
      | Record<string, StoredPosition>
      | ((prev: Record<string, StoredPosition>) => Record<string, StoredPosition>),
  ) => {
    setPositions(newPositions)
  }, [])

  const updateTrades = useCallback((
    newTrades: TradeWithCoaching[] | ((prev: TradeWithCoaching[]) => TradeWithCoaching[]),
  ) => {
    setTrades(newTrades)
  }, [])

  const normalizePosition = useCallback((pos: unknown): StoredPosition => {
    if (typeof pos === "number") return { quantity: pos, avgPrice: 0 }
    if (pos && typeof pos === "object") {
      const p = pos as Record<string, unknown>
      return {
        quantity: typeof p.quantity === "number" ? p.quantity : 0,
        avgPrice: typeof p.avgPrice === "number" ? p.avgPrice : 0,
      }
    }
    return { quantity: 0, avgPrice: 0 }
  }, [])

  const activePositionCount = Object.entries(positions)
    .filter(([, pos]) => pos.quantity > 0)
    .length

  return {
    balance,
    positions,
    trades,
    updateBalance,
    updatePositions,
    updateTrades,
    activePositionCount,
    initialBalance: INITIAL_BALANCE,
    normalizePosition,
  }
}
