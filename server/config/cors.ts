import { CorsOptions } from 'cors';
import { env } from './env.js';
import { logSecurityEvent } from '../services/auditLogger.js';

/**
 * Enterprise-grade Restrictive CORS configuration
 * - Allowlist based on APP_URL, VITE_APP_URL, and explicit CORS_ORIGIN
 * - Strict anchored regex for Google Cloud Run subdomains (^https:\/\/[a-z0-9-]+\.run\.app$)
 * - Localhost permitted ONLY in development mode (NODE_ENV === 'development')
 * - Rejects all unknown origins
 * - Minimal allowed methods and headers
 * - Enables credentials for HttpOnly cookie session management
 */
const CLOUD_RUN_STRICT_REGEX = /^https:\/\/[a-z0-9-]+\.run\.app$/;
const LOCALHOST_STRICT_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function getCorsOptions(): CorsOptions {
  const allowedSet = new Set<string>();

  if (env.APP_URL) allowedSet.add(env.APP_URL.trim());
  if (env.VITE_APP_URL) allowedSet.add(env.VITE_APP_URL.trim());
  if (process.env.VITE_APP_URL) allowedSet.add(process.env.VITE_APP_URL.trim());

  if (env.CORS_ORIGIN) {
    env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .forEach((o) => allowedSet.add(o));
  }

  const isDev = env.NODE_ENV === 'development';

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, internal requests, same-origin)
      if (!origin) {
        return callback(null, true);
      }

      // 1. Exact match against explicitly configured domains (APP_URL, VITE_APP_URL, CORS_ORIGIN)
      if (allowedSet.has(origin)) {
        return callback(null, true);
      }

      // 2. Strict anchored Regex match for Cloud Run preview and production environments
      if (CLOUD_RUN_STRICT_REGEX.test(origin)) {
        return callback(null, true);
      }

      // 3. Localhost permitted ONLY during development mode
      if (isDev && LOCALHOST_STRICT_REGEX.test(origin)) {
        return callback(null, true);
      }

      // Log security event for unauthorized CORS attempt
      logSecurityEvent({
        type: 'CSRF_BLOCKED',
        severity: 'WARN',
        ip: 'CORS-Gatekeeper',
        path: 'preflight/origin',
        method: 'OPTIONS',
        details: `CORS blocked unauthorized origin: ${origin} (Mode: ${env.NODE_ENV})`,
      });

      console.warn(`[CORS Blocked] Unauthorized origin: ${origin} (Environment: ${env.NODE_ENV})`);
      callback(new Error('Bloqueado pelas políticas de segurança CORS restritivas do FlowTailor.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'X-Session-Token',
      'X-Atelie-Id',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
      'Authorization',
      'Set-Cookie',
    ],
    credentials: true,
    maxAge: 86400, // Cache preflight requests for 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
}
