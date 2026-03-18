"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Wallet, TrendingUp, TrendingDown } from "lucide-react"
import type { Notification } from "@/types/dashboard"
import { useAuth } from "@/contexts/auth-context"
import { detectTrend, type PricePoint } from "@/lib/ml/trend-detection"
import { evaluateTradeForCoaching, updateBehavioralMemory, updateWeightsFromFeedback, type TradeWithCoaching, type EvaluateTradeInput } from "@/lib/coaching"
import { scheduleSyncToServer } from "@/lib/storage"
import TradeReviewCard from "./trade-review-card"

interface TradingSimulatorProps {
  selectedStock?: {
    symbol: string
    price: number
    name: string
    market?: string
  } | null
  onNotification?: (notification: Omit<Notification, "id">) => void
  balance: number
  setBalance: (balance: number) => void
  positions: { [key: string]: { quantity: number; avgPrice: number } }
  setPositions: (
    positions:
      | { [key: string]: { quantity: number; avgPrice: number } }
      | ((prev: { [key: string]: { quantity: number; avgPrice: number } }) => {
          [key: string]: { quantity: number; avgPrice: number }
        }),
  ) => void
  trades: TradeWithCoaching[]
  setTrades: (trades: TradeWithCoaching[] | ((prev: TradeWithCoaching[]) => TradeWithCoaching[])) => void
}

interface SentimentData {
  label: "bullish" | "bearish" | "neutral"
  score: number
  confidence: number
  source: "finbert" | "heuristic-fallback" | "unavailable"
}

interface TrendData {
  label: "uptrend" | "downtrend" | "range" | "uncertain"
  signal: number
  confidence: number
  shortMA: number
  longMA: number
  momentum: number
}

