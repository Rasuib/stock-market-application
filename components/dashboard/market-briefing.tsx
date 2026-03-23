"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Newspaper, TrendingUp, TrendingDown, Clock } from "lucide-react"
import { fetchJSON } from "@/lib/fetch-client"
import { MarketBriefingSkeleton } from "./loading-skeletons"

interface MarketIndex {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

interface BriefingData {
  indices: MarketIndex[]
  topMover: { symbol: string; changePercent: number } | null
  marketMood: "bullish" | "bearish" | "mixed"
  lastUpdated: string
}

const INDICES = [
  { symbol: "^NSEI", name: "NIFTY 50" },
  { symbol: "^BSESN", name: "SENSEX" },
  { symbol: "^GSPC", name: "S&P 500" },
]

export default function MarketBriefing() {
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchBriefing = async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled(
        INDICES.map(idx =>
          fetchJSON<{ symbol: string; price: number; change: number; changePercent: number }>(
            `/api/stock/${encodeURIComponent(idx.symbol)}`
          )
        )
      )

      const indices: MarketIndex[] = []
      results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value?.price) {
          indices.push({
            symbol: INDICES[i].symbol,
            name: INDICES[i].name,
            price: result.value.price,
            change: result.value.change || 0,
            changePercent: result.value.changePercent || 0,
          })
        }
      })

      const positive = indices.filter(i => i.changePercent > 0).length
      const negative = indices.filter(i => i.changePercent < 0).length
      const marketMood = positive > negative ? "bullish" : negative > positive ? "bearish" : "mixed"

      const sorted = [...indices].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      const topMover = sorted[0] ? { symbol: sorted[0].name, changePercent: sorted[0].changePercent } : null

      setData({
        indices,
        topMover,
        marketMood,
        lastUpdated: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
      })
    } catch {
      // Silently fail — briefing is non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBriefing()
    const interval = setInterval(fetchBriefing, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return <MarketBriefingSkeleton />
  }

  if (!data || data.indices.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-primary" />
            Market Briefing
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={
              data.marketMood === "bullish" ? "outline-success" :
              data.marketMood === "bearish" ? "outline-destructive" :
              "secondary"
            }>
              {data.marketMood.toUpperCase()}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {data.lastUpdated}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.indices.map(idx => (
            <div
              key={idx.symbol}
              className="flex items-center justify-between p-3 rounded-lg bg-surface border border-surface-border transition-colors hover:bg-surface-hover"
            >
              <div>
                <p className="text-xs text-muted-foreground font-mono">{idx.name}</p>
                <p className="text-sm font-semibold font-mono">
                  {idx.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className={`flex items-center gap-1 ${idx.changePercent >= 0 ? "text-profit" : "text-loss"}`}>
                {idx.changePercent >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="text-sm font-mono font-semibold">
                  {idx.changePercent >= 0 ? "+" : ""}{idx.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
