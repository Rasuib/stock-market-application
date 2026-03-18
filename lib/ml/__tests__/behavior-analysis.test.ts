import { describe, it, expect } from "vitest"
import { analyzeBehavior, type TradeRecord } from "../behavior-analysis"

function makeTrade(overrides: Partial<TradeRecord> = {}): TradeRecord {
  return {
    type: "buy",
    symbol: "AAPL",
    price: 150,
    quantity: 10,
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe("analyzeBehavior", () => {
  it("returns empty alerts for fewer than 2 trades", () => {
    const result = analyzeBehavior([makeTrade()])
    expect(result.alerts).toHaveLength(0)
    expect(result.patterns.uniqueSymbols).toBe(1)
  })

  it("detects overtrading when many trades happen rapidly", () => {
    const now = Date.now()
    // 15 trades in 1 minute — way over 10/hour threshold
    const trades: TradeRecord[] = Array.from({ length: 15 }, (_, i) =>
      makeTrade({ timestamp: new Date(now + i * 4000).toISOString() })
    )
    const result = analyzeBehavior(trades)
    const overtradingAlert = result.alerts.find(a => a.type === "overtrading")
    expect(overtradingAlert).toBeDefined()
    expect(result.patterns.tradesPerHour).toBeGreaterThan(10)
  })

  it("detects trend ignoring when trades oppose the trend", () => {
    const trades: TradeRecord[] = Array.from({ length: 10 }, (_, i) =>
      makeTrade({
        type: "buy",
        trendSignal: -1, // buying against downtrend
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
      })
    )
    const result = analyzeBehavior(trades)
    expect(result.patterns.trendAlignmentRate).toBe(0) // 0% aligned
    const alert = result.alerts.find(a => a.type === "trend_ignoring")
    expect(alert).toBeDefined()
  })

  it("detects sentiment ignoring when trades oppose sentiment", () => {
    const trades: TradeRecord[] = Array.from({ length: 10 }, (_, i) =>
      makeTrade({
        type: "buy",
        sentimentSignal: -1, // buying against bearish sentiment
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
      })
    )
    const result = analyzeBehavior(trades)
    expect(result.patterns.sentimentAlignmentRate).toBe(0)
    const alert = result.alerts.find(a => a.type === "sentiment_ignoring")
    expect(alert).toBeDefined()
  })

  it("detects frequent reversals (buy then sell within 5 min)", () => {
    const now = Date.now()
    const trades: TradeRecord[] = [
      makeTrade({ type: "buy", timestamp: new Date(now).toISOString() }),
      makeTrade({ type: "sell", timestamp: new Date(now + 60000).toISOString() }), // 1 min later — reversal
      makeTrade({ type: "buy", timestamp: new Date(now + 120000).toISOString() }),
      makeTrade({ type: "sell", timestamp: new Date(now + 180000).toISOString() }), // another reversal
    ]
    const result = analyzeBehavior(trades)
    expect(result.patterns.reversalRate).toBeGreaterThan(0)
  })

  it("detects concentration risk for single-stock portfolios", () => {
    const trades = Array.from({ length: 12 }, (_, i) =>
      makeTrade({
        symbol: "TSLA",
        timestamp: new Date(Date.now() + i * 3600000).toISOString(),
      })
    )
    const result = analyzeBehavior(trades)
    const alert = result.alerts.find(a => a.type === "concentration_risk")
    expect(alert).toBeDefined()
    expect(result.patterns.uniqueSymbols).toBe(1)
  })

  it("reports healthy patterns when trades are well-spaced and aligned", () => {
    const trades: TradeRecord[] = Array.from({ length: 5 }, (_, i) =>
      makeTrade({
        type: "buy",
        trendSignal: 1,
        sentimentSignal: 1,
        symbol: ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN"][i],
        timestamp: new Date(Date.now() + i * 7200000).toISOString(), // 2 hours apart
      })
    )
    const result = analyzeBehavior(trades)
    expect(result.alerts).toHaveLength(0)
    expect(result.patterns.trendAlignmentRate).toBe(100)
    expect(result.patterns.sentimentAlignmentRate).toBe(100)
    expect(result.patterns.uniqueSymbols).toBe(5)
  })
})
