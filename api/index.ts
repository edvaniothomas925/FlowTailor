import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/index.js';

/**
 * Vercel Serverless Function entrypoint
 * Forwards all incoming HTTP requests to the centralized FlowTailor Express application.
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req, res);
}

export { app };
