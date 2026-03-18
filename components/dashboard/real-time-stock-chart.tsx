"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts"
import { TrendingUp, TrendingDown, BarChart3, RefreshCw } from "lucide-react"

interface ChartDataPoint {
  time: string
  price: number
  timestamp: number
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [tickCount, setTickCount] = useState(0)

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
        console.error("Failed to fetch real-time price:", response.status)
        return null
      }

      const data = await response.json()

      return {
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
      }
    } catch (error) {
      console.error("Error fetching real-time price:", error)
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
          setChartData(chartDataResponse.chartData)
          const lastPoint = chartDataResponse.chartData[chartDataResponse.chartData.length - 1]
          if (lastPoint) {
            setLivePrice(lastPoint.price)
          }
        }
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error("Failed to fetch stock data:", error)
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm">{formatTime(label)}</p>
          <p className="text-white font-semibold">{formatPrice(payload[0].value)}</p>
        </div>
      )
    }

    return null
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            {symbol} Price Chart
            {symbol && (
              <Badge variant="outline" className="text-xs text-gray-400 border-gray-600 flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                {timeRange === "3S" ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    LIVE (3s)
                  </span>
                ) : (
                  `Auto-refresh`
                )}
              </Badge>
            )}
          </CardTitle>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-20 bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
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
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{symbol} Price</p>
            {timeRange === "3S" && <span className="text-xs text-gray-500 font-mono">Tick #{tickCount}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-white font-mono">{formatPrice(livePrice)}</span>
            <Badge
              className={`flex items-center gap-1 ${
                liveChange >= 0
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              }`}
            >
              {liveChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {liveChange >= 0 ? "+" : ""}
              {liveChangePercent.toFixed(2)}%
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>
              Change: <span className={liveChange >= 0 ? "text-green-400" : "text-red-400"}>{formatPrice(liveChange)}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">
              {timeRange === "3S" ? "Real-Time Trading Chart" : `${timeRange} Historical Chart`}
            </h3>
            <span className="text-xs text-gray-500">{chartData.length} data points</span>
          </div>

          {loading && chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center bg-gray-800/30 rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-gray-400">Loading chart data...</p>
              </div>
            </div>
          ) : (
            <div className="h-80 bg-gray-800/30 rounded-lg p-4 border border-gray-700">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRefreshing ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
              {isRefreshing ? "Fetching latest data..." : "Connected"}
            </span>
            <p className="text-gray-500">
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
