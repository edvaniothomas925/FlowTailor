import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { logSecurityEvent } from '../services/auditLogger.js';

const CLOUD_RUN_STRICT_REGEX = /^https:\/\/[a-z0-9-]+\.run\.app$/;
const LOCALHOST_STRICT_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Sanitizes input string to neutralize Cross-Site Scripting (XSS),
 * HTML injections, script tags, and common command injection characters.
 */
export function sanitizeString(val: string): string {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '') // Strip inline event handlers like onclick=
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '') // Strip control chars
    .trim();
}

/**
 * Recursively sanitizes all string properties in an object or array.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = sanitizeObject((obj as any)[key]);
    }
    return sanitized as T;
  }
  return obj;
}

/**
 * Applies strict HTTP security headers to all responses
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Frame protection (allow framing only from same origin or trusted preview environments)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Cross-Site Scripting protection filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy to disable dangerous hardware APIs if not needed
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  
  // For API endpoints, prevent caching of sensitive responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * Middleware that automatically sanitizes incoming req.body, req.query, and req.params
 */
export function sanitizeInputs(req: Request, _res: Response, next: NextFunction) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
}

/**
 * CSRF & Origin Validation for state-changing requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  // Logout is idempotent and state-clearing, always allow without CSRF rejection
  const cleanPath = (req.originalUrl || req.url || req.path).split('?')[0];
  if (cleanPath.endsWith('/logout')) {
    return next();
  }

  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

  // If no origin header is present on internal/server-to-server calls, allow
  if (!origin) {
    return next();
  }

  const allowedSet = new Set<string>();
  if (env.APP_URL) allowedSet.add(env.APP_URL.trim());
  if (env.VITE_APP_URL) allowedSet.add(env.VITE_APP_URL.trim());
  if (process.env.VITE_APP_URL) allowedSet.add(process.env.VITE_APP_URL.trim());
  if (env.CORS_ORIGIN) {
    env.CORS_ORIGIN.split(',')
      .map(o => o.trim())
      .filter(Boolean)
      .forEach(o => allowedSet.add(o));
  }

  const isDev = env.NODE_ENV === 'development';

  if (
    allowedSet.has(origin) ||
    CLOUD_RUN_STRICT_REGEX.test(origin) ||
    (isDev && LOCALHOST_STRICT_REGEX.test(origin))
  ) {
    return next();
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

  logSecurityEvent({
    type: 'CSRF_BLOCKED',
    severity: 'WARN',
    ip,
    path: req.originalUrl,
    method: req.method,
    details: `CSRF validation blocked request from untrusted origin: ${origin}`,
  });

  return res.status(403).json({
    error: 'Acesso rejeitado pela validação de integridade CSRF do FlowTailor.',
  });
}
