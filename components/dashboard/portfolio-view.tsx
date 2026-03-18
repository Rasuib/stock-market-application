"use client"

import { useEffect, useState } from "react"
import DashboardStat from "@/components/dashboard/stat"
import Watchlist from "@/components/dashboard/watchlist"
import TrendingUpIcon from "@/components/icons/trending-up"
import DollarSignIcon from "@/components/icons/dollar-sign"
import BarChartIcon from "@/components/icons/bar-chart"
import ActivityIcon from "@/components/icons/activity"

const iconMap = {
  "dollar-sign": DollarSignIcon,
  "bar-chart": BarChartIcon,
  "trending-up": TrendingUpIcon,
  activity: ActivityIcon,
}

interface Position {
  quantity: number
  avgPrice: number
}

interface Trade {
  symbol: string
  type: "buy" | "sell"
  quantity: number
  price: number
  timestamp: string
  profit?: number
}

interface PortfolioViewProps {
  tradingStats: { label: string; value: string; description: string; icon: string; tag: string; intent: "positive" | "negative" | "neutral"; direction: "up" | "down" }[]
  watchlist: {
    symbol: string
    name: string
    price: string
    change: string
    isPositive: boolean
    sector?: string
    market?: string
  }[]
  addToWatchlist: (stock: { symbol: string; name: string; price: string; change: string; isPositive: boolean; sector?: string; market?: string }) => boolean
  removeFromWatchlist: (symbol: string) => void
  positions: { [key: string]: Position | number }
  balance: number
  tradeHistory: Trade[]
}

const normalizePosition = (pos: Position | number): Position => {
  if (typeof pos === "number") {
    return { quantity: pos, avgPrice: 0 }
  }
  return pos
}

