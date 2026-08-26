import { Router, Request, Response, CookieOptions } from 'express';
import {
  signJwtToken,
  verifyJwtToken,
  generateTokenPair,
  validateAndRotateRefreshToken,
  revokeRefreshToken,
  decodeJwtToken,
  UserJwtPayload,
} from '../services/jwtService.js';
import { hashPassword, comparePassword } from '../services/passwordService.js';
import { requireAuth } from '../middleware/authJwt.js';
import { validateBody } from '../middleware/zodValidator.js';
import {
  authLoginSchema,
  authTokenIssueSchema,
  tokenVerifySchema,
  refreshTokenSchema,
  pinHashSchema,
  pinVerifySchema,
  AuthLoginInput,
  AuthTokenIssueInput,
} from '../schemas/zodSchemas.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { logSecurityEvent } from '../services/auditLogger.js';

const router = Router();

export const REFRESH_COOKIE_NAME = 'flowtailor_refresh_token';

/**
 * Returns strict, secure cookie options for Refresh Tokens
 */
export function getRefreshCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction, // HTTPS required in production
    sameSite: 'strict', // Strict protection against Cross-Site Request Forgery (CSRF)
    path: '/api/auth', // Scoped exclusively to authentication endpoints
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
}

const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  message: 'Muitas tentativas de autenticação. Aguarde um momento.',
});

router.use(authRateLimiter);

/**
 * 1. Login with credentials or PIN (Validated via Zod authLoginSchema)
 * Sets the Refresh Token in an HttpOnly, Secure, SameSite=Strict cookie
 */
router.post(
  '/login',
  validateBody(authLoginSchema),
  async (req: Request, res: Response) => {
    const { email, role, atelieId, atelieName, authProvider } = req.body as AuthLoginInput;
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const payload: UserJwtPayload = {
      userId,
      email,
      role: role || 'atelie_owner',
      atelieId: atelieId || undefined,
      atelieName: atelieName || 'Ateliê FlowTailor',
      authProvider: authProvider || 'email',
      sessionCreated: new Date().toISOString(),
    };

    const tokens = generateTokenPair(payload);

    // Set Refresh Token exclusively via HttpOnly, Secure, SameSite=Strict cookie
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions());

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

    logSecurityEvent({
      type: 'AUTH_SUCCESS',
      severity: 'INFO',
      ip,
      path: req.originalUrl,
      method: req.method,
      details: `User login successful via Zod schema: ${email} (${payload.role})`,
    });

    res.json({
      success: true,
      message: 'Autenticação concluída com sucesso com Zod e JWT.',
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: payload,
    });
  }
);

/**
 * 2. Generate & sign a secure JWT pair for a user session (Validated via Zod authTokenIssueSchema)
 * Sets the Refresh Token in an HttpOnly, Secure, SameSite=Strict cookie
 */
router.post(
  '/token',
  validateBody(authTokenIssueSchema),
  (req: Request, res: Response) => {
    const body = req.body as AuthTokenIssueInput;
    const payload: UserJwtPayload = {
      ...body,
      atelieId: body.atelieId || undefined,
      atelieName: body.atelieName || undefined,
      sessionCreated: new Date().toISOString(),
    };

    const tokens = generateTokenPair(payload);

    // Set Refresh Token exclusively via HttpOnly, Secure, SameSite=Strict cookie
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions());

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

    logSecurityEvent({
      type: 'AUTH_SUCCESS',
      severity: 'INFO',
      ip,
      path: req.originalUrl,
      method: req.method,
      details: `JWT Token pair issued via Zod schema for user: ${payload.userId} (${payload.role})`,
    });

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: payload,
    });
  }
);

/**
 * 3. Verify a JWT token integrity and signature (Validated via Zod tokenVerifySchema)
 */
router.post(
  '/verify',
  validateBody(tokenVerifySchema),
  (req: Request, res: Response) => {
    const { token } = req.body;
    const result = verifyJwtToken(token);

    if (!result.valid) {
      return res.status(401).json({
        valid: false,
        error: result.error,
      });
    }

    res.json({
      valid: true,
      payload: result.payload,
      checkedAt: new Date().toISOString(),
    });
  }
);

