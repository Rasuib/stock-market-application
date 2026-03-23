"use client"

import DashboardStat from "@/components/dashboard/stat"
import TradingSimulator from "@/components/dashboard/trading-simulator"
import StockSearchPanel from "@/components/dashboard/stock-search-panel"
import TrendingUpIcon from "@/components/icons/trending-up"
import DollarSignIcon from "@/components/icons/dollar-sign"
import BarChartIcon from "@/components/icons/bar-chart"
import ActivityIcon from "@/components/icons/activity"
import TradeReviewCard from "@/components/dashboard/trade-review-card"
import AICoachPanel from "@/components/dashboard/ai-coach-panel"
import { useTradingStore } from "@/stores/trading-store"
import { useTradingStats } from "@/hooks/use-trading-stats"

const iconMap = {
  "dollar-sign": DollarSignIcon,
  "bar-chart": BarChartIcon,
  "trending-up": TrendingUpIcon,
  activity: ActivityIcon,
}

export default function TradingSimulatorView() {
  const positions = useTradingStore((s) => s.positions)
  const trades = useTradingStore((s) => s.trades)
  const tradingStats = useTradingStats()

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <StockSearchPanel />
        <TradingSimulator />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h3 className="text-sm text-muted-foreground mb-4">Trade Reviews</h3>
          {trades.length > 0 ? (
            <div className="space-y-3 max-h-80 sm:max-h-100 lg:max-h-125 overflow-y-auto">
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
                    currency={trade.currency}
                    execution={trade.execution}
                    thesis={trade.thesis}
                    expanded={false}
                  />
                ))}
            </div>
          ) : (
            <div className="h-32 sm:h-40 lg:h-50 flex items-center justify-center text-muted-foreground text-sm">
              No trades yet. Start trading to get coaching feedback!
            </div>
          )}
        </div>

        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h3 className="text-sm text-muted-foreground mb-4">Your Positions</h3>
          {Object.entries(positions).filter(([, pos]) => pos.quantity > 0).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(positions)
                .filter(([, pos]) => pos.quantity > 0)
                .map(([symbol, pos]) => (
                  <div key={symbol} className="p-4 bg-surface-elevated rounded-lg border border-surface-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">{symbol}</span>
                      <span className="text-profit text-sm font-mono">{pos.quantity} shares</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Avg Price</span>
                      <span className="font-mono">${pos.avgPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Value</span>
                      <span className="font-mono">${(pos.quantity * pos.avgPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="h-32 sm:h-40 lg:h-50 flex items-center justify-center text-muted-foreground text-sm">
              No open positions
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <AICoachPanel />
      </div>
    </>
  )
}
