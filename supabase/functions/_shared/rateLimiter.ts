/**
 * In-memory sliding window rate limiter for edge functions
 * Note: Resets on cold start (per-instance), but provides effective per-request protection
 */

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given identifier (usually IP or user ID)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create entry
  let entry = rateLimitStore.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(identifier, entry);
  }

  // Filter out timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  // Calculate remaining requests
  const remaining = Math.max(0, config.maxRequests - entry.timestamps.length);
  const allowed = entry.timestamps.length < config.maxRequests;

  if (allowed) {
    entry.timestamps.push(now);
  }

  // Calculate when the oldest request will expire
  const oldestTimestamp = entry.timestamps[0] || now;
  const resetAt = oldestTimestamp + config.windowMs;

  return { allowed, remaining, resetAt };
}

/**
 * Get client IP from request headers
 * Handles various proxy headers commonly used
 */
export function getClientIp(req: Request): string {
  // Check common headers for real IP behind proxies
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be comma-separated list, get first IP
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback - use a hash of user agent + other headers as identifier
  const userAgent = req.headers.get("user-agent") || "unknown";
  return `ua-${hashString(userAgent)}`;
}

/**
 * Simple string hash for fallback identification
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
  return {
    "X-RateLimit-Limit": config.maxRequests.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetAt / 1000).toString(),
  };
}

/**
 * Create a 429 Too Many Requests response
 */
export function rateLimitExceededResponse(
  corsHeaders: Record<string, string>,
  result: RateLimitResult,
  config: RateLimitConfig
): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...rateLimitHeaders(result, config),
        "Retry-After": retryAfter.toString(),
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Periodic cleanup of old entries to prevent memory bloat
 * Should be called occasionally (e.g., every 100 requests)
 */
let cleanupCounter = 0;
export function maybeCleanup(windowMs: number): void {
  cleanupCounter++;
  if (cleanupCounter >= 100) {
    cleanupCounter = 0;
    const cutoff = Date.now() - windowMs * 2;
    
    for (const [key, entry] of rateLimitStore.entries()) {
      // Remove entries with no recent timestamps
      if (entry.timestamps.length === 0 || 
          Math.max(...entry.timestamps) < cutoff) {
        rateLimitStore.delete(key);
      }
    }
  }
}
