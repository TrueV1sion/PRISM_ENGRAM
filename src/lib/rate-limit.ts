/**
 * PRISM -- In-Memory Rate Limiter
 *
 * Sliding-window rate limiter for the SSE pipeline endpoint.
 * Prevents excessive API costs from runaway clients.
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  /**
   * @param maxRequests Maximum requests per window (default: 5)
   * @param windowMs Window size in ms (default: 60_000 = 1 minute)
   */
  constructor(maxRequests = 5, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request from the given key should be allowed.
   * Returns { allowed, remaining, retryAfterMs }.
   */
  check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.entries.get(key) || { timestamps: [] };

    // Remove expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldest = entry.timestamps[0];
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: this.windowMs - (now - oldest),
      };
    }

    // Allow and record
    entry.timestamps.push(now);
    this.entries.set(key, entry);

    return {
      allowed: true,
      remaining: this.maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
    };
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   * Call periodically (e.g. every 5 minutes).
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.entries.delete(key);
      }
    }
  }
}

/**
 * Singleton rate limiter for the pipeline SSE endpoint.
 * Allows 5 pipeline runs per minute per IP (generous for normal use,
 * prevents runaway loops).
 */
export const pipelineRateLimiter = new RateLimiter(5, 60_000);

// Auto-cleanup every 5 minutes
if (typeof globalThis !== "undefined") {
  setInterval(() => pipelineRateLimiter.cleanup(), 5 * 60_000);
}
