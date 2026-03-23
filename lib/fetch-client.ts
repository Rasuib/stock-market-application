/**
 * Client-side fetch wrapper with timeout, retry, and error handling.
 *
 * All client-side API calls should use this instead of raw fetch()
 * to ensure consistent timeout and error behavior.
 */

const DEFAULT_TIMEOUT = 15_000 // 15 seconds
const DEFAULT_RETRIES = 1

interface FetchClientOptions extends RequestInit {
  /** Timeout in ms (default: 15000) */
  timeout?: number
  /** Number of retries on network/5xx errors (default: 1) */
  retries?: number
}

export class FetchError extends Error {
  constructor(
    message: string,
    public status: number,
    public isTimeout: boolean = false,
  ) {
    super(message)
    this.name = "FetchError"
  }
}

/**
 * Fetch with timeout and automatic retry on transient failures.
 * Throws FetchError with status code for callers to handle.
 */
export async function fetchWithTimeout<T = unknown>(
  url: string,
  options: FetchClientOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, ...fetchOptions } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Don't retry on 4xx client errors
        if (response.status >= 400 && response.status < 500) {
          const body = await response.json().catch(() => ({ error: response.statusText }))
          throw new FetchError(
            body.error || `Request failed: ${response.statusText}`,
            response.status,
          )
        }

        // Retry on 5xx server errors
        lastError = new FetchError(
          `Server error: ${response.statusText}`,
          response.status,
        )
        continue
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof FetchError) {
        throw error // Don't retry client errors
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new FetchError("Request timed out", 0, true)
        continue
      }

      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError || new Error("Fetch failed")
}

/**
 * Convenience: GET with timeout.
 */
export function fetchJSON<T = unknown>(url: string, timeout?: number): Promise<T> {
  return fetchWithTimeout<T>(url, { timeout })
}
