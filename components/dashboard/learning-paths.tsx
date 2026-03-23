"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Play, AlertTriangle } from "lucide-react"
import { useTradingStore } from "@/stores/trading-store"
import { getLessonLinksForFlags } from "@/lib/coaching/flag-lesson-map"
import type { BehavioralFlag } from "@/lib/coaching/types"

interface Lesson {
  id: string
  title: string
  content: string
  keyTakeaway: string
}

interface LearningPath {
  id: string
  title: string
  description: string
  level: "beginner" | "intermediate" | "advanced"
  lessons: Lesson[]
}

const PATHS: LearningPath[] = [
  {
    id: "basics",
    title: "Trading Basics",
    description: "Understand the fundamentals of stock markets",
    level: "beginner",
    lessons: [
      {
        id: "what-is-stock",
        title: "What is a Stock?",
        content: "A stock represents ownership in a company. When you buy a stock, you own a tiny piece of that company. Companies issue stocks to raise money for growth. As the company grows and earns more profit, the stock price typically rises — and your investment grows with it.\n\nStocks are traded on exchanges like the NYSE (US) or NSE (India). The price of a stock at any moment is determined by supply and demand — how many people want to buy vs sell.",
        keyTakeaway: "Buying a stock means owning a piece of a real business. Price goes up when more people want to buy than sell.",
      },
      {
        id: "buy-sell",
        title: "Buying and Selling",
        content: "To make money in stocks, the goal is simple: buy low, sell high. You buy a stock when you think it will go up, and sell it when you think it's reached a good price.\n\nBut timing the market is extremely hard. That's why most successful traders focus on understanding the company and market conditions rather than trying to predict exact prices.\n\nIn Tradia, you start with $100,000 of virtual money. Try buying stocks you've researched and see how your decisions play out.",
        keyTakeaway: "Buy when you have a reason (not a feeling). Sell based on your plan, not panic.",
      },
      {
        id: "risk-management-101",
        title: "Risk Management 101",
        content: "The #1 rule of trading: never risk more than you can afford to lose. Professional traders follow strict rules:\n\n1. Position sizing — Never put more than 5-10% of your total portfolio into a single stock\n2. Stop losses — Decide in advance how much you're willing to lose on a trade\n3. Diversification — Spread your money across different stocks and sectors\n\nIn Tradia, the coaching system tracks how much of your portfolio is in a single stock. If you go above 30%, you'll get a warning.",
        keyTakeaway: "Small positions + diversification = survival. The best traders are the ones who manage risk, not the ones who make the biggest bets.",
      },
    ],
  },
  {
    id: "analysis",
    title: "Understanding Market Signals",
    description: "Learn to read sentiment and technical indicators",
    level: "intermediate",
    lessons: [
      {
        id: "sentiment",
        title: "What is Market Sentiment?",
        content: "Market sentiment is the overall mood of investors toward a particular stock or the market as a whole. It's driven by news, earnings reports, economic data, and social media.\n\nTradia uses FinBERT, an AI model trained on financial text, to analyze news headlines and determine whether the sentiment around a stock is bullish (positive), bearish (negative), or neutral.\n\nImportant: Sentiment is one signal, not a guarantee. A stock can have bullish sentiment but still drop if the overall market crashes.",
        keyTakeaway: "Sentiment tells you what the crowd thinks. Use it as one input, not your only decision factor.",
      },
      {
        id: "trends",
        title: "Trend Detection",
        content: "A trend is the general direction a stock's price is moving. Tradia uses moving averages to detect trends:\n\n- Uptrend: Short-term average is above long-term average (price is generally rising)\n- Downtrend: Short-term average is below long-term average (price is generally falling)\n- Sideways: No clear direction\n\nThe 'momentum' value tells you how strong the trend is. High momentum in an uptrend = the stock is rising fast.",
        keyTakeaway: "Trade with the trend, not against it. If a stock is in a downtrend, think twice before buying.",
      },
      {
        id: "combining-signals",
        title: "Combining Multiple Signals",
        content: "The best trades happen when multiple signals agree:\n\n- Bullish sentiment + Uptrend = Strong buy signal\n- Bearish sentiment + Downtrend = Strong sell signal\n- Conflicting signals (bullish sentiment but downtrend) = Be cautious\n\nTradia's coaching system scores your trades partly on 'signal alignment' — how well your trade matched the available market data.\n\nPro tip: When signals conflict, the safest move is often to wait.",
        keyTakeaway: "Don't trade on just one signal. Wait for confirmation from multiple sources.",
      },
    ],
  },
  {
    id: "psychology",
    title: "Trading Psychology",
    description: "Master your emotions to make better decisions",
    level: "advanced",
    lessons: [
      {
        id: "emotions",
        title: "Fear and Greed",
        content: "The two most dangerous emotions in trading:\n\n- FEAR makes you sell too early (locking in small profits) or avoid good opportunities\n- GREED makes you hold too long (watching profits evaporate) or bet too much on one stock\n\nTradia's behavioral memory system tracks these patterns. If you consistently sell winners too early or hold losers too long, the coaching will flag it.",
        keyTakeaway: "Have a plan before you trade. When emotions kick in, follow the plan — not the feeling.",
      },
      {
        id: "overtrading",
        title: "Overtrading",
        content: "Overtrading is making too many trades in a short period. It usually happens when:\n\n- You're trying to 'make back' a loss\n- You're bored and trading for excitement\n- You can't sit with an open position without fidgeting\n\nMore trades ≠ more profit. Professional traders often make just a few well-researched trades per week.\n\nTradia tracks your trading frequency. If you make more than 5 trades per hour, you'll get a discipline warning.",
        keyTakeaway: "Quality over quantity. Fewer, well-thought-out trades beat many impulsive ones.",
      },
      {
        id: "loss-aversion",
        title: "Loss Aversion",
        content: "Humans feel losses roughly 2x more strongly than equivalent gains. This means:\n\n- A $100 loss feels as bad as a $200 gain feels good\n- You'll hold losing positions too long, hoping they'll 'come back'\n- You'll sell winning positions too early to 'lock in' the gain\n\nThe fix: Set rules before trading. Decide your exit price (both profit target AND stop loss) BEFORE you buy. Then follow through.",
        keyTakeaway: "Accept that losses are part of trading. The goal isn't to never lose — it's to make sure your wins are bigger than your losses.",
      },
    ],
  },
]

