"use client"

import DashboardStat from "@/components/dashboard/stat"
import TradingSimulator from "@/components/dashboard/trading-simulator"
import StockSearchPanel from "@/components/dashboard/stock-search-panel"
import TrendingUpIcon from "@/components/icons/trending-up"
import DollarSignIcon from "@/components/icons/dollar-sign"
import BarChartIcon from "@/components/icons/bar-chart"
import ActivityIcon from "@/components/icons/activity"
import type { Notification } from "@/types/dashboard"
import type { TradeWithCoaching } from "@/lib/coaching/types"
import TradeReviewCard from "@/components/dashboard/trade-review-card"

const iconMap = {
  "dollar-sign": DollarSignIcon,
  "bar-chart": BarChartIcon,
  "trending-up": TrendingUpIcon,
  activity: ActivityIcon,
}

interface TradingSimulatorViewProps {
  selectedStock: {
    symbol: string
    price: number
    name: string
    market?: string
  } | null
  onStockSelect: (stock: { symbol: string; price: number; name: string; market?: string } | null) => void
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
  previousStock?: {
    symbol: string
    price: number
    name: string
    market?: string
  } | null
}

export default function TradingSimulatorView({
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
  previousStock,
}: TradingSimulatorViewProps) {
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
        <StockSearchPanel onStockSelect={onStockSelect} addToWatchlist={() => false} previousStock={previousStock} />
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

      {previousStock && selectedStock && previousStock.symbol !== selectedStock.symbol && (
        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4 mb-6">
          <h3 className="font-mono text-sm text-gray-400 mb-4">STOCK COMPARISON</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-[#0d0d1a] rounded-lg border border-[#00ff88]/30">
              <p className="font-mono text-xs text-[#00ff88] mb-1">CURRENT</p>
              <p className="font-mono text-white text-lg">{selectedStock.symbol}</p>
              <p className="font-mono text-[#00ff88]">
                {selectedStock.market === "IN" ? "₹" : "$"}
                {selectedStock.price.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-[#0d0d1a] rounded-lg border border-amber-500/30">
              <p className="font-mono text-xs text-amber-400 mb-1">PREVIOUS</p>
              <p className="font-mono text-white text-lg">{previousStock.symbol}</p>
              <p className="font-mono text-amber-400">
                {previousStock.market === "IN" ? "₹" : "$"}
                {previousStock.price.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
          <h3 className="font-mono text-sm text-[#00ff88] mb-4">TRADE REVIEWS</h3>
          {trades.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {trades
                .slice()
                .reverse()
                .slice(0, 10)
                .map((trade) => (
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
          ) : (
            <div className="h-50 flex items-center justify-center text-gray-500 font-mono text-sm">
              No trades yet. Start trading to get coaching feedback!
            </div>
          )}
        </div>

        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
          <h3 className="font-mono text-sm text-[#00ff88] mb-4">YOUR POSITIONS</h3>
          {Object.entries(positions).filter(([_, pos]) => pos.quantity > 0).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(positions)
                .filter(([_, pos]) => pos.quantity > 0)
                .map(([symbol, pos]) => (
                  <div key={symbol} className="p-4 bg-[#0d0d1a] rounded-lg border border-[#2d2d44]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-white font-bold">{symbol}</span>
                      <span className="font-mono text-[#00ff88] text-sm">{pos.quantity} shares</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-gray-400">Avg Price</span>
                      <span className="font-mono text-white">${pos.avgPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-gray-400">Total Value</span>
                      <span className="font-mono text-white">${(pos.quantity * pos.avgPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500 font-mono text-sm">
              No open positions
            </div>
          )}
        </div>
      </div>
    </>
  )
}
