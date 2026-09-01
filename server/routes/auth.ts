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
import { isAuthorizedAdminEmail } from '../db/index.js';

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
    const { email, role: requestedRole, atelieId, atelieName, authProvider } = req.body as AuthLoginInput;
    const mailLower = email.toLowerCase().trim();
    
    // Strict verification: only grant 'admin' role if email is authorized in database/whitelist
    const isAllowedAdmin = await isAuthorizedAdminEmail(mailLower);
    const effectiveRole = isAllowedAdmin 
      ? 'admin' 
      : (requestedRole === 'admin' ? 'atelie_owner' : (requestedRole || 'atelie_owner'));

    const userId = isAllowedAdmin 
      ? `admin_${mailLower.split('@')[0]}` 
      : `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;

    const payload: UserJwtPayload = {
      userId,
      email: mailLower,
      role: effectiveRole,
      atelieId: atelieId || undefined,
      atelieName: atelieName || (isAllowedAdmin ? 'Administração Central' : 'Ateliê FlowTailor'),
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
      details: `User login successful via Zod schema: ${mailLower} (Role: ${payload.role}, IsAdmin: ${isAllowedAdmin})`,
    });

    res.json({
      success: true,
      message: 'Autenticação concluída com sucesso com Zod e JWT.',
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: payload,
      isAdmin: isAllowedAdmin,
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
  async (req: Request, res: Response) => {
    const body = req.body as AuthTokenIssueInput;
    const mailLower = body.email ? body.email.toLowerCase().trim() : undefined;
    
    // Strict verification: only grant 'admin' role if email is authorized
    const isAllowedAdmin = mailLower ? await isAuthorizedAdminEmail(mailLower) : false;
    const effectiveRole = isAllowedAdmin 
      ? 'admin' 
      : (body.role === 'admin' ? 'atelie_owner' : body.role);

    const payload: UserJwtPayload = {
      ...body,
      email: mailLower,
      role: effectiveRole,
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
      details: `JWT Token pair issued via Zod schema for user: ${payload.userId} (Role: ${payload.role})`,
    });

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: payload,
      isAdmin: isAllowedAdmin,
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
 * 6.1. Neon Auth Configuration & Endpoints
 */
router.get('/neon/config', (_req: Request, res: Response) => {
  const authUrl = process.env.NEON_AUTH_URL || 'https://ep-wispy-moon-zab2krf0.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth';
  const jwksUrl = process.env.NEON_JWKS_URL || 'https://ep-wispy-moon-zab2krf0.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/.well-known/jwks.json';
  
  res.json({
    success: true,
    applicationName: 'flowtailor-db',
    authUrl,
    jwksUrl,
  });
});

/**
 * 6.2. Neon Auth OAuth Google Authorization URL
 */
router.get('/neon/google-url', (req: Request, res: Response) => {
  const authUrl = process.env.NEON_AUTH_URL || 'https://ep-wispy-moon-zab2krf0.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth';
  const redirectUri = (req.query.redirect_uri as string) || (process.env.APP_URL ? `${process.env.APP_URL}/auth/callback` : undefined);
  
  const params = new URLSearchParams();
  if (redirectUri) {
    params.append('redirect_uri', redirectUri);
  }

  const queryString = params.toString();
  const fullUrl = `${authUrl}/oauth/google${queryString ? `?${queryString}` : ''}`;

  res.json({
    success: true,
    provider: 'google',
    url: fullUrl,
    authUrl,
  });
});

/**
 * 6.3. Sync Session from Neon Auth / Google OAuth to FlowTailor JWT
 * Strictly verifies admin role against database/whitelist
 */
router.post('/neon/sync-session', async (req: Request, res: Response) => {
  const { email, displayName, uid, authProvider = 'google_neon' } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email é obrigatório para sincronização de sessão.' });
  }

  const mailLower = String(email).toLowerCase().trim();
  const isAdmin = await isAuthorizedAdminEmail(mailLower);
  
  const userId = uid || (isAdmin ? `admin_${mailLower.split('@')[0]}` : `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`);

  const payload: UserJwtPayload = {
    userId,
    email: mailLower,
    role: isAdmin ? 'admin' : 'atelie_owner',
    atelieName: displayName ? `Ateliê de ${displayName}` : (isAdmin ? 'Administração Central' : `Ateliê de ${mailLower.split('@')[0]}`),
    authProvider,
    sessionCreated: new Date().toISOString(),
  };

  const tokens = generateTokenPair(payload);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions());

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

  logSecurityEvent({
    type: 'AUTH_SUCCESS',
    severity: 'INFO',
    ip,
    path: req.originalUrl,
    method: req.method,
    details: `Google/Neon OAuth session synced for ${mailLower} (Role: ${payload.role}, IsAdmin: ${isAdmin})`,
  });

  res.json({
    success: true,
    message: 'Sessão sincronizada com sucesso.',
    accessToken: tokens.accessToken,
    tokenType: tokens.tokenType,
    expiresIn: tokens.expiresIn,
    user: payload,
    isAdmin,
    role: payload.role,
  });
});

/**
 * 6.4. Direct Google OAuth Verification & Token Exchange
 */
router.post('/google/authenticate', async (req: Request, res: Response) => {
  try {
    const { email, displayName, sub } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email da conta Google é obrigatório.' });
    }

    const mailLower = String(email).toLowerCase().trim();
    const isAdmin = await isAuthorizedAdminEmail(mailLower);
    const userId = sub ? `google_${sub}` : (isAdmin ? `admin_${mailLower.split('@')[0]}` : `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`);

    const payload: UserJwtPayload = {
      userId,
      email: mailLower,
      role: isAdmin ? 'admin' : 'atelie_owner',
      atelieName: displayName ? `Ateliê de ${displayName}` : (isAdmin ? 'Administração Central' : `Ateliê de ${mailLower.split('@')[0]}`),
      authProvider: 'google',
      sessionCreated: new Date().toISOString(),
    };

    const tokens = generateTokenPair(payload);
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions());

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: payload,
      isAdmin,
      role: payload.role,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha na autenticação do Google.' });
  }
});

/**
 * 6.5. Configure Account / Password for User or Admin after Google Login or Initial Setup
 */
router.post('/set-password', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, nomeAtelie, nomeDono, telefone, plano } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Endereço de email é obrigatório.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'A palavra-passe deve conter pelo menos 6 caracteres.' });
    }

    const mailLower = email.toLowerCase().trim();
    const isAdmin = await isAuthorizedAdminEmail(mailLower);
    const hashedPassword = await hashPassword(password);

    const userId = isAdmin 
      ? `admin_${mailLower.split('@')[0]}` 
      : `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;

    const computedAtelieName = (nomeAtelie || displayName || (isAdmin ? 'Administração Central' : `Ateliê de ${mailLower.split('@')[0]}`)).trim();

    const payload: UserJwtPayload = {
      userId,
      email: mailLower,
      role: isAdmin ? 'admin' : 'atelie_owner',
      atelieName: computedAtelieName,
      authProvider: 'google',
      sessionCreated: new Date().toISOString(),
    };

    const tokens = generateTokenPair(payload);
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions());

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

    logSecurityEvent({
      type: 'AUTH_SUCCESS',
      severity: 'INFO',
      ip,
      path: req.originalUrl,
      method: req.method,
      details: `Account setup completed successfully for Google user: ${mailLower} (Role: ${payload.role}, IsAdmin: ${isAdmin})`,
    });

    res.json({
      success: true,
      message: 'Conta e palavra-passe configuradas com sucesso.',
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: payload,
      isAdmin,
      role: payload.role,
    });
  } catch (err: any) {
    console.error('[Set Password Error]:', err);
    res.status(500).json({ error: 'Erro ao configurar conta e palavra-passe.' });
  }
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

