"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RotateCcw, Loader2 } from "lucide-react"

export default function AccountResetButton() {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    setLoading(true)
    try {
      const res = await fetch("/api/user/reset", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? "Reset failed")
      }

      // Clear all tradia_ keys from localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith("tradia_")) keysToRemove.push(key)
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))

      window.location.reload()
    } catch (err) {
      setLoading(false)
      setConfirming(false)
      alert(err instanceof Error ? err.message : "Failed to reset account")
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleReset}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            "Are you sure? This cannot be undone"
          )}
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={() => setConfirming(true)}
    >
      <RotateCcw />
      Reset Account
    </Button>
  )
}
