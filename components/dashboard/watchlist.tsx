"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import TrashIcon from "@/components/icons/trash"
import PlusIcon from "@/components/icons/plus"
import TrendingUpIcon from "@/components/icons/trending-up"
import TrendingDownIcon from "@/components/icons/trending-down"

interface WatchlistStock {
  symbol: string
  name: string
  price: string
  change: string
  isPositive: boolean
  sector?: string
  market?: string
}

interface SearchResult {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  exchange: string
}

interface WatchlistProps {
  watchlist?: WatchlistStock[]
  stocks?: WatchlistStock[]
  addToWatchlist?: (stock: WatchlistStock) => boolean
  removeFromWatchlist?: (symbol: string) => void
  onRemove?: (symbol: string) => void
}

export default function Watchlist({
  watchlist: propWatchlist,
  stocks,
  addToWatchlist: propAddToWatchlist,
  removeFromWatchlist: propRemoveFromWatchlist,
  onRemove,
}: WatchlistProps) {
  const [localWatchlist, setLocalWatchlist] = useState<WatchlistStock[]>([
    {
      symbol: "RELIANCE",
      name: "Reliance Industries",
      price: "₹2,847.50",
      change: "+2.34%",
      isPositive: true,
      sector: "Energy",
    },
    {
      symbol: "TCS",
      name: "Tata Consultancy Services",
      price: "₹4,123.80",
      change: "+1.87%",
      isPositive: true,
      sector: "IT Services",
    },
  ])

  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const watchlist = propWatchlist || stocks || localWatchlist

  const handleRemoveFromWatchlist = (symbol: string) => {
    if (propRemoveFromWatchlist || onRemove) {
      propRemoveFromWatchlist?.(symbol)
      onRemove?.(symbol)
    } else {
      setLocalWatchlist((prev) => prev.filter((stock) => stock.symbol !== symbol))
    }
  }

  const handleAddToWatchlist = (stock: WatchlistStock) => {
    // Check if stock already exists
    if (watchlist.some((item) => item.symbol === stock.symbol)) {
      return false
    }
    if (propAddToWatchlist) {
      return propAddToWatchlist(stock)
    } else {
      setLocalWatchlist((prev) => [...prev, stock])
      return true
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
      } else {
        console.error("Search failed:", response.statusText)
        setSearchResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddFromSearch = (result: SearchResult) => {
    const stock: WatchlistStock = {
      symbol: result.symbol,
      name: result.name,
      price: `₹${result.price.toFixed(2)}`,
      change: `${result.changePercent >= 0 ? "+" : ""}${result.changePercent.toFixed(2)}%`,
      isPositive: result.changePercent >= 0,
      sector: result.exchange === "NSE" ? "NSE" : "BSE",
    }

    const success = handleAddToWatchlist(stock)
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
            <Badge variant="secondary" className="text-xs">
              {watchlist.length} stocks
            </Badge>
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
            watchlist.map((stock) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{stock.symbol}</span>
                    {stock.sector && (
                      <Badge variant="outline" className="text-xs">
                        {stock.sector}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-sm">{stock.price}</p>
                    <div className="flex items-center gap-1">
                      {stock.isPositive ? (
                        <TrendingUpIcon className="size-3 text-green-500" />
                      ) : (
                        <TrendingDownIcon className="size-3 text-red-500" />
                      )}
                      <span className={cn("text-xs font-medium", stock.isPositive ? "text-green-500" : "text-red-500")}>
                        {stock.change}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFromWatchlist(stock.symbol)}
                    className="size-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </div>
            ))
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
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
              >
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search stocks (e.g., RELIANCE, TCS)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? "..." : "Search"}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <div
                      key={`${result.symbol}-${result.exchange}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{result.symbol}</span>
                          <Badge variant="outline" className="text-xs">
                            {result.exchange}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{result.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-sm">₹{result.price.toFixed(2)}</p>
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
