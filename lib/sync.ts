/**
 * Sync Engine
 *
 * Manages bidirectional sync between client store and server.
 * Server is source of truth for authenticated users.
 *
 * Features:
 * - Hydrate from server on load
 * - Debounced writes with retry + exponential backoff
 * - Offline queue with localStorage persistence
 * - Sync status tracking (synced / syncing / offline / error)
 * - Last-write-wins conflict resolution using server version
 */

import type { TradeWithCoaching, BehavioralMemoryStore, CurriculumProgress, AdaptiveWeights } from "./coaching/types"
import type { GamificationState } from "./gamification/types"
import type { StoredPosition } from "./storage"

// ── Sync Status ──

export type SyncStatus = "synced" | "syncing" | "offline" | "error"

type SyncListener = (status: SyncStatus) => void
let currentStatus: SyncStatus = "synced"
const listeners: Set<SyncListener> = new Set()

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export function onSyncStatusChange(fn: SyncListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function setSyncStatus(status: SyncStatus) {
  currentStatus = status
  listeners.forEach((fn) => fn(status))
}

// ── Server Data Shape ──

export interface ServerSnapshot {
  trades: TradeWithCoaching[]
  positions: Record<string, StoredPosition>
  balance: number
  behavioralMemory: BehavioralMemoryStore | null
  curriculumProgress: CurriculumProgress | null
  adaptiveWeights: AdaptiveWeights | null
  rewardHistory: number[]
  gamification: GamificationState | null
  onboardingStatus: string
  lastSynced: string
}

export interface ServerResponse {
  data: ServerSnapshot | null
  exists: boolean
  version: number
}

// ── Fetch from server ──

export async function fetchServerState(): Promise<{ snapshot: ServerSnapshot | null; version: number }> {
  const res = await fetch("/api/user-data", { credentials: "include" })
  if (res.status === 401) {
    return { snapshot: null, version: 0 }
  }
  if (!res.ok) {
    throw new Error(`Server returned ${res.status}`)
  }
  const body: ServerResponse = await res.json()
  if (!body.exists || !body.data) {
    return { snapshot: null, version: 0 }
  }
  return { snapshot: body.data, version: body.version }
}

// ── Push to server ──

interface PushPayload {
  trades: TradeWithCoaching[]
  positions: Record<string, StoredPosition>
  balance: number
  behavioralMemory: BehavioralMemoryStore | null
  curriculumProgress: CurriculumProgress | null
  adaptiveWeights: AdaptiveWeights | null
  rewardHistory: number[]
  gamification: GamificationState | null
  onboardingStatus?: string
}

let serverVersion = 0

export function setServerVersion(v: number) {
  serverVersion = v
}

export function getServerVersion(): number {
  return serverVersion
}

export async function pushToServer(payload: PushPayload): Promise<{ version: number }> {
  const res = await fetch("/api/user-data", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, version: serverVersion }),
  })

  if (res.status === 401) {
    throw new Error("Unauthorized")
  }
  if (!res.ok) {
    throw new Error(`Server returned ${res.status}`)
  }

  const body = await res.json()
  serverVersion = body.version
  return { version: body.version }
}

// ── PATCH for lightweight updates ──

export async function patchServer(fields: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/user-data", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  })
  if (!res.ok && res.status !== 401) {
    throw new Error(`PATCH failed: ${res.status}`)
  }
}

// ── Debounced Sync with Retry ──

const SYNC_DEBOUNCE_MS = 3_000
const MAX_RETRIES = 3
const QUEUE_KEY = "tradia_sync_queue"

let syncTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: PushPayload | null = null

/** Save pending payload to localStorage for offline resilience */
function persistQueue(payload: PushPayload) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(payload))
  } catch { /* quota exceeded */ }
}

function clearQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY)
  } catch { /* noop */ }
}

/** Load queued payload from localStorage (for offline replay) */
export function loadQueuedPayload(): PushPayload | null {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function executeSync(payload: PushPayload, retries = 0): Promise<void> {
  try {
    setSyncStatus("syncing")
    await pushToServer(payload)
    clearQueue()
    setSyncStatus("synced")
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** retries, 10_000)
      await new Promise((r) => setTimeout(r, delay))
      return executeSync(payload, retries + 1)
    }

    // Exhausted retries — go offline
    persistQueue(payload)
    const isOffline = !navigator.onLine || (err instanceof Error && err.message.includes("fetch"))
    setSyncStatus(isOffline ? "offline" : "error")
  }
}

/** Schedule a debounced sync to server. Replaces any pending sync. */
export function scheduleSync(payload: PushPayload): void {
  pendingPayload = payload
  persistQueue(payload)
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    if (pendingPayload) {
      executeSync(pendingPayload)
      pendingPayload = null
    }
  }, SYNC_DEBOUNCE_MS)
}

/** Force immediate sync (e.g., before page unload). */
export function flushSync(): void {
  if (syncTimer) clearTimeout(syncTimer)
  if (pendingPayload) {
    // Fire-and-forget since we may be unloading
    executeSync(pendingPayload)
    pendingPayload = null
  }
}

/** Replay queued payload on reconnect. */
export async function replayQueue(): Promise<void> {
  const queued = loadQueuedPayload()
  if (queued) {
    await executeSync(queued)
  }
}

// ── Online/Offline listeners ──

let listenersAttached = false

export function attachNetworkListeners(): () => void {
  if (listenersAttached || typeof window === "undefined") return () => {}
  listenersAttached = true

  const onOnline = () => {
    replayQueue()
  }
  const onOffline = () => {
    setSyncStatus("offline")
  }
  const onBeforeUnload = () => {
    flushSync()
  }

  window.addEventListener("online", onOnline)
  window.addEventListener("offline", onOffline)
  window.addEventListener("beforeunload", onBeforeUnload)

  return () => {
    window.removeEventListener("online", onOnline)
    window.removeEventListener("offline", onOffline)
    window.removeEventListener("beforeunload", onBeforeUnload)
    listenersAttached = false
  }
}
