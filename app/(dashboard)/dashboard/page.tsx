"use client"

import { useEffect, useState, lazy, Suspense } from "react"
import DashboardPageLayout from "@/components/dashboard/layout"
import DashboardStat from "@/components/dashboard/stat"
import TrendingUpIcon from "@/components/icons/trending-up"
import DollarSignIcon from "@/components/icons/dollar-sign"
import BarChartIcon from "@/components/icons/bar-chart"
import ActivityIcon from "@/components/icons/activity"
import { useNavigation } from "@/components/dashboard/navigation-context"
import ErrorBoundary from "@/components/error-boundary"
import { initTradingStore, useTradingStore } from "@/stores/trading-store"
import { useTradingStats } from "@/hooks/use-trading-stats"
import { ChevronDown, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

const StockSearchPanel = lazy(() => import("@/components/dashboard/stock-search-panel"))
const TradingSimulator = lazy(() => import("@/components/dashboard/trading-simulator"))
const AICoachPanel = lazy(() => import("@/components/dashboard/ai-coach-panel"))
const MarketBriefing = lazy(() => import("@/components/dashboard/market-briefing"))
const TradingChallenges = lazy(() => import("@/components/dashboard/trading-challenges"))
const Onboarding = lazy(() => import("@/components/dashboard/onboarding"))
const LearningPaths = lazy(() => import("@/components/dashboard/learning-paths"))
const Leaderboard = lazy(() => import("@/components/dashboard/leaderboard"))

const CoachingProgress = lazy(() => import("@/components/dashboard/coaching-progress"))
const MarketNewsView = lazy(() => import("@/components/dashboard/market-news-view"))
const StockAnalysisView = lazy(() => import("@/components/dashboard/stock-analysis-view"))
const TradingSimulatorView = lazy(() => import("@/components/dashboard/trading-simulator-view"))
const PortfolioView = lazy(() => import("@/components/dashboard/portfolio-view"))
const TradeHistoryView = lazy(() => import("@/components/dashboard/trade-history-view"))

const iconMap = {
  "dollar-sign": DollarSignIcon,
  "bar-chart": BarChartIcon,
  "trending-up": TrendingUpIcon,
  activity: ActivityIcon,
}

const ViewFallback = () => (
  <div className="flex items-center justify-center py-20" role="status">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="sr-only">Loading...</span>
    </div>
  </div>
)

// Views gated behind onboarding completion
const GATED_VIEWS = new Set(["portfolio", "news", "simulator", "learn", "challenges", "leaderboard", "progress", "history"])

function OnboardingGate() {
  const { setCurrentView } = useNavigation()
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Lock className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-center max-w-sm">
        Complete the quick start on the Dashboard first — search a stock, place a trade, and review your coaching.
      </p>
      <button
        onClick={() => setCurrentView("dashboard")}
        className="text-sm text-primary hover:underline"
      >
        Go to Dashboard
      </button>
    </div>
  )
}

export default function TradiaOverview() {
  const { currentView } = useNavigation()
  const onboardingStatus = useTradingStore((s) => s.onboardingStatus)
  const onboardingComplete = onboardingStatus === "completed" || onboardingStatus === "skipped"

  useEffect(() => {
    return initTradingStore()
  }, [])

  const renderActiveView = () => {
    // Gate non-essential views behind onboarding
    if (GATED_VIEWS.has(currentView) && !onboardingComplete) {
      return <OnboardingGate />
    }

    switch (currentView) {
      case "analysis":
        return (
          <ErrorBoundary section="Stock Analysis">
            <Suspense fallback={<ViewFallback />}>
              <StockAnalysisView />
            </Suspense>
          </ErrorBoundary>
        )
      case "portfolio":
        return (
          <ErrorBoundary section="Portfolio">
            <Suspense fallback={<ViewFallback />}>
              <PortfolioView />
            </Suspense>
          </ErrorBoundary>
        )
      case "news":
        return (
          <ErrorBoundary section="Market News">
            <Suspense fallback={<ViewFallback />}>
              <MarketNewsView />
            </Suspense>
          </ErrorBoundary>
        )
      case "simulator":
        return (
          <ErrorBoundary section="Trading Simulator">
            <Suspense fallback={<ViewFallback />}>
              <TradingSimulatorView />
            </Suspense>
          </ErrorBoundary>
        )
      case "learn":
        return (
          <ErrorBoundary section="Learning Paths">
            <Suspense fallback={<ViewFallback />}>
              <LearningPaths />
            </Suspense>
          </ErrorBoundary>
        )
      case "challenges":
        return (
          <ErrorBoundary section="Trading Challenges">
            <Suspense fallback={<ViewFallback />}>
              <TradingChallenges expanded />
            </Suspense>
          </ErrorBoundary>
        )
      case "leaderboard":
        return (
          <ErrorBoundary section="Your Stats">
            <Suspense fallback={<ViewFallback />}>
              <Leaderboard />
            </Suspense>
          </ErrorBoundary>
        )
      case "progress":
        return (
          <ErrorBoundary section="Coaching Progress">
            <Suspense fallback={<ViewFallback />}>
              <CoachingProgress />
            </Suspense>
          </ErrorBoundary>
        )
      case "history":
        return (
          <ErrorBoundary section="Trade History">
            <Suspense fallback={<ViewFallback />}>
              <TradeHistoryView />
            </Suspense>
          </ErrorBoundary>
        )
      default:
        return (
          <ErrorBoundary section="Dashboard">
            <DashboardView />
          </ErrorBoundary>
        )
    }
  }

  return (
    <DashboardPageLayout
      header={{
        title: getViewTitle(currentView),
        description: getViewDescription(currentView),
        icon: getViewIcon(currentView),
      }}
    >
      {renderActiveView()}
    </DashboardPageLayout>
  )
}

