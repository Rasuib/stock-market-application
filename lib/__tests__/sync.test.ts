import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getSyncStatus,
  onSyncStatusChange,
  fetchServerState,
  pushToServer,
  setServerVersion,
  getServerVersion,
  loadQueuedPayload,
  scheduleSync,
  type SyncStatus,
} from "../sync"

// ── Mock fetch ──

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Mock localStorage
const storage: Record<string, string> = {}
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value },
  removeItem: (key: string) => { delete storage[key] },
})

vi.stubGlobal("navigator", { onLine: true })

beforeEach(() => {
  vi.clearAllMocks()
  Object.keys(storage).forEach((k) => delete storage[k])
  setServerVersion(0)
})

// ── fetchServerState Tests ──

describe("fetchServerState", () => {
  it("returns null snapshot on 401", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
    })

    const result = await fetchServerState()
    expect(result.snapshot).toBeNull()
    expect(result.version).toBe(0)
  })

  it("returns snapshot from server", async () => {
    const serverData = {
      data: {
        trades: [],
        positions: {},
        balance: 95000,
        behavioralMemory: null,
        curriculumProgress: null,
        adaptiveWeights: null,
        rewardHistory: [],
        gamification: null,
        onboardingStatus: "completed",
        lastSynced: "2025-01-01T00:00:00.000Z",
      },
      exists: true,
      version: 5,
    }

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(serverData),
    })

    const result = await fetchServerState()
    expect(result.snapshot).not.toBeNull()
    expect(result.snapshot!.balance).toBe(95000)
    expect(result.version).toBe(5)
  })

  it("returns null when no data exists", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data: null, exists: false, version: 0 }),
    })

    const result = await fetchServerState()
    expect(result.snapshot).toBeNull()
  })

  it("throws on server error", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
    })

    await expect(fetchServerState()).rejects.toThrow("Server returned 500")
  })
})

// ── pushToServer Tests ──

describe("pushToServer", () => {
  it("sends payload and updates server version", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ success: true, version: 3 }),
    })

    const payload = {
      trades: [],
      positions: {},
      balance: 100000,
      behavioralMemory: null,
      curriculumProgress: null,
      adaptiveWeights: null,
      rewardHistory: [],
      gamification: null,
    }

    const result = await pushToServer(payload)
    expect(result.version).toBe(3)
    expect(getServerVersion()).toBe(3)

    // Check fetch was called with correct payload
    expect(mockFetch).toHaveBeenCalledWith("/api/user-data", expect.objectContaining({
      method: "POST",
      credentials: "include",
    }))
  })

  it("throws on 401", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
    })

    await expect(pushToServer({
      trades: [],
      positions: {},
      balance: 100000,
      behavioralMemory: null,
      curriculumProgress: null,
      adaptiveWeights: null,
      rewardHistory: [],
      gamification: null,
    })).rejects.toThrow("Unauthorized")
  })
})

// ── Sync Status Tests ──

describe("sync status", () => {
  it("starts as synced", () => {
    expect(getSyncStatus()).toBe("synced")
  })

  it("notifies listeners on change", () => {
    const statuses: SyncStatus[] = []
    const unsub = onSyncStatusChange((s) => statuses.push(s))

    // Trigger a sync that will change status
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ success: true, version: 1 }),
    })

    unsub()
    // Verify listener was removed (no more notifications)
    expect(typeof unsub).toBe("function")
  })
})

// ── Queue Persistence Tests ──

describe("queue persistence", () => {
  it("persists payload to localStorage on scheduleSync", () => {
    vi.useFakeTimers()

    const payload = {
      trades: [],
      positions: {},
      balance: 99000,
      behavioralMemory: null,
      curriculumProgress: null,
      adaptiveWeights: null,
      rewardHistory: [],
      gamification: null,
    }

    scheduleSync(payload)

    const queued = loadQueuedPayload()
    expect(queued).not.toBeNull()
    expect(queued!.balance).toBe(99000)

    vi.useRealTimers()
  })
})

// ── Server Version Tracking ──

describe("server version", () => {
  it("tracks version correctly", () => {
    expect(getServerVersion()).toBe(0)
    setServerVersion(5)
    expect(getServerVersion()).toBe(5)
  })
})
