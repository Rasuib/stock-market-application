/**
 * Server-Side User Data Persistence
 *
 * Stores user data as JSON files on the server filesystem.
 * Each user gets their own file based on a user identifier.
 *
 * GET /api/user-data?userId=xxx -> returns stored data
 * POST /api/user-data -> saves user data to server
 *
 * Security:
 * - userId sanitized to prevent path traversal
 * - Request body validated with Zod schema
 * - Rate limited per IP
 * - Max payload size enforced
 *
 * Note: This is client-identified storage (not server-authenticated).
 * The userId comes from the client and is not verified against a session.
 * This is acceptable for an educational simulator but would need proper
 * auth for a production trading platform.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { promises as fs } from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), ".data", "users")

// Rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// Validation
const UserIdSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_@.\-]+$/, "Invalid userId format")

const UserDataSchema = z.object({
  trades: z.array(z.unknown()).max(500).optional().default([]),
  positions: z.record(z.unknown()).optional().default({}),
  balance: z.number().min(0).max(1e9).optional().default(100000),
  behavioralMemory: z.unknown().optional().default(null),
  curriculumProgress: z.unknown().optional().default(null),
  adaptiveWeights: z.unknown().optional().default(null),
  rewardHistory: z.array(z.number()).max(200).optional().default([]),
})

const PostBodySchema = z.object({
  userId: UserIdSchema,
  data: UserDataSchema,
})

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch { /* exists */ }
}

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 64)
}

function getUserFilePath(userId: string): string {
  return path.join(DATA_DIR, `${sanitizeUserId(userId)}.json`)
}

// ── GET ──

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const userId = request.nextUrl.searchParams.get("userId")
  const parsed = UserIdSchema.safeParse(userId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
  }

  const safeId = sanitizeUserId(parsed.data)
  if (!safeId) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
  }

  await ensureDataDir()

  try {
    const filePath = getUserFilePath(safeId)
    const raw = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(raw)
    return NextResponse.json({ data, exists: true })
  } catch {
    return NextResponse.json({ data: null, exists: false })
  }
}

// ── POST ──

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = PostBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues.map(i => i.message) },
        { status: 400 },
      )
    }

    const safeId = sanitizeUserId(parsed.data.userId)
    if (!safeId) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    await ensureDataDir()

    const filePath = getUserFilePath(safeId)
    const toWrite = {
      ...parsed.data.data,
      lastSynced: new Date().toISOString(),
    }

    await fs.writeFile(filePath, JSON.stringify(toWrite, null, 2), "utf-8")
    return NextResponse.json({ success: true, lastSynced: toWrite.lastSynced })
  } catch {
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 })
  }
}
