import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().optional(),
  JWT_SECRET: z.string().default('flowtailor_super_secure_jwt_secret_key_default_2026'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(120),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ [CONFIG] Configuração de variáveis de ambiente inválida:', parsed.error.format());
}

export const env = parsed.success
  ? parsed.data
  : {
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      PORT: Number(process.env.PORT) || 3000,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      APP_URL: process.env.APP_URL,
      JWT_SECRET: process.env.JWT_SECRET || 'flowtailor_super_secure_jwt_secret_key_default_2026',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
      CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
      RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
      RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 120,
    };