// Track completed lessons in localStorage
function getCompletedLessons(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem("tradia_completed_lessons")
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function markLessonComplete(lessonId: string) {
  const completed = getCompletedLessons()
  completed.add(lessonId)
  localStorage.setItem("tradia_completed_lessons", JSON.stringify([...completed]))
}

export default function LearningPaths() {
  const [expandedPath, setExpandedPath] = useState<string | null>("basics")
  const [activeLesson, setActiveLesson] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(() => getCompletedLessons())
  const trades = useTradingStore((s) => s.trades)

  const handleComplete = (lessonId: string) => {
    markLessonComplete(lessonId)
    setCompleted(prev => new Set([...prev, lessonId]))
    setActiveLesson(null)
  }

  // Compute "relevant to you" lessons from recent behavioral flags
  const { relevantLessons, flagMessages } = useMemo(() => {
    const recentTrades = trades.slice(-20)
    const allFlags: BehavioralFlag[] = []
    for (const trade of recentTrades) {
      for (const f of trade.coaching.behavioralFlags) {
        allFlags.push(f.flag as BehavioralFlag)
      }
    }
    const links = getLessonLinksForFlags(allFlags)
    const relevant = new Set(links.map(l => l.lessonId))
    const messages: Record<string, string> = {}
    for (const link of links) {
      const lessonCompleted = completed.has(link.lessonId)
      messages[link.lessonId] = lessonCompleted ? link.reminderMessage : link.nudgeMessage
    }
    return { relevantLessons: relevant, flagMessages: messages }
  }, [trades, completed])

  const activeLessonData = PATHS.flatMap(p => p.lessons).find(l => l.id === activeLesson)

  // Lesson reader view
  if (activeLessonData) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveLesson(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          Back to Learning Paths
        </Button>

        <Card className="bg-surface border-surface-border">
          <CardHeader>
            <CardTitle className="text-foreground text-xl">{activeLessonData.title}</CardTitle>
            {relevantLessons.has(activeLessonData.id) && (
              <div className="flex items-start gap-2 mt-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  {flagMessages[activeLessonData.id]}
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-invert prose-sm max-w-none">
              {activeLessonData.content.split("\n\n").map((para, i) => (
                <p key={i} className="text-foreground/80 leading-relaxed text-sm">{para}</p>
              ))}
            </div>

            <div className="p-4 bg-primary/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-primary font-semibold mb-1">KEY TAKEAWAY</p>
              <p className="text-sm text-foreground">{activeLessonData.keyTakeaway}</p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => handleComplete(activeLessonData.id)}
                className="bg-success hover:bg-success/90"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {completed.has(activeLessonData.id) ? "Already Completed" : "Mark Complete"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveLesson(null)}
                className="border-border text-muted-foreground"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Path list view
  return (
    <div className="space-y-4">
      {/* Contextual banner: lessons relevant to your recent behavior */}
      {relevantLessons.size > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 space-y-2">
            <div className="flex items-center gap-2 text-warning text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Recommended for You
            </div>
            <p className="text-xs text-muted-foreground">
              Based on your recent trades, these lessons may help:
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from(relevantLessons).map(lessonId => {
                const lesson = PATHS.flatMap(p => p.lessons).find(l => l.id === lessonId)
                if (!lesson) return null
                const isCompleted = completed.has(lessonId)
                return (
                  <button
                    key={lessonId}
                    onClick={() => setActiveLesson(lessonId)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isCompleted
                        ? "bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20"
                        : "bg-warning/20 text-warning border border-warning/40 hover:bg-warning/30"
                    }`}
                  >
                    {lesson.title}
                    {isCompleted && <span className="ml-1 opacity-60">(revisit)</span>}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {PATHS.map(path => {
        const isExpanded = expandedPath === path.id
        const completedCount = path.lessons.filter(l => completed.has(l.id)).length
        const totalCount = path.lessons.length
        const progress = completedCount / totalCount

        return (
          <Card key={path.id} className="bg-surface border-surface-border">
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedPath(isExpanded ? null : path.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    progress === 1 ? "bg-success/20" : "bg-primary/10"
                  }`}>
                    {progress === 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base text-foreground">{path.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{path.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`text-[10px] ${
                    path.level === "beginner" ? "bg-success/20 text-success" :
                    path.level === "intermediate" ? "bg-primary/20 text-primary" :
                    "bg-chart-4/20 text-chart-4"
                  }`}>
                    {path.level}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{completedCount}/{totalCount}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progress === 1 ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-2">
                {path.lessons.map((lesson, i) => {
                  const isComplete = completed.has(lesson.id)
                  const isRelevant = relevantLessons.has(lesson.id)
                  return (
                    <div
                      key={lesson.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        isComplete
                          ? "bg-success/5 border border-success/20 hover:bg-success/10"
                          : isRelevant
                          ? "bg-warning/5 border border-warning/20 hover:bg-warning/10"
                          : "bg-surface border border-surface-border hover:bg-surface-hover"
                      }`}
                      onClick={() => setActiveLesson(lesson.id)}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isComplete ? "bg-success/20" : isRelevant ? "bg-warning/20" : "bg-muted"
                      }`}>
                        {isComplete ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        ) : isRelevant ? (
                          <AlertTriangle className="w-3 h-3 text-warning" />
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${isComplete ? "text-success" : isRelevant ? "text-warning" : "text-foreground"}`}>
                          {lesson.title}
                          {isRelevant && !isComplete && (
                            <Badge variant="outline" className="ml-2 text-[9px] text-warning border-warning/30">
                              Relevant to you
                            </Badge>
                          )}
                          {isRelevant && isComplete && (
                            <Badge variant="outline" className="ml-2 text-[9px] text-warning border-warning/30">
                              Revisit
                            </Badge>
                          )}
                        </p>
                      </div>
                      <Play className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )
                })}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
