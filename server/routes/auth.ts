import { Router, Request, Response, CookieOptions } from 'express';
import { env } from '../config/env.js';
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
 * Calculates the exact OAuth Redirect URI for Google Callback
 * Priority:
 * 1. GOOGLE_OAUTH_REDIRECT_URI environment variable (explicit)
 * 2. VERCEL_URL (dynamic Vercel deployment preview / production)
 * 3. APP_URL / VITE_APP_URL
 * 4. Request host headers (forwarded host / host)
 * 5. Default production domain: https://flow-tailor.vercel.app/api/auth/google/callback
 */
export function getGoogleOAuthRedirectUri(req?: Request): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  if (process.env.VERCEL_URL) {
    const domain = process.env.VERCEL_URL.startsWith('http')
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
    return `${domain.replace(/\/+$/, '')}/api/auth/google/callback`;
  }
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/+$/, '')}/api/auth/google/callback`;
  }
  if (req) {
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) {
      const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'));
      return `${proto}://${host}/api/auth/google/callback`;
    }
  }
  return 'https://flow-tailor.vercel.app/api/auth/google/callback';
}

/**
 * Validates Google OAuth Client ID & Client Secret from environment
 * Returns null and logs a clear warning without throwing to prevent unhandled 500 crashes
 */
export function getGoogleCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Google OAuth] Aviso: GOOGLE_CLIENT_ID e/ou GOOGLE_CLIENT_SECRET não estão configurados no painel de ambiente.');
    return null;
  }

  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

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
 * 6.3. Direct Google OAuth Start / Authorization URL (/api/auth/google)
 */
router.get(['/google', '/auth/google', '/api/auth/google'], (req: Request, res: Response) => {
  const creds = getGoogleCredentials();
  if (!creds) {
    console.warn('[Google OAuth /google] Tentativa de iniciar Google OAuth sem GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET configurados.');
    if (req.headers.accept?.includes('application/json') || req.xhr || req.query.format === 'json') {
      return res.status(400).json({
        success: false,
        message: 'Google OAuth não está configurado no servidor. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no painel da Vercel.',
        code: 'GOOGLE_CONFIG_MISSING',
      });
    }
    return res.redirect('/?auth_error=google_not_configured');
  }

  const redirectUri = getGoogleOAuthRedirectUri(req);
  const state = (req.query.state as string) || crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
    return res.json({
      success: true,
      url,
      redirectUri,
    });
  }

  return res.redirect(url);
});

/**
 * 6.4. Google OAuth 2.0 Callback (/api/auth/google/callback)
 * Exchanges authorization code for Google tokens and verifies user profile against Neon DB
 * Explicitly supports GET and POST, query parameters 'code' and 'state', and performs redirect to /?login=success
 */