export default function TradingSimulator({
  selectedStock,
  onNotification,
  balance,
  setBalance,
  positions,
  setPositions,
  trades,
  setTrades,
}: TradingSimulatorProps) {
  const [quantity, setQuantity] = useState(1)
  const [lastCoachingReport, setLastCoachingReport] = useState<TradeWithCoaching | null>(null)
  const [currentSentiment, setCurrentSentiment] = useState<SentimentData | null>(null)
  const [currentTrend, setCurrentTrend] = useState<TrendData | null>(null)
  const { recordTrade, isAuthenticated } = useAuth()

  // Fetch sentiment + trend data for the selected stock
  const fetchMarketSignals = useCallback(async (symbol: string) => {
    const cleanSymbol = symbol.replace(/\.(NS|BO)$/, "")

    const [sentimentResult, chartResult] = await Promise.allSettled([
      fetch(`/api/news?q=${encodeURIComponent(cleanSymbol)}&ticker=${encodeURIComponent(symbol)}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/stock/${symbol}/chart?range=1D`).then(r => r.ok ? r.json() : null),
    ])

    if (sentimentResult.status === "fulfilled" && sentimentResult.value?.overallSentiment) {
      const s = sentimentResult.value.overallSentiment
      setCurrentSentiment({
        label: s.label === "bullish" ? "bullish" : s.label === "bearish" ? "bearish" : "neutral",
        score: s.score,
        confidence: s.confidence,
        source: sentimentResult.value.sentimentModel || "unavailable",
      })
    } else {
      setCurrentSentiment({ label: "neutral", score: 50, confidence: 0.3, source: "unavailable" })
    }

    if (chartResult.status === "fulfilled" && chartResult.value?.chartData?.length > 0) {
      const priceHistory: PricePoint[] = chartResult.value.chartData.map((p: { price: number; timestamp: number }) => ({
        price: p.price,
        timestamp: p.timestamp,
      }))
      const trendSignal = detectTrend(priceHistory)
      const label = trendSignal.trend === "uptrend" ? "uptrend" as const
        : trendSignal.trend === "downtrend" ? "downtrend" as const
        : trendSignal.confidence < 0.2 ? "uncertain" as const
        : "range" as const
      setCurrentTrend({
        label,
        signal: trendSignal.signal,
        confidence: trendSignal.confidence,
        shortMA: trendSignal.shortMA,
        longMA: trendSignal.longMA,
        momentum: trendSignal.priceChangePercent,
      })
    } else {
      setCurrentTrend({ label: "uncertain", signal: 0, confidence: 0.2, shortMA: 0, longMA: 0, momentum: 0 })
    }
  }, [])

  useEffect(() => {
    if (selectedStock?.symbol) {
      fetchMarketSignals(selectedStock.symbol)
      setLastCoachingReport(null)
    } else {
      setCurrentSentiment(null)
      setCurrentTrend(null)
      setLastCoachingReport(null)
    }
  }, [selectedStock?.symbol, fetchMarketSignals])

  const currentPrice = selectedStock?.price || 0
  const currentSymbol = selectedStock?.symbol || ""
  const stockName = selectedStock?.name || "No stock selected"
  const currencySymbol = selectedStock?.market === "IN" ? "\u20B9" : "$"
  const tradeMarket: "US" | "IN" = selectedStock?.market === "IN" ? "IN" : "US"
  const tradeCurrency: "USD" | "INR" = tradeMarket === "IN" ? "INR" : "USD"

  const rawPosition = positions[currentSymbol]
  const currentPosition = rawPosition
    ? {
        quantity: typeof rawPosition.quantity === "number" ? rawPosition.quantity : 0,
        avgPrice: typeof rawPosition.avgPrice === "number" ? rawPosition.avgPrice : 0,
      }
    : { quantity: 0, avgPrice: 0 }

  const computeExposure = (): number => {
    let invested = 0
    for (const pos of Object.values(positions)) {
      const p = typeof pos === "number" ? { quantity: pos, avgPrice: 0 } : pos
      invested += p.quantity * p.avgPrice
    }
    const total = invested + balance
    return total > 0 ? invested / total : 0
  }

  const recentTradeCount = (): number => {
    const oneHourAgo = Date.now() - 3600000
    return trades.filter(t => new Date(t.timestamp).getTime() > oneHourAgo).length
  }

  const executeTrade = (type: "buy" | "sell") => {
    if (!selectedStock || currentPrice === 0) {
      onNotification?.({
        title: "No Stock Selected",
        message: "Please search and select a stock before trading.",
        timestamp: new Date().toISOString(),
        type: "error",
        read: false,
        priority: "medium",
      })
      return
    }

    const cost = quantity * currentPrice
    const now = new Date()
    const tradeTimestamp = now.toISOString()
    const displayTimestamp = now.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" })

    const sentiment: EvaluateTradeInput["sentiment"] = currentSentiment || {
      label: "neutral", score: 50, confidence: 0.3, source: "unavailable",
    }
    const trend: EvaluateTradeInput["trend"] = currentTrend || {
      label: "uncertain", signal: 0, confidence: 0.2, shortMA: 0, longMA: 0, momentum: 0,
    }

    if (type === "buy") {
      if (cost > balance) {
        onNotification?.({
          title: "Buy Order Failed",
          message: `Insufficient balance. Need ${currencySymbol}${cost.toLocaleString()}, have ${currencySymbol}${balance.toLocaleString()}.`,
          timestamp: tradeTimestamp, type: "error", read: false, priority: "high",
        })
        return
      }

      const newBalance = balance - cost
      const totalQuantity = currentPosition.quantity + quantity
      const newAvgPrice = totalQuantity > 0
        ? (currentPosition.quantity * currentPosition.avgPrice + quantity * currentPrice) / totalQuantity
        : currentPrice

      setBalance(newBalance)
      setPositions(prev => ({ ...prev, [currentSymbol]: { quantity: totalQuantity, avgPrice: newAvgPrice } }))

      const recentRewards = trades.slice(-20).map(t => t.coaching.reward.total)
      const input: EvaluateTradeInput = {
        action: "buy", symbol: currentSymbol, quantity, price: currentPrice,
        market: tradeMarket, currency: tradeCurrency,
        sentiment, trend,
        portfolioExposure: computeExposure(),
        recentTradeCount: recentTradeCount(),
        existingPositionSize: currentPosition.quantity,
        totalBalance: balance,
        recentRewards,
        tradeHistory: trades.slice(-20),
      }
      const coaching = evaluateTradeForCoaching(input)

      const newTrade: TradeWithCoaching = {
        id: `${tradeTimestamp}-${currentSymbol}-buy`,
        type: "buy", symbol: currentSymbol, quantity, price: currentPrice, cost,
        timestamp: tradeTimestamp, displayTime: displayTimestamp,
        market: tradeMarket, currency: tradeCurrency,
        coaching,
      }

      const updatedTrades = [...trades, newTrade]
      setTrades(updatedTrades)
      setLastCoachingReport(newTrade)
      updateBehavioralMemory(newTrade, updatedTrades)
      scheduleSyncToServer()

      if (isAuthenticated) recordTrade(0, "buy", "technicalAnalysis")

      onNotification?.({
        title: `BUY: ${quantity} ${currentSymbol}`,
        message: coaching.summary,
        timestamp: tradeTimestamp, type: "trade_buy", read: false,
        priority: cost > 50000 ? "high" : cost > 10000 ? "medium" : "low",
      })

    } else {
      // SELL
      const owned = currentPosition.quantity
      if (quantity > owned) {
        onNotification?.({
          title: "Sell Order Failed",
          message: `Insufficient shares. Have ${owned}, trying to sell ${quantity}.`,
          timestamp: tradeTimestamp, type: "error", read: false, priority: "high",
        })
        return
      }

      const newBalance = balance + cost
      const remainingShares = owned - quantity
      const profit = (currentPrice - currentPosition.avgPrice) * quantity
      const profitPercent = currentPosition.avgPrice > 0
        ? ((currentPrice - currentPosition.avgPrice) / currentPosition.avgPrice) * 100
        : 0

      setBalance(newBalance)
      setPositions(prev => ({
        ...prev,
        [currentSymbol]: { quantity: remainingShares, avgPrice: remainingShares > 0 ? currentPosition.avgPrice : 0 },
      }))

      const recentRewards = trades.slice(-20).map(t => t.coaching.reward.total)
      const input: EvaluateTradeInput = {
        action: "sell", symbol: currentSymbol, quantity, price: currentPrice,
        market: tradeMarket, currency: tradeCurrency,
        sentiment, trend,
        portfolioExposure: computeExposure(),
        recentTradeCount: recentTradeCount(),
        existingPositionSize: currentPosition.quantity,
        totalBalance: balance,
        recentRewards,
        tradeHistory: trades.slice(-20),
        profit, profitPercent,
      }
      const coaching = evaluateTradeForCoaching(input)

      const newTrade: TradeWithCoaching = {
        id: `${tradeTimestamp}-${currentSymbol}-sell`,
        type: "sell", symbol: currentSymbol, quantity, price: currentPrice, cost,
        timestamp: tradeTimestamp, displayTime: displayTimestamp,
        market: tradeMarket, currency: tradeCurrency,
        profit, profitPercent,
        coaching,
      }

      const updatedTrades = [...trades, newTrade]
      setTrades(updatedTrades)
      setLastCoachingReport(newTrade)
      updateBehavioralMemory(newTrade, updatedTrades)
      scheduleSyncToServer()

      if (isAuthenticated) recordTrade(profit, "sell", "riskManagement")

      const profitLabel = profit >= 0 ? `+${currencySymbol}${profit.toFixed(2)}` : `-${currencySymbol}${Math.abs(profit).toFixed(2)}`
      onNotification?.({
        title: `SELL: ${quantity} ${currentSymbol} (${profitLabel})`,
        message: coaching.summary,
        timestamp: tradeTimestamp, type: "trade_sell", read: false,
        priority: cost > 50000 ? "high" : cost > 10000 ? "medium" : "low",
      })
    }
  }

  const unrealizedPnL = currentPosition.quantity > 0 ? (currentPrice - currentPosition.avgPrice) * currentPosition.quantity : 0
  const unrealizedPercent = currentPosition.avgPrice > 0 ? ((currentPrice - currentPosition.avgPrice) / currentPosition.avgPrice) * 100 : 0

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Trading Simulator
          </CardTitle>
          {selectedStock && (
            <div className="text-sm text-gray-400">
              Trading: {stockName} ({currentSymbol}) - {currencySymbol}{currentPrice.toFixed(2)}
              <span className="ml-2 text-xs bg-gray-700 px-2 py-1 rounded">
                {tradeMarket === "IN" ? "NSE/BSE" : "US Market"}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedStock && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
              <p className="text-yellow-400">Search and select a stock to start trading</p>
            </div>
          )}

          {/* Balance & Position */}
          <div className="p-4 bg-gray-800/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Virtual Balance</span>
              <span className="text-xl font-bold text-green-400 font-mono">{currencySymbol}{balance.toLocaleString()}</span>
            </div>
            {currentPosition.quantity > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Shares Owned</span>
                  <span className="text-white font-mono">{currentPosition.quantity} @ {currencySymbol}{currentPosition.avgPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Unrealized P&L</span>
                  <span className={unrealizedPnL >= 0 ? "text-green-400 font-mono" : "text-red-400 font-mono"}>
                    {unrealizedPnL >= 0 ? "+" : ""}{currencySymbol}{unrealizedPnL.toFixed(2)} ({unrealizedPercent >= 0 ? "+" : ""}{unrealizedPercent.toFixed(1)}%)
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Market signals */}
          {selectedStock && (currentSentiment || currentTrend) && (
            <div className="flex gap-2 flex-wrap">
              {currentSentiment && (
                <Badge className={`text-xs ${
                  currentSentiment.label === "bullish" ? "bg-green-500/20 text-green-400" :
                  currentSentiment.label === "bearish" ? "bg-red-500/20 text-red-400" :
                  "bg-gray-500/20 text-gray-400"
                }`}>
                  Sentiment: {currentSentiment.label}
                  {currentSentiment.source === "finbert" && <span className="ml-1 opacity-60">(FinBERT)</span>}
                  {currentSentiment.source === "heuristic-fallback" && <span className="ml-1 opacity-60">(heuristic)</span>}
                </Badge>
              )}
              {currentTrend && (
                <Badge className={`text-xs ${
                  currentTrend.label === "uptrend" ? "bg-green-500/20 text-green-400" :
                  currentTrend.label === "downtrend" ? "bg-red-500/20 text-red-400" :
                  "bg-gray-500/20 text-gray-400"
                }`}>
                  Trend: {currentTrend.label}
                </Badge>
              )}
            </div>
          )}

          {/* Trade controls */}
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Quantity</label>
              <Input
                type="number" min="1" value={quantity}
                onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
                className="bg-gray-800 border-gray-700 text-white"
                disabled={!selectedStock}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => executeTrade("buy")}
                className="bg-green-600 hover:bg-green-700"
                disabled={!selectedStock || quantity * currentPrice > balance}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Buy {selectedStock ? `${currencySymbol}${(quantity * currentPrice).toLocaleString()}` : ""}
              </Button>
              <Button
                onClick={() => executeTrade("sell")}
                className="bg-red-600 hover:bg-red-700"
                disabled={!selectedStock || quantity > currentPosition.quantity}
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                Sell {selectedStock ? `${currencySymbol}${(quantity * currentPrice).toLocaleString()}` : ""}
              </Button>
            </div>
          </div>

          {/* Learning hint */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400 mb-0.5 font-semibold">Coaching System</p>
            <p className="text-xs text-gray-400">
              {isAuthenticated
                ? "Every trade generates a coaching report. Check what you did right, what went wrong, and what to improve."
                : "Sign in to track your learning progress across sessions."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Post-trade coaching review - THE MAIN EVENT */}
      {lastCoachingReport && (
        <TradeReviewCard
          coaching={lastCoachingReport.coaching}
          action={lastCoachingReport.type}
          symbol={lastCoachingReport.symbol}
          quantity={lastCoachingReport.quantity}
          price={lastCoachingReport.price}
          currency={lastCoachingReport.currency}
          expanded={true}
          onRate={(helpful) => {
            // Update adaptive weights based on feedback
            updateWeightsFromFeedback(lastCoachingReport.coaching, helpful)
            // Store rating on the trade (immutable update)
            const rating = { helpful, timestamp: new Date().toISOString() }
            setLastCoachingReport({
              ...lastCoachingReport,
              coaching: { ...lastCoachingReport.coaching, rating },
            })
            scheduleSyncToServer()
          }}
        />
      )}
    </div>
  )
}
