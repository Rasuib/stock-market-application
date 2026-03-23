/**
 * Shared in-memory rate limiter for API routes.
 *
 * Uses a sliding window counter per IP address.
 * Each route can specify its own limit and window.
 *
 * Note: In-memory maps reset on deploy/restart.
 * For distributed deployments, swap for Redis-backed limiter.
 */

import { NextResponse } from "next/server"

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitConfig {
  /** Max requests per window (default: 30) */
  limit?: number
  /** Window duration in ms (default: 60_000 = 1 minute) */
  windowMs?: number
}

const buckets = new Map<string, Map<string, RateLimitEntry>>()

// Periodic cleanup to prevent memory leaks from stale entries
const CLEANUP_INTERVAL = 5 * 60_000 // every 5 minutes
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [, bucket] of buckets) {
    for (const [ip, entry] of bucket) {
      if (now > entry.resetAt) bucket.delete(ip)
    }
  }
}

/**
 * Extract client IP from request headers.
 * Works with Vercel, Cloudflare, nginx, and direct connections.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  )
}

/**
 * Check whether a request is within rate limits.
 *
 * @param bucketName - unique name per route (e.g. "api/news")
 * @param ip - client IP address
 * @param config - optional limit and window overrides
 * @returns { allowed, remaining, resetAt }
 */
export function checkRateLimit(
  bucketName: string,
  ip: string,
  config: RateLimitConfig = {},
): { allowed: boolean; remaining: number; resetAt: number } {
  const limit = config.limit ?? 30
  const windowMs = config.windowMs ?? 60_000
  const now = Date.now()

  cleanup()

  if (!buckets.has(bucketName)) {
    buckets.set(bucketName, new Map())
  }
  const bucket = buckets.get(bucketName)!

  const entry = bucket.get(ip)
  if (!entry || now > entry.resetAt) {
    bucket.set(ip, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/**
 * Helper: returns a 429 response with standard headers.
 */
export function rateLimitResponse(resetAt: number) {
  const retryAfterSec = Math.ceil((resetAt - Date.now()) / 1000)
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSec)),
        "X-RateLimit-Reset": String(resetAt),
      },
    },
  )
}
