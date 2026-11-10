export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

interface Bucket {
  count: number;
  resetAtMs: number;
}

/**
 * Best-effort in-memory fixed-window rate limiter.
 * Guardrail is scoped to a single Node/serverless isolate (no shared Redis store).
 */
export class FixedWindowRateLimiter implements RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly nowMs: () => number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: {
    maxRequests: number;
    windowMs: number;
    maxEntries?: number;
    nowMs?: () => number;
  }) {
    this.maxRequests = Math.max(1, options.maxRequests);
    this.windowMs = Math.max(100, options.windowMs);
    this.maxEntries = Math.max(100, options.maxEntries ?? 5000);
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  check(key: string): RateLimitResult {
    const now = this.nowMs();

    if (this.buckets.size >= this.maxEntries) {
      for (const [k, bucket] of this.buckets.entries()) {
        if (bucket.resetAtMs <= now) {
          this.buckets.delete(k);
        }
      }
      while (this.buckets.size >= this.maxEntries) {
        const oldestKey = this.buckets.keys().next().value;
        if (!oldestKey) {
          break;
        }
        this.buckets.delete(oldestKey);
      }
    }

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAtMs <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAtMs: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        retryAfterSeconds: 0,
      };
    }

    if (existing.count >= this.maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAtMs - now) / 1000)
      );
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - existing.count),
      retryAfterSeconds: 0,
    };
  }
}

export const decisionRateLimiter = new FixedWindowRateLimiter({
  maxRequests: 30,
  windowMs: 60_000,
});

export const reviewRateLimiter = new FixedWindowRateLimiter({
  maxRequests: 15,
  windowMs: 60_000,
});

export const documentWriteRateLimiter = new FixedWindowRateLimiter({
  maxRequests: 20,
  windowMs: 60_000,
});

export const authRateLimiter = new FixedWindowRateLimiter({
  maxRequests: 15,
  windowMs: 60_000,
});

