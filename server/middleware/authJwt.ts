import { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, UserJwtPayload } from '../services/jwtService.js';
import { logSecurityEvent } from '../services/auditLogger.js';

// Extend Express Request type to include user payload
declare global {
  namespace Express {
    interface Request {
      user?: UserJwtPayload;
      token?: string;
    }
  }
}

/**
 * Extracts Bearer token from Authorization header or signed cookies
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  if (req.cookies && req.cookies.jwt_token) {
    return req.cookies.jwt_token;
  }

  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string') {
    return customHeader.trim();
  }

  return null;
}

/**
 * Express middleware to authenticate requests using JWT tokens
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

  if (!token) {
    logSecurityEvent({
      type: 'AUTH_FAILURE',
      severity: 'WARN',
      ip,
      path: req.originalUrl,
      method: req.method,
      details: 'Missing Authorization Bearer token in protected route',
    });

    return res.status(401).json({
      error: 'Autenticação necessária. Por favor, forneça um token JWT válido.',
      code: 'UNAUTHORIZED',
    });
  }

  const result = verifyJwtToken(token);

  if (!result.valid || !result.payload) {
    logSecurityEvent({
      type: 'AUTH_FAILURE',
      severity: 'WARN',
      ip,
      path: req.originalUrl,
      method: req.method,
      details: `JWT Verification failed: ${result.error}`,
    });

    return res.status(401).json({
      error: result.error || 'Token de autenticação inválido ou expirado.',
      code: 'INVALID_TOKEN',
    });
  }

  req.user = result.payload;
  req.token = token;
  next();
}

/**
 * Optional authentication: if token is present, attaches user payload; otherwise proceeds
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const result = verifyJwtToken(token);
    if (result.valid && result.payload) {
      req.user = result.payload;
      req.token = token;
    }
  }
  next();
}

/**
 * Role-Based Access Control (RBAC) middleware generator
 */
export function requireRole(...allowedRoles: Array<'admin' | 'atelie_owner' | 'staff' | 'user'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

      logSecurityEvent({
        type: 'AUTH_FAILURE',
        severity: 'CRITICAL',
        ip,
        path: req.originalUrl,
        method: req.method,
        details: `Access forbidden: user ${req.user.userId} with role ${req.user.role} attempted to access route requiring ${allowedRoles.join(', ')}`,
      });

      return res.status(403).json({
        error: 'Acesso negado: privilégios insuficientes para este recurso.',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}
