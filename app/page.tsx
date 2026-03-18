"use client"

import { useState, useMemo } from "react"
import DashboardPageLayout from "@/components/dashboard/layout"
import DashboardStat from "@/components/dashboard/stat"
import StockSearchPanel from "@/components/dashboard/stock-search-panel"
import TradingSimulator from "@/components/dashboard/trading-simulator"
import Notifications from "@/components/dashboard/notifications"
import TrendingUpIcon from "@/components/icons/trending-up"
import DollarSignIcon from "@/components/icons/dollar-sign"
import BarChartIcon from "@/components/icons/bar-chart"
import ActivityIcon from "@/components/icons/activity"
import MarketNewsView from "@/components/dashboard/market-news-view"
import StockAnalysisView from "@/components/dashboard/stock-analysis-view"
import TradingSimulatorView from "@/components/dashboard/trading-simulator-view"
import PortfolioView from "@/components/dashboard/portfolio-view"
import { useNavigation } from "@/components/dashboard/navigation-context"
import { useNotifications } from "@/contexts/notification-context"
import { useTradingState } from "@/hooks/use-trading-state"
import type { Notification } from "@/types/dashboard"
import type { TradeWithCoaching } from "@/lib/coaching/types"
import { generateLearningSummary } from "@/lib/coaching"
import TradeReviewCard from "@/components/dashboard/trade-review-card"

const iconMap = {
  "dollar-sign": DollarSignIcon,
  "bar-chart": BarChartIcon,
  "trending-up": TrendingUpIcon,
  activity: ActivityIcon,
}

interface SelectedStock {
  symbol: string
  price: number
  name: string
  market?: string
}

