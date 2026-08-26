import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../services/auditLogger.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  blockDurationMs?: number;
}

/**
 * In-memory sliding window rate limiter to defend against brute force,
 * denial-of-service (DoS), and automated credential stuffing attacks.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Demasiadas requisições. Por favor, tente novamente mais tarde.',
    blockDurationMs = windowMs * 2,
  } = options;

  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime && (!record.blockedUntil || now > record.blockedUntil)) {
        store.delete(key);
      }
    }
  }, Math.max(windowMs, 60000));

  return (req: Request, res: Response, next: NextFunction) => {
    // Get client identifier: X-Forwarded-For header or remote address
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
    const key = `${ip}:${req.baseUrl || ''}${req.path}`;
    const now = Date.now();

    let record = store.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(key, record);
    } else {
      // Check if currently temporarily blocked
      if (record.blockedUntil && now < record.blockedUntil) {
        const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.blockedUntil / 1000));
        
        logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          severity: 'WARN',
          ip,
          path: req.originalUrl,
          method: req.method,
          details: `Blocked IP attempted request. Cooldown active for ${retryAfterSeconds}s`,
        });

        return res.status(429).json({
          error: message,
          retryAfterSeconds,
          status: 429,
        });
      }

      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      record.blockedUntil = now + blockDurationMs;

      logSecurityEvent({
        type: 'RATE_LIMIT_TRIGGERED',
        severity: 'WARN',
        ip,
        path: req.originalUrl,
        method: req.method,
        details: `Exceeded threshold: ${record.count}/${maxRequests} in ${windowMs / 1000}s. Blocked for ${blockDurationMs / 1000}s`,
      });

      return res.status(429).json({
        error: message,
        retryAfterSeconds: Math.ceil(blockDurationMs / 1000),
        status: 429,
      });
    }

    next();
  };
}
