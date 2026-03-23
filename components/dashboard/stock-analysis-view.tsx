"use client"

import StockSearchPanel from "@/components/dashboard/stock-search-panel"
import RealTimeStockChart from "@/components/dashboard/real-time-stock-chart"
import TradingSimulator from "@/components/dashboard/trading-simulator"
import TechnicalIndicatorsPanel from "@/components/dashboard/technical-indicators-panel"
import { useTradingStore } from "@/stores/trading-store"

export default function StockAnalysisView() {
  const selectedStock = useTradingStore((s) => s.selectedStock)
  const positions = useTradingStore((s) => s.positions)

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <StockSearchPanel />
        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h3 className="text-sm text-muted-foreground mb-4 font-mono uppercase">Price Chart</h3>
          {selectedStock ? (
            <RealTimeStockChart
              symbol={selectedStock.symbol}
              currentPrice={selectedStock.price}
              change={0}
              changePercent={0}
              market={selectedStock.market}
            />
          ) : (
            <div className="h-48 sm:h-64 lg:h-75 flex items-center justify-center text-muted-foreground text-sm">
              Select a stock to view real-time chart
            </div>
          )}
        </div>
      </div>

      {/* Technical Analysis Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TechnicalIndicatorsPanel />
        <TradingSimulator />
      </div>

      <div className="mb-6">
        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h3 className="text-sm text-muted-foreground mb-4 font-mono uppercase">Stock Details</h3>
          {selectedStock ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Symbol</span>
                <span>{selectedStock.symbol}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Name</span>
                <span>{selectedStock.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="text-profit font-mono">
                  {selectedStock.market === "IN" ? "₹" : "$"}
                  {selectedStock.price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Market</span>
                <span>{selectedStock.market === "IN" ? "NSE/BSE" : "NYSE/NASDAQ"}</span>
              </div>
              {positions[selectedStock.symbol] && positions[selectedStock.symbol].quantity > 0 && (
                <>
                  <div className="border-t border-border pt-4 mt-4">
                    <h4 className="text-xs text-profit mb-3 font-mono uppercase">Your Position</h4>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span>{positions[selectedStock.symbol].quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Avg Price</span>
                    <span className="font-mono">
                      {selectedStock.market === "IN" ? "₹" : "$"}
                      {positions[selectedStock.symbol].avgPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">P&L</span>
                    {(() => {
                      const pnl =
                        (selectedStock.price - positions[selectedStock.symbol].avgPrice) * positions[selectedStock.symbol].quantity
                      return (
                        <span className={`font-mono ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
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
            <div className="h-32 sm:h-40 lg:h-50 flex items-center justify-center text-muted-foreground text-sm">
              Select a stock to view details
            </div>
          )}
        </div>
      </div>
    </>
  )
}
