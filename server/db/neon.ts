import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '../config/env.js';

// Cache client instances for serverless/HMR reuse
let sqlClient: ReturnType<typeof neon> | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

/**
 * Retorna a URL de conexão do Neon configurada nas variáveis de ambiente.
 */
export function getNeonDatabaseUrl(): string | null {
  return env.DATABASE_URL || env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || null;
}

/**
 * Inicialização preguiçosa (Lazy initialization) do driver serverless Neon SQL.
 * Não quebra a inicialização do servidor se a variável DATABASE_URL ainda não tiver sido definida.
 */
export function getNeonSql() {
  const dbUrl = getNeonDatabaseUrl();
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL não configurada. Execute `npx neon@latest init` ou defina DATABASE_URL no seu arquivo de ambiente.'
    );
  }

  if (!sqlClient) {
    sqlClient = neon(dbUrl);
  }
  return sqlClient;
}

/**
 * Retorna o cliente Drizzle ORM conectado ao Neon Serverless PostgreSQL.
 */
export function getNeonDb() {
  const dbUrl = getNeonDatabaseUrl();
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL não configurada. Execute `npx neon@latest init` ou defina DATABASE_URL no seu arquivo de ambiente.'
    );
  }

  if (!drizzleDb) {
    const sql = getNeonSql();
    drizzleDb = drizzle(sql);
  }
  return drizzleDb;
}

/**
 * Verifica o status da conexão com o Neon Serverless PostgreSQL.
 */
export async function checkNeonConnection(): Promise<{
  connected: boolean;
  timestamp?: string;
  version?: string;
  error?: string;
}> {
  try {
    const sql = getNeonSql();
    const result = await sql`SELECT NOW() as now, version() as version;` as Array<{ now: string; version: string }>;
    if (result && result.length > 0) {
      return {
        connected: true,
        timestamp: result[0].now,
        version: result[0].version,
      };
    }
    return { connected: true };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Falha ao conectar ao Neon PostgreSQL.',
    };
  }
}
