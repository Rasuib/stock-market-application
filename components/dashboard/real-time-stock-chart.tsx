"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ComposedChart, Line, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts"
import { TrendingUp, TrendingDown, BarChart3, RefreshCw, Layers, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChartDataPoint {
  time: string
  price: number
  timestamp: number
  bbUpper?: number | null
  bbMiddle?: number | null
  bbLower?: number | null
  sma20?: number | null
  ema12?: number | null
}

interface TooltipPayloadItem {
  dataKey?: string
  value?: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: number
}

interface RealTimeStockChartProps {
  symbol: string
  currentPrice?: number
  initialPrice?: number
  change?: number
  changePercent?: number
  currency?: string
  market?: string
  onPriceUpdate?: (price: number, change: number, changePercent: number) => void
}

export default function RealTimeStockChart({
  symbol,
  currentPrice,
  initialPrice,
  change,
  changePercent,
  currency,
  market,
  onPriceUpdate,
}: RealTimeStockChartProps) {
  const resolvedCurrency = currency || (market === "IN" ? "INR" : "USD")
  const startingPrice = currentPrice ?? initialPrice ?? 0
  const startingChange = change ?? 0
  const startingChangePercent = changePercent ?? 0

  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [timeRange, setTimeRange] = useState("3S")
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [livePrice, setLivePrice] = useState(startingPrice)
  const [liveChange, setLiveChange] = useState(startingChange)
  const [liveChangePercent, setLiveChangePercent] = useState(startingChangePercent)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [tickCount, setTickCount] = useState(0)
  const [showBollinger, setShowBollinger] = useState(false)
  const [showSMA, setShowSMA] = useState(false)

  const fetchRealTimePrice = useCallback(async () => {
    if (!symbol) return null

    try {
      const response = await fetch(`/api/stock/${symbol}?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (!response.ok) {
        setFetchError(`Failed to fetch price (${response.status})`)
        return null
      }

      setFetchError(null)
      const data = await response.json()

      return {
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
      }
    } catch (error) {
      setFetchError("Network error — retrying automatically")
      return null
    }
  }, [symbol])

  const fetchChartData = useCallback(async () => {
    if (!symbol) return

    setLoading(true)
    setIsRefreshing(true)

    try {
      if (timeRange === "3S") {
        const priceData = await fetchRealTimePrice()

        if (priceData?.price) {
          const now = Date.now()
          const newDataPoint: ChartDataPoint = {
            time: new Date(now).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
              timeZone: "Asia/Kolkata",
            }),
            price: priceData.price,
            timestamp: now,
          }

          setLivePrice(priceData.price)
          setLiveChange(priceData.change)
          setLiveChangePercent(priceData.changePercent)
          setChartData((prevData) => [...prevData, newDataPoint].slice(-30))
          setTickCount((prev) => prev + 1)
          onPriceUpdate?.(priceData.price, priceData.change, priceData.changePercent)
        }
      } else {
        const chartResponse = await fetch(`/api/stock/${symbol}/chart?range=${timeRange}`)
        const chartDataResponse = await chartResponse.json()

        if (chartDataResponse.chartData) {
          // Merge indicator series into chart data for overlays
          const series = chartDataResponse.indicatorSeries
          const merged = chartDataResponse.chartData.map((point: ChartDataPoint, i: number) => ({
            ...point,
            bbUpper: series?.bollinger?.upper?.[i] ?? null,
            bbMiddle: series?.bollinger?.middle?.[i] ?? null,
            bbLower: series?.bollinger?.lower?.[i] ?? null,
            sma20: series?.sma20?.[i] ?? null,
            ema12: series?.ema12?.[i] ?? null,
          }))
          setChartData(merged)
          const lastPoint = merged[merged.length - 1]
          if (lastPoint) {
            setLivePrice(lastPoint.price)
          }
        }
      }

      setLastUpdate(new Date())
    } catch (error) {
      setFetchError("Failed to load chart data. Will retry on next interval.")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [fetchRealTimePrice, onPriceUpdate, symbol, timeRange])

  useEffect(() => {
    if (startingPrice > 0) {
      setLivePrice(startingPrice)
      setLiveChange(startingChange)
      setLiveChangePercent(startingChangePercent)
    }
  }, [startingPrice, startingChange, startingChangePercent, symbol])

  // Single effect for fetching + polling — avoids double-fire from two separate effects
  useEffect(() => {
    if (!symbol) {
      setChartData([])
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    setChartData([])
    setTickCount(0)
    fetchChartData()

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Scale polling interval to time range — no need to hit the API every 2.5s for yearly data
    const pollIntervals: Record<string, number> = {
      "3S": 3000,     // Live: 3 seconds
      "1D": 30000,    // Intraday: 30 seconds
      "5D": 60000,    // 5-day: 1 minute
      "1M": 300000,   // Monthly: 5 minutes
      "3M": 300000,   // Quarterly: 5 minutes
      "1Y": 600000,   // Yearly: 10 minutes
      "ALL": 600000,  // All-time: 10 minutes
    }
    const interval = pollIntervals[timeRange] || 30000

    intervalRef.current = setInterval(() => {
      fetchChartData()
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchChartData, symbol, timeRange])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    if (timeRange === "3S" || timeRange === "1D") {
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: timeRange === "3S" ? "2-digit" : undefined,
        hour12: false,
        timeZone: "Asia/Kolkata",
      })
    }

    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    })
  }

  const formatPrice = (value: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return `${resolvedCurrency === "INR" ? "₹" : "$"}0.00`
    }

    return `${resolvedCurrency === "INR" ? "₹" : "$"}${value.toFixed(2)}`
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const priceEntry = payload.find((p) => p.dataKey === "price")
      const bbUpperEntry = payload.find((p) => p.dataKey === "bbUpper")
      const bbLowerEntry = payload.find((p) => p.dataKey === "bbLower")
      const sma20Entry = payload.find((p) => p.dataKey === "sma20")

      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-muted-foreground text-sm">{formatTime(label ?? Date.now())}</p>
          {priceEntry && <p className="text-foreground font-semibold">{formatPrice(priceEntry.value ?? 0)}</p>}
          {showBollinger && bbUpperEntry?.value != null && (
            <div className="text-[10px] font-mono mt-1 space-y-0.5">
              <p className="text-chart-5/70">BB Upper: {bbUpperEntry.value.toFixed(2)}</p>
              <p className="text-chart-2/70">BB Lower: {bbLowerEntry?.value?.toFixed(2)}</p>
            </div>
          )}
          {showSMA && sma20Entry?.value != null && (
            <p className="text-[10px] font-mono text-chart-2/70 mt-0.5">SMA(20): {sma20Entry.value.toFixed(2)}</p>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-chart-2" />
            {symbol} Price Chart
            {symbol && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                {timeRange === "3S" ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    LIVE (3s)
                  </span>
                ) : (
                  `Auto-refresh`
                )}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {timeRange !== "3S" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBollinger(!showBollinger)}
                  className={`h-6 px-2 text-[10px] font-mono ${showBollinger ? "bg-chart-4/20 text-chart-4" : "text-muted-foreground hover:text-foreground"}`}
                  aria-label={showBollinger ? "Hide Bollinger Bands" : "Show Bollinger Bands"}
                  aria-pressed={showBollinger}
                >
                  BB
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSMA(!showSMA)}
                  className={`h-6 px-2 text-[10px] font-mono ${showSMA ? "bg-chart-2/20 text-chart-2" : "text-muted-foreground hover:text-foreground"}`}
                  aria-label={showSMA ? "Hide SMA/EMA overlays" : "Show SMA/EMA overlays"}
                  aria-pressed={showSMA}
                >
                  MA
                </Button>
              </div>
            )}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-20" aria-label="Chart time range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3S">LIVE</SelectItem>
                <SelectItem value="1D">1D</SelectItem>
                <SelectItem value="5D">5D</SelectItem>
                <SelectItem value="1M">1M</SelectItem>
                <SelectItem value="3M">3M</SelectItem>
                <SelectItem value="1Y">1Y</SelectItem>
                <SelectItem value="ALL">ALL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2 p-4 bg-surface rounded-lg border border-surface-border">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{symbol} Price</p>
            {timeRange === "3S" && <span className="text-xs text-muted-foreground font-mono">Tick #{tickCount}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold font-mono">{formatPrice(livePrice)}</span>
            <Badge variant={liveChange >= 0 ? "outline-success" : "outline-destructive"} className="flex items-center gap-1">
              {liveChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {liveChange >= 0 ? "+" : ""}
              {liveChangePercent.toFixed(2)}%
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Change: <span className={liveChange >= 0 ? "text-profit" : "text-loss"}>{formatPrice(liveChange)}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {timeRange === "3S" ? "Real-Time Trading Chart" : `${timeRange} Historical Chart`}
            </h3>
            <span className="text-xs text-muted-foreground">{chartData.length} data points</span>
          </div>

          {fetchError && (
            <div className="flex items-center gap-2 p-2 mb-2 bg-warning/10 border border-warning/20 rounded-lg" role="alert">
              <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
              <p className="text-warning text-xs flex-1">{fetchError}</p>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-warning" onClick={fetchChartData}>
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          )}

          {loading && chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center bg-surface rounded-lg" role="status">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 text-chart-2 animate-spin" />
                <p className="text-muted-foreground">Loading chart data...</p>
              </div>
            </div>
          ) : (
            <div className="h-80 bg-surface rounded-lg p-4 border border-surface-border">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTime}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    interval={timeRange === "3S" ? "preserveStartEnd" : "preserveStart"}
                  />
                  <YAxis
                    domain={["dataMin - 1", "dataMax + 1"]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    tickFormatter={(value) => (value ?? 0).toFixed(2)}
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {/* Bollinger Bands area fill */}
                  {showBollinger && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="bbUpper"
                        stroke="none"
                        fill="rgba(168, 85, 247, 0.08)"
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="bbLower"
                        stroke="none"
                        fill="rgba(15, 23, 42, 1)"
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="bbUpper"
                        stroke="#a855f7"
                        strokeWidth={1}
                        strokeDasharray="4 2"
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="bbMiddle"
                        stroke="#a855f7"
                        strokeWidth={1}
                        strokeOpacity={0.5}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="bbLower"
                        stroke="#a855f7"
                        strokeWidth={1}
                        strokeDasharray="4 2"
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </>
                  )}

                  {/* SMA/EMA overlays */}
                  {showSMA && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="sma20"
                        stroke="#22d3ee"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="ema12"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </>
                  )}

                  {/* Price line (always on top) */}
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={liveChange >= 0 ? "#10B981" : "#EF4444"}
                    strokeWidth={2.5}
                    dot={timeRange === "3S" ? { r: 2, fill: liveChange >= 0 ? "#10B981" : "#EF4444" } : false}
                    activeDot={{
                      r: 5,
                      fill: liveChange >= 0 ? "#10B981" : "#EF4444",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    animationDuration={800}
                    animationEasing="ease-in-out"
                    connectNulls={true}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Overlay legend */}
          {(showBollinger || showSMA) && timeRange !== "3S" && (
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <Layers className="w-3 h-3 text-muted-foreground" />
              {showBollinger && (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-chart-4 inline-block" style={{ borderTop: "1px dashed" }} />
                  <span className="text-chart-4">Bollinger Bands</span>
                </span>
              )}
              {showSMA && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-chart-2 inline-block" />
                    <span className="text-chart-2">SMA(20)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-warning inline-block" style={{ borderTop: "1px dashed" }} />
                    <span className="text-warning">EMA(12)</span>
                  </span>
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRefreshing ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
              {isRefreshing ? "Fetching latest data..." : "Connected"}
            </span>
            <p className="text-muted-foreground">
              Last updated:{" "}
              {lastUpdate.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                second: timeRange === "3S" ? "2-digit" : undefined,
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
