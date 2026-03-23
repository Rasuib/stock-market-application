/**
 * Error reporting infrastructure backed by Sentry.
 *
 * When NEXT_PUBLIC_SENTRY_DSN is set, errors flow to Sentry.
 * Otherwise falls back to structured console logging with a buffer.
 */

import * as Sentry from "@sentry/nextjs"

interface ErrorContext {
  /** Where the error occurred (e.g. "TradingSimulator", "API/news") */
  source: string
  /** Additional metadata */
  extra?: Record<string, unknown>
  /** User-facing message (if different from error.message) */
  userMessage?: string
}

const errorBuffer: Array<{ timestamp: string; error: string; context: ErrorContext }> = []
const MAX_BUFFER = 50

/**
 * Capture and report an error.
 */
export function captureError(error: unknown, context: ErrorContext): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  // Structured console output (always)
  console.error(
    `[${context.source}] ${message}`,
    {
      ...context.extra,
      stack,
      timestamp: new Date().toISOString(),
    },
  )

  // Send to Sentry if configured
  Sentry.withScope((scope) => {
    scope.setTag("source", context.source)
    if (context.extra) {
      scope.setExtras(context.extra)
    }
    if (error instanceof Error) {
      Sentry.captureException(error)
    } else {
      Sentry.captureMessage(message, "error")
    }
  })

  // Buffer for local debugging
  if (errorBuffer.length >= MAX_BUFFER) errorBuffer.shift()
  errorBuffer.push({
    timestamp: new Date().toISOString(),
    error: message,
    context,
  })
}

/**
 * Capture a warning or informational message.
 */
export function captureMessage(message: string, context: ErrorContext): void {
  console.warn(`[${context.source}] ${message}`, context.extra)

  Sentry.withScope((scope) => {
    scope.setTag("source", context.source)
    if (context.extra) {
      scope.setExtras(context.extra)
    }
    Sentry.captureMessage(message, "warning")
  })
}

/**
 * Get recent errors (useful for debugging or a dev tools panel).
 */
export function getRecentErrors() {
  return [...errorBuffer]
}
