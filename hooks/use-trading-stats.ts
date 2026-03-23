"use client"

import { useMemo } from "react"
import { useTradingStore, selectActivePositionCount, INITIAL_BALANCE } from "@/stores/trading-store"
import { generateLearningSummary } from "@/lib/coaching"

type StatIntent = "positive" | "negative" | "neutral"
type StatDirection = "up" | "down"

export interface TradingStat {
  label: string
  value: string
  description: string
  icon: string
  tag: string
  intent: StatIntent
  direction: StatDirection
}

/**
 * Computes the four dashboard stat cards from store state.
 * Uses selectedStock for live portfolio value when viewing a stock.
 */
export function useTradingStats(): TradingStat[] {
  const balance = useTradingStore((s) => s.balance)
  const positions = useTradingStore((s) => s.positions)
  const trades = useTradingStore((s) => s.trades)
  const selectedStock = useTradingStore((s) => s.selectedStock)
  const activePositionCount = useTradingStore(selectActivePositionCount)

  const coachingSummary = useMemo(() => generateLearningSummary(trades), [trades])

  return useMemo(() => {
    const currentGrade = coachingSummary.grade
    const gradeIntent: StatIntent =
      ["S", "A"].includes(currentGrade) ? "positive" :
      ["B", "C"].includes(currentGrade) ? "neutral" : "negative"

    let positionsValue = 0
    Object.entries(positions).forEach(([symbol, pos]) => {
      if (pos.quantity <= 0) return
      const currentPrice = (selectedStock?.symbol === symbol) ? selectedStock.price : pos.avgPrice
      positionsValue += pos.quantity * currentPrice
    })

    const portfolioValue = balance + positionsValue
    const portfolioChange = portfolioValue - INITIAL_BALANCE
    const portfolioChangePercent = ((portfolioChange / INITIAL_BALANCE) * 100).toFixed(2)

    return [
      {
        label: "Virtual Portfolio",
        value: `$${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        description: `${portfolioChangePercent}% from initial`,
        icon: "dollar-sign",
        tag: `${portfolioChange >= 0 ? "+" : ""}${portfolioChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        intent: (portfolioChange >= 0 ? "positive" : "negative") as StatIntent,
        direction: (portfolioChange >= 0 ? "up" : "down") as StatDirection,
      },
      {
        label: "Active Positions",
        value: activePositionCount.toString(),
        description: "Across US & Indian markets",
        icon: "bar-chart",
        tag: activePositionCount > 0 ? `${activePositionCount} open` : "No positions",
        intent: (activePositionCount > 0 ? "positive" : "neutral") as StatIntent,
        direction: (activePositionCount > 0 ? "up" : "down") as StatDirection,
      },
      {
        label: "Total Trades",
        value: trades.length.toString(),
        description: "Simulated trades executed",
        icon: "trending-up",
        tag: trades.length > 0 ? `${trades.length} completed` : "Start trading",
        intent: (trades.length > 0 ? "positive" : "neutral") as StatIntent,
        direction: (trades.length > 0 ? "up" : "down") as StatDirection,
      },
      {
        label: "Learning Grade",
        value: currentGrade,
        description: `Avg Reward: ${coachingSummary.score >= 0 ? "+" : ""}${coachingSummary.score.toFixed(1)}`,
        icon: "activity",
        tag: trades.length > 0 ? `${coachingSummary.trajectory}` : "Start trading",
        intent: gradeIntent,
        direction: (coachingSummary.trajectory === "improving" ? "up" : coachingSummary.trajectory === "declining" ? "down" : "up") as StatDirection,
      },
    ]
  }, [balance, positions, trades, selectedStock, activePositionCount, coachingSummary])
}
