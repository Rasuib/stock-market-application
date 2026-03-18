export interface DashboardStat {
  label: string
  value: string
  description: string
  intent: "positive" | "negative" | "neutral"
  icon: string
  tag?: string
  direction?: "up" | "down"
}

export interface Notification {
  id: string
  title: string
  message: string
  timestamp: string
  type: "info" | "warning" | "success" | "error" | "trade_buy" | "trade_sell"
  read: boolean
  priority: "low" | "medium" | "high"
}

export interface WidgetData {
  location: string
  timezone: string
  temperature: string
  weather: string
  date: string
}

