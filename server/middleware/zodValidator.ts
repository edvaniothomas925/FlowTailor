import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logSecurityEvent } from '../services/auditLogger.js';

export interface ValidateRequestOptions {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

/**
 * Validates request data (body, query, or params) using Zod schemas.
 * Automatically sanitizes, validates, coerces types, and replaces the request properties with parsed data.
 */
export function validateRequest(schema: ValidateRequestOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body || {});
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query || {});
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params || {});
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join('.') || 'payload',
          message: err.message,
          code: err.code,
        }));

        logSecurityEvent({
          type: 'INVALID_INPUT',
          severity: 'WARN',
          ip,
          path: req.originalUrl,
          method: req.method,
          details: `Zod validation failed on ${req.method} ${req.path}: ${formattedErrors.map((e) => `${e.field}: ${e.message}`).join(', ')}`,
        });

        return res.status(400).json({
          error: 'Falha de validação de dados (Zod Schema).',
          valido: false,
          erros: formattedErrors,
          quantidadeErros: formattedErrors.length,
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  };
}

/**
 * Helper to validate only the request body using a Zod Schema
 */
export function validateBody(schema: ZodSchema<any>) {
  return validateRequest({ body: schema });
}