router.all([
  '/google/callback',
  '/google-callback',
  '/auth/google/callback',
  '/auth/google-callback',
  '/api/auth/google/callback',
  '/api/auth/google-callback',
], async (req: Request, res: Response) => {
  try {
    const errorParam = req.query.error || req.body?.error;
    const errorDesc = req.query.error_description || req.body?.error_description;

    if (errorParam) {
      console.warn(`[Google OAuth Callback] Erro retornado pelo Google: ${errorParam} - ${errorDesc}`);
      if (req.headers.accept?.includes('application/json') && req.method === 'POST') {
        return res.status(400).json({
          success: false,
          message: `Falha na autenticação do Google: ${errorDesc || errorParam || 'Acesso cancelado ou negado'}`,
          code: 'GOOGLE_AUTH_CANCELLED',
        });
      }
      return res.redirect(`/?auth_error=${encodeURIComponent(String(errorDesc || errorParam || 'google_cancelled'))}`);
    }

    const code = req.query.code || req.body?.code;
    const state = req.query.state || req.body?.state;
    if (!code) {
      console.warn('[Google OAuth Callback] Código de autorização ausente na requisição.');
      if (req.headers.accept?.includes('application/json') && req.method === 'POST') {
        return res.status(400).json({
          success: false,
          message: 'Falha na autenticação do Google: código de autorização não fornecido.',
          code: 'MISSING_AUTH_CODE',
        });
      }
      return res.redirect('/?auth_error=missing_code');
    }

    const creds = getGoogleCredentials();
    if (!creds) {
      console.warn('[Google OAuth Callback] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ausentes no servidor ao processar callback.');
      if (req.headers.accept?.includes('application/json') && req.method === 'POST') {
        return res.status(400).json({
          success: false,
          message: 'Falha na autenticação do Google: credenciais OAuth não configuradas no servidor.',
          code: 'GOOGLE_CONFIG_MISSING',
        });
      }
      return res.redirect('/?auth_error=google_config_missing');
    }

    const redirectUri = (req.body?.redirect_uri as string) || getGoogleOAuthRedirectUri(req);

    // Exchange authorization code for Google access token & ID token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.warn(`[Google OAuth Callback] Falha na troca do token Google (${tokenRes.status}):`, errBody);
      if (req.headers.accept?.includes('application/json') && req.method === 'POST') {
        return res.status(401).json({
          success: false,
          message: 'Falha na autenticação do Google: código de autorização expirado ou inválido.',
          code: 'GOOGLE_TOKEN_EXCHANGE_FAILED',
        });
      }
      return res.redirect('/?auth_error=invalid_google_token');
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    if (!tokenData.access_token && !tokenData.id_token) {
      console.warn('[Google OAuth Callback] Resposta de token do Google vazia.');
      return res.status(401).json({
        success: false,
        message: 'Falha na autenticação do Google: token não retornado pelo provedor.',
        code: 'GOOGLE_EMPTY_TOKEN',
      });
    }

    // Retrieve user profile from Google UserInfo endpoint
    let googleProfile: { email?: string; name?: string; sub?: string; picture?: string } = {};

    if (tokenData.access_token) {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userInfoRes.ok) {
          googleProfile = await userInfoRes.json();
        }
      } catch (uiErr) {
        console.warn('[Google OAuth Callback] Aviso ao obter userinfo:', uiErr);
      }
    }

    // Fallback: decode id_token if email was not retrieved from userinfo
    if (!googleProfile.email && tokenData.id_token) {
      try {
        const decoded = decodeJwtToken(tokenData.id_token);
        if (decoded && typeof decoded === 'object') {
          const decObj = decoded as Record<string, any>;
          if (decObj.email && typeof decObj.email === 'string') {
            googleProfile.email = decObj.email;
            googleProfile.name = typeof decObj.name === 'string' ? decObj.name : undefined;
            googleProfile.sub = typeof decObj.sub === 'string' ? decObj.sub : undefined;
          }
        }
      } catch (decErr) {
        console.warn('[Google OAuth Callback] Aviso ao decodificar id_token:', decErr);
      }
    }

    if (!googleProfile.email) {
      console.warn('[Google OAuth Callback] Email não encontrado no perfil retornado pelo Google.');
      if (req.headers.accept?.includes('application/json') && req.method === 'POST') {
        return res.status(400).json({
          success: false,
          message: 'Falha na autenticação do Google: email não disponível no perfil da conta.',
          code: 'GOOGLE_EMAIL_MISSING',
        });
      }
      return res.redirect('/?auth_error=email_missing');
    }

    const mailLower = googleProfile.email.toLowerCase().trim();

    // Query Neon PostgreSQL DB to check if email belongs to an authorized admin
    const isAdmin = await isAuthorizedAdminEmail(mailLower);
    const role = isAdmin ? 'admin' : 'atelie_owner';
    const userId = googleProfile.sub
      ? `google_${googleProfile.sub}`
      : (isAdmin ? `admin_${mailLower.split('@')[0]}` : `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`);

    const userPayload: UserJwtPayload = {
      userId,
      email: mailLower,
      role,
      atelieName: googleProfile.name
        ? `Ateliê de ${googleProfile.name}`
        : (isAdmin ? 'Administração Central' : `Ateliê de ${mailLower.split('@')[0]}`),
      authProvider: 'google',
      sessionCreated: new Date().toISOString(),
    };

    const tokens = generateTokenPair(userPayload);
    const refreshOpts = getRefreshCookieOptions();
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshOpts);
    res.cookie('flowtailor_jwt_token', tokens.accessToken, { ...refreshOpts, httpOnly: false });
    res.cookie('flowtailor_session', JSON.stringify({
      uid: userPayload.userId,
      email: userPayload.email,
      role,
      isAdmin,
      atelieName: userPayload.atelieName,
      authProvider: 'google',
    }), { ...refreshOpts, httpOnly: false });

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

    logSecurityEvent({
      type: 'AUTH_SUCCESS',
      severity: 'INFO',
      ip,
      path: req.originalUrl,
      method: req.method,
      details: `Google OAuth Callback login completed: ${mailLower} (Role: ${role}, IsAdmin: ${isAdmin})`,
    });

    // If programmatic POST requesting JSON
    if (req.headers.accept?.includes('application/json') && req.method === 'POST') {
      return res.json({
        success: true,
        message: 'Autenticação com o Google realizada com sucesso.',
        accessToken: tokens.accessToken,
        tokenType: tokens.tokenType,
        expiresIn: tokens.expiresIn,
        user: userPayload,
        isAdmin,
        role: userPayload.role,
      });
    }

    // Redirect directly to /admin or /dashboard with login=success and authentication parameters
    const targetPath = isAdmin ? '/admin' : '/dashboard';
    const redirectUrl = `${targetPath}?login=success&token=${encodeURIComponent(tokens.accessToken)}&uid=${encodeURIComponent(userPayload.userId)}&email=${encodeURIComponent(userPayload.email)}&role=${encodeURIComponent(role)}&name=${encodeURIComponent(userPayload.atelieName || '')}`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error('[Google OAuth Callback Exception]:', err);
    if (req.headers.accept?.includes('application/json') && req.method === 'POST') {
      return res.status(401).json({
        success: false,
        message: 'Falha na autenticação do Google.',
        error: err?.message || 'Erro de processamento',
        code: 'GOOGLE_AUTH_ERROR',
      });
    }
    return res.redirect('/?auth_error=google_auth_failed');
  }
});

