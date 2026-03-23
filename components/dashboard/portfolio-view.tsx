"use client"

import { useEffect, useState } from "react"
import DashboardStat from "@/components/dashboard/stat"
import Watchlist from "@/components/dashboard/watchlist"
import RiskAnalyticsCard from "@/components/dashboard/risk-analytics-card"
import TrendingUpIcon from "@/components/icons/trending-up"
import DollarSignIcon from "@/components/icons/dollar-sign"
import BarChartIcon from "@/components/icons/bar-chart"
import ActivityIcon from "@/components/icons/activity"
import { useTradingStore } from "@/stores/trading-store"
import { useTradingStats } from "@/hooks/use-trading-stats"
import AISessionInsights from "@/components/dashboard/ai-session-insights"
import AccountResetButton from "@/components/dashboard/account-reset-button"

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
  const tradingStats = useTradingStats()

  const [allocation, setAllocation] = useState<
    { symbol: string; value: number; percentage: number; color: string; currentPrice: number }[]
  >([])
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

      let totalInvested = 0
      let currentValue = 0
      let bestReturn = Number.NEGATIVE_INFINITY
      let worstReturn = Number.POSITIVE_INFINITY
      let bestSymbol = "--"
      let worstSymbol = "--"

      for (const item of updatedAllocation) {
        const pos = positions[item.symbol]
        const invested = pos.quantity * pos.avgPrice
        totalInvested += invested
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

      const totalReturn = currentValue - totalInvested
      const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0

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

      {/* Risk analytics — promoted above portfolio listing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RiskAnalyticsCard />
        <Watchlist />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h3 className="text-sm text-muted-foreground mb-4 font-mono uppercase">Portfolio Allocation</h3>
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
                      <p className="text-xs text-muted-foreground">TOTAL</p>
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
          <h3 className="text-sm text-muted-foreground mb-4 font-mono uppercase">Portfolio Performance</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 bg-surface-elevated rounded-lg border border-surface-border">
              <p className="text-xs text-muted-foreground mb-2">TOTAL RETURN</p>
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

      <div className="mb-6">
        <AISessionInsights />
      </div>

      {/* Danger zone */}
      <div className="border border-destructive/20 rounded-lg p-4">
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
