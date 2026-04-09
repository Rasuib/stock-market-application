import type React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bullet } from "@/components/ui/bullet"
import { cn } from "@/lib/utils"

interface DashboardStatProps {
  label: string
  value: string
  description?: string
  tag?: string
  icon: React.ElementType
  intent?: "positive" | "negative" | "neutral"
  direction?: "up" | "down"
}

interface AnimatedNumberProps {
  value: number
  prefix?: string
  suffix?: string
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, prefix = "", suffix = "" }) => {
  return (
    <span className="transition-all duration-300 ease-out">
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  )
}

export default function DashboardStat({ label, value, description, icon, tag, intent, direction }: DashboardStatProps) {
  const Icon = icon

  const parseValue = (val: string) => {
    const match = val.match(/^([^\d.-]*)([+-]?\d*\.?\d+)([^\d]*)$/)

    if (match) {
      const [, prefix, numStr, suffix] = match
      return {
        prefix: prefix || "",
        numericValue: Number.parseFloat(numStr),
        suffix: suffix || "",
        isNumeric: !Number.isNaN(Number.parseFloat(numStr)),
      }
    }

    return {
      prefix: "",
      numericValue: 0,
      suffix: val,
      isNumeric: false,
    }
  }

  const intentColor =
    intent === "positive" ? "text-profit" : intent === "negative" ? "text-loss" : "text-muted-foreground"

  const { prefix, numericValue, suffix, isNumeric } = parseValue(value)
  const trendLabel = direction === "up" ? "UP" : direction === "down" ? "DOWN" : "FLAT"

  return (
    <Card className="relative overflow-hidden border-surface-border/80 bg-surface/80 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.7)]">
      <CardHeader className="flex items-center justify-between border-b border-surface-border/60 pb-3">
        <CardTitle className="flex items-center gap-2 text-[13px] tracking-wide">
          <Bullet />
          {label}
        </CardTitle>
        <div className="rounded-md bg-background/60 p-1.5 ring-1 ring-surface-border/80">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>

      <CardContent className="relative flex-1 overflow-clip bg-surface-elevated/50 pt-4 md:pt-5">
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl leading-none font-display md:text-4xl">
            {isNumeric ? <AnimatedNumber value={numericValue} prefix={prefix} suffix={suffix} /> : value}
          </span>
          <Badge variant="outline" className={cn("text-[10px] tracking-wide uppercase", intentColor)}>
            {trendLabel}
          </Badge>
        </div>

        {description && (
          <div className="mt-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground md:text-sm">{description}</p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          {tag ? (
            <Badge variant="secondary" className="text-[10px] font-medium tracking-[0.08em] uppercase">
              {tag}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">No tag</span>
          )}
          <div
            className={cn(
              "h-1.5 w-14 rounded-full",
              direction === "up" ? "bg-profit/70" : direction === "down" ? "bg-loss/70" : "bg-muted",
            )}
          />
        </div>

        <div className="pointer-events-none absolute inset-0">
          <div
            className={cn(
              "absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl",
              intent === "positive" ? "bg-profit/20" : intent === "negative" ? "bg-loss/20" : "bg-primary/15",
            )}
          />
          <div className="absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        </div>
      </CardContent>
    </Card>
  )
}
