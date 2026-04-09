"use client"

import { useEffect, useMemo, useState } from "react"
import DashboardStat from "@/components/dashboard/stat"
import Watchlist from "@/components/dashboard/watchlist"
import RiskAnalyticsCard from "@/components/dashboard/risk-analytics-card"
import TrendingUpIcon from "@/components/icons/trending-up"
import DollarSignIcon from "@/components/icons/dollar-sign"
import BarChartIcon from "@/components/icons/bar-chart"
import ActivityIcon from "@/components/icons/activity"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { INITIAL_BALANCE, useTradingStore } from "@/stores/trading-store"
import { useTradingStats } from "@/hooks/use-trading-stats"
import AISessionInsights from "@/components/dashboard/ai-session-insights"
import AccountResetButton from "@/components/dashboard/account-reset-button"
import { evaluateTradeForCoaching, type TradeWithCoaching } from "@/lib/coaching"
import type { EvaluateTradeInput } from "@/lib/coaching/types"
import { executeOrder, getDefaultConfig } from "@/lib/execution/engine"
import type { OrderRequest } from "@/lib/execution/types"
import { getMarketSession } from "@/lib/market-hours"
import { useNotifications } from "@/contexts/notification-context"
import { useAuth } from "@/contexts/auth-context"
import { useGamification } from "@/hooks/use-gamification"

const iconMap = {
  "dollar-sign": DollarSignIcon,
  "bar-chart": BarChartIcon,
  "trending-up": TrendingUpIcon,
  activity: ActivityIcon,
}

const COLORS = ["oklch(0.75 0.18 155)", "oklch(0.72 0.15 220)", "oklch(0.65 0.2 25)", "oklch(0.8 0.15 85)", "oklch(0.7 0.16 145)", "oklch(0.68 0.18 260)", "oklch(0.7 0.15 340)", "oklch(0.65 0.2 290)"]

