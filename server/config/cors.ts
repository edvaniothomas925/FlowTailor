import { CorsOptions } from 'cors';
import { env } from './env.js';

/**
 * Enterprise-grade Restrictive CORS configuration
 * - Strict anchored regex for Google Cloud Run subdomains (^https:\/\/[a-z0-9-]+\.run\.app$)
 * - Strict anchored regex for local development (^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$)
 * - Exact match array comparison for explicit whitelisted domains
 * - Enables credentials: true for secure HttpOnly cookie management
 */
const CLOUD_RUN_STRICT_REGEX = /^https:\/\/[a-z0-9-]+\.run\.app$/;
const LOCALHOST_STRICT_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function getCorsOptions(): CorsOptions {
  const rawOrigins = env.CORS_ORIGIN || '';
  const explicitAllowedList = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // 1. Exact match against explicitly configured domain whitelist
      if (explicitAllowedList.includes(origin)) {
        return callback(null, true);
      }

      // 2. Strict anchored Regex match for Cloud Run preview and production environments
      if (CLOUD_RUN_STRICT_REGEX.test(origin)) {
        return callback(null, true);
      }

      // 3. Strict anchored Regex match for Localhost development ports
      if (LOCALHOST_STRICT_REGEX.test(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] Request blocked from unauthorized origin: ${origin}`);
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

