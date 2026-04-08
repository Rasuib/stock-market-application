"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import TrashIcon from "@/components/icons/trash"
import PlusIcon from "@/components/icons/plus"
import TrendingUpIcon from "@/components/icons/trending-up"
import TrendingDownIcon from "@/components/icons/trending-down"
import { useTradingStore } from "@/stores/trading-store"
import { useNotifications } from "@/contexts/notification-context"
import { fetchJSON } from "@/lib/fetch-client"
import { RefreshCw, Bell, BellOff } from "lucide-react"

interface SearchResult {
  symbol: string
  name?: string
  price: number
  change: number
  changePercent: number
  exchange: string
  currency?: string
}

interface LivePrice {
  price: number
  change: number
  changePercent: number
  lastUpdated: number
}

// Threshold for price alerts (percentage)
const ALERT_THRESHOLD = 3

export default function Watchlist() {
  const watchlist = useTradingStore((s) => s.watchlist)
  const addToWatchlist = useTradingStore((s) => s.addToWatchlist)
  const removeFromWatchlist = useTradingStore((s) => s.removeFromWatchlist)
  const { addNotification } = useNotifications()

  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [lastAlertedPrices, setLastAlertedPrices] = useState<Record<string, number>>({})

  const formatPrice = useCallback((price: number, market?: string, currency?: string) => {
    const symbol = market === "IN" || currency === "INR" ? "\u20B9" : "$"
    return `${symbol}${price.toFixed(2)}`
  }, [])

  const refreshPrices = useCallback(async () => {
    if (watchlist.length === 0) return
    setRefreshing(true)

    const results = await Promise.allSettled(
      watchlist.map(stock =>
        fetchJSON<{ price: number; change: number; changePercent: number }>(
          `/api/stock/${encodeURIComponent(stock.symbol)}`
        )
      )
    )

    const newPrices: Record<string, LivePrice> = {}
    results.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value?.price) {
        const symbol = watchlist[i].symbol
        newPrices[symbol] = {
          price: result.value.price,
          change: result.value.change || 0,
          changePercent: result.value.changePercent || 0,
          lastUpdated: Date.now(),
        }

        // Check for significant price movements and alert
        if (alertsEnabled) {
          const prevPrice = lastAlertedPrices[symbol]
          const changePercent = Math.abs(result.value.changePercent || 0)

          if (changePercent >= ALERT_THRESHOLD && (!prevPrice || Math.abs(result.value.price - prevPrice) / prevPrice > 0.01)) {
            const isUp = (result.value.changePercent || 0) >= 0
            const market = watchlist[i].market || "US"
            addNotification({
              title: `${symbol} ${isUp ? "UP" : "DOWN"} ${changePercent.toFixed(1)}%`,
              message: `${watchlist[i].name} is now at ${formatPrice(result.value.price, market)} (${isUp ? "+" : ""}${(result.value.changePercent || 0).toFixed(2)}%)`,
              timestamp: new Date().toISOString(),
              type: isUp ? "trade_buy" : "trade_sell",
              read: false,
              priority: changePercent >= 5 ? "high" : "medium",
            })
            setLastAlertedPrices(prev => ({ ...prev, [symbol]: result.value.price }))
          }
        }
      }
    })

    setLivePrices(prev => ({ ...prev, ...newPrices }))
    setRefreshing(false)
  }, [watchlist, alertsEnabled, lastAlertedPrices, addNotification, formatPrice])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    if (watchlist.length === 0) return
    refreshPrices()
    const interval = setInterval(refreshPrices, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshPrices, watchlist.length]) // Only re-setup when watchlist size changes

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
      } else {
        setSearchResults([])
      }
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddFromSearch = (result: SearchResult) => {
    const market = result.symbol.endsWith(".NS") || result.symbol.endsWith(".BO") ? "IN" : "US"
    const displayName = result.name || result.symbol
    const success = addToWatchlist({
      symbol: result.symbol,
      name: displayName,
      price: formatPrice(result.price, market, result.currency),
      change: `${result.changePercent >= 0 ? "+" : ""}${result.changePercent.toFixed(2)}%`,
      isPositive: result.changePercent >= 0,
      sector: result.exchange,
      market,
    })

    if (success) {
      setShowSearchModal(false)
      setSearchQuery("")
      setSearchResults([])
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Stock Watchlist</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={cn("size-8 p-0", alertsEnabled ? "text-green-400" : "text-gray-500")}
                aria-label={alertsEnabled ? "Disable price alerts" : "Enable price alerts"}
              >
                {alertsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              </Button>
              {watchlist.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshPrices}
                  disabled={refreshing}
                  className="size-8 p-0 text-gray-400 hover:text-white"
                  aria-label="Refresh watchlist prices"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                </Button>
              )}
              <Badge variant="secondary" className="text-xs">
                {watchlist.length} stocks
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {watchlist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="mb-2">
                <TrendingUpIcon className="size-8 mx-auto opacity-50" />
              </div>
              <p className="text-sm">No stocks in your watchlist</p>
              <p className="text-xs mt-1">Add stocks from the search panel to track them</p>
            </div>
          ) : (
            watchlist.map((stock) => {
              const live = livePrices[stock.symbol]
              const displayPrice = live ? formatPrice(live.price, stock.market) : stock.price
              const displayChange = live ? `${live.changePercent >= 0 ? "+" : ""}${live.changePercent.toFixed(2)}%` : stock.change
              const isPositive = live ? live.changePercent >= 0 : stock.isPositive
              const isSignificant = live && Math.abs(live.changePercent) >= ALERT_THRESHOLD

              return (
                <div
                  key={stock.symbol}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg transition-colors",
                    isSignificant
                      ? isPositive ? "bg-green-500/10 hover:bg-green-500/15" : "bg-red-500/10 hover:bg-red-500/15"
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{stock.symbol}</span>
                      {stock.sector && (
                        <Badge variant="outline" className="text-xs">
                          {stock.sector}
                        </Badge>
                      )}
                      {isSignificant && (
                        <Badge className={cn("text-[9px]", isPositive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                          {isPositive ? "HOT" : "DROP"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-words">{stock.name}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold text-sm">{displayPrice}</p>
                      <div className="flex items-center gap-1">
                        {isPositive ? (
                          <TrendingUpIcon className="size-3 text-green-500" />
                        ) : (
                          <TrendingDownIcon className="size-3 text-red-500" />
                        )}
                        <span className={cn("text-xs font-medium", isPositive ? "text-green-500" : "text-red-500")}>
                          {displayChange}
                        </span>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove ${stock.symbol} from watchlist`}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {stock.symbol} from watchlist?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {stock.name} ({stock.symbol}) from your watchlist. You can add it back later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeFromWatchlist(stock.symbol)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )
            })
          )}

          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs bg-transparent"
              onClick={() => setShowSearchModal(true)}
            >
              <PlusIcon className="size-4 mr-2" />
              Add Stock to Watchlist
            </Button>
          </div>
        </CardContent>
      </Card>

      {showSearchModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Add stock to watchlist"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowSearchModal(false)
              setSearchQuery("")
              setSearchResults([])
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSearchModal(false)
              setSearchQuery("")
              setSearchResults([])
            }
          }}
        >
          <div className="bg-background rounded-lg p-6 w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Stock to Watchlist</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSearchModal(false)
                  setSearchQuery("")
                  setSearchResults([])
                }}
                className="size-8 p-0"
                aria-label="Close search"
              >
                x
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search stocks (e.g., RELIANCE, TCS)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                  aria-label="Search stocks to add to watchlist"
                  autoFocus
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? "..." : "Search"}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto" role="list" aria-label="Search results">
                  {searchResults.map((result) => (
                    <div
                      key={`${result.symbol}-${result.exchange}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      role="listitem"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{result.symbol}</span>
                          <Badge variant="outline" className="text-xs">
                            {result.exchange}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground break-words">{result.name || result.symbol}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatPrice(result.price, undefined, result.currency)}</p>
                          <span
                            className={cn(
                              "text-xs font-medium",
                              result.changePercent >= 0 ? "text-green-500" : "text-red-500",
                            )}
                          >
                            {result.changePercent >= 0 ? "+" : ""}
                            {result.changePercent.toFixed(2)}%
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddFromSearch(result)}
                          className="size-8 p-0 hover:bg-primary/10"
                          disabled={watchlist.some((item) => item.symbol === result.symbol)}
                          aria-label={`Add ${result.symbol} to watchlist`}
                        >
                          <PlusIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !isSearching && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  No stocks found. Try searching for different terms.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