export default function PortfolioView() {
  const positions = useTradingStore((s) => s.positions)
  const balance = useTradingStore((s) => s.balance)
  const trades = useTradingStore((s) => s.trades)
  const setBalance = useTradingStore((s) => s.setBalance)
  const setPositions = useTradingStore((s) => s.setPositions)
  const setTrades = useTradingStore((s) => s.setTrades)
  const { addNotification } = useNotifications()
  const { isAuthenticated, recordTrade } = useAuth()
  const { processTrade: processGamification } = useGamification()
  const tradingStats = useTradingStats()
  const [sellQuantity, setSellQuantity] = useState<Record<string, number>>({})
  const [sellingSymbol, setSellingSymbol] = useState<string | null>(null)

  const [allocation, setAllocation] = useState<
    { symbol: string; value: number; percentage: number; color: string; currentPrice: number }[]
  >([])
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({})
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(balance)
  const [isLoading, setIsLoading] = useState(true)
  const [performance, setPerformance] = useState({
    totalReturn: 0,
    totalReturnPercent: 0,
    bestPerformer: { symbol: "--", return: 0 },
    worstPerformer: { symbol: "--", return: 0 },
  })

  useEffect(() => {
    const calculateAllocation = async () => {
      setIsLoading(true)
      const positionEntries = Object.entries(positions)

      if (positionEntries.length === 0) {
        setAllocation([])
        setTotalPortfolioValue(balance)
        setIsLoading(false)
        return
      }

      const allocationData: {
        symbol: string
        value: number
        percentage: number
        color: string
        currentPrice: number
        avgPrice: number
      }[] = []
      let totalStockValue = 0
      const latestPrices: Record<string, number> = {}

      const activePositions = positionEntries
        .filter(([, pos]) => pos.quantity > 0)

      const priceResults = await Promise.allSettled(
        activePositions.map(([symbol]) =>
          fetch(`/api/stock/${symbol}?t=${Date.now()}`).then(res => res.json())
        )
      )

      activePositions.forEach(([symbol, pos], index) => {
        const result = priceResults[index]
        const currentPrice = result.status === "fulfilled" ? (result.value.price || pos.avgPrice) : pos.avgPrice
        latestPrices[symbol] = currentPrice
        const value = pos.quantity * currentPrice

        allocationData.push({
          symbol,
          value,
          percentage: 0,
          color: COLORS[allocationData.length % COLORS.length],
          currentPrice,
          avgPrice: pos.avgPrice,
        })
        totalStockValue += value
      })

      const totalValue = totalStockValue + balance
      setTotalPortfolioValue(totalValue)

      const updatedAllocation = allocationData.map((item) => ({
        ...item,
        percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
      }))

      setAllocation(updatedAllocation)
      setCurrentPrices(latestPrices)

      let currentValue = 0
      let bestReturn = Number.NEGATIVE_INFINITY
      let worstReturn = Number.POSITIVE_INFINITY
      let bestSymbol = "--"
      let worstSymbol = "--"

      for (const item of updatedAllocation) {
        const pos = positions[item.symbol]
        currentValue += item.value

        const returnPct = pos.avgPrice > 0 ? ((item.currentPrice - pos.avgPrice) / pos.avgPrice) * 100 : 0

        if (returnPct > bestReturn) {
          bestReturn = returnPct
          bestSymbol = item.symbol
        }
        if (returnPct < worstReturn) {
          worstReturn = returnPct
          worstSymbol = item.symbol
        }
      }

      // Net performance should include both unrealized and realized P/L.
      const totalReturn = totalValue - INITIAL_BALANCE
      const totalReturnPercent = INITIAL_BALANCE > 0 ? (totalReturn / INITIAL_BALANCE) * 100 : 0

      setPerformance({
        totalReturn,
        totalReturnPercent,
        bestPerformer: { symbol: bestSymbol, return: bestReturn === Number.NEGATIVE_INFINITY ? 0 : bestReturn },
        worstPerformer: { symbol: worstSymbol, return: worstReturn === Number.POSITIVE_INFINITY ? 0 : worstReturn },
      })

      setIsLoading(false)
    }

    calculateAllocation()
    const interval = setInterval(calculateAllocation, 10000)
    return () => clearInterval(interval)
  }, [positions, balance])

  const cashPercentage = totalPortfolioValue > 0 ? (balance / totalPortfolioValue) * 100 : 100
  const hasPositions = allocation.length > 0
  const openPositions = useMemo(
    () =>
      Object.entries(positions)
        .filter(([, pos]) => pos.quantity > 0)
        .map(([symbol, pos]) => {
          const currentPrice = currentPrices[symbol] ?? pos.avgPrice
          const value = pos.quantity * currentPrice
          const unrealized = (currentPrice - pos.avgPrice) * pos.quantity
          const unrealizedPct = pos.avgPrice > 0 ? ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100 : 0
          return { symbol, pos, currentPrice, value, unrealized, unrealizedPct }
        }),
    [positions, currentPrices],
  )
  const investedValue = useMemo(
    () => openPositions.reduce((sum, item) => sum + item.value, 0),
    [openPositions],
  )
  const netPnL = totalPortfolioValue - INITIAL_BALANCE
  const netPnLPercent = INITIAL_BALANCE > 0 ? (netPnL / INITIAL_BALANCE) * 100 : 0

  const getMarketMeta = (symbol: string) => {
    const market: "US" | "IN" = symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "IN" : "US"
    const currency: "USD" | "INR" = market === "IN" ? "INR" : "USD"
    const currencySymbol = currency === "INR" ? "\u20B9" : "$"
    return { market, currency, currencySymbol }
  }

  const getSellQuantity = (symbol: string, maxQty: number) => {
    const raw = sellQuantity[symbol]
    if (!raw || Number.isNaN(raw)) return 1
    return Math.max(1, Math.min(maxQty, Math.floor(raw)))
  }

  const buildSellInput = (
    symbol: string,
    quantity: number,
    price: number,
    market: "US" | "IN",
    currency: "USD" | "INR",
    profit: number,
    profitPercent: number,
    referenceTime: number,
  ): EvaluateTradeInput => ({
    action: "sell",
    symbol,
    quantity,
    price,
    market,
    currency,
    sentiment: { label: "neutral", score: 50, confidence: 0.3, source: "unavailable" },
    trend: { label: "uncertain", signal: 0, confidence: 0.2, shortMA: 0, longMA: 0, momentum: 0 },
    portfolioExposure: totalPortfolioValue > 0 ? (totalPortfolioValue - balance) / totalPortfolioValue : 0,
    recentTradeCount: trades.filter(t => referenceTime - new Date(t.timestamp).getTime() < 3_600_000).length,
    existingPositionSize: positions[symbol]?.quantity ?? 0,
    totalBalance: balance,
    recentRewards: trades.slice(-20).map(t => t.coaching.reward.total),
    tradeHistory: trades.slice(-20),
    profit,
    profitPercent,
  })

  const handleSellFromPortfolio = (symbol: string) => {
    const state = useTradingStore.getState()
    const position = state.positions[symbol]
    if (!position || position.quantity <= 0) return

    const quantity = getSellQuantity(symbol, position.quantity)
    const marketMeta = getMarketMeta(symbol)
    const marketSession = getMarketSession(marketMeta.market)
    const marketPrice = currentPrices[symbol] ?? position.avgPrice

    const request: OrderRequest = {
      type: "market",
      action: "sell",
      symbol,
      quantity,
      marketPrice,
      currency: marketMeta.currency,
      market: marketMeta.market,
    }

    const config = getDefaultConfig()
    const adjustedConfig = {
      ...config,
      spreadBps: {
        liquid: config.spreadBps.liquid * marketSession.spreadMultiplier,
        mid: config.spreadBps.mid * marketSession.spreadMultiplier,
        small: config.spreadBps.small * marketSession.spreadMultiplier,
      },
    }

    setSellingSymbol(symbol)
    const result = executeOrder(request, adjustedConfig)

    if (result.status === "rejected") {
      addNotification({
        title: "Order Rejected",
        message: result.rejectReason || "Could not execute sell order.",
        timestamp: new Date().toISOString(),
        type: "error",
        read: false,
        priority: "high",
      })
      setSellingSymbol(null)
      return
    }

    const proceeds = quantity * result.fillPrice - result.commissionPaid
    const newBalance = state.balance + proceeds
    const remaining = position.quantity - quantity
    const profit = (result.fillPrice - position.avgPrice) * quantity - result.commissionPaid
    const profitPercent = position.avgPrice > 0
      ? ((result.fillPrice - position.avgPrice) / position.avgPrice) * 100
      : 0
    const now = new Date()
    const nowIso = now.toISOString()

    setBalance(() => newBalance)
    setPositions(prev => ({
      ...prev,
      [symbol]: {
        quantity: remaining,
        avgPrice: remaining > 0 ? position.avgPrice : 0,
      },
    }))

    const coaching = evaluateTradeForCoaching(
      buildSellInput(
        symbol,
        quantity,
        result.fillPrice,
        marketMeta.market,
        marketMeta.currency,
        profit,
        profitPercent,
        now.getTime(),
      ),
    )

    const trade: TradeWithCoaching = {
      id: `${nowIso}-${symbol}-sell-portfolio`,
      type: "sell",
      symbol,
      quantity,
      price: result.fillPrice,
      cost: quantity * result.fillPrice,
      timestamp: nowIso,
      displayTime: now.toLocaleTimeString(),
      market: marketMeta.market,
      currency: marketMeta.currency,
      profit,
      profitPercent,
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

    setTrades(prev => [...prev, trade])
    processGamification()
    if (isAuthenticated) recordTrade(profit, "sell", "riskManagement")

    addNotification({
      title: `Sold ${quantity} ${symbol}`,
      message: `${profit >= 0 ? "+" : "-"}${marketMeta.currencySymbol}${Math.abs(profit).toFixed(2)} after fees`,
      timestamp: nowIso,
      type: "trade_sell",
      read: false,
      priority: "medium",
    })

    setSellQuantity(prev => ({ ...prev, [symbol]: 1 }))
    setSellingSymbol(null)
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tradingStats.map((stat, index) => (
          <DashboardStat
            key={index}
            label={stat.label}
            value={stat.value}
            description={stat.description}
            icon={iconMap[stat.icon as keyof typeof iconMap]}
            tag={stat.tag}
            intent={stat.intent}
            direction={stat.direction}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-surface-border bg-surface p-3">
          <p className="text-[11px] text-muted-foreground">Net Worth</p>
          <p className="text-base font-mono">${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface p-3">
          <p className="text-[11px] text-muted-foreground">Cash</p>
          <p className="text-base font-mono">${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface p-3">
          <p className="text-[11px] text-muted-foreground">Invested</p>
          <p className="text-base font-mono">${investedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface p-3">
          <p className="text-[11px] text-muted-foreground">Total P/L</p>
          <p className={`text-base font-mono ${netPnL >= 0 ? "text-profit" : "text-loss"}`}>
            {netPnL >= 0 ? "+" : "-"}${Math.abs(netPnL).toLocaleString(undefined, { maximumFractionDigits: 2 })} ({netPnLPercent >= 0 ? "+" : ""}{netPnLPercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      {/* Risk analytics — promoted above portfolio listing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RiskAnalyticsCard />
        <Watchlist />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h3 className="text-sm text-muted-foreground mb-4 font-mono">Allocation</h3>
          <div className="min-h-48 sm:min-h-64 lg:min-h-75 flex items-center justify-center">
            {isLoading ? (
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Calculating allocation...</p>
              </div>
            ) : !hasPositions ? (
              <div className="text-center">
                <div className="w-48 h-48 mx-auto mb-4 rounded-full border-4 border-profit/30 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold">100%</p>
                    <p className="text-xs text-muted-foreground">CASH</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">Start trading to see your allocation</p>
              </div>
            ) : (
              <div className="w-full flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {(() => {
                      let cumulativePercentage = 0
                      const segments = []

                      for (const item of allocation) {
                        const startAngle = cumulativePercentage * 3.6
                        const endAngle = (cumulativePercentage + item.percentage) * 3.6
                        const largeArcFlag = item.percentage > 50 ? 1 : 0

                        const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                        const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                        const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
                        const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)

                        if (item.percentage > 0.5) {
                          segments.push(
                            <path
                              key={item.symbol}
                              d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
                              fill={item.color}
                              stroke="var(--color-surface)"
                              strokeWidth="1"
                            />,
                          )
                        }
                        cumulativePercentage += item.percentage
                      }

                      if (cashPercentage > 0.5) {
                        const startAngle = cumulativePercentage * 3.6
                        const largeArcFlag = cashPercentage > 50 ? 1 : 0

                        const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                        const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                        const endX = 50 + 40 * Math.cos((360 * Math.PI) / 180)
                        const endY = 50 + 40 * Math.sin((360 * Math.PI) / 180)

                        segments.push(
                          <path
                            key="cash"
                            d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
                            fill="oklch(0.45 0.03 270)"
                            stroke="var(--color-surface)"
                            strokeWidth="1"
                          />,
                        )
                      }

                      return segments
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl font-bold">
                        ${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground">Net Worth</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2 max-h-40 sm:max-h-50 overflow-y-auto">
                  {allocation.map((item) => (
                    <div key={item.symbol} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="text-xs">{item.symbol}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{item.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "oklch(0.45 0.03 270)" }} />
                      <span className="text-xs">CASH</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{cashPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h3 className="text-sm text-muted-foreground mb-4 font-mono">Performance</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 bg-surface-elevated rounded-lg border border-surface-border">
              <p className="text-xs text-muted-foreground mb-2">TOTAL P/L (REALIZED + UNREALIZED)</p>
              <p className={`text-2xl font-mono ${performance.totalReturn >= 0 ? "text-profit" : "text-loss"}`}>
                {performance.totalReturn >= 0 ? "+" : ""}
                {performance.totalReturnPercent.toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {performance.totalReturn >= 0 ? "+" : ""}${performance.totalReturn.toFixed(2)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-surface-elevated rounded-lg border border-surface-border">
                <p className="text-xs text-muted-foreground mb-1">BEST</p>
                <p className="text-sm font-bold">{performance.bestPerformer.symbol}</p>
                <p className={`text-xs font-mono mt-0.5 ${performance.bestPerformer.return >= 0 ? "text-profit" : "text-loss"}`}>
                  {performance.bestPerformer.symbol !== "--" ? (
                    <>{performance.bestPerformer.return >= 0 ? "+" : ""}{performance.bestPerformer.return.toFixed(2)}%</>
                  ) : "—"}
                </p>
              </div>
              <div className="p-3 bg-surface-elevated rounded-lg border border-surface-border">
                <p className="text-xs text-muted-foreground mb-1">WORST</p>
                <p className="text-sm font-bold">{performance.worstPerformer.symbol}</p>
                <p className={`text-xs font-mono mt-0.5 ${performance.worstPerformer.return >= 0 ? "text-profit" : "text-loss"}`}>
                  {performance.worstPerformer.symbol !== "--" ? (
                    <>{performance.worstPerformer.return >= 0 ? "+" : ""}{performance.worstPerformer.return.toFixed(2)}%</>
                  ) : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 bg-surface border border-surface-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-muted-foreground font-mono uppercase">Open Positions</h3>
          <Badge variant="secondary" className="text-xs">{openPositions.length} holdings</Badge>
        </div>

        {openPositions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No open positions yet. Buy from the trade panel and they will appear here.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {openPositions.map(({ symbol, pos, currentPrice, value, unrealized, unrealizedPct }) => {
              const { currencySymbol } = getMarketMeta(symbol)
              const qty = getSellQuantity(symbol, pos.quantity)
              const remainingAfterSell = pos.quantity - qty
              const isSelling = sellingSymbol === symbol

              return (
                <div key={symbol} className="rounded-lg border border-surface-border bg-surface-elevated p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm break-words">{symbol}</p>
                      <p className="text-xs text-muted-foreground">Qty {pos.quantity} • Avg {currencySymbol}{pos.avgPrice.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono">{currencySymbol}{value.toFixed(2)}</p>
                      <p className={`text-xs font-mono ${unrealized >= 0 ? "text-profit" : "text-loss"}`}>
                        {unrealized >= 0 ? "+" : "-"}{currencySymbol}{Math.abs(unrealized).toFixed(2)} ({unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(2)}%)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded border border-surface-border px-2 py-1.5">
                      <span className="block text-muted-foreground/70">Current</span>
                      <span className="font-mono text-foreground">{currencySymbol}{currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="rounded border border-surface-border px-2 py-1.5">
                      <span className="block text-muted-foreground/70">After sell</span>
                      <span className="font-mono text-foreground">{remainingAfterSell} shares</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-24 flex-1">
                      <label htmlFor={`sell-qty-${symbol}`} className="block text-[11px] text-muted-foreground mb-1">Sell Qty</label>
                      <Input
                        id={`sell-qty-${symbol}`}
                        type="number"
                        min={1}
                        max={pos.quantity}
                        value={qty}
                        onChange={(e) => {
                          const raw = Number.parseInt(e.target.value, 10)
                          setSellQuantity(prev => ({
                            ...prev,
                            [symbol]: Number.isNaN(raw) ? 1 : raw,
                          }))
                        }}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSellQuantity(prev => ({ ...prev, [symbol]: pos.quantity }))}
                      className="h-9"
                    >
                      Sell All
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" size="sm" className="h-9 bg-loss hover:bg-loss/90 text-white" disabled={isSelling}>
                          {isSelling ? "Selling..." : "Sell"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm sell order</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sell {qty} share{qty > 1 ? "s" : ""} of {symbol} at market price (~{currencySymbol}{currentPrice.toFixed(2)}).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleSellFromPortfolio(symbol)}
                            className="bg-loss text-white hover:bg-loss/90"
                          >
                            Confirm Sell
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mb-6">
        <AISessionInsights />
      </div>

      <div className="border border-surface-border rounded-lg p-4 bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Reset Account</h3>
            <p className="text-xs text-muted-foreground">Reset balance to $100,000 and delete all trades and progress.</p>
          </div>
          <AccountResetButton />
        </div>
      </div>
    </>
  )
}