function getViewTitle(view: string) {
  switch (view) {
    case "analysis": return "Stock Analysis"
    case "portfolio": return "Portfolio Management"
    case "news": return "Market News"
    case "simulator": return "Trading Simulator"
    case "learn": return "Learning Paths"
    case "challenges": return "Trading Challenges"
    case "leaderboard": return "Your Stats"
    case "progress": return "Coaching Progress"
    case "history": return "Trade History"
    default: return "Dashboard"
  }
}

function getViewDescription(view: string) {
  switch (view) {
    case "analysis": return "Sentiment analysis and trend signals"
    case "portfolio": return "Manage your simulated portfolio"
    case "news": return "Latest market news and sentiment"
    case "simulator": return "Practice trading with virtual money"
    case "learn": return "Structured lessons to build trading skills"
    case "challenges": return "Complete challenges to test your skills"
    case "leaderboard": return "Your performance at a glance"
    case "progress": return "Your coaching improvement over time"
    case "history": return "Search, filter, and export your trades"
    default: return "Search, analyze, trade, learn"
  }
}

function getViewIcon(view: string) {
  switch (view) {
    case "analysis": return TrendingUpIcon
    case "portfolio": return DollarSignIcon
    case "news": return ActivityIcon
    case "simulator": return BarChartIcon
    default: return TrendingUpIcon
  }
}

/* ─── Insights tabs for secondary modules ─── */

const INSIGHT_TABS = [
  { id: "briefing", label: "Market" },
  { id: "coach", label: "AI Coach" },
  { id: "challenges", label: "Rules" },
  { id: "progress", label: "Progress" },
  { id: "stats", label: "Your Stats" },
] as const

type InsightTab = (typeof INSIGHT_TABS)[number]["id"]

function InsightsSection() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<InsightTab>("briefing")

  return (
    <section aria-label="Insights and extras">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        Insights &amp; Extras
      </button>

      {open && (
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Insights tabs">
            {INSIGHT_TABS.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors touch-manipulation",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div role="tabpanel" aria-label={INSIGHT_TABS.find(t => t.id === activeTab)?.label}>
            <Suspense fallback={<ViewFallback />}>
              {activeTab === "briefing" && <MarketBriefing />}
              {activeTab === "coach" && <AICoachPanel />}
              {activeTab === "challenges" && <TradingChallenges />}
              {activeTab === "progress" && <CoachingProgress compact />}
              {activeTab === "stats" && <Leaderboard compact />}
            </Suspense>
          </div>
        </div>
      )}
    </section>
  )
}

/* ─── Main Dashboard View: Search → Analyze → Trade → Review ─── */

function DashboardView() {
  const tradingStats = useTradingStats()
  const selectedStock = useTradingStore((s) => s.selectedStock)
  const onboardingStatus = useTradingStore((s) => s.onboardingStatus)
  const showOnboarding = onboardingStatus !== "completed" && onboardingStatus !== "skipped"

  return (
    <>
      {/* Onboarding for new users */}
      {showOnboarding && (
        <Suspense fallback={<ViewFallback />}>
          <Onboarding />
        </Suspense>
      )}

      {/* Stats row — compact overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tradingStats.map((stat, index) => (
          <DashboardStat
            key={index}
            label={stat.label}
            value={stat.value}
            description={stat.description}
            icon={iconMap[stat.icon as keyof typeof iconMap]}
            tag={stat.tag}
            intent={stat.intent}
            direction={stat.direction}
          />
        ))}
      </div>

      {/* A. Primary action: Search + stock context (full width) */}
      {/* B. Trade controls appear inline when a stock is selected */}
      <Suspense fallback={<ViewFallback />}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Search & chart take more space — this is the primary action */}
          <div className={cn(
            "lg:col-span-7",
            !selectedStock && "lg:col-span-12"
          )}>
            <StockSearchPanel />
          </div>

          {/* Trade controls — only visible when a stock is selected */}
          {selectedStock && (
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-16">
                <TradingSimulator />
              </div>
            </div>
          )}
        </div>
      </Suspense>

      {/* Prompt: tell the user what to do next when no stock selected */}
      {!selectedStock && !showOnboarding && (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">Search for a stock above to start analyzing and trading.</p>
        </div>
      )}

      {/* D. Insights — secondary modules in collapsible tabs */}
      <InsightsSection />
    </>
  )
}