export default function TradiaOverview() {
  const [selectedStock, setSelectedStock] = useState<SelectedStock | null>(null)
  const [previousStock, setPreviousStock] = useState<SelectedStock | null>(null)

  const { notifications, clearAll, deleteNotification, markAsRead, addNotification } = useNotifications()

  const {
    balance, positions, trades,
    updateBalance, updatePositions, updateTrades,
    activePositionCount, initialBalance, normalizePosition,
  } = useTradingState()

  // Use the coaching pipeline's learning summary for the stat card
  const coachingSummary = useMemo(() => generateLearningSummary(trades), [trades])
  const currentGrade = coachingSummary.grade
  const gradeIntent: "positive" | "neutral" | "negative" =
    ["S", "A"].includes(currentGrade) ? "positive" :
    ["B", "C"].includes(currentGrade) ? "neutral" : "negative"

  const [watchlist, setWatchlist] = useState<
    {
      symbol: string
      name: string
      price: string
      change: string
      isPositive: boolean
      sector?: string
      market?: string
    }[]
  >([])

  const addToWatchlist = (stock: {
    symbol: string
    name: string
    price: string
    change: string
    isPositive: boolean
    sector?: string
    market?: string
  }) => {
    if (watchlist.some((item) => item.symbol === stock.symbol)) {
      return false
    }
    setWatchlist((prev) => [...prev, stock])
    return true
  }

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist((prev) => prev.filter((stock) => stock.symbol !== symbol))
  }

  // Calculate portfolio value from actual position data
  const calculatePortfolioValue = () => {
    let positionsValue = 0
    Object.entries(positions).forEach(([symbol, positionData]) => {
      const { quantity, avgPrice } = normalizePosition(positionData)
      if (quantity <= 0) return

      // Use live price if viewing that stock, otherwise use avgPrice as estimate
      const currentPrice = (selectedStock?.symbol === symbol) ? selectedStock.price : avgPrice
      positionsValue += quantity * currentPrice
    })
    return balance + positionsValue
  }

  const portfolioValue = calculatePortfolioValue()
  const portfolioChange = portfolioValue - initialBalance
  const portfolioChangePercent = ((portfolioChange / initialBalance) * 100).toFixed(2)

  type StatIntent = "positive" | "negative" | "neutral"
  type StatDirection = "up" | "down"

  const tradingStats: { label: string; value: string; description: string; icon: string; tag: string; intent: StatIntent; direction: StatDirection }[] = [
    {
      label: "Virtual Portfolio",
      value: `$${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      description: `${portfolioChangePercent}% from initial`,
      icon: "dollar-sign",
      tag: `${portfolioChange >= 0 ? "+" : ""}${portfolioChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      intent: portfolioChange >= 0 ? "positive" : "negative",
      direction: portfolioChange >= 0 ? "up" : "down",
    },
    {
      label: "Active Positions",
      value: activePositionCount.toString(),
      description: "Across US & Indian markets",
      icon: "bar-chart",
      tag: activePositionCount > 0 ? `${activePositionCount} open` : "No positions",
      intent: activePositionCount > 0 ? "positive" : "neutral",
      direction: activePositionCount > 0 ? "up" : "down",
    },
    {
      label: "Total Trades",
      value: trades.length.toString(),
      description: "Simulated trades executed",
      icon: "trending-up",
      tag: trades.length > 0 ? `${trades.length} completed` : "Start trading",
      intent: trades.length > 0 ? "positive" : "neutral",
      direction: trades.length > 0 ? "up" : "down",
    },
    {
      label: "Learning Grade",
      value: currentGrade,
      description: `Avg Reward: ${coachingSummary.score >= 0 ? "+" : ""}${coachingSummary.score.toFixed(1)}`,
      icon: "activity",
      tag: trades.length > 0 ? `${coachingSummary.trajectory}` : "Start trading",
      intent: gradeIntent,
      direction: coachingSummary.trajectory === "improving" ? "up" : coachingSummary.trajectory === "declining" ? "down" : "up",
    },
  ]

  const { currentView } = useNavigation()

  const handleStockSelect = (stock: SelectedStock | null) => {
    if (stock && selectedStock && stock.symbol !== selectedStock.symbol) {
      setPreviousStock(selectedStock)
    }
    setSelectedStock(stock)
  }

  const renderActiveView = () => {
    switch (currentView) {
      case "analysis":
        return (
          <StockAnalysisView
            selectedStock={selectedStock}
            onStockSelect={handleStockSelect}
            onNotification={addNotification}
            balance={balance}
            setBalance={updateBalance}
            positions={positions}
            setPositions={updatePositions}
            trades={trades}
            setTrades={updateTrades}
            addToWatchlist={addToWatchlist}
            previousStock={previousStock}
          />
        )
      case "portfolio":
        return (
          <PortfolioView
            tradingStats={tradingStats}
            watchlist={watchlist}
            addToWatchlist={addToWatchlist}
            removeFromWatchlist={removeFromWatchlist}
            positions={positions}
            balance={balance}
            tradeHistory={trades}
          />
        )
      case "news":
        return <MarketNewsView />
      case "simulator":
        return (
          <TradingSimulatorView
            selectedStock={selectedStock}
            onStockSelect={handleStockSelect}
            onNotification={addNotification}
            balance={balance}
            setBalance={updateBalance}
            positions={positions}
            setPositions={updatePositions}
            trades={trades}
            setTrades={updateTrades}
            tradingStats={tradingStats}
            previousStock={previousStock}
          />
        )
      default:
        return (
          <DashboardView
            selectedStock={selectedStock}
            onStockSelect={handleStockSelect}
            onNotification={addNotification}
            balance={balance}
            setBalance={updateBalance}
            positions={positions}
            setPositions={updatePositions}
            trades={trades}
            setTrades={updateTrades}
            tradingStats={tradingStats}
            addToWatchlist={addToWatchlist}
            previousStock={previousStock}
          />
        )
    }
  }

  return (
    <DashboardPageLayout
      header={{
        title: getViewTitle(currentView),
        description: getViewDescription(currentView),
        icon: getViewIcon(currentView),
      }}
      sidebar={
        <Notifications
          initialNotifications={notifications}
          notifications={notifications}
          onClearAll={clearAll}
          onDelete={deleteNotification}
          onMarkAsRead={markAsRead}
        />
      }
    >
      {renderActiveView()}
    </DashboardPageLayout>
  )
}

