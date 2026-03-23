"use client"

import { useState } from "react"
import { AlertTriangle, X } from "lucide-react"

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="sticky top-0 lg:top-0 z-[60] bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center gap-3 backdrop-blur-sm">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      <p className="text-xs sm:text-sm text-amber-200 flex-1">
        <strong>Educational simulator only.</strong> Not financial advice. All trades use virtual money.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-300/70 hover:text-amber-200 touch-manipulation p-1"
        aria-label="Dismiss disclaimer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
