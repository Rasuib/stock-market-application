/**
 * Environment variable validation.
 *
 * Server-side env vars are validated lazily on first access.
 * Missing optional vars are logged as warnings; missing required vars throw in production.
 *
 * Usage:
 *   import { env } from "@/lib/env"
 *   const key = env.GEMINI_API_KEY // string | undefined (optional)
 */

function getEnv(key: string): string | undefined {
  return process.env[key]
}

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Set it in your .env file or deployment environment. See .env.example.`,
    )
  }
  return value
}

interface ServerEnv {
  /** Gemini API key — optional, AI coaching is disabled without it */
  readonly GEMINI_API_KEY: string | undefined
  /** HuggingFace API token — optional, falls back to keyword heuristics */
  readonly HF_API_TOKEN: string | undefined
  /** Node environment */
  readonly NODE_ENV: string
  /** Database connection URL — required in production */
  readonly DATABASE_URL: string
  /** NextAuth secret for JWT signing — required in production */
  readonly AUTH_SECRET: string
}

const isProduction = process.env.NODE_ENV === "production"

let _validated = false

/** Validated server-side environment variables */
export const env: ServerEnv = {
  get GEMINI_API_KEY() {
    return getEnv("GEMINI_API_KEY")
  },
  get HF_API_TOKEN() {
    return getEnv("HF_API_TOKEN")
  },
  get NODE_ENV() {
    return getEnv("NODE_ENV") || "development"
  },
  get DATABASE_URL() {
    if (isProduction) return requireEnv("DATABASE_URL")
    return getEnv("DATABASE_URL") || "file:./prisma/dev.db"
  },
  get AUTH_SECRET() {
    if (isProduction) return requireEnv("AUTH_SECRET")
    return getEnv("AUTH_SECRET") || "dev-secret-not-for-production"
  },
}

/**
 * Validate all environment variables at startup.
 * Call this in instrumentation.ts or at app init.
 * In production, missing required vars throw immediately.
 * In development, missing optional vars are logged as warnings.
 */
export function validateEnv(): void {
  if (_validated) return
  _validated = true

  const errors: string[] = []
  const warnings: string[] = []

  // Required in production
  if (!getEnv("DATABASE_URL")) {
    if (isProduction) errors.push("DATABASE_URL is required in production")
    else warnings.push("DATABASE_URL not set — using SQLite fallback")
  }

  if (!getEnv("AUTH_SECRET")) {
    if (isProduction) errors.push("AUTH_SECRET is required in production — generate one with: openssl rand -base64 32")
    else warnings.push("AUTH_SECRET not set — using insecure dev default")
  }

  // Always optional
  if (!env.GEMINI_API_KEY) {
    warnings.push("GEMINI_API_KEY not set — AI coaching features will be disabled")
  }

  if (!env.HF_API_TOKEN) {
    warnings.push("HF_API_TOKEN not set — FinBERT sentiment will fall back to keyword heuristics")
  }

  if (errors.length > 0) {
    throw new Error(
      "\n❌ Missing required environment variables:\n" +
      errors.map(e => `   • ${e}`).join("\n") +
      "\n   See .env.example for configuration.\n",
    )
  }

  if (warnings.length > 0) {
    console.warn(
      "\n⚠️  Environment Warnings:\n" +
      warnings.map(w => `   • ${w}`).join("\n") +
      "\n   See .env.example for configuration.\n",
    )
  }
}
