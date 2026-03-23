"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingDown, Target, Shield, Activity } from "lucide-react"
import { useTradingStore, INITIAL_BALANCE } from "@/stores/trading-store"
import { computeRiskMetrics, type RiskMetrics } from "@/lib/risk-analytics"

function MetricRow({ label, value, suffix, intent }: {
  label: string
  value: string
  suffix?: string
  intent?: "profit" | "loss" | "neutral"
}) {
  const color = intent === "profit" ? "text-profit" : intent === "loss" ? "text-loss" : "text-foreground"
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-bold ${color}`}>
        {value}{suffix && <span className="text-muted-foreground font-normal ml-0.5">{suffix}</span>}
      </span>
    </div>
  )
}

export default function RiskAnalyticsCard() {
  const trades = useTradingStore((s) => s.trades)
  const balance = useTradingStore((s) => s.balance)

  const metrics: RiskMetrics = useMemo(
    () => computeRiskMetrics(trades, INITIAL_BALANCE),
    [trades]
  )

  const portfolioReturn = ((balance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-chart-4" />
            Risk Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center text-sm text-muted-foreground">
            Complete some trades to see your risk metrics.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-chart-4" />
          Risk Analytics
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Based on {metrics.totalSells} closed trade{metrics.totalSells !== 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Portfolio Return */}
        <div className="p-3 bg-surface rounded-lg border border-surface-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-chart-4" />
              <span className="text-sm font-medium">Portfolio Return</span>
            </div>
            <span className={`text-lg font-mono font-bold ${portfolioReturn >= 0 ? "text-profit" : "text-loss"}`}>
              {portfolioReturn >= 0 ? "+" : ""}{portfolioReturn.toFixed(2)}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            vs. starting balance of ${INITIAL_BALANCE.toLocaleString()}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="divide-y divide-border">
          <MetricRow
            label="Win Rate"
            value={`${metrics.winRate}%`}
            intent={metrics.winRate >= 50 ? "profit" : metrics.winRate > 0 ? "loss" : "neutral"}
          />
          <MetricRow
            label="Average Win"
            value={`$${metrics.averageWin.toFixed(2)}`}
            intent="profit"
          />
          <MetricRow
            label="Average Loss"
            value={`$${Math.abs(metrics.averageLoss).toFixed(2)}`}
            intent="loss"
          />
          <MetricRow
            label="Reward:Risk Ratio"
            value={metrics.rewardRiskRatio.toFixed(2)}
            suffix="x"
            intent={metrics.rewardRiskRatio >= 1 ? "profit" : "loss"}
          />
          <MetricRow
            label="Max Drawdown"
            value={`${metrics.maxDrawdown.toFixed(2)}%`}
            intent={metrics.maxDrawdown > -10 ? "neutral" : "loss"}
          />
          <MetricRow
            label="Sizing Consistency"
            value={metrics.positionSizingConsistency.toFixed(3)}
            intent="neutral"
          />
        </div>

        {/* Quick interpretation */}
        <div className="flex flex-wrap gap-1.5">
          {metrics.winRate >= 55 && (
            <Badge variant="outline" className="text-[10px] text-profit border-profit/30">
              <Target className="w-3 h-3 mr-1" />
              Positive win rate
            </Badge>
          )}
          {metrics.rewardRiskRatio >= 1.5 && (
            <Badge variant="outline" className="text-[10px] text-profit border-profit/30">
              <Shield className="w-3 h-3 mr-1" />
              Good R:R ratio
            </Badge>
          )}
          {metrics.maxDrawdown < -15 && (
            <Badge variant="outline" className="text-[10px] text-loss border-loss/30">
              <TrendingDown className="w-3 h-3 mr-1" />
              High drawdown
            </Badge>
          )}
          {metrics.positionSizingConsistency > 0.1 && (
            <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
              Inconsistent sizing
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