function getViewTitle(view: string) {
  switch (view) {
    case "analysis":
      return "Stock Analysis"
    case "portfolio":
      return "Portfolio Management"
    case "news":
      return "Market News"
    case "simulator":
      return "Trading Simulator"
    default:
      return "Market Overview"
  }
}

function getViewDescription(view: string) {
  switch (view) {
    case "analysis":
      return "Sentiment analysis and trend signals"
    case "portfolio":
      return "Manage your simulated portfolio"
    case "news":
      return "Latest market news and sentiment"
    case "simulator":
      return "Practice trading with virtual money"
    default:
      return "Search, analyze, and trade stocks"
  }
}

function getViewIcon(view: string) {
  switch (view) {
    case "analysis":
      return TrendingUpIcon
    case "portfolio":
      return DollarSignIcon
    case "news":
      return ActivityIcon
    case "simulator":
      return BarChartIcon
    default:
      return TrendingUpIcon
  }
}

function DashboardView({
  selectedStock,
  onStockSelect,
  onNotification,
  balance,
  setBalance,
  positions,
  setPositions,
  trades,
  setTrades,
  tradingStats,
  addToWatchlist,
  previousStock,
}: {
  selectedStock: SelectedStock | null
  onStockSelect: (stock: SelectedStock | null) => void
  onNotification: (notification: Omit<Notification, "id">) => void
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
  tradingStats: { label: string; value: string; description: string; icon: string; tag: string; intent: "positive" | "negative" | "neutral"; direction: "up" | "down" }[]
  addToWatchlist: (stock: { symbol: string; name: string; price: string; change: string; isPositive: boolean; sector?: string; market?: string }) => boolean
  previousStock: SelectedStock | null
}) {
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
        <StockSearchPanel onStockSelect={onStockSelect} addToWatchlist={addToWatchlist} previousStock={previousStock} />
        <TradingSimulator
          selectedStock={selectedStock}
          onNotification={onNotification}
          balance={balance}
          setBalance={setBalance}
          positions={positions}
          setPositions={setPositions}
          trades={trades}
          setTrades={setTrades}
        />
      </div>

      {/* Coaching Insights Section */}
      <DashboardCoachingInsights trades={trades} />
    </>
  )
}