/**
 * 4. Protected endpoint requiring valid JWT in Bearer header or cookie
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: req.user,
    token: req.token ? `${req.token.substring(0, 15)}...` : undefined,
  });
});

/**
 * 5. Refresh Token Rotation (/api/auth/refresh)
 * - Reads existing token from HttpOnly cookie or request body
 * - Enforces Rotation: Invalidates old token and issues a brand new token pair
 * - Detects Replay/Reuse attempts and blocks unauthorized session hijacking
 */
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  (req: Request, res: Response) => {
    // 1. Extract Refresh Token from HttpOnly cookie or fallback body
    const existingRefreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] ||
      req.cookies?.refreshToken ||
      req.body?.token;

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

    if (!existingRefreshToken) {
      logSecurityEvent({
        type: 'AUTH_FAILURE',
        severity: 'WARN',
        ip,
        path: req.originalUrl,
        method: req.method,
        details: 'Refresh token missing in HttpOnly cookie and request payload',
      });

      return res.status(401).json({
        error: 'Refresh token ausente no cookie seguro HttpOnly ou na requisição.',
        code: 'REFRESH_TOKEN_REQUIRED',
      });
    }

    // 2. Validate & Rotate Token
    const rotationResult = validateAndRotateRefreshToken(existingRefreshToken);

    if (rotationResult.status === 'REUSED') {
      logSecurityEvent({
        type: 'SUSPICIOUS_PAYLOAD',
        severity: 'CRITICAL',
        ip,
        path: req.originalUrl,
        method: req.method,
        details: `Refresh Token Reuse detected! Old token was already consumed.`,
      });

      // Clear compromised cookie
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });

      return res.status(403).json({
        error: 'Tentativa de reuso de token detectada! A sessão anterior foi revogada por segurança.',
        code: 'TOKEN_REUSE_DETECTED',
      });
    }

    if (rotationResult.status !== 'VALID' || !rotationResult.payload) {
      logSecurityEvent({
        type: 'AUTH_FAILURE',
        severity: 'WARN',
        ip,
        path: req.originalUrl,
        method: req.method,
        details: `Invalid refresh token: ${rotationResult.error}`,
      });

      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });

      return res.status(401).json({
        error: rotationResult.error || 'Refresh token inválido ou expirado.',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // 3. Issue Fresh Token Pair (Rotation Completed)
    const payload = (rotationResult.payload || {}) as Record<string, any>;
    const { isRefreshToken, iat, exp, iss, aud, tokenId, ...cleanUserPayload } = payload;
    const newTokens = generateTokenPair(cleanUserPayload as UserJwtPayload);

    // 4. Update HttpOnly Cookie with New Rotated Refresh Token
    res.cookie(REFRESH_COOKIE_NAME, newTokens.refreshToken, getRefreshCookieOptions());

    logSecurityEvent({
      type: 'AUTH_SUCCESS',
      severity: 'INFO',
      ip,
      path: req.originalUrl,
      method: req.method,
      details: `Refresh Token Rotation successful for user ${cleanUserPayload.userId}`,
    });

    res.json({
      success: true,
      message: 'Token renovado e rotacionado com sucesso (Refresh Token Rotation).',
      accessToken: newTokens.accessToken,
      tokenType: newTokens.tokenType,
      expiresIn: newTokens.expiresIn,
      user: cleanUserPayload,
    });
  }
);

/**
 * 6. Logout endpoint - Clears HttpOnly Cookie and Revokes Active Refresh Token
 */
router.post('/logout', (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.token;
  if (token) {
    revokeRefreshToken(token);
  }

  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.clearCookie('jwt_token', { path: '/' });

  res.json({
    success: true,
    message: 'Sessão terminada e tokens revogados com sucesso.',
  });
});

/**
 * 7. Securely hash a PIN or password using Bcrypt (Validated via Zod pinHashSchema)
 */
router.post(
  '/hash-pin',
  validateBody(pinHashSchema),
  async (req: Request, res: Response) => {
    try {
      const hash = await hashPassword(req.body.pin);
      res.json({ success: true, hash });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao gerar hash seguro.' });
    }
  }
);

/**
 * 8. Compare a PIN or password against a Bcrypt hash (Validated via Zod pinVerifySchema)
 */
router.post(
  '/verify-pin',
  validateBody(pinVerifySchema),
  async (req: Request, res: Response) => {
    try {
      const match = await comparePassword(req.body.pin, req.body.hash);
      res.json({ match });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao verificar hash.' });
    }
  }
);

export default router;

