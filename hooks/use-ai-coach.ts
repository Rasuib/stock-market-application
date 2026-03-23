"use client"

import { useState, useCallback, useRef, useSyncExternalStore } from "react"
import type { AITradeAnalysis, AISessionInsight, AIChatMessage } from "@/lib/ai-coach"
import type { CoachingReport, EvaluateTradeInput, LearningSummary, TradeWithCoaching } from "@/lib/coaching/types"

// ── Availability (external store to avoid setState-in-effect) ──

let cachedStatus: { available: boolean; checked: boolean } = { available: false, checked: false }
let statusListeners: Array<() => void> = []
let statusFetched = false

function notifyStatusListeners() {
  for (const listener of statusListeners) listener()
}

function subscribeStatus(listener: () => void) {
  statusListeners.push(listener)
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener)
  }
}

function getStatusSnapshot() {
  return cachedStatus
}

function getServerStatusSnapshot() {
  return { available: false, checked: false }
}

// Trigger fetch once
if (typeof window !== "undefined" && !statusFetched) {
  statusFetched = true
  fetch("/api/ai-coach/status")
    .then(res => res.json())
    .then(data => {
      cachedStatus = { available: !!data.available, checked: true }
      notifyStatusListeners()
    })
    .catch(() => {
      cachedStatus = { available: false, checked: true }
      notifyStatusListeners()
    })
}

export function useAICoachAvailability() {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getServerStatusSnapshot)
}

// ── Trade Analysis ──

export function useAITradeAnalysis() {
  const [analysis, setAnalysis] = useState<AITradeAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (input: EvaluateTradeInput, coaching: CoachingReport) => {
    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const res = await fetch("/api/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "trade-analysis", input, coaching }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "AI analysis failed")
      }

      const data = await res.json()
      setAnalysis(data.analysis)
      return data.analysis as AITradeAnalysis
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI analysis failed"
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { analysis, loading, error, analyze }
}

// ── Session Insights ──

export function useAISessionInsight() {
  const [insight, setInsight] = useState<AISessionInsight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateInsight = useCallback(async (
    summary: LearningSummary,
    recentTrades: TradeWithCoaching[],
  ) => {
    setLoading(true)
    setError(null)
    setInsight(null)

    try {
      const res = await fetch("/api/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "session-insight", summary, recentTrades }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Session insight failed")
      }

      const data = await res.json()
      setInsight(data.insight)
      return data.insight as AISessionInsight
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Session insight failed"
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { insight, loading, error, generateInsight }
}

// ── Streaming Chat ──

export function useAICoachChat() {
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (
    userMessage: string,
    summary: LearningSummary | null,
    recentTrades: TradeWithCoaching[],
  ) => {
    const newUserMsg: AIChatMessage = { role: "user", content: userMessage }
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)
    setStreaming(true)

    // Add empty assistant message that we'll stream into
    const assistantMsg: AIChatMessage = { role: "assistant", content: "" }
    setMessages([...updatedMessages, assistantMsg])

    try {
      abortRef.current = new AbortController()

      const res = await fetch("/api/ai-coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          summary,
          recentTrades,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error("Chat request failed")
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") break

            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                accumulated += parsed.text
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: "assistant", content: accumulated }
                  return updated
                })
              }
              if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue // skip malformed chunks
              throw e
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return

      const errorMsg = err instanceof Error ? err.message : "Chat failed"
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Sorry, I couldn't respond right now. ${errorMsg}`,
        }
        return updated
      })
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  return { messages, streaming, sendMessage, clearChat, stopStreaming }
}
