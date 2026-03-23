"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, RefreshCw, Target, Brain, Lightbulb } from "lucide-react"
import { useAISessionInsight, useAICoachAvailability } from "@/hooks/use-ai-coach"
import { useTradingStore } from "@/stores/trading-store"
import { generateLearningSummary } from "@/lib/coaching"

export default function AISessionInsights() {
  const { available, checked } = useAICoachAvailability()
  const { insight, loading, error, generateInsight } = useAISessionInsight()

  const trades = useTradingStore((s) => s.trades)
  const summary = useMemo(() => generateLearningSummary(trades), [trades])

  if (!checked || !available) return null
  if (trades.length < 2) return null

  const handleGenerate = () => {
    generateInsight(summary, trades.slice(-20))
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-chart-4 flex items-center gap-2 text-base">
            <Brain className="w-5 h-5" />
            AI Session Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] text-chart-4 border-chart-4/30">
              Gemini
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
              className="h-7 px-2 text-xs text-chart-4 hover:text-chart-4/80 hover:bg-chart-4/10"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1" />
              )}
              {insight ? "Refresh" : "Analyze"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!insight && !loading && !error && (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 text-chart-4/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm mb-3">
              Get AI-powered insights on your trading session
            </p>
            <Button
              onClick={handleGenerate}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Session Analysis
            </Button>
          </div>
        )}

        {loading && (
          <div className="text-center py-6">
            <div className="w-8 h-8 border-2 border-chart-4 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-chart-4 text-sm animate-pulse">Analyzing your trading patterns...</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              className="mt-2 text-xs text-destructive hover:text-destructive/80"
            >
              Try again
            </Button>
          </div>
        )}

        {insight && !loading && (
          <div className="space-y-4">
            {/* Performance summary */}
            <div>
              <p className="text-sm text-foreground/80 leading-relaxed">{insight.performanceSummary}</p>
            </div>

            {/* Pattern analysis */}
            <div className="p-3 bg-chart-4/10 border border-chart-4/20 rounded-lg">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5 text-chart-4" />
                <span className="text-xs text-chart-4 font-semibold">Pattern Analysis</span>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{insight.patternAnalysis}</p>
            </div>

            {/* Action plan */}
            {insight.actionPlan.length > 0 && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-primary font-semibold">Action Plan</span>
                </div>
                <ul className="space-y-1.5">
                  {insight.actionPlan.map((action, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="text-primary font-mono text-xs mt-0.5">{i + 1}.</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mindset tip */}
            <p className="text-xs text-chart-4/80 italic">{insight.mindsetTip}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
