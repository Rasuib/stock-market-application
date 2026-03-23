"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Wallet, Sparkles, Clock } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useNotifications } from "@/contexts/notification-context"
import { useTradingStore } from "@/stores/trading-store"
import { evaluateTradeForCoaching, updateBehavioralMemory, updateWeightsFromFeedback, type TradeWithCoaching, type EvaluateTradeInput, type CoachingReport } from "@/lib/coaching"
import { useStockData } from "@/hooks/use-stock-data"
import { useAITradeAnalysis, useAICoachAvailability } from "@/hooks/use-ai-coach"
import type { AITradeAnalysis } from "@/lib/ai-coach"
import TradeReviewCard from "./trade-review-card"
import { MarketSignals, OrderForm, OrderPreview, ReflectionPrompt } from "./trading"
import { useGamification } from "@/hooks/use-gamification"
import { previewOrder, executeOrder, getDefaultConfig, validateOrder } from "@/lib/execution/engine"
import type { OrderRequest, OrderPreview as OrderPreviewType } from "@/lib/execution/types"
import { getMarketSession, type MarketSession } from "@/lib/market-hours"
import { validateTradeAgainstChallenges, type ChallengeContext } from "@/lib/challenges"

export default function TradingSimulator() {
  const [quantity, setQuantity] = useState(1)
  const [orderType, setOrderType] = useState<"market" | "limit">("market")
  const [limitPrice, setLimitPrice] = useState<number | null>(null)
  const [thesis, setThesis] = useState("")
  const [reflection, setReflection] = useState("")
  const [showReflectionPrompt, setShowReflectionPrompt] = useState(false)
  const [pendingReflectionTradeId, setPendingReflectionTradeId] = useState<string | null>(null)
  const [lastCoachingReport, setLastCoachingReport] = useState<TradeWithCoaching | null>(null)
  const [lastAIAnalysis, setLastAIAnalysis] = useState<AITradeAnalysis | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<{ type: "buy" | "sell"; preview: OrderPreviewType; request: OrderRequest } | null>(null)
  const coachingRef = useRef<HTMLDivElement>(null)
  const { recordTrade, isAuthenticated } = useAuth()
  const { addNotification } = useNotifications()
  const { available: aiAvailable } = useAICoachAvailability()
  const { analyze: aiAnalyze, loading: aiLoading } = useAITradeAnalysis()
  const { processTrade: processGamification } = useGamification()

  const selectedStock = useTradingStore((s) => s.selectedStock)
  const balance = useTradingStore((s) => s.balance)
  const positions = useTradingStore((s) => s.positions)
  const trades = useTradingStore((s) => s.trades)
  const setBalance = useTradingStore((s) => s.setBalance)
  const setPositions = useTradingStore((s) => s.setPositions)
  const setTrades = useTradingStore((s) => s.setTrades)

  // Market signals from shared hook
  const {
    sentiment: currentSentiment,
    trend: currentTrend,
    loading: signalsLoading,
    error: signalsError,
    refresh: refreshSignals,
  } = useStockData(selectedStock?.symbol)

  const currentPrice = selectedStock?.price || 0
  const currentSymbol = selectedStock?.symbol || ""
  const stockName = selectedStock?.name || "No stock selected"
  const currencySymbol = selectedStock?.market === "IN" ? "\u20B9" : "$"
  const tradeMarket: "US" | "IN" = selectedStock?.market === "IN" ? "IN" : "US"
  const tradeCurrency: "USD" | "INR" = tradeMarket === "IN" ? "INR" : "USD"

  // Market hours awareness
  const marketSession: MarketSession = useMemo(
    () => getMarketSession(tradeMarket),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tradeMarket, selectedStock?.symbol]
  )

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

  const recentTradeCount = (referenceTime: number): number => {
    const oneHourAgo = referenceTime - 3600000
    return trades.filter(t => new Date(t.timestamp).getTime() > oneHourAgo).length
  }

  const buildInput = (
    type: "buy" | "sell",
    referenceTime: number,
    executedFillPrice?: number,
    profit?: number,
    profitPercent?: number,
  ): EvaluateTradeInput => {
    const sentiment: EvaluateTradeInput["sentiment"] = currentSentiment || {
      label: "neutral", score: 50, confidence: 0.3, source: "unavailable",
    }
    const trend: EvaluateTradeInput["trend"] = currentTrend || {
      label: "uncertain", signal: 0, confidence: 0.2, shortMA: 0, longMA: 0, momentum: 0,
    }
    // Use actual fill price for coaching evaluation when available,
    // falling back to quote price for preview/non-executed contexts.
    const priceForCoaching = executedFillPrice ?? currentPrice
    return {
      action: type, symbol: currentSymbol, quantity, price: priceForCoaching,
      market: tradeMarket, currency: tradeCurrency,
      sentiment, trend,
      portfolioExposure: computeExposure(),
      recentTradeCount: recentTradeCount(referenceTime),
      existingPositionSize: currentPosition.quantity,
      totalBalance: balance,
      recentRewards: trades.slice(-20).map(t => t.coaching.reward.total),
      tradeHistory: trades.slice(-20),
      profit, profitPercent,
    }
  }

  const requestAIAnalysis = async (input: EvaluateTradeInput, coaching: CoachingReport) => {
    if (!aiAvailable) return
    setLastAIAnalysis(null)
    const result = await aiAnalyze(input, coaching)
    if (result) setLastAIAnalysis(result)
  }

  // Scroll coaching card into view after trade
  useEffect(() => {
    if (lastCoachingReport && coachingRef.current) {
      coachingRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [lastCoachingReport])

  // Generate order preview
  const handlePreview = (type: "buy" | "sell") => {
    if (!selectedStock || currentPrice === 0) return

    // Validate against active challenges
    const totalPositionValue = Object.values(positions).reduce(
      (sum, p) => sum + p.quantity * p.avgPrice, 0
    )
    const challengeCtx: ChallengeContext = {
      action: type,
      symbol: currentSymbol,
      quantity,
      price: currentPrice,
      balance,
      positions,
      trades,
      totalPortfolioValue: balance + totalPositionValue,
    }
    const violations = validateTradeAgainstChallenges(challengeCtx)
    if (violations.length > 0) {
      addNotification({
        title: "Trade Blocked",
        message: violations[0],
        timestamp: new Date().toISOString(),
        type: "error", read: false, priority: "high",
      })
      return
    }

    const config = getDefaultConfig()
    // Apply market hours spread multiplier
    const adjustedConfig = {
      ...config,
      spreadBps: {
        liquid: config.spreadBps.liquid * marketSession.spreadMultiplier,
        mid: config.spreadBps.mid * marketSession.spreadMultiplier,
        small: config.spreadBps.small * marketSession.spreadMultiplier,
      },
    }

    const request: OrderRequest = {
      type: orderType,
      action: type,
      symbol: currentSymbol,
      quantity,
      marketPrice: currentPrice,
      limitPrice: orderType === "limit" && limitPrice !== null ? limitPrice : undefined,
      currency: tradeCurrency,
      market: tradeMarket,
    }

    // Validate order (catches limit orders without valid price, NaN, etc.)
    const orderError = validateOrder(request)
    if (orderError) {
      addNotification({
        title: "Invalid Order",
        message: orderError,
        timestamp: new Date().toISOString(),
        type: "error", read: false, priority: "high",
      })
      return
    }

    const preview = previewOrder(request, adjustedConfig)
    setPendingOrder({ type, preview, request })
    setShowPreview(true)
  }

  const confirmOrder = () => {
    if (!pendingOrder || !selectedStock) return
    setShowPreview(false)

    const { type, request } = pendingOrder
    const config = getDefaultConfig()
    const adjustedConfig = {
      ...config,
      spreadBps: {
        liquid: config.spreadBps.liquid * marketSession.spreadMultiplier,
        mid: config.spreadBps.mid * marketSession.spreadMultiplier,
        small: config.spreadBps.small * marketSession.spreadMultiplier,
      },
    }

    const result = executeOrder(request, adjustedConfig)

    if (result.status === "rejected") {
      addNotification({
        title: "Order Rejected",
        message: result.rejectReason || "Limit order could not be filled at the specified price.",
        timestamp: new Date().toISOString(),
        type: "error", read: false, priority: "high",
      })
      setPendingOrder(null)
      return
    }

    const fillPrice = result.fillPrice
    const cost = quantity * fillPrice + (type === "buy" ? result.commissionPaid : -result.commissionPaid)
    const now = new Date()
    const tradeTimestamp = now.toISOString()
    const displayTimestamp = now.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" })

    if (type === "buy") {
      if (cost > balance) {
        addNotification({
          title: "Insufficient Balance",
          message: `Order requires ${currencySymbol}${cost.toFixed(2)} (incl. fees) but you have ${currencySymbol}${balance.toLocaleString()}.`,
          timestamp: tradeTimestamp, type: "error", read: false, priority: "high",
        })
        setPendingOrder(null)
        return
      }

      const newBalance = balance - cost
      const totalQuantity = currentPosition.quantity + quantity
      const newAvgPrice = totalQuantity > 0
        ? (currentPosition.quantity * currentPosition.avgPrice + quantity * fillPrice) / totalQuantity
        : fillPrice

      setBalance(newBalance)
      setPositions(prev => ({ ...prev, [currentSymbol]: { quantity: totalQuantity, avgPrice: newAvgPrice } }))

      const coaching = evaluateTradeForCoaching(buildInput("buy", now.getTime(), fillPrice))

      const newTrade: TradeWithCoaching = {
        id: `${tradeTimestamp}-${currentSymbol}-buy`,
        type: "buy", symbol: currentSymbol, quantity, price: fillPrice, cost,
        timestamp: tradeTimestamp, displayTime: displayTimestamp,
        market: tradeMarket, currency: tradeCurrency,
        thesis: thesis.trim() || undefined,
        execution: {
          requestedPrice: result.requestedPrice,
          fillPrice: result.fillPrice,
          spreadBps: result.spreadBps,
          commissionPaid: result.commissionPaid,
          slippageBps: result.slippageBps,
          executionDelayMs: result.executionDelayMs,
          orderType: result.orderType,
        },
        coaching,
      }

      const updatedTrades = [...trades, newTrade]
      setTrades(updatedTrades)
      setLastCoachingReport(newTrade)
      updateBehavioralMemory(newTrade, updatedTrades)
      processGamification()

      requestAIAnalysis(buildInput("buy", now.getTime(), fillPrice), coaching)

      if (isAuthenticated) recordTrade(0, "buy", "technicalAnalysis")

      addNotification({
        title: `Bought ${quantity} ${currentSymbol} @ ${currencySymbol}${fillPrice.toFixed(2)}`,
        message: `${coaching.summary} (Commission: ${currencySymbol}${result.commissionPaid.toFixed(2)})`,
        timestamp: tradeTimestamp, type: "trade_buy", read: false,
        priority: cost > 50000 ? "high" : cost > 10000 ? "medium" : "low",
      })

      // Show reflection prompt for sell trades only
      setThesis("")

    } else {
      // SELL
      const owned = currentPosition.quantity
      if (quantity > owned) {
        addNotification({
          title: "Not Enough Shares",
          message: `You own ${owned} share${owned !== 1 ? "s" : ""}, but tried to sell ${quantity}.`,
          timestamp: tradeTimestamp, type: "error", read: false, priority: "high",
        })
        setPendingOrder(null)
        return
      }

      const sellProceeds = quantity * fillPrice - result.commissionPaid
      const newBalance = balance + sellProceeds
      const remainingShares = owned - quantity
      const profit = (fillPrice - currentPosition.avgPrice) * quantity - result.commissionPaid
      const profitPercent = currentPosition.avgPrice > 0
        ? ((fillPrice - currentPosition.avgPrice) / currentPosition.avgPrice) * 100
        : 0

      setBalance(newBalance)
      setPositions(prev => ({
        ...prev,
        [currentSymbol]: { quantity: remainingShares, avgPrice: remainingShares > 0 ? currentPosition.avgPrice : 0 },
      }))

      const coaching = evaluateTradeForCoaching(buildInput("sell", now.getTime(), fillPrice, profit, profitPercent))

      const tradeId = `${tradeTimestamp}-${currentSymbol}-sell`
      const newTrade: TradeWithCoaching = {
        id: tradeId,
        type: "sell", symbol: currentSymbol, quantity, price: fillPrice, cost: quantity * fillPrice,
        timestamp: tradeTimestamp, displayTime: displayTimestamp,
        market: tradeMarket, currency: tradeCurrency,
        profit, profitPercent,
        thesis: thesis.trim() || undefined,
        execution: {
          requestedPrice: result.requestedPrice,
          fillPrice: result.fillPrice,
          spreadBps: result.spreadBps,
          commissionPaid: result.commissionPaid,
          slippageBps: result.slippageBps,
          executionDelayMs: result.executionDelayMs,
          orderType: result.orderType,
        },
        coaching,
      }

      const updatedTrades = [...trades, newTrade]
      setTrades(updatedTrades)
      setLastCoachingReport(newTrade)
      updateBehavioralMemory(newTrade, updatedTrades)
      processGamification()

      requestAIAnalysis(buildInput("sell", now.getTime(), fillPrice, profit, profitPercent), coaching)

      if (isAuthenticated) recordTrade(profit, "sell", "riskManagement")

      const profitLabel = profit >= 0 ? `+${currencySymbol}${profit.toFixed(2)}` : `-${currencySymbol}${Math.abs(profit).toFixed(2)}`
      addNotification({
        title: `Sold ${quantity} ${currentSymbol} (${profitLabel})`,
        message: `${coaching.summary} (Commission: ${currencySymbol}${result.commissionPaid.toFixed(2)})`,
        timestamp: tradeTimestamp, type: "trade_sell", read: false,
        priority: cost > 50000 ? "high" : cost > 10000 ? "medium" : "low",
      })

      // Show reflection prompt after sell
      setThesis("")
      setShowReflectionPrompt(true)
      setPendingReflectionTradeId(tradeId)
    }

    setPendingOrder(null)
  }

  const submitReflection = () => {
    if (!pendingReflectionTradeId || !reflection.trim()) return
    // Update the trade with reflection
    setTrades(prev => prev.map(t =>
      t.id === pendingReflectionTradeId
        ? { ...t, reflection: reflection.trim() }
        : t
    ))
    setReflection("")
    setShowReflectionPrompt(false)
    setPendingReflectionTradeId(null)
  }

  const skipReflection = () => {
    setReflection("")
    setShowReflectionPrompt(false)
    setPendingReflectionTradeId(null)
  }

  const unrealizedPnL = currentPosition.quantity > 0 ? (currentPrice - currentPosition.avgPrice) * currentPosition.quantity : 0
  const unrealizedPercent = currentPosition.avgPrice > 0 ? ((currentPrice - currentPosition.avgPrice) / currentPosition.avgPrice) * 100 : 0
  const limitPriceValid = orderType === "market" || (limitPrice !== null && limitPrice > 0)
  const thesisValid = thesis.length === 0 || thesis.length >= 10
  const canBuy = selectedStock && quantity * currentPrice <= balance && limitPriceValid && thesisValid
  const canSell = selectedStock && quantity <= currentPosition.quantity && currentPosition.quantity > 0 && limitPriceValid && thesisValid

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Trade
          </CardTitle>
          {selectedStock && (
            <p className="text-sm text-muted-foreground">
              {stockName} ({currentSymbol}) &mdash; {currencySymbol}{currentPrice.toFixed(2)}
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {tradeMarket === "IN" ? "NSE/BSE" : "US Market"}
              </Badge>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedStock && (
            <div className="py-8 text-center" role="status">
              <p className="text-sm text-muted-foreground">Select a stock from search results to start trading.</p>
            </div>
          )}

          {selectedStock && (
            <>
              {/* Market Hours Status */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono ${
                marketSession.isOpen
                  ? "bg-profit/10 border border-profit/20 text-profit"
                  : marketSession.status === "pre-market" || marketSession.status === "after-hours"
                  ? "bg-warning/10 border border-warning/20 text-warning"
                  : "bg-muted/50 border border-border text-muted-foreground"
              }`}>
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{marketSession.name}: {marketSession.statusLabel}</span>
                {!marketSession.isOpen && (
                  <Badge variant="secondary" className="text-[9px] ml-auto">
                    {marketSession.spreadMultiplier}x spread
                  </Badge>
                )}
              </div>

              {/* Balance & Position */}
              <div className="p-3 bg-surface rounded-lg space-y-1.5" aria-live="polite">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Balance</span>
                  <span className="text-sm font-bold text-profit font-mono" aria-label={`Balance: ${currencySymbol}${balance.toLocaleString()}`}>
                    {currencySymbol}{balance.toLocaleString()}
                  </span>
                </div>
                {currentPosition.quantity > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Position</span>
                      <span className="text-sm font-mono">{currentPosition.quantity} @ {currencySymbol}{currentPosition.avgPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Unrealized P&L</span>
                      <span className={`text-sm font-mono ${unrealizedPnL >= 0 ? "text-profit" : "text-loss"}`}>
                        {unrealizedPnL >= 0 ? "+" : ""}{currencySymbol}{unrealizedPnL.toFixed(2)} ({unrealizedPercent >= 0 ? "+" : ""}{unrealizedPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Market signals */}
              <MarketSignals
                sentiment={currentSentiment}
                trend={currentTrend}
                loading={signalsLoading}
                error={signalsError}
                onRefresh={refreshSignals}
              />

              {/* Trade controls */}
              <OrderForm
                currentPrice={currentPrice}
                currencySymbol={currencySymbol}
                quantity={quantity}
                onQuantityChange={setQuantity}
                orderType={orderType}
                onOrderTypeChange={setOrderType}
                limitPrice={limitPrice}
                onLimitPriceChange={setLimitPrice}
                thesis={thesis}
                onThesisChange={setThesis}
                canBuy={!!canBuy}
                canSell={!!canSell}
                insufficientBalance={!canBuy && quantity * currentPrice > balance}
                limitPriceValid={limitPriceValid}
                onPreview={handlePreview}
              />

              {/* Order Preview / Confirmation */}
              {showPreview && pendingOrder && (
                <OrderPreview
                  preview={pendingOrder.preview}
                  type={pendingOrder.type}
                  orderTypeName={pendingOrder.request.type}
                  currencySymbol={currencySymbol}
                  marketSession={marketSession}
                  onConfirm={confirmOrder}
                  onCancel={() => { setShowPreview(false); setPendingOrder(null) }}
                />
              )}

              {/* Post-trade reflection prompt (for sells) */}
              {showReflectionPrompt && (
                <ReflectionPrompt
                  reflection={reflection}
                  onReflectionChange={setReflection}
                  onSubmit={submitReflection}
                  onSkip={skipReflection}
                />
              )}

              {/* Coaching hint for beginners */}
              {trades.length < 3 && !showPreview && !showReflectionPrompt && (
                <p className="text-xs text-muted-foreground border-t border-border pt-3">
                  Every trade gets a coaching report. It shows what you did well and what to improve.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* C. Post-trade coaching — the strongest focal element */}
      {lastCoachingReport && (
        <div ref={coachingRef}>
          <TradeReviewCard
            coaching={lastCoachingReport.coaching}
            action={lastCoachingReport.type}
            symbol={lastCoachingReport.symbol}
            quantity={lastCoachingReport.quantity}
            currency={lastCoachingReport.currency}
            execution={lastCoachingReport.execution}
            thesis={lastCoachingReport.thesis}
            expanded={false}
            onRate={(helpful) => {
              updateWeightsFromFeedback(lastCoachingReport.coaching, helpful)
              const rating = { helpful, timestamp: new Date().toISOString() }
              const updated = {
                ...lastCoachingReport,
                coaching: { ...lastCoachingReport.coaching, rating },
              }
              setLastCoachingReport(updated)
              setTrades((prev) =>
                prev.map((t) => (t.id === updated.id ? { ...t, coaching: updated.coaching } : t)),
              )
            }}
          />
        </div>
      )}

      {/* AI-powered analysis */}
      {lastCoachingReport && (aiLoading || lastAIAnalysis) && (
        <Card className="bg-linear-to-br from-primary/10 to-primary/5 border-primary/30 overflow-hidden" aria-live="polite">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Coach
              {aiLoading && (
                <span className="text-xs text-primary/70 animate-pulse">thinking...</span>
              )}
            </CardTitle>
          </CardHeader>
          {lastAIAnalysis && (
            <CardContent className="space-y-3 pt-0">
              <p className="text-sm leading-relaxed">{lastAIAnalysis.narrative}</p>

              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-xs text-primary font-semibold mb-1">Tip for You</p>
                <p className="text-sm text-muted-foreground">{lastAIAnalysis.personalizedTip}</p>
              </div>

              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-xs text-warning font-semibold mb-1">What a Pro Would Do</p>
                <p className="text-sm text-muted-foreground">{lastAIAnalysis.whatAProfessionalWouldDo}</p>
              </div>

              <p className="text-xs text-primary/80 italic">{lastAIAnalysis.encouragement}</p>

              <Badge variant="outline" className="text-[10px]">
                Powered by Gemini
              </Badge>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
