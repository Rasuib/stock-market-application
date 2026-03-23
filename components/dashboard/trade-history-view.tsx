"use client"

import { useMemo, useState, useCallback } from "react"
import { useTradingStore } from "@/stores/trading-store"
import type { TradeWithCoaching } from "@/lib/coaching/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Download, Search, History, ChevronDown } from "lucide-react"

type FilterTab = "all" | "buy" | "sell"

function currencySymbol(currency: "USD" | "INR") {
  return currency === "INR" ? "\u20b9" : "$"
}

function formatCurrency(value: number, currency: "USD" | "INR") {
  const sym = currencySymbol(currency)
  return `${sym}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(timestamp: string) {
  const d = new Date(timestamp)
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function generateCsv(trades: TradeWithCoaching[]): string {
  const headers = [
    "Date", "Symbol", "Type", "Quantity", "Requested Price", "Fill Price",
    "Cost", "Profit", "Spread (bps)", "Slippage (bps)", "Commission",
    "Order Type", "Coaching Score", "Verdict",
  ]
  const rows = trades.map((t) => [
    escapeCsvField(new Date(t.timestamp).toISOString()),
    escapeCsvField(t.symbol),
    escapeCsvField(t.type.toUpperCase()),
    String(t.quantity),
    String(t.execution?.requestedPrice ?? t.price),
    String(t.execution?.fillPrice ?? t.price),
    String(t.cost),
    t.profit != null ? String(t.profit) : "",
    String(t.execution?.spreadBps ?? ""),
    String(t.execution?.slippageBps ?? ""),
    String(t.execution?.commissionPaid ?? ""),
    escapeCsvField(t.execution?.orderType ?? "market"),
    String(t.coaching.score),
    escapeCsvField(t.coaching.verdict),
  ])

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function TradeHistoryView() {
  const trades = useTradingStore((s) => s.trades)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredTrades = useMemo(() => {
    let result = [...trades]

    // Filter by type
    if (activeTab === "buy") result = result.filter((t) => t.type === "buy")
    if (activeTab === "sell") result = result.filter((t) => t.type === "sell")

    // Filter by search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((t) => t.symbol.toLowerCase().includes(q))
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return result
  }, [trades, activeTab, search])

  const handleExport = useCallback(() => {
    if (filteredTrades.length === 0) return
    const csv = generateCsv(filteredTrades)
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(csv, `tradia-trades-${date}.csv`)
  }, [filteredTrades])

  const tabs: { label: string; value: FilterTab }[] = [
    { label: "All", value: "all" },
    { label: "Buys", value: "buy" },
    { label: "Sells", value: "sell" },
  ]

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <History className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-medium text-muted-foreground">No trades yet</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Your trade history will appear here once you start trading.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Trade History</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={filteredTrades.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search + filter tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trade list */}
        {filteredTrades.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No trades match your filters.
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Symbol</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 text-right font-medium">Qty</th>
                  <th className="pb-2 pr-4 text-right font-medium">Price</th>
                  <th className="pb-2 pr-4 text-right font-medium">Cost</th>
                  <th className="pb-2 pr-4 text-right font-medium">Profit</th>
                  <th className="pb-2 pr-4 text-right font-medium">Score</th>
                  <th className="pb-2 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => {
                  const isExpanded = expandedId === trade.id
                  const exec = trade.execution
                  return (
                    <tr key={trade.id} className="border-b border-border/50 last:border-0 group">
                      <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">
                        {formatDate(trade.timestamp)}
                      </td>
                      <td className="py-3 pr-4 font-medium">{trade.symbol}</td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={trade.type === "buy" ? "outline" : "outline-destructive"}
                          className="capitalize"
                        >
                          {trade.type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{trade.quantity}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCurrency(trade.price, trade.currency)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCurrency(trade.cost, trade.currency)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {trade.profit != null ? (
                          <span className={trade.profit >= 0 ? "text-profit" : "text-loss"}>
                            {trade.profit >= 0 ? "+" : "-"}
                            {formatCurrency(trade.profit, trade.currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        <span
                          className={
                            trade.coaching.score >= 70
                              ? "text-profit"
                              : trade.coaching.score >= 40
                                ? "text-warning"
                                : "text-loss"
                          }
                        >
                          {trade.coaching.score}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={
                              trade.coaching.verdict === "strong"
                                ? "outline-success"
                                : trade.coaching.verdict === "mixed"
                                  ? "outline-warning"
                                  : "outline-destructive"
                            }
                            className="capitalize"
                          >
                            {trade.coaching.verdict}
                          </Badge>
                          {exec && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Toggle execution details"
                              aria-expanded={isExpanded}
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          )}
                        </div>
                        {isExpanded && exec && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground">
                            <span>Requested: {formatCurrency(exec.requestedPrice, trade.currency)}</span>
                            <span>Fill: {formatCurrency(exec.fillPrice, trade.currency)}</span>
                            <span>Spread: {exec.spreadBps}bps</span>
                            <span>Slippage: {exec.slippageBps}bps</span>
                            <span>Commission: {formatCurrency(exec.commissionPaid, trade.currency)}</span>
                            <span className="uppercase">Order: {exec.orderType}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="lg:hidden space-y-3">
            {filteredTrades.map((trade) => {
              const isExpanded = expandedId === trade.id
              const exec = trade.execution
              return (
                <div key={trade.id} className="p-3 bg-surface rounded-lg border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{trade.symbol}</span>
                      <Badge
                        variant={trade.type === "buy" ? "outline" : "outline-destructive"}
                        className="capitalize text-xs"
                      >
                        {trade.type}
                      </Badge>
                    </div>
                    <Badge
                      variant={
                        trade.coaching.verdict === "strong"
                          ? "outline-success"
                          : trade.coaching.verdict === "mixed"
                            ? "outline-warning"
                            : "outline-destructive"
                      }
                      className="capitalize text-xs"
                    >
                      {trade.coaching.verdict} ({trade.coaching.score})
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Qty</span>
                      <span className="tabular-nums">{trade.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="tabular-nums">{formatCurrency(trade.price, trade.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost</span>
                      <span className="tabular-nums">{formatCurrency(trade.cost, trade.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">P&amp;L</span>
                      {trade.profit != null ? (
                        <span className={`tabular-nums ${trade.profit >= 0 ? "text-profit" : "text-loss"}`}>
                          {trade.profit >= 0 ? "+" : "-"}{formatCurrency(trade.profit, trade.currency)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <span>{formatDate(trade.timestamp)}</span>
                    {exec && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Toggle execution details"
                        aria-expanded={isExpanded}
                      >
                        Details
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                  {isExpanded && exec && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground pt-2 border-t border-border/50">
                      <span>Req: {formatCurrency(exec.requestedPrice, trade.currency)}</span>
                      <span>Fill: {formatCurrency(exec.fillPrice, trade.currency)}</span>
                      <span>Spread: {exec.spreadBps}bps</span>
                      <span>Slip: {exec.slippageBps}bps</span>
                      <span>Comm: {formatCurrency(exec.commissionPaid, trade.currency)}</span>
                      <span className="uppercase">Type: {exec.orderType}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </>
        )}

        {/* Summary footer */}
        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>
            Showing {filteredTrades.length} of {trades.length} trades
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
