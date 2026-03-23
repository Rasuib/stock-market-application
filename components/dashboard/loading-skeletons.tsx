"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"

/** Pulsing signal badges placeholder (for sentiment + trend loading) */
export function SignalsSkeleton() {
  return (
    <div className="flex gap-2 flex-wrap">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-full border border-surface-border">
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono">Loading sentiment...</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-full border border-surface-border">
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono">Loading trend...</span>
      </div>
    </div>
  )
}

/** Placeholder for the stock search results area */
export function SearchResultsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading search results">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 bg-surface rounded-lg border border-surface-border animate-pulse">
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-5 w-16 ml-auto" />
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-8 w-28 ml-auto mt-2" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading search results...</span>
    </div>
  )
}

/** Placeholder for the stock detail panel (price + chart area) */
export function StockDetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading stock details">
      <div className="flex items-center justify-between p-4 bg-surface rounded-lg animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-6 w-20 ml-auto" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-8 w-28 ml-auto mt-2" />
        </div>
      </div>
      <div className="p-4 bg-surface rounded-lg animate-pulse">
        <Skeleton className="h-5 w-40 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <span className="sr-only">Loading stock details...</span>
    </div>
  )
}

/** Inline spinner shown next to text */
export function InlineSpinner({ text }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      {text && <span className="text-xs font-mono">{text}</span>}
    </span>
  )
}

/** Full-area loading overlay */
export function ViewLoadingOverlay({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-16" role="status">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm font-mono">{text}</p>
      </div>
    </div>
  )
}

/** Dashboard stat skeleton for initial loading */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Loading statistics">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 bg-surface rounded-lg border border-surface-border animate-pulse">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-7 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
      <span className="sr-only">Loading statistics...</span>
    </div>
  )
}

/** Market briefing skeleton */
export function MarketBriefingSkeleton() {
  return (
    <div className="p-4 bg-surface rounded-lg border border-surface-border animate-pulse" role="status" aria-label="Loading market briefing">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-surface-elevated border border-surface-border">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading market briefing...</span>
    </div>
  )
}
