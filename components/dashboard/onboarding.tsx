"use client"

import { useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, ShoppingCart, GraduationCap, ChevronRight, CheckCircle2, X } from "lucide-react"
import { useTradingStore, type OnboardingStatus } from "@/stores/trading-store"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    id: "step1_search" as const,
    title: "Search for a stock",
    description: "Type a company name or ticker (like AAPL or RELIANCE) in the search box above and select a result.",
    icon: Search,
    completionHint: "Select a stock from search results to continue.",
  },
  {
    id: "step2_trade" as const,
    title: "Place your first trade",
    description: "Write a short thesis (why you're trading), then buy some shares. Minimum 10 characters for your reasoning.",
    icon: ShoppingCart,
    completionHint: "Execute a buy order with a thesis to continue.",
  },
  {
    id: "step3_review" as const,
    title: "Read your coaching report",
    description: "Scroll down to see your coaching feedback — what you did well and what to improve.",
    icon: GraduationCap,
    completionHint: "Review your coaching card below.",
  },
] as const

const STATUS_TO_STEP: Record<string, number> = {
  not_started: 0,
  step1_search: 0,
  step2_trade: 1,
  step3_review: 2,
  completed: 3,
  skipped: -1,
}

/** Hook to get current onboarding step and advance it */
export function useOnboarding() {
  const onboardingStatus = useTradingStore((s) => s.onboardingStatus)
  const setOnboardingStatus = useTradingStore((s) => s.setOnboardingStatus)
  const trades = useTradingStore((s) => s.trades)
  const selectedStock = useTradingStore((s) => s.selectedStock)

  const currentStep = STATUS_TO_STEP[onboardingStatus] ?? 0
  const isActive = onboardingStatus !== "completed" && onboardingStatus !== "skipped"
  const isCompleted = onboardingStatus === "completed"

  const advance = useCallback((to: OnboardingStatus) => {
    setOnboardingStatus(to)
  }, [setOnboardingStatus])

  const skip = useCallback(() => {
    setOnboardingStatus("skipped")
  }, [setOnboardingStatus])

  const restart = useCallback(() => {
    setOnboardingStatus("not_started")
  }, [setOnboardingStatus])

  return { onboardingStatus, currentStep, isActive, isCompleted, advance, skip, restart, trades, selectedStock }
}

/** Listener that auto-advances onboarding based on user actions */
export function useOnboardingAutoAdvance() {
  const onboardingStatus = useTradingStore((s) => s.onboardingStatus)
  const setOnboardingStatus = useTradingStore((s) => s.setOnboardingStatus)
  const selectedStock = useTradingStore((s) => s.selectedStock)
  const trades = useTradingStore((s) => s.trades)
  const prevTradeCount = useRef(trades.length)

  // If a user already has trades, onboarding should be considered done.
  useEffect(() => {
    if (trades.length > 0 && onboardingStatus !== "completed" && onboardingStatus !== "skipped") {
      setOnboardingStatus("completed")
    }
  }, [trades.length, onboardingStatus, setOnboardingStatus])

  // Step 1 → Step 2: when a stock is selected
  useEffect(() => {
    if (onboardingStatus === "not_started" || onboardingStatus === "step1_search") {
      if (selectedStock) {
        setOnboardingStatus("step2_trade")
      }
    }
  }, [selectedStock, onboardingStatus, setOnboardingStatus])

  // Step 2 → Step 3: when first trade is placed
  useEffect(() => {
    if (onboardingStatus === "step2_trade" && trades.length > prevTradeCount.current) {
      setOnboardingStatus("step3_review")
    }
    prevTradeCount.current = trades.length
  }, [trades.length, onboardingStatus, setOnboardingStatus])
}

export default function Onboarding() {
  const { onboardingStatus, currentStep, isActive, advance, skip } = useOnboarding()

  useOnboardingAutoAdvance()

  if (!isActive) return null

  return (
    <Card className="bg-linear-to-br from-primary/10 to-primary/5 border-primary/20 mb-6 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Quick Start
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              3 steps to your first coaching report (~2 min)
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={skip}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-3" role="list" aria-label="Onboarding steps">
          {STEPS.map((step, i) => {
            const isComplete = i < currentStep
            const isCurrent = i === currentStep
            const Icon = step.icon

            return (
              <div
                key={step.id}
                role="listitem"
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg transition-all",
                  isCurrent && "bg-primary/10 border border-primary/30",
                  isComplete && "bg-profit/5 border border-profit/20 opacity-70",
                  !isCurrent && !isComplete && "bg-surface border border-surface-border opacity-40",
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  isComplete && "bg-profit/20",
                  isCurrent && "bg-primary/20",
                  !isCurrent && !isComplete && "bg-muted",
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-profit" />
                  ) : (
                    <Icon className={cn("w-4 h-4", isCurrent ? "text-primary" : "text-muted-foreground")} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    isComplete && "text-profit",
                    isCurrent && "text-foreground",
                    !isCurrent && !isComplete && "text-muted-foreground",
                  )}>
                    {step.title}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  )}
                </div>
                {isCurrent && i === 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => advance("completed")}
                    className="text-primary hover:text-primary/80 shrink-0"
                    aria-label="Mark onboarding complete"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {currentStep >= 2 && onboardingStatus === "step3_review" && (
          <div className="mt-4 text-center">
            <Button
              size="sm"
              onClick={() => advance("completed")}
            >
              Got it — I&apos;m ready to trade!
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
