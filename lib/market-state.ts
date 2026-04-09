export type MarketActivityState = "open" | "pre-market" | "after-hours" | "closed" | "unknown"

export function normalizeYahooMarketState(value: string | null | undefined): MarketActivityState {
  const state = value?.toUpperCase().trim()

  switch (state) {
    case "REGULAR":
      return "open"
    case "PRE":
    case "PREPRE":
      return "pre-market"
    case "POST":
    case "POSTPOST":
      return "after-hours"
    case "CLOSED":
      return "closed"
    default:
      return "unknown"
  }
}

export function marketStateLabel(value: string | null | undefined): string {
  const state = normalizeYahooMarketState(value)

  switch (state) {
    case "open":
      return "Market Open"
    case "pre-market":
      return "Pre-market"
    case "after-hours":
      return "After-hours"
    case "closed":
      return "Market Closed"
    default:
      return value ? `Market: ${value}` : "Market Status Unknown"
  }
}

export function isMarketActivelyTrading(value: string | null | undefined): boolean {
  return normalizeYahooMarketState(value) === "open"
}
