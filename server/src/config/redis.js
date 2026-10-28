/**
 * Redis client for server-side API response caching.
 * Falls back to a no-op stub if REDIS_URL is not configured, so the app
 * continues to work without Redis (just without caching).
 */
const Redis = require('ioredis');

let redis;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    // Reconnect with exponential backoff (max 30s)
    retryStrategy(times) {
      if (times > 10) return null; // Stop retrying after 10 attempts
      return Math.min(times * 200, 30000);
    },
    // Don't throw on connection failure — fallback gracefully
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
  });

  redis.on('error', (err) => {
    // Suppress noisy Redis errors in production — cache is optional
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Redis] Connection error:', err.message);
    }
  });

  redis.connect().catch(() => {
    // Fail silently — Redis is a performance enhancement, not a requirement
  });
} else {
  // No-op stub — cache operations do nothing
  redis = {
    get: async () => null,
    setex: async () => null,
    del: async () => null,
    keys: async () => [],
    ping: async () => 'PONG',
  };
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Redis] REDIS_URL not set — caching disabled (no-op mode)');
  }
}

module.exports = redis;
