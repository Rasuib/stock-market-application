import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { checkRateLimit, rateLimitResponse, getClientIP } from "@/lib/rate-limit"

/**
 * Middleware handles ONLY rate limiting for API routes.
 *
 * Auth protection is handled by server-side layouts and route handlers
 * using NextAuth's auth() function, which runs in Node.js runtime
 * where JWT decryption works reliably.
 */

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/auth/signup": { limit: 5, windowMs: 60_000 },
  "/api/auth/forgot-password": { limit: 3, windowMs: 60_000 },
  "/api/auth/reset-password": { limit: 5, windowMs: 60_000 },
  "/api/auth/verify-email": { limit: 10, windowMs: 60_000 },
  "/api/news": { limit: 30, windowMs: 60_000 },
  "/api/stocks/search": { limit: 20, windowMs: 60_000 },
  "/api/stock": { limit: 60, windowMs: 60_000 },
  "/api/user-data": { limit: 60, windowMs: 60_000 },
  "/api/user": { limit: 30, windowMs: 60_000 },
  "/api/ai-coach": { limit: 15, windowMs: 60_000 },
}

const DEFAULT_RATE_LIMIT = { limit: 60, windowMs: 60_000 }

function getRateLimitConfig(pathname: string) {
  for (const [prefix, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return { key: prefix, ...config }
  }
  return { key: "api-default", ...DEFAULT_RATE_LIMIT }
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Only rate-limit API routes
  if (pathname.startsWith("/api/")) {
    const ip = getClientIP(req)
    const { key, limit, windowMs } = getRateLimitConfig(pathname)
    const rl = checkRateLimit(key, ip, { limit, windowMs })
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
