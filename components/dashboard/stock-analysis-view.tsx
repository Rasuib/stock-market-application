"use client"

import StockSearchPanel from "@/components/dashboard/stock-search-panel"
import RealTimeStockChart from "@/components/dashboard/real-time-stock-chart"
import TradingSimulator from "@/components/dashboard/trading-simulator"
import { History } from "lucide-react"
import type { Notification } from "@/types/dashboard"
import type { TradeWithCoaching } from "@/lib/coaching/types"

interface StockAnalysisViewProps {
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
  addToWatchlist: (stock: { symbol: string; name: string; price: string; change: string; isPositive: boolean; sector?: string; market?: string }) => boolean
  previousStock?: {
    symbol: string
    price: number
    name: string
    market?: string
  } | null
}

export default function StockAnalysisView({
  selectedStock,
  onStockSelect,
  onNotification,
  balance,
  setBalance,
  positions,
  setPositions,
  trades,
  setTrades,
  addToWatchlist,
  previousStock,
}: StockAnalysisViewProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <StockSearchPanel onStockSelect={onStockSelect} addToWatchlist={addToWatchlist} previousStock={previousStock} />
        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
          <h3 className="font-mono text-sm text-[#00ff88] mb-4">PRICE CHART</h3>
          {selectedStock ? (
            <RealTimeStockChart
              symbol={selectedStock.symbol}
              currentPrice={selectedStock.price}
              change={0}
              changePercent={0}
              market={selectedStock.market}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 font-mono text-sm">
              Select a stock to view real-time chart
            </div>
          )}
        </div>
      </div>

      {previousStock && selectedStock && previousStock.symbol !== selectedStock.symbol && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#1a1a2e]/80 border border-amber-500/30 rounded-lg p-4">
            <h3 className="font-mono text-sm text-amber-400 mb-4 flex items-center gap-2">
              <History className="w-4 h-4" />
              PREVIOUS STOCK: {previousStock.symbol}
            </h3>
            <RealTimeStockChart
              symbol={previousStock.symbol}
              currentPrice={previousStock.price}
              change={0}
              changePercent={0}
              market={previousStock.market}
            />
          </div>
          <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
            <h3 className="font-mono text-sm text-gray-400 mb-4">PREVIOUS STOCK DETAILS</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-400">Symbol</span>
                <span className="font-mono text-white">{previousStock.symbol}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-400">Last Price</span>
                <span className="font-mono text-amber-400">
                  {previousStock.market === "IN" ? "₹" : "$"}
                  {previousStock.price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-400">Market</span>
                <span className="font-mono text-white">{previousStock.market === "IN" ? "NSE/BSE" : "NYSE/NASDAQ"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-4">
          <h3 className="font-mono text-sm text-[#00ff88] mb-4">STOCK DETAILS</h3>
          {selectedStock ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-400">Symbol</span>
                <span className="font-mono text-white">{selectedStock.symbol}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-400">Name</span>
                <span className="font-mono text-white">{selectedStock.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-400">Price</span>
                <span className="font-mono text-[#00ff88]">
                  {selectedStock.market === "IN" ? "₹" : "$"}
                  {selectedStock.price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-400">Market</span>
                <span className="font-mono text-white">{selectedStock.market === "IN" ? "NSE/BSE" : "NYSE/NASDAQ"}</span>
              </div>
              {positions[selectedStock.symbol] && positions[selectedStock.symbol].quantity > 0 && (
                <>
                  <div className="border-t border-[#2d2d44] pt-4 mt-4">
                    <h4 className="font-mono text-xs text-[#00ff88] mb-3">YOUR POSITION</h4>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-gray-400">Quantity</span>
                    <span className="font-mono text-white">{positions[selectedStock.symbol].quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-gray-400">Avg Price</span>
                    <span className="font-mono text-white">
                      {selectedStock.market === "IN" ? "₹" : "$"}
                      {positions[selectedStock.symbol].avgPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-gray-400">P&L</span>
                    {(() => {
                      const pnl =
                        (selectedStock.price - positions[selectedStock.symbol].avgPrice) * positions[selectedStock.symbol].quantity

                      return (
                        <span className={`font-mono ${pnl >= 0 ? "text-[#00ff88]" : "text-red-500"}`}>
                          {pnl >= 0 ? "+" : ""}
                          {selectedStock.market === "IN" ? "₹" : "$"}
                          {pnl.toFixed(2)}
                        </span>
                      )
                    })()}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500 font-mono text-sm">
              Select a stock to view details
            </div>
          )}
        </div>
      </div>

    </>
  )
}
