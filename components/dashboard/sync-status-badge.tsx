"use client"

import { useState, useEffect } from "react"
import { getSyncStatus, onSyncStatusChange, type SyncStatus } from "@/lib/sync"
import { Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<SyncStatus, {
  icon: typeof Cloud
  label: string
  className: string
}> = {
  synced: {
    icon: Cloud,
    label: "Synced",
    className: "text-profit",
  },
  syncing: {
    icon: Loader2,
    label: "Syncing...",
    className: "text-primary",
  },
  offline: {
    icon: CloudOff,
    label: "Offline",
    className: "text-muted-foreground",
  },
  error: {
    icon: AlertCircle,
    label: "Sync error",
    className: "text-loss",
  },
}

export default function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus)

  useEffect(() => {
    return onSyncStatusChange(setStatus)
  }, [])

  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md",
        "bg-surface border border-surface-border",
        config.className,
      )}
      role="status"
      aria-live="polite"
      title={config.label}
    >
      <Icon className={cn("w-3 h-3", status === "syncing" && "animate-spin")} />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  )
}