const COLORS = ["#00ff88", "#00d4ff", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff8fab", "#a855f7"]

export default function PortfolioView({
  tradingStats,
  watchlist,
  addToWatchlist,
  removeFromWatchlist,
  positions,
  balance,
  tradeHistory,
}: PortfolioViewProps) {
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

      // Fetch all prices in parallel instead of sequentially
      const activePositions = positionEntries
        .map(([symbol, pos]) => ({ symbol, pos: normalizePosition(pos) }))
        .filter(({ pos }) => pos.quantity > 0)

      const priceResults = await Promise.allSettled(
        activePositions.map(({ symbol }) =>
          fetch(`/api/stock/${symbol}?t=${Date.now()}`).then(res => res.json())
        )
      )

      activePositions.forEach(({ symbol, pos }, index) => {
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

      // Calculate percentages
      const updatedAllocation = allocationData.map((item) => ({
        ...item,
        percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
      }))

      // Add cash allocation
      const cashPercentage = totalValue > 0 ? (balance / totalValue) * 100 : 100

      setAllocation(updatedAllocation)

      // Calculate performance metrics
      let totalInvested = 0
      let currentValue = 0
      let bestReturn = Number.NEGATIVE_INFINITY
      let worstReturn = Number.POSITIVE_INFINITY
      let bestSymbol = "--"
      let worstSymbol = "--"

      for (const item of updatedAllocation) {
        const pos = normalizePosition(positions[item.symbol])
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

    // Refresh every 10 seconds
    const interval = setInterval(calculateAllocation, 10000)
    return () => clearInterval(interval)
  }, [positions, balance])

  const cashPercentage = totalPortfolioValue > 0 ? (balance / totalPortfolioValue) * 100 : 100
  const hasPositions = allocation.length > 0

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Watchlist watchlist={watchlist} removeFromWatchlist={removeFromWatchlist} />
        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
          <h3 className="font-mono text-sm text-[#00ff88] mb-4">PORTFOLIO ALLOCATION</h3>
          <div className="h-[300px] flex items-center justify-center">
            {isLoading ? (
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="font-mono text-gray-500 text-sm">Calculating allocation...</p>
              </div>
            ) : !hasPositions ? (
              <div className="text-center">
                <div className="w-48 h-48 mx-auto mb-4 rounded-full border-4 border-[#00ff88]/30 flex items-center justify-center">
                  <div className="text-center">
                    <p className="font-mono text-3xl text-white font-bold">100%</p>
                    <p className="font-mono text-xs text-gray-400">CASH</p>
                  </div>
                </div>
                <p className="font-mono text-gray-500 text-sm">Start trading to see your allocation</p>
              </div>
            ) : (
              <div className="w-full flex items-center gap-6">
                {/* Pie chart visualization */}
                <div className="relative w-48 h-48 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {(() => {
                      let cumulativePercentage = 0
                      const segments = []

                      // Add stock segments
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
                              stroke="#1a1a2e"
                              strokeWidth="1"
                            />,
                          )
                        }
                        cumulativePercentage += item.percentage
                      }

                      // Add cash segment
                      if (cashPercentage > 0.5) {
                        const startAngle = cumulativePercentage * 3.6
                        const endAngle = 360
                        const largeArcFlag = cashPercentage > 50 ? 1 : 0

                        const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                        const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                        const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
                        const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)

                        segments.push(
                          <path
                            key="cash"
                            d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
                            fill="#4a4a6a"
                            stroke="#1a1a2e"
                            strokeWidth="1"
                          />,
                        )
                      }

                      return segments
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="font-mono text-xl text-white font-bold">
                        ${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className="font-mono text-xs text-gray-400">TOTAL</p>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2 max-h-[200px] overflow-y-auto">
                  {allocation.map((item) => (
                    <div key={item.symbol} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="font-mono text-xs text-white">{item.symbol}</span>
                      </div>
                      <span className="font-mono text-xs text-gray-400">{item.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#4a4a6a]" />
                      <span className="font-mono text-xs text-white">CASH</span>
                    </div>
                    <span className="font-mono text-xs text-gray-400">{cashPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4 mb-6">
        <h3 className="font-mono text-sm text-[#00ff88] mb-4">PORTFOLIO PERFORMANCE</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
            <p className="font-mono text-gray-400 text-xs mb-2">TOTAL RETURN</p>
            <p className={`font-mono text-2xl ${performance.totalReturn >= 0 ? "text-[#00ff88]" : "text-[#ff6b6b]"}`}>
              {performance.totalReturn >= 0 ? "+" : ""}
              {performance.totalReturnPercent.toFixed(2)}%
            </p>
            <p className="font-mono text-gray-500 text-xs mt-1">
              {performance.totalReturn >= 0 ? "+" : ""}${performance.totalReturn.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
            <p className="font-mono text-gray-400 text-xs mb-2">BEST PERFORMER</p>
            <p className="font-mono text-xl text-white">{performance.bestPerformer.symbol}</p>
            <p
              className={`font-mono text-xs mt-1 ${performance.bestPerformer.return >= 0 ? "text-[#00ff88]" : "text-[#ff6b6b]"}`}
            >
              {performance.bestPerformer.symbol !== "--" ? (
                <>
                  {performance.bestPerformer.return >= 0 ? "+" : ""}
                  {performance.bestPerformer.return.toFixed(2)}%
                </>
              ) : (
                "No trades yet"
              )}
            </p>
          </div>
          <div className="p-4 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
            <p className="font-mono text-gray-400 text-xs mb-2">WORST PERFORMER</p>
            <p className="font-mono text-xl text-white">{performance.worstPerformer.symbol}</p>
            <p
              className={`font-mono text-xs mt-1 ${performance.worstPerformer.return >= 0 ? "text-[#00ff88]" : "text-[#ff6b6b]"}`}
            >
              {performance.worstPerformer.symbol !== "--" ? (
                <>
                  {performance.worstPerformer.return >= 0 ? "+" : ""}
                  {performance.worstPerformer.return.toFixed(2)}%
                </>
              ) : (
                "No trades yet"
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
        <h3 className="font-mono text-sm text-[#00ff88] mb-4">TRADING TIPS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#00ff88]" />
              <p className="font-mono text-white text-sm">Diversification</p>
            </div>
            <p className="font-mono text-gray-400 text-xs">
              Spread investments across sectors and markets to reduce risk. A balanced portfolio typically holds 10-15 positions.
            </p>
          </div>
          <div className="p-4 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#00ff88]" />
              <p className="font-mono text-white text-sm">Risk Management</p>
            </div>
            <p className="font-mono text-gray-400 text-xs">
              Never invest more than you can afford to lose. Use the sentiment and trend signals to make informed decisions.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