/**
 * 6.5. Google Identity Services ID Token / Credential Verification
 */
router.post('/google/verify-credential', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Token de credencial do Google não fornecido.',
      });
    }

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) {
      console.warn('[Google verify-credential] Falha ao verificar ID token junto do Google');
      return res.status(401).json({
        success: false,
        message: 'Falha na autenticação do Google: token inválido ou expirado.',
      });
    }

    const payload = (await verifyRes.json()) as { email?: string; name?: string; sub?: string; aud?: string };
    if (!payload.email) {
      return res.status(400).json({
        success: false,
        message: 'Falha na autenticação do Google: email não disponível no token.',
      });
    }

    const creds = getGoogleCredentials();
    if (creds && payload.aud && payload.aud !== creds.clientId) {
      console.warn(`[Google verify-credential] Client ID mismatch: aud=${payload.aud} vs configured=${creds.clientId}`);
      return res.status(401).json({
        success: false,
        message: 'Falha na autenticação do Google: Client ID não coincide.',
      });
    }

    const mailLower = payload.email.toLowerCase().trim();
    const isAdmin = await isAuthorizedAdminEmail(mailLower);
    const role = isAdmin ? 'admin' : 'atelie_owner';
    const userId = payload.sub
      ? `google_${payload.sub}`
      : (isAdmin ? `admin_${mailLower.split('@')[0]}` : `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`);

    const userPayload: UserJwtPayload = {
      userId,
      email: mailLower,
      role,
      atelieName: payload.name
        ? `Ateliê de ${payload.name}`
        : (isAdmin ? 'Administração Central' : `Ateliê de ${mailLower.split('@')[0]}`),
      authProvider: 'google',
      sessionCreated: new Date().toISOString(),
    };

    const tokens = generateTokenPair(userPayload);
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions());

    return res.json({
      success: true,
      message: 'Autenticado com sucesso via Google.',
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: userPayload,
      isAdmin,
      role,
    });
  } catch (err: any) {
    console.error('[Google verify-credential Error]:', err);
    return res.status(401).json({
      success: false,
      message: 'Falha na autenticação do Google.',
    });
  }
});

/**
 * 6.6. Sync Session from Neon Auth / Google OAuth to FlowTailor JWT
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
 * 6.7. Direct Google OAuth Verification & Token Exchange
 */
router.post('/google/authenticate', async (req: Request, res: Response) => {
  try {
    const { email, displayName, sub } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email da conta Google é obrigatório.',
      });
    }

    const mailLower = String(email).toLowerCase().trim();
    const isAdmin = await isAuthorizedAdminEmail(mailLower);
    const role = isAdmin ? 'admin' : 'atelie_owner';
    const userId = sub ? `google_${sub}` : (isAdmin ? `admin_${mailLower.split('@')[0]}` : `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`);

    const payload: UserJwtPayload = {
      userId,
      email: mailLower,
      role,
      atelieName: displayName ? `Ateliê de ${displayName}` : (isAdmin ? 'Administração Central' : `Ateliê de ${mailLower.split('@')[0]}`),
      authProvider: 'google',
      sessionCreated: new Date().toISOString(),
    };

    const tokens = generateTokenPair(payload);
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions());

    res.json({
      success: true,
      message: 'Autenticado com sucesso.',
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: payload,
      isAdmin,
      role: payload.role,
    });
  } catch (err: any) {
    console.error('[Google Authenticate Error]:', err);
    res.status(401).json({
      success: false,
      message: 'Falha na autenticação do Google.',
    });
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

