import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface UserJwtPayload {
  userId: string;
  email?: string;
  role: 'admin' | 'atelie_owner' | 'staff' | 'user';
  atelieId?: string;
  atelieName?: string;
  authProvider?: 'google' | 'email' | 'anonymous';
  sessionCreated?: string;
  isRefreshToken?: boolean;
  tokenId?: string;
}

// In-Memory Store for Refresh Token Rotation & Revocation Tracking
const activeRefreshTokens = new Map<string, { userId: string; createdAt: number; expiresAt: number }>();
const revokedRefreshTokens = new Set<string>();

/**
 * Signs a new JWT token for authenticated users with standard claims
 */
export function signJwtToken(payload: UserJwtPayload, options?: SignOptions): string {
  const defaultOptions: SignOptions = {
    expiresIn: (env.JWT_EXPIRES_IN as any) || '24h',
    issuer: 'flowtailor-auth-server',
    audience: 'flowtailor-app',
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generates a pair of access and refresh tokens and registers the refresh token for rotation
 */
export function generateTokenPair(payload: UserJwtPayload) {
  const tokenId = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const accessToken = signJwtToken({ ...payload, tokenId }, { expiresIn: '2h' });
  const refreshToken = signJwtToken(
    { ...payload, isRefreshToken: true, tokenId } as any,
    { expiresIn: '7d' }
  );

  // Register in active store (expires in 7 days)
  const now = Date.now();
  activeRefreshTokens.set(refreshToken, {
    userId: payload.userId,
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 7200, // 2 hours in seconds
  };
}

/**
 * Verifies a JWT token, ensuring it is unexpired and has not been tampered with
 */
export function verifyJwtToken<T = UserJwtPayload>(token: string, options?: VerifyOptions): { valid: boolean; payload?: T; error?: string } {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'flowtailor-auth-server',
      audience: 'flowtailor-app',
      ...options,
    }) as unknown as T;

    return {
      valid: true,
      payload: decoded,
    };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'O token JWT expirou. Por favor efetue novo login.' };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Assinatura do token JWT inválida ou adulterada.' };
    }
    return { valid: false, error: error.message || 'Token JWT inválido.' };
  }
}

/**
 * Refresh Token Rotation Check & Invalidation:
 * Returns 'VALID' if active and valid, 'REVOKED' if token reuse attempt, 'UNKNOWN' if not found.
 */
export function validateAndRotateRefreshToken(oldRefreshToken: string): {
  status: 'VALID' | 'REUSED' | 'INVALID';
  payload?: UserJwtPayload;
  error?: string;
} {
  // 1. Check if token was already revoked (Token Reuse / Replay Detection)
  if (revokedRefreshTokens.has(oldRefreshToken)) {
    return {
      status: 'REUSED',
      error: 'Tentativa de reutilização de Refresh Token detectada! O token anterior já foi revogado.',
    };
  }

  // 2. Verify JWT signature & expiration
  const verifyResult = verifyJwtToken<UserJwtPayload>(oldRefreshToken);
  if (!verifyResult.valid || !verifyResult.payload || !verifyResult.payload.isRefreshToken) {
    return {
      status: 'INVALID',
      error: verifyResult.error || 'Refresh token inválido ou corrompido.',
    };
  }

  // 3. Mark old refresh token as revoked (Rotation)
  activeRefreshTokens.delete(oldRefreshToken);
  revokedRefreshTokens.add(oldRefreshToken);

  return {
    status: 'VALID',
    payload: verifyResult.payload,
  };
}

/**
 * Revokes a refresh token immediately (e.g. upon user logout)
 */
export function revokeRefreshToken(token: string): boolean {
  if (activeRefreshTokens.has(token)) {
    activeRefreshTokens.delete(token);
    revokedRefreshTokens.add(token);
    return true;
  }
  revokedRefreshTokens.add(token);
  return false;
}

/**
 * Safely decodes a token without verifying signature (useful for inspection)
 */
export function decodeJwtToken(token: string) {
  return jwt.decode(token);
}

