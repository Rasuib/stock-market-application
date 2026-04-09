"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Activity, TrendingUp, TrendingDown, Minus, BarChart3, Gauge,
  ArrowUpCircle, ArrowDownCircle, AlertTriangle, Zap, Info,
} from "lucide-react"
import { useTradingStore } from "@/stores/trading-store"
import type { IndicatorSnapshot } from "@/lib/indicators"

function SignalBadge({ direction }: { direction: "bullish" | "bearish" | "neutral" }) {
  if (direction === "bullish") {
    return (
      <Badge className="bg-success/20 text-success border-success/30 gap-1">
        <TrendingUp className="w-3 h-3" /> Bullish
      </Badge>
    )
  }
  if (direction === "bearish") {
    return (
      <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
        <TrendingDown className="w-3 h-3" /> Bearish
      </Badge>
    )
  }
  return (
    <Badge className="bg-muted/20 text-muted-foreground border-muted/30 gap-1">
      <Minus className="w-3 h-3" /> Neutral
    </Badge>
  )
}

function GaugeBar({ value, min, max, zones }: {
  value: number
  min: number
  max: number
  zones: { from: number; to: number; color: string }[]
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  return (
    <div className="relative h-3 w-full rounded-full overflow-hidden bg-surface">
      {/* Zone backgrounds */}
      {zones.map((zone, i) => {
        const left = ((zone.from - min) / (max - min)) * 100
        const width = ((zone.to - zone.from) / (max - min)) * 100
        return (
          <div
            key={i}
            className="absolute top-0 h-full opacity-30"
            style={{ left: `${left}%`, width: `${width}%`, backgroundColor: zone.color }}
          />
        )
      })}
      {/* Needle */}
      <div
        className="absolute top-0 h-full w-1 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.6)] transition-all duration-500"
        style={{ left: `calc(${pct}% - 2px)` }}
      />
    </div>
  )
}

function MetricInfo({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="What does this metric mean?"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="max-w-64 leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function IndicatorRow({ label, value, signal, icon: Icon, helpText }: {
  label: string
  value: string
  signal: "bullish" | "bearish" | "neutral"
  icon: React.ElementType
  helpText: string
}) {
  const color = signal === "bullish" ? "text-success" : signal === "bearish" ? "text-destructive" : "text-muted-foreground"

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="font-mono text-xs text-foreground/80">{label}</span>
        <MetricInfo text={helpText} />
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-sm font-semibold ${color}`}>{value}</span>
        <SignalBadge direction={signal} />
      </div>
    </div>
  )
}

export default function TechnicalIndicatorsPanel() {
  const selectedStock = useTradingStore((s) => s.selectedStock)
  const [indicators, setIndicators] = useState<IndicatorSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchIndicators = useCallback(async () => {
    if (!selectedStock) return
    setLoading(true)
    try {
      const res = await fetch(`/api/stock/${selectedStock.symbol}/chart?range=3M`)
      const data = await res.json()
      if (data.indicators) {
        setIndicators(data.indicators)
      }
    } catch {
      // Indicators unavailable
    } finally {
      setLoading(false)
    }
  }, [selectedStock])

  useEffect(() => {
    setIndicators(null)
    fetchIndicators()
  }, [fetchIndicators])

  if (!selectedStock) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-mono">Select a stock to view technical analysis</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="w-8 h-8 text-chart-2 mx-auto mb-3 animate-pulse" />
          <p className="text-muted-foreground text-sm font-mono">Computing indicators...</p>
        </CardContent>
      </Card>
    )
  }

  if (!indicators) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-mono">Not enough data for analysis</p>
          <p className="text-muted-foreground text-xs font-mono mt-1">Need at least 35 price points</p>
        </CardContent>
      </Card>
    )
  }

  const { rsi, macd, bollinger, atr, stochastic, sma20, ema12, ema26, overallSignal } = indicators

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-chart-2 flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5" />
            Technical Analysis
          </CardTitle>
          <Badge variant="outline" className="text-[11px] text-muted-foreground border-border">
            {selectedStock.symbol}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Signal */}
        <div className={`p-4 rounded-lg border ${
          overallSignal.direction === "bullish"
            ? "bg-success/5 border-success/30"
            : overallSignal.direction === "bearish"
            ? "bg-destructive/5 border-destructive/30"
            : "bg-muted/5 border-muted/30"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">OVERALL SIGNAL</span>
              <MetricInfo text="Weighted consensus across RSI, MACD, Bollinger, Stochastic, and SMA trend. Confidence reflects how much indicator coverage is available." />
            </div>
            <SignalBadge direction={overallSignal.direction} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
                <span>Strong Bearish</span>
                <span>Neutral</span>
                <span>Strong Bullish</span>
              </div>
              <GaugeBar
                value={
                  overallSignal.direction === "bullish" ? 50 + overallSignal.strength * 50
                  : overallSignal.direction === "bearish" ? 50 - overallSignal.strength * 50
                  : 50
                }
                min={0}
                max={100}
                zones={[
                  { from: 0, to: 25, color: "#ef4444" },
                  { from: 25, to: 40, color: "#f59e0b" },
                  { from: 40, to: 60, color: "#6b7280" },
                  { from: 60, to: 75, color: "#22d3ee" },
                  { from: 75, to: 100, color: "#10b981" },
                ]}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-muted-foreground">
            <span>Confidence: {(overallSignal.confidence * 100).toFixed(0)}%</span>
            <span>{overallSignal.signals.length} indicators contributing</span>
          </div>
        </div>

        {/* Individual Indicators */}
        <div className="space-y-1 divide-y divide-border">
          {/* RSI */}
          {rsi && (
            <div className="py-3">
              <IndicatorRow
                label="RSI (14)"
                value={rsi.value.toFixed(1)}
                signal={rsi.signal === "overbought" ? "bearish" : rsi.signal === "oversold" ? "bullish" : "neutral"}
                icon={Gauge}
                helpText="Relative Strength Index (0-100). Above 70 is typically overbought, below 30 is oversold. It measures momentum, not guaranteed reversals."
              />
              <div className="mt-2">
                <GaugeBar
                  value={rsi.value}
                  min={0}
                  max={100}
                  zones={[
                    { from: 0, to: 30, color: "#10b981" },
                    { from: 30, to: 70, color: "#6b7280" },
                    { from: 70, to: 100, color: "#ef4444" },
                  ]}
                />
                <div className="flex justify-between text-[11px] font-mono text-muted-foreground mt-1">
                  <span>Oversold &lt;30</span>
                  <span>Overbought &gt;70</span>
                </div>
              </div>
            </div>
          )}

          {/* MACD */}
          {macd && (
            <div className="py-3">
              <IndicatorRow
                label="MACD (12,26,9)"
                value={macd.macd > 0 ? `+${macd.macd.toFixed(2)}` : macd.macd.toFixed(2)}
                signal={macd.trend}
                icon={Activity}
                helpText="MACD compares fast EMA(12) vs slow EMA(26). Above zero is generally bullish trend bias, below zero bearish. Crossovers can hint momentum shifts."
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center">
                  <p className="text-[11px] font-mono text-muted-foreground">MACD</p>
                  <p className={`text-xs font-mono font-semibold ${macd.macd >= 0 ? "text-success" : "text-destructive"}`}>
                    {macd.macd > 0 ? "+" : ""}{macd.macd.toFixed(4)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-mono text-muted-foreground">Signal</p>
                  <p className="text-xs font-mono font-semibold text-foreground/80">{macd.signal.toFixed(4)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-mono text-muted-foreground">Histogram</p>
                  <p className={`text-xs font-mono font-semibold ${macd.histogram >= 0 ? "text-success" : "text-destructive"}`}>
                    {macd.histogram > 0 ? "+" : ""}{macd.histogram.toFixed(4)}
                  </p>
                </div>
              </div>
              {macd.crossover !== "none" && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Zap className={`w-3 h-3 ${macd.crossover === "bullish_cross" ? "text-success" : "text-destructive"}`} />
                  <span className={`text-[11px] font-mono font-semibold ${macd.crossover === "bullish_cross" ? "text-success" : "text-destructive"}`}>
                    {macd.crossover === "bullish_cross" ? "BULLISH CROSSOVER" : "BEARISH CROSSOVER"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bollinger Bands */}
          {bollinger && (
            <div className="py-3">
              <IndicatorRow
                label="Bollinger (20,2)"
                value={`${(bollinger.percentB * 100).toFixed(0)}%B`}
                signal={
                  bollinger.signal === "overbought" ? "bearish"
                  : bollinger.signal === "oversold" ? "bullish"
                  : bollinger.signal === "squeeze" ? "neutral"
                  : "neutral"
                }
                icon={BarChart3}
                helpText="Bollinger Bands track volatility around a 20-period average. %B shows where price sits inside the band range. Tight bands can indicate a volatility squeeze."
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center">
                  <p className="text-[11px] font-mono text-muted-foreground">Upper</p>
                  <p className="text-xs font-mono font-semibold text-destructive">{bollinger.upper.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-mono text-muted-foreground">Middle</p>
                  <p className="text-xs font-mono font-semibold text-foreground/80">{bollinger.middle.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-mono text-muted-foreground">Lower</p>
                  <p className="text-xs font-mono font-semibold text-success">{bollinger.lower.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-2">
                <GaugeBar
                  value={bollinger.percentB * 100}
                  min={0}
                  max={100}
                  zones={[
                    { from: 0, to: 20, color: "#10b981" },
                    { from: 20, to: 80, color: "#6b7280" },
                    { from: 80, to: 100, color: "#ef4444" },
                  ]}
                />
                <div className="flex justify-between text-[11px] font-mono text-muted-foreground mt-1">
                  <span>Lower band</span>
                  {bollinger.signal === "squeeze" && (
                    <span className="text-warning">SQUEEZE</span>
                  )}
                  <span>Upper band</span>
                </div>
              </div>
            </div>
          )}

          {/* Stochastic */}
          {stochastic && (
            <div className="py-3">
              <IndicatorRow
                label="Stochastic (14,3,3)"
                value={`%K: ${stochastic.k.toFixed(0)}`}
                signal={
                  stochastic.signal === "overbought" ? "bearish"
                  : stochastic.signal === "oversold" ? "bullish"
                  : "neutral"
                }
                icon={Activity}
                helpText="Stochastic compares close price to its recent high-low range. %K/%D near 80+ can be overbought, near 20- can be oversold. Crosses can signal momentum turns."
              />
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
                    <span>%K</span>
                    <span>{stochastic.k.toFixed(1)}</span>
                  </div>
                  <GaugeBar
                    value={stochastic.k}
                    min={0}
                    max={100}
                    zones={[
                      { from: 0, to: 20, color: "#10b981" },
                      { from: 20, to: 80, color: "#6b7280" },
                      { from: 80, to: 100, color: "#ef4444" },
                    ]}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
                    <span>%D</span>
                    <span>{stochastic.d.toFixed(1)}</span>
                  </div>
                  <GaugeBar
                    value={stochastic.d}
                    min={0}
                    max={100}
                    zones={[
                      { from: 0, to: 20, color: "#10b981" },
                      { from: 20, to: 80, color: "#6b7280" },
                      { from: 80, to: 100, color: "#ef4444" },
                    ]}
                  />
                </div>
              </div>
              {stochastic.crossover !== "none" && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Zap className={`w-3 h-3 ${stochastic.crossover === "bullish_cross" ? "text-success" : "text-destructive"}`} />
                  <span className={`text-[11px] font-mono font-semibold ${stochastic.crossover === "bullish_cross" ? "text-success" : "text-destructive"}`}>
                    {stochastic.crossover === "bullish_cross" ? "BULLISH CROSSOVER" : "BEARISH CROSSOVER"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ATR */}
          {atr && (
            <div className="py-3">
              <IndicatorRow
                label="ATR (14)"
                value={atr.value.toFixed(2)}
                signal="neutral"
                icon={AlertTriangle}
                helpText="Average True Range measures volatility only. Higher ATR means wider price movement, lower ATR means quieter movement. ATR is not a directional indicator."
              />
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className={`text-[11px] ${
                  atr.volatility === "high" ? "text-destructive border-destructive/30"
                  : atr.volatility === "low" ? "text-success border-success/30"
                  : "text-warning border-warning/20"
                }`}>
                  {atr.volatility.toUpperCase()} VOLATILITY
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {atr.percent.toFixed(2)}% of price
                </span>
              </div>
            </div>
          )}

          {/* Moving Averages */}
          {(sma20 || ema12 || ema26) && (
            <div className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-chart-2" />
                <span className="font-mono text-xs text-foreground/80">Moving Averages</span>
                <MetricInfo text="SMA and EMA smooth noisy price action to reveal direction. EMA reacts faster than SMA. Price above key averages often indicates stronger trend structure." />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {sma20 && (
                  <div className="text-center p-2 bg-surface rounded">
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-[11px] font-mono text-muted-foreground">SMA(20)</p>
                      <MetricInfo text="Simple Moving Average of last 20 closes. Slower, smoother trend reference line." />
                    </div>
                    <p className="text-xs font-mono font-semibold text-chart-2">{sma20.toFixed(2)}</p>
                  </div>
                )}
                {ema12 && (
                  <div className="text-center p-2 bg-surface rounded">
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-[11px] font-mono text-muted-foreground">EMA(12)</p>
                      <MetricInfo text="Exponential Moving Average of last 12 closes. More sensitive to recent price changes." />
                    </div>
                    <p className="text-xs font-mono font-semibold text-chart-4">{ema12.toFixed(2)}</p>
                  </div>
                )}
                {ema26 && (
                  <div className="text-center p-2 bg-surface rounded">
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-[11px] font-mono text-muted-foreground">EMA(26)</p>
                      <MetricInfo text="Exponential Moving Average of last 26 closes. Commonly paired with EMA(12) for MACD trend context." />
                    </div>
                    <p className="text-xs font-mono font-semibold text-warning">{ema26.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Signal Votes */}
        <div className="pt-2 border-t border-border">
          <div className="mb-2 flex items-center gap-1.5">
            <p className="font-mono text-[11px] text-muted-foreground">SIGNAL VOTES</p>
            <MetricInfo text="Each indicator contributes a weighted bullish, bearish, or neutral vote. The weighted mix drives the overall signal." />
          </div>
          <div className="space-y-1.5">
            {overallSignal.signals.map((vote) => (
              <div key={vote.indicator} className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted-foreground">{vote.indicator}</span>
                <div className="flex items-center gap-2">
                  {vote.direction === "bullish" ? (
                    <ArrowUpCircle className="w-3.5 h-3.5 text-success" />
                  ) : vote.direction === "bearish" ? (
                    <ArrowDownCircle className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className={`text-[11px] font-mono ${
                    vote.direction === "bullish" ? "text-success"
                    : vote.direction === "bearish" ? "text-destructive"
                    : "text-muted-foreground"
                  }`}>
                    {vote.direction.toUpperCase()}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({(vote.weight * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
