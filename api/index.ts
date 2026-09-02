import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/index.js';

/**
 * Vercel Serverless Function entrypoint
 * Forwards all incoming HTTP requests to the centralized FlowTailor Express application.
 * Normalizes req.url in case Vercel rewrites or internal routing alters the requested path.
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url) {
    const rawUrl = req.url;
    // Check if Vercel provided the original route path in headers before rewrites
    const matchedPath =
      (req.headers['x-vercel-matched-path'] as string) ||
      (req.headers['x-matched-path'] as string) ||
      (req.headers['x-forwarded-uri'] as string) ||
      (req.headers['x-original-uri'] as string) ||
      (req.headers['x-rewrite-url'] as string);

    if (matchedPath && (rawUrl.startsWith('/api/index') || rawUrl === '/api' || rawUrl.startsWith('/api?'))) {
      const searchIndex = rawUrl.indexOf('?');
      const search = searchIndex >= 0 ? rawUrl.substring(searchIndex) : (matchedPath.includes('?') ? matchedPath.substring(matchedPath.indexOf('?')) : '');
      const pathname = matchedPath.split('?')[0];
      req.url = `${pathname}${search}`;
    }
  }

  return app(req as any, res as any);
}

export { app };

