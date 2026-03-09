/**
 * PRISM Pipeline -- Retry Utility
 *
 * Provides exponential backoff retry logic for pipeline phase calls.
 * Retries on transient errors (rate limits, server errors, network failures)
 * but NOT on client errors (bad request, auth, validation).
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 2) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 2000) */
  baseDelayMs?: number;
  /** AbortSignal for cancellation during delay */
  signal?: AbortSignal;
  /** Label for logging (e.g. phase name) */
  label?: string;
}

/** Errors that should NOT be retried */
const NON_RETRYABLE_PATTERNS = [
  /400/,                    // Bad request
  /401|403/,                // Auth errors
  /invalid.*api.*key/i,     // API key issues
  /ZodError/i,              // Validation errors
  /AbortError/i,            // Intentional cancellation
];

/** HTTP status codes that SHOULD be retried */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Determine whether an error is retryable.
 * Retries on: rate limits (429), server errors (5xx), network failures.
 * Does NOT retry on: bad requests (400), auth errors (401/403), Zod errors, AbortErrors.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Check non-retryable patterns
  if (NON_RETRYABLE_PATTERNS.some((p) => p.test(message))) {
    return false;
  }

  // Check for retryable HTTP status codes in error message
  for (const code of RETRYABLE_STATUS_CODES) {
    if (message.includes(String(code))) {
      return true;
    }
  }

  // Network errors are retryable
  if (
    message.includes("ECONNRESET") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("fetch failed") ||
    message.includes("network")
  ) {
    return true;
  }

  // Anthropic overloaded error
  if (message.includes("overloaded") || message.includes("rate_limit")) {
    return true;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Sleep for a given number of milliseconds, respecting abort signal.
 * Resolves immediately if signal is already aborted.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted during retry delay", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted during retry delay", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Execute a function with exponential backoff retry.
 *
 * @example
 * ```ts
 * const blueprint = await withRetry(
 *   () => think({ query, emitEvent }),
 *   { maxRetries: 2, baseDelayMs: 2000, signal, label: "THINK" }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 2000, signal, label = "unknown" } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if not retryable or out of attempts
      if (!isRetryable(error) || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(
        `[RETRY] ${label} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms: ${error instanceof Error ? error.message : error}`,
      );

      await sleep(delay, signal);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}
