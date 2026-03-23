/**
 * Comprehensive API Route Tests
 *
 * Tests all major API routes: user-data, ai-coach, ai-coach/chat,
 * ai-coach/status, user/reset, auth/signup, rate-limit, and env.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ──

// Mock prisma
const mockPrisma = {
  tradingData: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  trade: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  position: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  verificationToken: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }))

// Mock auth — returns null by default, overridden per test
const mockAuth = vi.fn()
const mockHashPassword = vi.fn()
vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}))

// Mock email — signup now sends verification email
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}))

// Mock Google Generative AI
// We store the mock fns in a global object that vi.mock factory can close over.
const geminiMocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  sendMessageStream: vi.fn(),
  startChat: vi.fn(),
  getGenerativeModel: vi.fn(),
}))

vi.mock("@google/generative-ai", () => {
  // This factory is hoisted to top of file by vitest.
  // geminiMocks is available because vi.hoisted runs before vi.mock factories.
  geminiMocks.startChat.mockReturnValue({ sendMessageStream: geminiMocks.sendMessageStream })
  geminiMocks.getGenerativeModel.mockReturnValue({
    generateContent: geminiMocks.generateContent,
    startChat: geminiMocks.startChat,
  })

  class MockGoogleGenerativeAI {
    constructor() {
      // intentionally empty
    }
    getGenerativeModel(...args: unknown[]) {
      return geminiMocks.getGenerativeModel(...args)
    }
  }

  return { GoogleGenerativeAI: MockGoogleGenerativeAI }
})

// Convenience aliases
const mockGenerateContent = geminiMocks.generateContent
const mockSendMessageStream = geminiMocks.sendMessageStream
const mockGetGenerativeModel = geminiMocks.getGenerativeModel

// Mock ai-coach helpers — use vi.hoisted so we can re-wire after clearAllMocks
const aiCoachMocks = vi.hoisted(() => ({
  buildTradeAnalysisPrompt: vi.fn(),
  buildSessionInsightPrompt: vi.fn(),
  buildChatSystemPrompt: vi.fn(),
  parseAIResponse: vi.fn(),
}))

vi.mock("@/lib/ai-coach", () => ({
  buildTradeAnalysisPrompt: aiCoachMocks.buildTradeAnalysisPrompt,
  buildSessionInsightPrompt: aiCoachMocks.buildSessionInsightPrompt,
  buildChatSystemPrompt: aiCoachMocks.buildChatSystemPrompt,
  parseAIResponse: aiCoachMocks.parseAIResponse,
  COACH_PERSONA: "You are a trading coach",
}))

// ── Helpers ──

function makeRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): NextRequest {
  const init: RequestInit = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      ...options.headers,
    },
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }
  return new NextRequest(new URL(url, "http://localhost"), init)
}

function authenticatedSession(userId = "user-123") {
  return { user: { id: userId, name: "Test User", email: "test@example.com" } }
}

// ── Setup ──

// We need to clear rate limit state between tests. The rate limiter is in-memory
// with module-level Maps, so we re-import each time. We also save/restore env vars.
const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null)

  // Re-wire Gemini mock chain after clearAllMocks nukes return values
  geminiMocks.startChat.mockReturnValue({ sendMessageStream: geminiMocks.sendMessageStream })
  geminiMocks.getGenerativeModel.mockReturnValue({
    generateContent: geminiMocks.generateContent,
    startChat: geminiMocks.startChat,
  })

  // Re-wire ai-coach mocks
  aiCoachMocks.buildTradeAnalysisPrompt.mockReturnValue("trade prompt")
  aiCoachMocks.buildSessionInsightPrompt.mockReturnValue("session prompt")
  aiCoachMocks.buildChatSystemPrompt.mockReturnValue("system prompt")
  aiCoachMocks.parseAIResponse.mockReturnValue({ narrative: "test" })

  // Reset env
  process.env = { ...originalEnv }
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

// ════════════════════════════════════════════════════════════════
// /api/user-data
// ════════════════════════════════════════════════════════════════

describe("/api/user-data", () => {
  // Fresh import per describe block to avoid rate limit pollution
  let GET: typeof import("@/app/api/user-data/route").GET
  let POST: typeof import("@/app/api/user-data/route").POST
  let PATCH: typeof import("@/app/api/user-data/route").PATCH

  beforeEach(async () => {
    const mod = await import("@/app/api/user-data/route")
    GET = mod.GET
    POST = mod.POST
    PATCH = mod.PATCH
  })

  // ── GET ──

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null)
      const req = makeRequest("http://localhost/api/user-data")
      const res = await GET(req)
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe("Unauthorized")
    })

    it("returns data when authenticated and data exists", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())

      const now = new Date()
      mockPrisma.tradingData.findUnique.mockResolvedValue({
        userId: "user-123",
        balance: 95000,
        positions: '{"AAPL":{"quantity":10,"avgPrice":150}}',
        behavioralMemory: null,
        curriculumProgress: null,
        adaptiveWeights: null,
        rewardHistory: "[]",
        gamification: null,
        onboardingStatus: "completed",
        lastSynced: now,
        version: 5,
      })

      mockPrisma.trade.findMany.mockResolvedValue([
        {
          id: "trade-1",
          type: "buy",
          symbol: "AAPL",
          quantity: 10,
          price: 150,
          total: 1500,
          market: "US",
          currency: "USD",
          profit: null,
          coaching: null,
          execution: null,
          thesis: null,
          reflection: null,
          createdAt: now,
        },
      ])

      mockPrisma.position.findMany.mockResolvedValue([])

      const req = makeRequest("http://localhost/api/user-data")
      const res = await GET(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.exists).toBe(true)
      expect(json.version).toBe(5)
      expect(json.data.balance).toBe(95000)
      expect(json.data.trades).toHaveLength(1)
      expect(json.data.trades[0].symbol).toBe("AAPL")
    })

    it("returns exists:false when no data found", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      mockPrisma.tradingData.findUnique.mockResolvedValue(null)
      mockPrisma.trade.findMany.mockResolvedValue([])
      mockPrisma.position.findMany.mockResolvedValue([])

      const req = makeRequest("http://localhost/api/user-data")
      const res = await GET(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.exists).toBe(false)
      expect(json.data).toBeNull()
      expect(json.version).toBe(0)
    })

    it("returns 500 on database error", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      mockPrisma.tradingData.findUnique.mockRejectedValue(new Error("DB down"))

      const req = makeRequest("http://localhost/api/user-data")
      const res = await GET(req)
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toBe("Failed to read data")
    })
  })

  // ── POST ──

  describe("POST", () => {
    const validPayload = {
      trades: [],
      positions: {},
      balance: 95000,
      rewardHistory: [],
    }

    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null)
      const req = makeRequest("http://localhost/api/user-data", { method: "POST", body: validPayload })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it("validates body with Zod and rejects invalid data", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: { balance: -500 }, // negative balance not allowed (min 0, but trades required format)
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe("Invalid request")
      expect(json.details).toBeDefined()
    })

    it("rejects balance exceeding max", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: { ...validPayload, balance: 2e9 },
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it("upserts trading data correctly", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())

      const txMock = {
        tradingData: { upsert: vi.fn().mockResolvedValue({ version: 3 }) },
        trade: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() },
        position: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn() },
      }
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))

      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: validPayload,
      })
      const res = await POST(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.version).toBe(3)
      expect(json.lastSynced).toBeDefined()
      expect(txMock.tradingData.upsert).toHaveBeenCalledOnce()
    })

    it("increments version on upsert", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())

      const txMock = {
        tradingData: { upsert: vi.fn().mockResolvedValue({ version: 7 }) },
        trade: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() },
        position: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn() },
      }
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))

      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: validPayload,
      })
      const res = await POST(req)
      const json = await res.json()
      expect(json.version).toBe(7)

      // Verify the upsert call includes version increment
      const upsertCall = txMock.tradingData.upsert.mock.calls[0][0]
      expect(upsertCall.update.version).toEqual({ increment: 1 })
      expect(upsertCall.create.version).toBe(1)
    })

    it("inserts new trades while skipping existing ones", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())

      const tradePayload = {
        ...validPayload,
        trades: [
          {
            id: "new-trade-1",
            type: "buy" as const,
            symbol: "AAPL",
            quantity: 5,
            price: 150,
            cost: 750,
            timestamp: new Date().toISOString(),
            displayTime: "10:30:00 AM",
            market: "US" as const,
            currency: "USD" as const,
          },
          {
            id: "existing-trade-2",
            type: "sell" as const,
            symbol: "GOOG",
            quantity: 3,
            price: 2800,
            cost: 8400,
            timestamp: new Date().toISOString(),
            displayTime: "11:00:00 AM",
            market: "US" as const,
            currency: "USD" as const,
          },
        ],
      }

      const txMock = {
        tradingData: { upsert: vi.fn().mockResolvedValue({ version: 2 }) },
        trade: {
          findMany: vi.fn().mockResolvedValue([{ id: "existing-trade-2" }]),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        position: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn() },
      }
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))

      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: tradePayload,
      })
      const res = await POST(req)
      expect(res.status).toBe(200)

      // Only new trades should be inserted
      const createManyCall = txMock.trade.createMany.mock.calls[0][0]
      expect(createManyCall.data).toHaveLength(1)
      expect(createManyCall.data[0].id).toBe("new-trade-1")
    })
  })

  // ── PATCH ──

  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null)
      const req = makeRequest("http://localhost/api/user-data", {
        method: "PATCH",
        body: { onboardingStatus: "completed" },
      })
      const res = await PATCH(req)
      expect(res.status).toBe(401)
    })

    it("updates onboarding status", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      mockPrisma.tradingData.upsert.mockResolvedValue({})

      const req = makeRequest("http://localhost/api/user-data", {
        method: "PATCH",
        body: { onboardingStatus: "completed" },
      })
      const res = await PATCH(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)

      const upsertCall = mockPrisma.tradingData.upsert.mock.calls[0][0]
      expect(upsertCall.update.onboardingStatus).toBe("completed")
    })

    it("updates gamification data", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      mockPrisma.tradingData.upsert.mockResolvedValue({})

      const gamificationData = { level: 5, xp: 1200, streak: 3 }
      const req = makeRequest("http://localhost/api/user-data", {
        method: "PATCH",
        body: { gamification: gamificationData },
      })
      const res = await PATCH(req)
      expect(res.status).toBe(200)

      const upsertCall = mockPrisma.tradingData.upsert.mock.calls[0][0]
      expect(upsertCall.update.gamification).toBe(JSON.stringify(gamificationData))
    })

    it("rejects empty body (no fields)", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())

      const req = makeRequest("http://localhost/api/user-data", {
        method: "PATCH",
        body: {},
      })
      const res = await PATCH(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe("Invalid request")
    })

    it("rejects invalid onboarding status value", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())

      const req = makeRequest("http://localhost/api/user-data", {
        method: "PATCH",
        body: { onboardingStatus: "invalid_status" },
      })
      const res = await PATCH(req)
      expect(res.status).toBe(400)
    })
  })

  // ── Security: cross-user access ──

  describe("cross-user isolation", () => {
    it("GET only returns data for session user, never a body-supplied userId", async () => {
      mockAuth.mockResolvedValue(authenticatedSession("user-123"))
      mockPrisma.tradingData.findUnique.mockResolvedValue(null)
      mockPrisma.trade.findMany.mockResolvedValue([])
      mockPrisma.position.findMany.mockResolvedValue([])

      const req = makeRequest("http://localhost/api/user-data")
      await GET(req)

      // Verify the Prisma query used session userId, NOT anything from body/query
      const findCall = mockPrisma.tradingData.findUnique.mock.calls[0][0]
      expect(findCall.where.userId).toBe("user-123")
    })

    it("POST writes data under session userId only", async () => {
      mockAuth.mockResolvedValue(authenticatedSession("user-abc"))

      const txMock = {
        tradingData: { upsert: vi.fn().mockResolvedValue({ version: 1 }) },
        trade: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() },
        position: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn() },
      }
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))

      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: { trades: [], positions: {}, balance: 100000, rewardHistory: [] },
      })
      await POST(req)

      const upsertCall = txMock.tradingData.upsert.mock.calls[0][0]
      expect(upsertCall.where.userId).toBe("user-abc")
      expect(upsertCall.create.userId).toBe("user-abc")
    })

    it("different session = different data, no cross-read", async () => {
      // User A writes
      mockAuth.mockResolvedValue(authenticatedSession("user-a"))
      const txMockA = {
        tradingData: { upsert: vi.fn().mockResolvedValue({ version: 1 }) },
        trade: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() },
        position: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn() },
      }
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMockA) => Promise<unknown>) => fn(txMockA))

      await POST(makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: { trades: [], positions: {}, balance: 50000, rewardHistory: [] },
      }))

      // User B reads — should query with user-b, not user-a
      mockAuth.mockResolvedValue(authenticatedSession("user-b"))
      mockPrisma.tradingData.findUnique.mockResolvedValue(null)
      mockPrisma.trade.findMany.mockResolvedValue([])
      mockPrisma.position.findMany.mockResolvedValue([])

      await GET(makeRequest("http://localhost/api/user-data"))

      const findCall = mockPrisma.tradingData.findUnique.mock.calls[0][0]
      expect(findCall.where.userId).toBe("user-b")
    })
  })

  // ── Schema validation: malformed payloads ──

  describe("malformed payload rejection", () => {
    it("rejects POST with non-JSON body as error (400 or 500)", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      const req = new NextRequest(new URL("http://localhost/api/user-data"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
        body: "not json at all",
      })
      const res = await POST(req)
      // Non-parseable JSON triggers SyntaxError caught by the route's catch block
      expect([400, 500]).toContain(res.status)
    })

    it("rejects POST with array instead of object", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: [1, 2, 3],
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it("rejects POST with trades containing invalid type", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: {
          trades: [{ id: "t1", type: "invalid", symbol: "X", quantity: 1, price: 1, cost: 1, timestamp: "2025-01-01", market: "US", currency: "USD" }],
          positions: {},
          balance: 100000,
          rewardHistory: [],
        },
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it("rejects POST with NaN balance", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      const req = makeRequest("http://localhost/api/user-data", {
        method: "POST",
        body: { trades: [], positions: {}, balance: "not-a-number", rewardHistory: [] },
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it("rejects PATCH with unexpected fields only", async () => {
      mockAuth.mockResolvedValue(authenticatedSession())
      const req = makeRequest("http://localhost/api/user-data", {
        method: "PATCH",
        body: { userId: "hacker-id", balance: 999999 },
      })
      const res = await PATCH(req)
      // Should reject because neither onboardingStatus nor gamification etc. is present
      expect(res.status).toBe(400)
    })
  })
})

// ════════════════════════════════════════════════════════════════
// /api/ai-coach
// ════════════════════════════════════════════════════════════════

describe("/api/ai-coach", () => {
  let POST: typeof import("@/app/api/ai-coach/route").POST

  beforeEach(async () => {
    // Re-setup mocks (vi.clearAllMocks wipes mockReturnValue set in vi.mock factory)
    geminiMocks.startChat.mockReturnValue({ sendMessageStream: geminiMocks.sendMessageStream })
    geminiMocks.getGenerativeModel.mockReturnValue({
      generateContent: geminiMocks.generateContent,
      startChat: geminiMocks.startChat,
    })
    aiCoachMocks.buildTradeAnalysisPrompt.mockReturnValue("trade prompt")
    aiCoachMocks.buildSessionInsightPrompt.mockReturnValue("session prompt")
    aiCoachMocks.parseAIResponse.mockReturnValue({ narrative: "test" })

    const mod = await import("@/app/api/ai-coach/route")
    POST = mod.POST
  })

  const validTradeAnalysis = {
    type: "trade-analysis",
    input: {
      action: "buy",
      symbol: "AAPL",
      quantity: 10,
      price: 150,
      market: "US",
      currency: "USD",
      sentiment: { label: "bullish", score: 0.8, confidence: 0.9, source: "finbert" },
      trend: { label: "uptrend", signal: 0.7, confidence: 0.85, shortMA: 148, longMA: 145, momentum: 0.5 },
      portfolioExposure: 0.15,
      recentTradeCount: 3,
      existingPositionSize: 0,
      totalBalance: 100000,
      recentRewards: [80, 85, 90],
      tradeHistory: [],
    },
    coaching: {
      verdict: "strong",
      score: 85,
      summary: "Solid trade with good alignment",
    },
  }

  const validSessionInsight = {
    type: "session-insight",
    summary: {
      grade: "B+",
      score: 78,
      totalTrades: 12,
      trajectory: "improving",
    },
    recentTrades: [],
  }

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const req = new Request("http://localhost/api/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(validTradeAnalysis),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 503 when no GEMINI_API_KEY", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    delete process.env.GEMINI_API_KEY

    const req = new Request("http://localhost/api/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(validTradeAnalysis),
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.available).toBe(false)
  })

  it("processes trade-analysis input successfully", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"narrative":"good trade"}' },
    })

    const req = new Request("http://localhost/api/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(validTradeAnalysis),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.available).toBe(true)
    expect(json.analysis).toBeDefined()
  })

  it("processes session-insight input successfully", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"summary":"great session"}' },
    })

    const req = new Request("http://localhost/api/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(validSessionInsight),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.available).toBe(true)
    expect(json.insight).toBeDefined()
  })

  it("returns 400 for invalid type", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    const req = new Request("http://localhost/api/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ type: "unknown-type", data: {} }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Invalid request")
  })

  it("returns 500 when Gemini API throws", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    mockGenerateContent.mockRejectedValue(new Error("API quota exceeded"))

    const req = new Request("http://localhost/api/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(validTradeAnalysis),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("unavailable")
  })
})

// ════════════════════════════════════════════════════════════════
// /api/ai-coach/status
// ════════════════════════════════════════════════════════════════

describe("/api/ai-coach/status", () => {
  let GET: typeof import("@/app/api/ai-coach/status/route").GET

  beforeEach(async () => {
    const mod = await import("@/app/api/ai-coach/status/route")
    GET = mod.GET
  })

  it("returns available:true when GEMINI_API_KEY is set", async () => {
    process.env.GEMINI_API_KEY = "test-key-123"

    const req = makeRequest("http://localhost/api/ai-coach/status")
    const res = await GET(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.available).toBe(true)
  })

  it("returns available:false when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY

    const req = makeRequest("http://localhost/api/ai-coach/status")
    const res = await GET(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.available).toBe(false)
  })

  // Rate limiting is now handled by middleware, not per-route.
  // The per-route rate limit test no longer applies.
})

// ════════════════════════════════════════════════════════════════
// /api/ai-coach/chat
// ════════════════════════════════════════════════════════════════

describe("/api/ai-coach/chat", () => {
  let POST: typeof import("@/app/api/ai-coach/chat/route").POST

  beforeEach(async () => {
    // Re-setup the Gemini mock chain (vi.clearAllMocks wipes mockReturnValue set in vi.mock factory)
    geminiMocks.startChat.mockReturnValue({ sendMessageStream: geminiMocks.sendMessageStream })
    geminiMocks.getGenerativeModel.mockReturnValue({
      generateContent: geminiMocks.generateContent,
      startChat: geminiMocks.startChat,
    })

    const mod = await import("@/app/api/ai-coach/chat/route")
    POST = mod.POST
  })

  const validChatBody = {
    messages: [
      { role: "user", content: "Why was my last trade risky?" },
    ],
  }

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const req = new Request("http://localhost/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(validChatBody),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })

  it("returns 503 when no GEMINI_API_KEY", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    delete process.env.GEMINI_API_KEY

    const req = new Request("http://localhost/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(validChatBody),
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.available).toBe(false)
  })

  it("validates message array — rejects empty messages", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    const req = new Request("http://localhost/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ messages: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Invalid request")
  })

  it("rejects messages with empty content", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    const req = new Request("http://localhost/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ messages: [{ role: "user", content: "" }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects messages over max length (5000 chars)", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    const longMessage = "x".repeat(5001)
    const req = new Request("http://localhost/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ messages: [{ role: "user", content: longMessage }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects messages exceeding max array length (30)", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    const messages = Array.from({ length: 31 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }))

    const req = new Request("http://localhost/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ messages }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns streaming response on valid input", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    process.env.GEMINI_API_KEY = "test-key"

    // Mock streaming response
    const mockStream = (async function* () {
      yield { text: () => "Hello " }
      yield { text: () => "world" }
    })()

    mockSendMessageStream.mockResolvedValue({ stream: mockStream })

    const req = new Request("http://localhost/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(validChatBody),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/event-stream")

    // Read the stream to verify content
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ""
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
      if (result.value) fullText += decoder.decode(result.value)
    }

    expect(fullText).toContain("Hello ")
    expect(fullText).toContain("world")
    expect(fullText).toContain("[DONE]")
  })
})

// ════════════════════════════════════════════════════════════════
// /api/user/reset
// ════════════════════════════════════════════════════════════════

describe("/api/user/reset", () => {
  let POST: typeof import("@/app/api/user/reset/route").POST

  beforeEach(async () => {
    const mod = await import("@/app/api/user/reset/route")
    POST = mod.POST
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest("http://localhost/api/user/reset", { method: "POST" })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })

  it("resets data successfully", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())

    const txMock = {
      trade: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
      tradingData: { upsert: vi.fn().mockResolvedValue({}) },
    }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))

    const req = makeRequest("http://localhost/api/user/reset", { method: "POST" })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)

    // Verify trades were deleted for this user
    expect(txMock.trade.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-123" } })

    // Verify trading data was reset to defaults
    const upsertCall = txMock.tradingData.upsert.mock.calls[0][0]
    expect(upsertCall.create.balance).toBe(100_000)
    expect(upsertCall.create.positions).toBe("{}")
    expect(upsertCall.update.balance).toBe(100_000)
    expect(upsertCall.update.onboardingStatus).toBe("not_started")
  })

  it("returns 500 on database error", async () => {
    mockAuth.mockResolvedValue(authenticatedSession())
    mockPrisma.$transaction.mockRejectedValue(new Error("DB error"))

    const req = makeRequest("http://localhost/api/user/reset", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.99" },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe("Failed to reset account")
  })

  // Rate limiting is now handled by middleware, not per-route.
  // The per-route rate limit test no longer applies.
})

// ════════════════════════════════════════════════════════════════
// /api/auth/signup
// ════════════════════════════════════════════════════════════════

describe("/api/auth/signup", () => {
  let POST: typeof import("@/app/api/auth/signup/route").POST

  beforeEach(async () => {
    const mod = await import("@/app/api/auth/signup/route")
    POST = mod.POST
  })

  const validSignupBody = {
    name: "Jane Doe",
    email: "jane@example.com",
    password: "securepassword123",
  }

  it("validates required fields — rejects missing name", async () => {
    const req = makeRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: { email: "test@test.com", password: "password123" },
      headers: { "x-forwarded-for": "20.0.0.1" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Invalid input")
  })

  it("validates required fields — rejects missing email", async () => {
    const req = makeRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: { name: "Test", password: "password123" },
      headers: { "x-forwarded-for": "20.0.0.2" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("validates required fields — rejects short password", async () => {
    const req = makeRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: { name: "Test", email: "test@test.com", password: "12345" },
      headers: { "x-forwarded-for": "20.0.0.3" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("validates required fields — rejects invalid email", async () => {
    const req = makeRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: { name: "Test", email: "not-an-email", password: "password123" },
      headers: { "x-forwarded-for": "20.0.0.4" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects duplicate emails", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing-user", email: "jane@example.com" })

    const req = makeRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: validSignupBody,
      headers: { "x-forwarded-for": "20.0.0.5" },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe("Email already registered")
  })

  it("creates user successfully", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null) // No existing user
    mockHashPassword.mockResolvedValue("hashed-password-123")
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-1",
      name: "Jane Doe",
      email: "jane@example.com",
    })
    mockPrisma.verificationToken.create.mockResolvedValue({})

    const req = makeRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: validSignupBody,
      headers: { "x-forwarded-for": "20.0.0.6" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.user).toBeDefined()
    expect(json.user.id).toBe("new-user-1")
    expect(json.user.email).toBe("jane@example.com")
    expect(json.requiresVerification).toBe(true)

    // Verify hashPassword was called with the raw password
    expect(mockHashPassword).toHaveBeenCalledWith("securepassword123")

    // Verify user.create was called with hashed password
    const createCall = mockPrisma.user.create.mock.calls[0][0]
    expect(createCall.data.passwordHash).toBe("hashed-password-123")
    expect(createCall.data.email).toBe("jane@example.com")

    // Verify verification token was created
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledOnce()
  })

  it("accepts optional bio field", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockHashPassword.mockResolvedValue("hashed")
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-2",
      name: "Jane Doe",
      email: "jane2@example.com",
    })
    mockPrisma.verificationToken.create.mockResolvedValue({})

    const req = makeRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: { ...validSignupBody, email: "jane2@example.com", bio: "I love trading" },
      headers: { "x-forwarded-for": "20.0.0.7" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)

    const createCall = mockPrisma.user.create.mock.calls[0][0]
    expect(createCall.data.bio).toBe("I love trading")
  })

  it("returns 500 on database error during creation", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockHashPassword.mockResolvedValue("hashed")
    mockPrisma.user.create.mockRejectedValue(new Error("DB connection lost"))

    const req = makeRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: { ...validSignupBody, email: "new-unique@example.com" },
      headers: { "x-forwarded-for": "20.0.0.8" },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe("Failed to create account")
  })
})

// ════════════════════════════════════════════════════════════════
// lib/rate-limit.ts — Direct unit tests
// ════════════════════════════════════════════════════════════════

describe("lib/rate-limit", () => {
  let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit
  let getClientIP: typeof import("@/lib/rate-limit").getClientIP
  let rateLimitResponse: typeof import("@/lib/rate-limit").rateLimitResponse

  beforeEach(async () => {
    const mod = await import("@/lib/rate-limit")
    checkRateLimit = mod.checkRateLimit
    getClientIP = mod.getClientIP
    rateLimitResponse = mod.rateLimitResponse
  })

  it("allows requests within limit", () => {
    // Use a unique bucket and IP per test to avoid cross-test pollution
    const result = checkRateLimit("test-bucket-allow", "192.168.1.1", { limit: 5, windowMs: 60_000 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("blocks requests over limit", () => {
    const bucket = "test-bucket-block"
    const ip = "192.168.1.2"
    const limit = 3

    for (let i = 0; i < limit; i++) {
      const r = checkRateLimit(bucket, ip, { limit, windowMs: 60_000 })
      expect(r.allowed).toBe(true)
    }

    // The next request should be blocked
    const blocked = checkRateLimit(bucket, ip, { limit, windowMs: 60_000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it("tracks remaining count correctly", () => {
    const bucket = "test-bucket-remaining"
    const ip = "192.168.1.3"
    const limit = 5

    const r1 = checkRateLimit(bucket, ip, { limit, windowMs: 60_000 })
    expect(r1.remaining).toBe(4)

    const r2 = checkRateLimit(bucket, ip, { limit, windowMs: 60_000 })
    expect(r2.remaining).toBe(3)

    const r3 = checkRateLimit(bucket, ip, { limit, windowMs: 60_000 })
    expect(r3.remaining).toBe(2)
  })

  it("resets after window expires", () => {
    vi.useFakeTimers()

    const bucket = "test-bucket-reset"
    const ip = "192.168.1.4"
    const limit = 2
    const windowMs = 1000

    // Exhaust the limit
    checkRateLimit(bucket, ip, { limit, windowMs })
    checkRateLimit(bucket, ip, { limit, windowMs })
    const blocked = checkRateLimit(bucket, ip, { limit, windowMs })
    expect(blocked.allowed).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1)

    const afterReset = checkRateLimit(bucket, ip, { limit, windowMs })
    expect(afterReset.allowed).toBe(true)
    expect(afterReset.remaining).toBe(1)

    vi.useRealTimers()
  })

  it("returns correct resetAt timestamp", () => {
    vi.useFakeTimers()
    const now = Date.now()

    const bucket = "test-bucket-resetat"
    const ip = "192.168.1.5"
    const windowMs = 30_000

    const result = checkRateLimit(bucket, ip, { limit: 10, windowMs })
    expect(result.resetAt).toBe(now + windowMs)

    vi.useRealTimers()
  })

  it("isolates different IPs in the same bucket", () => {
    const bucket = "test-bucket-isolation"
    const limit = 1

    const r1 = checkRateLimit(bucket, "10.0.0.1", { limit, windowMs: 60_000 })
    expect(r1.allowed).toBe(true)

    // Different IP should have its own limit
    const r2 = checkRateLimit(bucket, "10.0.0.2", { limit, windowMs: 60_000 })
    expect(r2.allowed).toBe(true)

    // Original IP should be blocked
    const r3 = checkRateLimit(bucket, "10.0.0.1", { limit, windowMs: 60_000 })
    expect(r3.allowed).toBe(false)
  })

  it("getClientIP extracts from x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    })
    expect(getClientIP(req)).toBe("203.0.113.50")
  })

  it("getClientIP falls back to x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "10.10.10.10" },
    })
    expect(getClientIP(req)).toBe("10.10.10.10")
  })

  it("getClientIP falls back to cf-connecting-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "cf-connecting-ip": "172.16.0.1" },
    })
    expect(getClientIP(req)).toBe("172.16.0.1")
  })

  it("getClientIP returns 'unknown' when no headers present", () => {
    const req = new Request("http://localhost")
    expect(getClientIP(req)).toBe("unknown")
  })

  it("rateLimitResponse returns 429 with correct headers", () => {
    const resetAt = Date.now() + 30_000
    const res = rateLimitResponse(resetAt)
    expect(res.status).toBe(429)
    expect(res.headers.get("X-RateLimit-Reset")).toBe(String(resetAt))
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════
// lib/env.ts
// ════════════════════════════════════════════════════════════════

describe("lib/env", () => {
  it("returns env vars correctly via getters", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key"
    process.env.HF_API_TOKEN = "test-hf-token"

    // Dynamic import to pick up env changes
    const { env } = await import("@/lib/env")
    expect(env.GEMINI_API_KEY).toBe("test-gemini-key")
    expect(env.HF_API_TOKEN).toBe("test-hf-token")
  })

  it("returns undefined for unset optional vars", async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.HF_API_TOKEN

    const { env } = await import("@/lib/env")
    expect(env.GEMINI_API_KEY).toBeUndefined()
    expect(env.HF_API_TOKEN).toBeUndefined()
  })

  it("returns NODE_ENV defaulting to 'development'", async () => {
    delete process.env.NODE_ENV

    const { env } = await import("@/lib/env")
    expect(env.NODE_ENV).toBe("development")
  })

  it("validates successfully when required vars are set", async () => {
    process.env.DATABASE_URL = "postgresql://localhost/test"
    process.env.AUTH_SECRET = "super-secret"
    process.env.GEMINI_API_KEY = "key"
    process.env.HF_API_TOKEN = "token"
    process.env.NODE_ENV = "production"

    // We need a fresh module to reset _validated flag
    vi.resetModules()
    const { validateEnv } = await import("@/lib/env")
    expect(() => validateEnv()).not.toThrow()
  })

  it("validateEnv throws in production when required vars missing", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.DATABASE_URL
    delete process.env.AUTH_SECRET

    vi.resetModules()
    const { validateEnv } = await import("@/lib/env")
    expect(() => validateEnv()).toThrow("Missing required environment variables")
  })

  it("validateEnv warns in development when optional vars missing", async () => {
    process.env.NODE_ENV = "development"
    process.env.DATABASE_URL = "file:./dev.db"
    process.env.AUTH_SECRET = "dev-secret"
    delete process.env.GEMINI_API_KEY
    delete process.env.HF_API_TOKEN

    vi.resetModules()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { validateEnv } = await import("@/lib/env")
    validateEnv()

    expect(warnSpy).toHaveBeenCalled()
    const warnMessage = warnSpy.mock.calls[0][0]
    expect(warnMessage).toContain("GEMINI_API_KEY")
    expect(warnMessage).toContain("HF_API_TOKEN")

    warnSpy.mockRestore()
  })
})
