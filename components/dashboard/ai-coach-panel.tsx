"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Send, Square, Trash2, Lightbulb } from "lucide-react"
import { useAICoachChat, useAICoachAvailability } from "@/hooks/use-ai-coach"
import { useTradingStore } from "@/stores/trading-store"
import { generateLearningSummary } from "@/lib/coaching"

const STARTER_PROMPTS = [
  "How am I doing overall?",
  "What's my biggest mistake?",
  "How can I improve my risk management?",
  "Explain my last trade",
  "What should I focus on next?",
]

export default function AICoachPanel() {
  const { available, checked } = useAICoachAvailability()
  const { messages, streaming, sendMessage, clearChat, stopStreaming } = useAICoachChat()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const trades = useTradingStore((s) => s.trades)
  const summary = useMemo(() => generateLearningSummary(trades), [trades])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (!checked) return null
  if (!available) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">AI Coach requires an API key.</p>
          <p className="text-muted-foreground text-xs mt-1">Add GEMINI_API_KEY to .env.local to enable.</p>
        </CardContent>
      </Card>
    )
  }

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || streaming) return
    setInput("")
    sendMessage(msg, summary, trades.slice(-20))
  }

  const handleStarterPrompt = (prompt: string) => {
    if (streaming) return
    sendMessage(prompt, summary, trades.slice(-20))
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-chart-4 flex items-center gap-2 text-base">
            <Sparkles className="w-5 h-5" />
            AI Trading Coach
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] text-chart-4 border-chart-4/30">
              Gemini
            </Badge>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground/80"
                title="Clear chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 pt-0">
        {/* Messages area */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-45 sm:min-h-55 max-h-75 sm:max-h-100 overflow-y-auto space-y-3 pr-1"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-6">
              <Sparkles className="w-10 h-10 text-chart-4/30 mb-3" />
              <p className="text-muted-foreground text-sm text-center mb-1">
                Ask me about your trades, strategy, or learning progress.
              </p>
              <p className="text-muted-foreground text-xs text-center mb-4">
                I have access to your full trading history and performance data.
              </p>

              {/* Starter prompts */}
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleStarterPrompt(prompt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-chart-4/10 border border-chart-4/20 text-xs text-chart-4 hover:bg-chart-4/20 transition-colors"
                  >
                    <Lightbulb className="w-3 h-3" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-chart-4/30 text-chart-4 border border-chart-4/30"
                      : "bg-surface text-foreground/80 border border-surface-border"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3 text-chart-4" />
                      <span className="text-[10px] text-chart-4 font-semibold">AI COACH</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content || (streaming && i === messages.length - 1 ? (
                      <span className="text-chart-4/70 animate-pulse">thinking...</span>
                    ) : null)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input area */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask your AI coach..."
            className="bg-surface border-border text-foreground text-sm placeholder:text-muted-foreground"
            disabled={streaming}
          />
          {streaming ? (
            <Button
              onClick={stopStreaming}
              size="sm"
              variant="outline"
              className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              size="sm"
              className="shrink-0 bg-purple-600 hover:bg-purple-700"
              disabled={!input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
