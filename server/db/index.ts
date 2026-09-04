import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';
import { env } from '../config/env.js';

let sqlClient: ReturnType<typeof neon> | null = null;
let dbClient: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Obtém a URL de conexão do Neon com sslmode=require garantido.
 */
export function getDatabaseUrl(): string | null {
  const rawUrl = env.DATABASE_URL || env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!rawUrl) return null;

  let trimmed = rawUrl.trim();
  // Assegurar SSL ativado
  if (!trimmed.includes('sslmode=')) {
    trimmed += trimmed.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  return trimmed;
}

/**
 * Instância Neon SQL serverless (Lazy init)
 */
export function getSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL não configurada no ambiente. Adicione a sua string de ligação do Neon.');
  }
  if (!sqlClient) {
    sqlClient = neon(url);
  }
  return sqlClient;
}

/**
 * Instância Drizzle ORM conectada ao Neon com o schema relacional configurado.
 */
export function getDb() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL não configurada no ambiente. Adicione a sua string de ligação do Neon.');
  }
  if (!dbClient) {
    const sql = getSql();
    dbClient = drizzle(sql, { schema });
  }
  return dbClient;
}

/**
 * Auto-migração/sincronização de tabelas (DDL) caso ainda não existam no Neon.
 */
export async function ensureTablesExist(): Promise<{ success: boolean; error?: string }> {
  try {
    const sql = getSql();

    // Executar cada DDL individualmente para assegurar compatibilidade no Neon HTTP driver
    await sql`
      CREATE TABLE IF NOT EXISTS atelies (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT NOT NULL,
        telefone TEXT,
        plano TEXT NOT NULL DEFAULT 'basico',
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        data_vencimento TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS clientes (
        id TEXT PRIMARY KEY,
        atelie_id TEXT NOT NULL REFERENCES atelies(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        telefone TEXT,
        email TEXT,
        observacoes TEXT,
        medidas JSONB DEFAULT '{}'::jsonb,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS encomendas (
        id TEXT PRIMARY KEY,
        atelie_id TEXT NOT NULL REFERENCES atelies(id) ON DELETE CASCADE,
        cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
        cliente_nome TEXT,
        cliente_telefone TEXT,
        descricao TEXT NOT NULL,
        tipo_peca TEXT DEFAULT 'vestido',
        tecido TEXT,
        valor_kz NUMERIC(12, 2) DEFAULT 0,
        sinal_pago NUMERIC(12, 2) DEFAULT 0,
        estado TEXT NOT NULL DEFAULT 'pendente',
        prazo_entrega TIMESTAMPTZ,
        foto_referencia TEXT,
        observacoes TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS medidas (
        id TEXT PRIMARY KEY,
        atelie_id TEXT NOT NULL REFERENCES atelies(id) ON DELETE CASCADE,
        cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        busto NUMERIC,
        cintura NUMERIC,
        quadril NUMERIC,
        ombro NUMERIC,
        comprimento_tronco NUMERIC,
        comprimento_saia NUMERIC,
        comprimento_calca NUMERIC,
        manga NUMERIC,
        observacoes TEXT,
        registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS solicitacoes_pagamento (
        id TEXT PRIMARY KEY,
        atelie_id TEXT NOT NULL REFERENCES atelies(id) ON DELETE CASCADE,
        atelie_nome TEXT NOT NULL,
        email_owner TEXT NOT NULL,
        telefone_owner TEXT,
        plano TEXT NOT NULL DEFAULT 'basico',
        metodo_pagamento TEXT NOT NULL DEFAULT 'multicaixa',
        comprovativo_url TEXT,
        status TEXT NOT NULL DEFAULT 'pendente',
        observacoes_admin TEXT,
        solicitado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolvido_em TIMESTAMPTZ
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id TEXT PRIMARY KEY DEFAULT 'geral',
        numero_express TEXT,
        iban TEXT,
        banco TEXT,
        titular TEXT,
        whatsapp_admin TEXT,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS admins (
        email TEXT PRIMARY KEY,
        senha_hash TEXT,
        senha_definida_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        nome TEXT,
        senha_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'atelie_owner',
        atelie_id TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        nome TEXT,
        senha_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'atelie_owner',
        atelie_id TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Garantir colunas de senha e perfil na tabela admins, configuracoes e atelies
    try {
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_hash TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_definida_em TIMESTAMPTZ`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS nome TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS telefone TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS avatar TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS avatar_icon TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS modo_armazenamento TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS storage_mode TEXT`;

      await sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS nome TEXT`;
      await sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS telefone TEXT`;
      await sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS avatar TEXT`;
      await sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS avatar_icon TEXT`;
      await sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS modo_armazenamento TEXT`;
      await sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS storage_mode TEXT`;

      await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone TEXT`;
      await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar TEXT`;
      await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modo_armazenamento TEXT`;

      await sql`ALTER TABLE atelies ADD COLUMN IF NOT EXISTS senha_hash TEXT`;
    } catch (colErr) {
      console.warn('[NEON] Aviso ao adicionar colunas de senha e perfil:', colErr);
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_clientes_atelie ON clientes(atelie_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_encomendas_atelie ON encomendas(atelie_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_encomendas_cliente ON encomendas(cliente_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_medidas_atelie ON medidas(atelie_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_medidas_cliente ON medidas(cliente_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_solicitacoes_atelie ON solicitacoes_pagamento(atelie_id)`;
    } catch (idxErr) {
      console.warn('[NEON] Aviso ao criar índices:', idxErr);
    }

    // Inserção de Administradores Iniciais
    await sql`
      INSERT INTO admins (email, senha_hash, senha_definida_em) VALUES 
        ('admin@flowtailor.ao', '$2b$10$Md5fobe5OhlKFDJWJe3xB.ATvluQj9kGqc7/yivcLl6Xn8DBr7S0i', NOW())
      ON CONFLICT (email) DO NOTHING
    `;

    await sql`
      INSERT INTO usuarios (id, email, nome, senha_hash, role) VALUES
        ('admin_flowtailor', 'admin@flowtailor.ao', 'Administrador Central', '$2b$10$Md5fobe5OhlKFDJWJe3xB.ATvluQj9kGqc7/yivcLl6Xn8DBr7S0i', 'admin')
      ON CONFLICT (email) DO NOTHING
    `;

    // Inserção de Configurações Iniciais se não existirem
    await sql`
      INSERT INTO configuracoes (id, numero_express, iban, banco, titular, whatsapp_admin)
      VALUES (
        'geral',
        '923456789',
        'AO06.0040.0000.1234.5678.9011.2',
        'BAI (Banco Angolano de Investimentos)',
        'FlowTailor Consultoria Lda.',
        '244923456789'
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao verificar/criar tabelas no Neon:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Whitelist de administradores autorizados padrão (Root Admins)
 */
export const INITIAL_AUTHORIZED_ADMINS: readonly string[] = [
  'admin@flowtailor.ao',
];

/**
 * Validação rigorosa e segura de email de administrador no Neon PostgreSQL
 */
export async function isAuthorizedAdminEmail(email?: string | null): Promise<boolean> {
  if (!email || typeof email !== 'string') return false;
  const mailLower = email.toLowerCase().trim();
  if (!mailLower || !mailLower.includes('@')) return false;

  // 1. Verificação rápida contra os Root Admins
  if (INITIAL_AUTHORIZED_ADMINS.includes(mailLower)) {
    return true;
  }

  // 2. Consulta à tabela de administradores no Neon PostgreSQL
  try {
    const db = getDb();
    const rows = await db
      .select({ email: schema.admins.email })
      .from(schema.admins)
      .where(eq(schema.admins.email, mailLower));
    
    return rows.length > 0;
  } catch (err) {
    console.warn('[Admin Verification Neon DB Warning - fallback to static whitelist]:', err);
    return INITIAL_AUTHORIZED_ADMINS.includes(mailLower);
  }
}

export { schema };
export * from './schema.js';
