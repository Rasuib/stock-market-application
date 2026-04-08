"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, X } from "lucide-react"

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false)
  const bannerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = document.documentElement
    const setHeight = () => {
      const height = dismissed ? 0 : (bannerRef.current?.offsetHeight ?? 0)
      root.style.setProperty("--disclaimer-height", `${height}px`)
    }

    setHeight()

    if (dismissed || !bannerRef.current) {
      return () => {
        root.style.setProperty("--disclaimer-height", "0px")
      }
    }

    const observer = new ResizeObserver(setHeight)
    observer.observe(bannerRef.current)
    window.addEventListener("resize", setHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", setHeight)
      root.style.setProperty("--disclaimer-height", "0px")
    }
  }, [dismissed])

  if (dismissed) return null

  return (
    <div ref={bannerRef} className="sticky top-0 z-[60] border-b border-amber-500/30 bg-amber-500/15 backdrop-blur-sm">
      <div className="mx-auto flex w-full items-start gap-3 px-4 py-2.5 sm:items-center lg:px-6">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400 sm:mt-0" />
        <p className="flex-1 text-sm leading-relaxed text-amber-200">
          <strong>Educational simulator only.</strong> Not financial advice. All trades use virtual money.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="touch-manipulation rounded p-1 text-amber-300/70 transition-colors hover:text-amber-200"
          aria-label="Dismiss disclaimer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
