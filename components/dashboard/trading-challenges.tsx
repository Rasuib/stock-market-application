"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Target, Shield, Brain, Sparkles, ChevronRight } from "lucide-react"
import { useTradingStore } from "@/stores/trading-store"
import { CHALLENGE_RULES, getActiveChallenges, setActiveChallenges } from "@/lib/challenges"

const CATEGORY_CONFIG = {
  risk: { icon: Shield, label: "Risk", color: "text-loss" },
  discipline: { icon: Brain, label: "Discipline", color: "text-warning" },
  quality: { icon: Sparkles, label: "Quality", color: "text-primary" },
} as const

export default function TradingChallenges({ expanded = false }: { expanded?: boolean }) {
  const trades = useTradingStore((s) => s.trades)
  const [showAll, setShowAll] = useState(expanded)
  const [activeChallenges, setActiveChallengesState] = useState<Set<string>>(() => getActiveChallenges())

  const toggleChallenge = useCallback((id: string) => {
    setActiveChallengesState(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      setActiveChallenges(next)
      return next
    })
  }, [])

  // Compute stats for display
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayTrades = trades.filter(t => t.timestamp.startsWith(today))
    return {
      todayTradeCount: todayTrades.length,
      totalTrades: trades.length,
    }
  }, [trades])

  const displayed = showAll ? CHALLENGE_RULES : CHALLENGE_RULES.slice(0, 3)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-warning flex items-center gap-2">
            <Target className="w-5 h-5" />
            Trading Rules
          </CardTitle>
          <Badge variant="outline-warning">
            {activeChallenges.size}/{CHALLENGE_RULES.length} active
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Active rules are enforced before every trade. Violations block execution.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Today's stats */}
        <div className="flex gap-3 text-xs font-mono">
          <div className="flex-1 bg-surface rounded-lg px-3 py-2 border border-surface-border">
            <span className="text-muted-foreground">Today</span>
            <p className="text-foreground font-bold">{stats.todayTradeCount} trades</p>
          </div>
          <div className="flex-1 bg-surface rounded-lg px-3 py-2 border border-surface-border">
            <span className="text-muted-foreground">All time</span>
            <p className="text-foreground font-bold">{stats.totalTrades} trades</p>
          </div>
        </div>

        {displayed.map(rule => {
          const isActive = activeChallenges.has(rule.id)
          const cat = CATEGORY_CONFIG[rule.category]
          const CatIcon = cat.icon

          return (
            <div
              key={rule.id}
              className={`p-3 rounded-lg border transition-all ${
                isActive
                  ? "bg-surface border-primary/20"
                  : "bg-surface/50 border-surface-border opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isActive ? "bg-primary/10" : "bg-muted"
                }`}>
                  <CatIcon className={`w-3.5 h-3.5 ${isActive ? cat.color : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {rule.title}
                    </p>
                    <button
                      onClick={() => toggleChallenge(rule.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        isActive ? "bg-primary" : "bg-muted"
                      }`}
                      role="switch"
                      aria-checked={isActive}
                      aria-label={`${isActive ? "Disable" : "Enable"} ${rule.title}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                          isActive ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                  <Badge variant="secondary" className="text-[9px] mt-1.5">
                    {cat.label}
                  </Badge>
                </div>
              </div>
            </div>
          )
        })}

        {!showAll && CHALLENGE_RULES.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            View all rules
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