function DashboardCoachingInsights({ trades }: { trades: TradeWithCoaching[] }) {
  const summary = generateLearningSummary(trades)

  if (trades.length === 0) {
    return (
      <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-6 text-center">
        <p className="text-gray-400 font-mono text-sm mb-2">No trades yet</p>
        <p className="text-gray-500 text-xs">Search for a stock above and place your first simulated trade to get coaching feedback.</p>
      </div>
    )
  }

  const recentTrades = trades.slice(-5).reverse()

  return (
    <div className="space-y-6">
      {/* Focus area + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
          <h3 className="font-mono text-sm text-[#00ff88] mb-3">YOUR FOCUS AREA</h3>
          <p className="text-gray-300 text-sm mb-4">{summary.focusArea}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
              <p className="font-mono text-gray-400 text-xs mb-1">GRADE</p>
              <p className="font-mono text-2xl text-white">{summary.grade}</p>
              <p className={`font-mono text-xs mt-1 ${
                summary.trajectory === "improving" ? "text-green-400" :
                summary.trajectory === "declining" ? "text-red-400" :
                "text-gray-500"
              }`}>{summary.trajectory}</p>
            </div>
            <div className="p-3 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
              <p className="font-mono text-gray-400 text-xs mb-1">AVG REWARD</p>
              <p className={`font-mono text-2xl ${summary.score >= 0 ? "text-green-400" : "text-red-400"}`}>
                {summary.score >= 0 ? "+" : ""}{summary.score}
              </p>
              <p className="font-mono text-xs text-gray-500 mt-1">{summary.totalTrades} trades</p>
            </div>
            <div className="p-3 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
              <p className="font-mono text-gray-400 text-xs mb-1">WIN RATE</p>
              <p className={`font-mono text-2xl ${summary.winRate >= 50 ? "text-green-400" : summary.winRate > 0 ? "text-amber-400" : "text-gray-400"}`}>
                {summary.winRate}%
              </p>
              <p className={`font-mono text-xs mt-1 ${summary.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                {summary.totalPnL >= 0 ? "+" : ""}{summary.totalPnL.toFixed(0)} P&L
              </p>
            </div>
          </div>
          {/* Skill bars (recency-weighted) */}
          <div className="mt-4 space-y-2">
            {[
              { label: "Signal Alignment", value: summary.recentComponentAverages.alignment },
              { label: "Risk Management", value: summary.recentComponentAverages.risk },
              { label: "Discipline", value: summary.recentComponentAverages.discipline },
              { label: "Outcomes", value: summary.recentComponentAverages.outcome },
              { label: "Learning", value: summary.recentComponentAverages.learning },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${value >= 0 ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, Math.abs(value) * 100)}%` }}
                  />
                </div>
                <span className={`text-xs w-8 text-right font-mono ${value >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {value >= 0 ? "+" : ""}{(value * 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
          {/* Always show strengths/weaknesses alongside recurring patterns */}
          {summary.recurringMistakes.length > 0 && (
            <div className="mb-4">
              <h3 className="font-mono text-sm text-amber-400 mb-3">RECURRING PATTERNS</h3>
              <div className="space-y-2">
                {summary.recurringMistakes.map((mistake, i) => (
                  <div key={i} className="p-3 bg-[#0d0d1a] rounded-lg border border-amber-500/20">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-amber-400 text-sm font-semibold">{mistake.description}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono ${
                          mistake.trend === "increasing" ? "text-red-400" :
                          mistake.trend === "decreasing" ? "text-green-400" :
                          "text-gray-500"
                        }`}>
                          {mistake.trend === "increasing" ? "GETTING WORSE" :
                           mistake.trend === "decreasing" ? "IMPROVING" : ""}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">{mistake.count}x</span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-xs">{mistake.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="font-mono text-sm text-[#00ff88] mb-3">SKILL PROFILE</h3>
          <div className="space-y-2">
            {summary.strengths.length > 0 && (
              <div className="p-3 bg-[#0d0d1a] rounded-lg border border-green-500/20">
                <p className="text-green-400 text-xs font-semibold mb-1">STRENGTHS</p>
                <p className="text-gray-300 text-sm">{summary.strengths.map(s => s.replace(/_/g, " ")).join(", ")}</p>
              </div>
            )}
            {summary.weaknesses.length > 0 && (
              <div className="p-3 bg-[#0d0d1a] rounded-lg border border-red-500/20">
                <p className="text-red-400 text-xs font-semibold mb-1">AREAS TO IMPROVE</p>
                <p className="text-gray-300 text-sm">{summary.weaknesses.map(s => s.replace(/_/g, " ")).join(", ")}</p>
              </div>
            )}
            {summary.strengths.length === 0 && summary.weaknesses.length === 0 && summary.recurringMistakes.length === 0 && (
              <p className="text-gray-500 text-sm">Keep trading to build enough data for pattern analysis.</p>
            )}
          </div>

          {/* Trajectory detail */}
          {summary.trajectoryDetail && summary.totalTrades >= 4 && (
            <div className="mt-3 p-3 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
              <p className="text-gray-400 text-xs">{summary.trajectoryDetail}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent trade reviews */}
      {recentTrades.length > 0 && (
        <div>
          <h3 className="font-mono text-sm text-[#00ff88] mb-3">RECENT TRADE REVIEWS</h3>
          <div className="space-y-3">
            {recentTrades.map((trade) => (
              <TradeReviewCard
                key={trade.id}
                coaching={trade.coaching}
                action={trade.type}
                symbol={trade.symbol}
                quantity={trade.quantity}
                price={trade.price}
                currency={trade.currency}
                expanded={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
