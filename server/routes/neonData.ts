import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, getSql, getDatabaseUrl, ensureTablesExist, INITIAL_AUTHORIZED_ADMINS, isAuthorizedAdminEmail } from '../db/index.js';
import { 
  atelies, 
  clientes, 
  encomendas, 
  medidas, 
  solicitacoesPagamento, 
  configuracoes, 
  admins 
} from '../db/schema.js';
import { hashPassword, comparePassword } from '../services/passwordService.js';
import { extractToken } from '../middleware/authJwt.js';
import { verifyJwtToken } from '../services/jwtService.js';

const router = Router();

// Helper to guarantee admins table columns exist dynamically on Neon
let adminColumnsChecked = false;
async function ensureAdminColumnsExist() {
  if (adminColumnsChecked) return;
  try {
    const sql = getSql();
    await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_hash TEXT`;
    await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_definida_em TIMESTAMPTZ`;
    adminColumnsChecked = true;
  } catch (e) {
    console.warn('[Neon AutoMigration] admins columns:', e);
  }
}

// Sanitization Helpers for Neon DB
function sanitizeNumeric(val: any, fallback = '0'): string {
  if (val === null || val === undefined || val === '') return fallback;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? fallback : String(num);
}

function sanitizeNullableNumeric(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : String(num);
}

function sanitizeDate(val: any): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// Middleware helper to ensure Database connection is available
function checkDbAvailable(req: Request, res: Response, next: () => void) {
  const url = getDatabaseUrl();
  if (!url) {
    return res.status(503).json({
      success: false,
      message: 'Falha ao sincronizar dados do ateliê',
      details: 'Base de dados Neon PostgreSQL não configurada. Defina DATABASE_URL no seu ambiente.',
      neonConnected: false,
    });
  }
  next();
}

/**
 * 0. Setup/Sync Tables DDL (Acessível via GET ou POST sob /api/neon/setup-tables ou /neon/setup-tables)
 */
const handleSetupTables = async (_req: Request, res: Response) => {
  const result = await ensureTablesExist();
  if (result.success) {
    res.status(200).json({ 
      success: true, 
      message: 'Tabelas relacionais (atelies, clientes, encomendas, medidas, solicitacoes_pagamento, configuracoes, admins) criadas/validadas com sucesso no Neon PostgreSQL.' 
    });
  } else {
    res.status(500).json({ success: false, error: "Erro ao inicializar tabelas no banco de dados." });
  }
};

router.get('/neon/setup-tables', handleSetupTables);
router.post('/neon/setup-tables', handleSetupTables);
router.get('/setup-tables', handleSetupTables);
router.post('/setup-tables', handleSetupTables);

// ==============================================================================
// 1. ATELIÊS
// ==============================================================================

/**
 * Listar todos os ateliês (para o Painel Admin)
 */
router.get('/neon/atelies', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.select().from(atelies).orderBy(desc(atelies.criado_em));
    
    // Formatar nomes de campos para camelCase esperado pelo frontend
    const mapped = result.map(a => ({
      id: a.id,
      nome: a.nome,
      emailOwner: a.email,
      telefone: a.telefone || '',
      plano: a.plano as 'basico' | 'pro',
      ativo: a.ativo,
      dataVencimento: a.data_vencimento ? a.data_vencimento.toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      criadoEm: a.criado_em.toISOString(),
    }));

    res.json({ atelies: mapped, count: mapped.length });
  } catch (err: any) {
    console.error('[Neon] Erro ao listar atelies:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Obter ateliê específico por ID
 */
router.get('/neon/atelies/:id', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = await db.select().from(atelies).where(eq(atelies.id, id)).limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Ateliê não encontrado no Neon.' });
    }

    const a = result[0];
    const formatted = {
      id: a.id,
      nome: a.nome,
      emailOwner: a.email,
      telefone: a.telefone || '',
      plano: a.plano as 'basico' | 'pro',
      ativo: a.ativo,
      dataVencimento: a.data_vencimento ? a.data_vencimento.toISOString() : new Date().toISOString(),
      criadoEm: a.criado_em.toISOString(),
    };

    res.json({ atelie: formatted });
  } catch (err: any) {
    console.error('[Neon] Erro ao buscar atelie:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Inserir / Upsert Ateliê
 */
router.post('/neon/atelies', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id = body.id;
    const nome = body.nome;
    const email = body.emailOwner || body.email;
    const telefone = body.telefone;
    const plano = body.plano || 'basico';
    const ativo = body.ativo !== undefined ? Boolean(body.ativo) : true;
    const dataVencimento = body.dataVencimento || body.data_vencimento;

    if (!id || !nome || !email) {
      return res.status(400).json({ error: 'Campos id, nome e email são obrigatórios.' });
    }

    const db = getDb();
    const inserted = await db
      .insert(atelies)
      .values({
        id,
        nome,
        email,
        telefone: telefone || null,
        plano,
        ativo,
        data_vencimento: dataVencimento ? new Date(dataVencimento) : null,
      })
      .onConflictDoUpdate({
        target: atelies.id,
        set: {
          nome,
          email,
          telefone: telefone || null,
          plano,
          ativo,
          data_vencimento: dataVencimento ? new Date(dataVencimento) : null,
        },
      })
      .returning();

    res.status(201).json({ success: true, atelie: inserted[0] });
  } catch (err: any) {
    console.error('[Neon] Erro ao gravar atelie:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Excluir Ateliê
 */
router.delete('/neon/atelies/:id', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.delete(atelies).where(eq(atelies.id, id));
    res.json({ success: true, message: 'Ateliê removido com sucesso no Neon.' });
  } catch (err: any) {
    console.error('[Neon] Erro ao excluir atelie:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

// ==============================================================================
// 2. CLIENTES (Isolamento por atelie_id)
// ==============================================================================

/**
 * Listar clientes com isolamento
 */
router.get('/neon/clientes', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const atelieId = (req.query.atelie_id as string) || (req.headers['x-atelie-id'] as string);
    if (!atelieId) {
      return res.status(400).json({ error: 'Parâmetro atelie_id é obrigatório para isolamento multitenant.' });
    }

    const db = getDb();
    const result = await db
      .select()
      .from(clientes)
      .where(eq(clientes.atelie_id, atelieId))
      .orderBy(desc(clientes.criado_em));

    const mapped = result.map(c => ({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone || '',
      email: c.email || '',
      observacoes: c.observacoes || '',
      medidas: c.medidas || {},
      criadoEm: c.criado_em.toISOString(),
      atelieId: c.atelie_id,
    }));

    res.json({ clientes: mapped, count: mapped.length });
  } catch (err: any) {
    console.error('[Neon] Erro ao listar clientes:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Inserir / Upsert Cliente
 */
router.post('/neon/clientes', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id = body.id;
    const atelie_id = body.atelieId || body.atelie_id;
    const nome = body.nome;
    const telefone = body.telefone;
    const email = body.email;
    const observacoes = body.observacoes;
    const medidasData = body.medidas;

    if (!id || !atelie_id || !nome) {
      return res.status(400).json({ error: 'Campos id, atelie_id e nome são obrigatórios.' });
    }

    const db = getDb();

    // Assegura ateliê para chave estrangeira
    await db
      .insert(atelies)
      .values({
        id: atelie_id,
        nome: `Ateliê ${atelie_id}`,
        email: `${atelie_id}@ateliepro.local`,
      })
      .onConflictDoNothing();

    const inserted = await db
      .insert(clientes)
      .values({
        id,
        atelie_id,
        nome,
        telefone: telefone || null,
        email: email || null,
        observacoes: observacoes || null,
        medidas: medidasData || {},
      })
      .onConflictDoUpdate({
        target: clientes.id,
        set: {
          nome,
          telefone: telefone || null,
          email: email || null,
          observacoes: observacoes || null,
          medidas: medidasData || {},
        },
      })
      .returning();

    res.status(201).json({ success: true, cliente: inserted[0] });
  } catch (err: any) {
    console.error('[Neon] Erro ao salvar cliente:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Excluir Cliente com isolamento
 */
router.delete('/neon/clientes/:id', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const atelieId = (req.query.atelie_id as string) || (req.headers['x-atelie-id'] as string);
    const db = getDb();

    if (atelieId) {
      await db.delete(clientes).where(and(eq(clientes.id, id), eq(clientes.atelie_id, atelieId)));
    } else {
      await db.delete(clientes).where(eq(clientes.id, id));
    }

    res.json({ success: true, message: 'Cliente removido com sucesso no Neon.' });
  } catch (err: any) {
    console.error('[Neon] Erro ao remover cliente:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

// ==============================================================================
// 3. ENCOMENDAS (Isolamento por atelie_id)
// ==============================================================================

/**
 * Listar encomendas com isolamento
 */
router.get('/neon/encomendas', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const atelieId = (req.query.atelie_id as string) || (req.headers['x-atelie-id'] as string);
    if (!atelieId) {
      return res.status(400).json({ error: 'Parâmetro atelie_id é obrigatório para isolamento multitenant.' });
    }

    const db = getDb();
    const result = await db
      .select()
      .from(encomendas)
      .where(eq(encomendas.atelie_id, atelieId))
      .orderBy(desc(encomendas.criado_em));

    const mapped = result.map(e => ({
      id: e.id,
      clienteId: e.cliente_id || '',
      clienteNome: e.cliente_nome || '',
      clienteTelefone: e.cliente_telefone || '',
      descricao: e.descricao,
      tipoPeca: e.tipo_peca || 'vestido',
      tecido: e.tecido || '',
      valor: e.valor_kz ? Number(e.valor_kz) : 0,
      sinalPago: e.sinal_pago ? Number(e.sinal_pago) : 0,
      status: e.estado || 'em_andamento',
      prazoEntrega: e.prazo_entrega ? e.prazo_entrega.toISOString() : new Date().toISOString(),
      fotoReferencia: e.foto_referencia || '',
      observacoes: e.observacoes || '',
      criadoEm: e.criado_em.toISOString(),
      atualizadoEm: e.criado_em.toISOString(),
    }));

    res.json({ encomendas: mapped, pedidos: mapped, count: mapped.length });
  } catch (err: any) {
    console.error('[Neon] Erro ao listar encomendas:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Inserir / Upsert Encomenda
 */
router.post('/neon/encomendas', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id = body.id;
    const atelie_id = body.atelieId || body.atelie_id;
    const cliente_id = body.clienteId || body.cliente_id || null;
    const cliente_nome = body.clienteNome || body.cliente_nome || null;
    const cliente_telefone = body.clienteTelefone || body.cliente_telefone || null;
    const descricao = body.descricaoPeca || body.descricao;
    const tipo_peca = body.tipoPeca || body.tipo_peca || 'vestido';
    const tecido = body.tecido || null;
    const valor_kz = body.valor != null ? String(body.valor) : (body.precoKz != null ? String(body.precoKz) : (body.valor_kz != null ? String(body.valor_kz) : '0'));
    const sinal_pago = body.sinalPago != null ? String(body.sinalPago) : (body.sinal_pago != null ? String(body.sinal_pago) : '0');
    const estado = body.status || body.estado || 'em_andamento';
    const prazo_entrega = body.prazoEntrega || body.dataEntrega || body.prazo_entrega;
    const foto_referencia = body.fotoReferencia || body.foto_referencia || null;
    const observacoes = body.observacoes || null;

    if (!id || !atelie_id || !descricao) {
      return res.status(400).json({ error: 'Campos id, atelie_id e descricao são obrigatórios.' });
    }

    const db = getDb();

    // Assegura ateliê
    await db
      .insert(atelies)
      .values({
        id: atelie_id,
        nome: `Ateliê ${atelie_id}`,
        email: `${atelie_id}@ateliepro.local`,
      })
      .onConflictDoNothing();

    // Valida se cliente existe se fornecido
    let validClienteId: string | null = cliente_id;
    if (validClienteId) {
      const cliExists = await db.select().from(clientes).where(eq(clientes.id, validClienteId)).limit(1);
      if (cliExists.length === 0) {
        validClienteId = null;
      }
    }

    const inserted = await db
      .insert(encomendas)
      .values({
        id,
        atelie_id,
        cliente_id: validClienteId,
        cliente_nome,
        cliente_telefone,
        descricao,
        tipo_peca,
        tecido,
        valor_kz,
        sinal_pago,
        estado,
        prazo_entrega: prazo_entrega ? new Date(prazo_entrega) : null,
        foto_referencia,
        observacoes,
      })
      .onConflictDoUpdate({
        target: encomendas.id,
        set: {
          cliente_id: validClienteId,
          cliente_nome,
          cliente_telefone,
          descricao,
          tipo_peca,
          tecido,
          valor_kz,
          sinal_pago,
          estado,
          prazo_entrega: prazo_entrega ? new Date(prazo_entrega) : null,
          foto_referencia,
          observacoes,
        },
      })
      .returning();

    res.status(201).json({ success: true, encomenda: inserted[0] });
  } catch (err: any) {
    console.error('[Neon] Erro ao salvar encomenda:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Excluir Encomenda com isolamento
 */
router.delete('/neon/encomendas/:id', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const atelieId = (req.query.atelie_id as string) || (req.headers['x-atelie-id'] as string);
    const db = getDb();

    if (atelieId) {
      await db.delete(encomendas).where(and(eq(encomendas.id, id), eq(encomendas.atelie_id, atelieId)));
    } else {
      await db.delete(encomendas).where(eq(encomendas.id, id));
    }

    res.json({ success: true, message: 'Encomenda removida com sucesso no Neon.' });
  } catch (err: any) {
    console.error('[Neon] Erro ao remover encomenda:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

// ==============================================================================
// 4. MEDIDAS (Isolamento por atelie_id)
// ==============================================================================

/**
 * Listar medidas
 */
router.get('/neon/medidas', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const atelieId = (req.query.atelie_id as string) || (req.headers['x-atelie-id'] as string);
    const clienteId = req.query.cliente_id as string;

    if (!atelieId) {
      return res.status(400).json({ error: 'Parâmetro atelie_id é obrigatório.' });
    }

    const db = getDb();
    let query = db.select().from(medidas).where(eq(medidas.atelie_id, atelieId));
    if (clienteId) {
      query = db.select().from(medidas).where(and(eq(medidas.atelie_id, atelieId), eq(medidas.cliente_id, clienteId)));
    }

    const result = await query.orderBy(desc(medidas.registrado_em));
    const mapped = result.map(m => ({
      id: m.id,
      clienteId: m.cliente_id,
      busto: m.busto ? Number(m.busto) : undefined,
      cintura: m.cintura ? Number(m.cintura) : undefined,
      quadril: m.quadril ? Number(m.quadril) : undefined,
      ombro: m.ombro ? Number(m.ombro) : undefined,
      comprimentoTronco: m.comprimento_tronco ? Number(m.comprimento_tronco) : undefined,
      comprimentoSaia: m.comprimento_saia ? Number(m.comprimento_saia) : undefined,
      comprimentoCalca: m.comprimento_calca ? Number(m.comprimento_calca) : undefined,
      manga: m.manga ? Number(m.manga) : undefined,
      observacoes: m.observacoes || '',
      registradoEm: m.registrado_em.toISOString(),
      atelieId: m.atelie_id,
    }));

    res.json({ medidas: mapped, count: mapped.length });
  } catch (err: any) {
    console.error('[Neon] Erro ao listar medidas:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Inserir / Upsert Medidas
 */
router.post('/neon/medidas', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id = body.id;
    const atelie_id = body.atelieId || body.atelie_id;
    const cliente_id = body.clienteId || body.cliente_id;

    if (!id || !atelie_id || !cliente_id) {
      return res.status(400).json({ error: 'Campos id, atelie_id e cliente_id são obrigatórios.' });
    }

    const db = getDb();

    const inserted = await db
      .insert(medidas)
      .values({
        id,
        atelie_id,
        cliente_id,
        busto: body.busto != null ? String(body.busto) : null,
        cintura: body.cintura != null ? String(body.cintura) : null,
        quadril: body.quadril != null ? String(body.quadril) : null,
        ombro: body.ombro != null ? String(body.ombro) : null,
        comprimento_tronco: body.comprimentoTronco != null ? String(body.comprimentoTronco) : null,
        comprimento_saia: body.comprimentoSaia != null ? String(body.comprimentoSaia) : null,
        comprimento_calca: body.comprimentoCalca != null ? String(body.comprimentoCalca) : null,
        manga: body.manga != null ? String(body.manga) : null,
        observacoes: body.observacoes || null,
        registrado_em: body.registradoEm ? new Date(body.registradoEm) : new Date(),
      })
      .onConflictDoUpdate({
        target: medidas.id,
        set: {
          busto: body.busto != null ? String(body.busto) : null,
          cintura: body.cintura != null ? String(body.cintura) : null,
          quadril: body.quadril != null ? String(body.quadril) : null,
          ombro: body.ombro != null ? String(body.ombro) : null,
          comprimento_tronco: body.comprimentoTronco != null ? String(body.comprimentoTronco) : null,
          comprimento_saia: body.comprimentoSaia != null ? String(body.comprimentoSaia) : null,
          comprimento_calca: body.comprimentoCalca != null ? String(body.comprimentoCalca) : null,
          manga: body.manga != null ? String(body.manga) : null,
          observacoes: body.observacoes || null,
        },
      })
      .returning();

    res.status(201).json({ success: true, medida: inserted[0] });
  } catch (err: any) {
    console.error('[Neon] Erro ao salvar medidas:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

// ==============================================================================
// 5. SOLICITAÇÕES DE PAGAMENTO (Admin & Ateliê)
// ==============================================================================

/**
 * Listar solicitações de pagamento
 */
router.get('/neon/solicitacoes', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.select().from(solicitacoesPagamento).orderBy(desc(solicitacoesPagamento.solicitado_em));
    
    const mapped = result.map(s => ({
      id: s.id,
      atelieId: s.atelie_id,
      atelieNome: s.atelie_nome,
      emailOwner: s.email_owner,
      telefoneOwner: s.telefone_owner || '',
      plano: s.plano as 'basico' | 'pro',
      metodoPagamento: s.metodo_pagamento as 'multicaixa' | 'express' | 'transferencia' | 'pix',
      comprovativoUrl: s.comprovativo_url || '',
      status: s.status as 'pendente' | 'aprovado' | 'rejeitado',
      observacoesAdmin: s.observacoes_admin || undefined,
      solicitadoEm: s.solicitado_em.toISOString(),
      resolvidoEm: s.resolvido_em ? s.resolvido_em.toISOString() : null,
    }));

    res.json({ solicitacoes: mapped, count: mapped.length });
  } catch (err: any) {
    console.error('[Neon] Erro ao listar solicitacoes:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Inserir / Upsert Solicitação de Pagamento
 */
router.post('/neon/solicitacoes', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id = body.id;
    const atelie_id = body.atelieId || body.atelie_id;
    const atelie_nome = body.atelieNome || body.atelie_nome || 'Ateliê';
    const email_owner = body.emailOwner || body.email_owner;
    const telefone_owner = body.telefoneOwner || body.telefone_owner || null;
    const plano = body.plano || 'basico';
    const metodo_pagamento = body.metodoPagamento || body.metodo_pagamento || 'multicaixa';
    const comprovativo_url = body.comprovativoUrl || body.comprovativo_url || null;
    const status = body.status || 'pendente';
    const observacoes_admin = body.observacoesAdmin || body.observacoes_admin || null;
    const solicitado_em = body.solicitadoEm ? new Date(body.solicitadoEm) : new Date();
    const resolvido_em = body.resolvidoEm ? new Date(body.resolvidoEm) : null;

    if (!id || !atelie_id || !email_owner) {
      return res.status(400).json({ error: 'Campos id, atelieId e emailOwner são obrigatórios.' });
    }

    const db = getDb();
    const inserted = await db
      .insert(solicitacoesPagamento)
      .values({
        id,
        atelie_id,
        atelie_nome,
        email_owner,
        telefone_owner,
        plano,
        metodo_pagamento,
        comprovativo_url,
        status,
        observacoes_admin,
        solicitado_em,
        resolvido_em,
      })
      .onConflictDoUpdate({
        target: solicitacoesPagamento.id,
        set: {
          atelie_nome,
          email_owner,
          telefone_owner,
          plano,
          metodo_pagamento,
          comprovativo_url,
          status,
          observacoes_admin,
          resolvido_em,
        },
      })
      .returning();

    res.status(201).json({ success: true, solicitacao: inserted[0] });
  } catch (err: any) {
    console.error('[Neon] Erro ao gravar solicitacao:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

// ==============================================================================
// 6. CONFIGURAÇÕES GLOBAIS DE PAGAMENTO
// ==============================================================================

/**
 * Obter configurações de pagamento
 */
router.get('/neon/configuracoes', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.select().from(configuracoes).where(eq(configuracoes.id, 'geral')).limit(1);
    
    if (result.length === 0) {
      return res.json({
        configs: {
          numeroExpress: '923456789',
          iban: 'AO06.0040.0000.1234.5678.9011.2',
          banco: 'BAI (Banco Angolano de Investimentos)',
          titular: 'FlowTailor Consultoria Lda.',
          whatsappAdmin: '244923456789',
        }
      });
    }

    const c = result[0];
    res.json({
      configs: {
        numeroExpress: c.numero_express || '',
        iban: c.iban || '',
        banco: c.banco || '',
        titular: c.titular || '',
        whatsappAdmin: c.whatsapp_admin || '',
      }
    });
  } catch (err: any) {
    console.error('[Neon] Erro ao buscar configs:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Gravar configurações de pagamento
 */
router.post('/neon/configuracoes', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const db = getDb();

    const inserted = await db
      .insert(configuracoes)
      .values({
        id: 'geral',
        numero_express: body.numeroExpress || body.numero_express || null,
        iban: body.iban || null,
        banco: body.banco || null,
        titular: body.titular || null,
        whatsapp_admin: body.whatsappAdmin || body.whatsapp_admin || null,
        atualizado_em: new Date(),
      })
      .onConflictDoUpdate({
        target: configuracoes.id,
        set: {
          numero_express: body.numeroExpress || body.numero_express || null,
          iban: body.iban || null,
          banco: body.banco || null,
          titular: body.titular || null,
          whatsapp_admin: body.whatsappAdmin || body.whatsapp_admin || null,
          atualizado_em: new Date(),
        },
      })
      .returning();

    res.json({ success: true, configs: inserted[0] });
  } catch (err: any) {
    console.error('[Neon] Erro ao salvar configs:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

// ==============================================================================
// 7. ADMINS (Gestão de Administradores)
// ==============================================================================

/**
 * Listar administradores
 */
router.get('/neon/admins', checkDbAvailable, async (req: Request, res: Response) => {
  const initialAdmins = ['admin@flowtailor.ao'];
  try {
    await ensureAdminColumnsExist();
    const db = getDb();
    let result: any[] = [];
    try {
      result = await db.select().from(admins);
    } catch (queryErr) {
      // Se a coluna ainda não tiver sido criada pelo DDL, tentar auto-migrar imediatamente
      const sql = getSql();
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_hash TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_definida_em TIMESTAMPTZ`;
      result = await db.select().from(admins);
    }

    const emailList = result.map(a => a.email.toLowerCase());
    const merged = Array.from(new Set([...initialAdmins, ...emailList]));

    const details = merged.map(email => {
      const record = result.find(r => r.email.toLowerCase() === email.toLowerCase());
      return {
        email,
        hasPassword: Boolean(record?.senha_hash),
        senhaDefinidaEm: record?.senha_definida_em || null,
        criadoEm: record?.criado_em || null,
      };
    });

    res.json({ admins: merged, details, count: merged.length });
  } catch (err: any) {
    console.error('[Neon] Erro ao listar admins:', err);
    // Retornar fallback seguro com os admins padrão para evitar bloquear o frontend
    res.json({ 
      admins: initialAdmins, 
      details: initialAdmins.map(email => ({ email, hasPassword: false, senhaDefinidaEm: null, criadoEm: null })),
      count: initialAdmins.length 
    });
  }
});

/**
 * Consultar status de credenciais de um Administrador específico
 */
router.get('/neon/admins/status/:email', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    await ensureAdminColumnsExist();
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const initialAdmins = ['admin@flowtailor.ao'];
    const db = getDb();
    
    let result: any[] = [];
    try {
      result = await db.select().from(admins).where(eq(admins.email, email));
    } catch (e) {
      const sql = getSql();
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_hash TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_definida_em TIMESTAMPTZ`;
      result = await db.select().from(admins).where(eq(admins.email, email));
    }
    
    const isAdmin = initialAdmins.includes(email) || result.length > 0;

    if (!isAdmin) {
      return res.json({ isAdmin: false, exists: false, hasPassword: false });
    }

    const record = result[0];
    res.json({
      isAdmin: true,
      exists: true,
      email,
      hasPassword: Boolean(record?.senha_hash),
      senhaDefinidaEm: record?.senha_definida_em || null,
    });
  } catch (err: any) {
    console.error('[Neon] Erro ao consultar status admin:', err);
    const email = decodeURIComponent(req.params.email || '').toLowerCase().trim();
    const initialAdmins = ['admin@flowtailor.ao'];
    res.json({
      isAdmin: initialAdmins.includes(email),
      exists: initialAdmins.includes(email),
      email,
      hasPassword: false,
      senhaDefinidaEm: null
    });
  }
});

/**
 * Definir ou Redefinir Palavra-passe do Administrador (1º Dia / Primeiro Acesso ou Alteração)
 */
router.post('/neon/admins/password', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    await ensureAdminColumnsExist();
    const email = (req.body.email || '').toLowerCase().trim();
    const { password, passwordHash } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email do administrador é obrigatório.' });
    }

    let finalHash = passwordHash;
    if (!finalHash && password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
      }
      finalHash = await hashPassword(password);
    }

    if (!finalHash) {
      return res.status(400).json({ error: 'Palavra-passe ou Hash é obrigatório.' });
    }

    const db = getDb();
    const now = new Date();

    try {
      // Inserir ou atualizar senha do admin
      await db
        .insert(admins)
        .values({
          email,
          senha_hash: finalHash,
          senha_definida_em: now,
        })
        .onConflictDoUpdate({
          target: admins.email,
          set: {
            senha_hash: finalHash,
            senha_definida_em: now,
          },
        });
    } catch (dbErr) {
      const sql = getSql();
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_hash TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_definida_em TIMESTAMPTZ`;
      await db
        .insert(admins)
        .values({
          email,
          senha_hash: finalHash,
          senha_definida_em: now,
        })
        .onConflictDoUpdate({
          target: admins.email,
          set: {
            senha_hash: finalHash,
            senha_definida_em: now,
          },
        });
    }

    res.json({ 
      success: true, 
      message: 'Palavra-passe de administrador configurada com sucesso.',
      email,
      senhaDefinidaEm: now.toISOString()
    });
  } catch (err: any) {
    console.error('[Neon] Erro ao gravar senha admin:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Verificar Palavra-passe do Administrador
 */
router.post('/neon/admins/verify-password', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    await ensureAdminColumnsExist();
    const email = (req.body.email || '').toLowerCase().trim();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e palavra-passe são obrigatórios.' });
    }

    const db = getDb();
    let result: any[] = [];
    try {
      result = await db.select().from(admins).where(eq(admins.email, email));
    } catch (e) {
      const sql = getSql();
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_hash TEXT`;
      await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS senha_definida_em TIMESTAMPTZ`;
      result = await db.select().from(admins).where(eq(admins.email, email));
    }

    const initialAdmins = ['admin@flowtailor.ao'];
    const isAdmin = initialAdmins.includes(email) || result.length > 0;

    if (!isAdmin) {
      return res.json({ isAdmin: false, match: false, isFirstAccess: false });
    }

    const record = result[0];
    if (!record || !record.senha_hash) {
      // Primeiro dia de acesso do admin: ainda sem senha cadastrada
      return res.json({ isAdmin: true, match: false, isFirstAccess: true });
    }

    const match = await comparePassword(password, record.senha_hash);
    res.json({ isAdmin: true, match, isFirstAccess: false });
  } catch (err: any) {
    console.error('[Neon] Erro ao verificar senha admin:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Adicionar Administrador
 */
router.post('/neon/admins', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const initialPassword = req.body.initialPassword;

    if (!email) {
      return res.status(400).json({ error: 'Email do administrador é obrigatório.' });
    }

    const db = getDb();
    let senha_hash = null;
    let senha_definida_em = null;

    if (initialPassword && initialPassword.length >= 6) {
      senha_hash = await hashPassword(initialPassword);
      senha_definida_em = new Date();
    }

    await db.insert(admins).values({ 
      email,
      senha_hash,
      senha_definida_em
    }).onConflictDoNothing();

    res.status(201).json({ success: true, email, hasInitialPassword: Boolean(senha_hash) });
  } catch (err: any) {
    console.error('[Neon] Erro ao adicionar admin:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

/**
 * Remover Administrador
 */
router.delete('/neon/admins/:email', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const db = getDb();
    await db.delete(admins).where(eq(admins.email, email));
    res.json({ success: true, message: 'Administrador removido com sucesso.' });
  } catch (err: any) {
    console.error('[Neon] Erro ao remover admin:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

// ==============================================================================
// 8. BATCH SYNC: Sincronização em massa de Ateliê + Clientes + Encomendas + Medidas
// ==============================================================================
router.post(['/neon/sync-atelie', '/sync-atelie'], checkDbAvailable, async (req: Request, res: Response) => {
  try {
    // 0. Ensure tables exist before running SQL queries
    await ensureTablesExist().catch((tableErr) => {
      console.warn('[Neon sync-atelie] AutoMigration notice:', tableErr);
    });

    const { 
      atelie, 
      clientes: clientesList = [], 
      encomendas: encomendasList = [], 
      pedidos: pedidosList = [], 
      medidas: medidasList = [] 
    } = req.body || {};

    if (!atelie || typeof atelie !== 'object' || !atelie.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Falha ao sincronizar dados do ateliê', 
        details: 'Dados do ateliê ou ID do ateliê são obrigatórios no payload.' 
      });
    }

    const db = getDb();
    const atelieId = String(atelie.id).trim();
    if (!atelieId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Falha ao sincronizar dados do ateliê', 
        details: 'ID do ateliê não pode ser vazio.' 
      });
    }

    const atelieNome = (atelie.nome && String(atelie.nome).trim()) || 'Ateliê';
    const atelieEmail = (atelie.emailOwner || atelie.email || `${atelieId}@flowtailor.local`).toLowerCase().trim();
    const atelieTelefone = atelie.telefone ? String(atelie.telefone).trim() : null;
    const ateliePlano = atelie.plano || 'basico';
    const atelieAtivo = atelie.ativo !== undefined ? Boolean(atelie.ativo) : true;
    const atelieVencimento = sanitizeDate(atelie.dataVencimento);

    const finalEncomendas = Array.isArray(encomendasList) && encomendasList.length > 0 
      ? encomendasList 
      : (Array.isArray(pedidosList) ? pedidosList : []);

    // 1. Upsert ateliê
    await db
      .insert(atelies)
      .values({
        id: atelieId,
        nome: atelieNome,
        email: atelieEmail,
        telefone: atelieTelefone,
        plano: ateliePlano,
        ativo: atelieAtivo,
        data_vencimento: atelieVencimento,
      })
      .onConflictDoUpdate({
        target: atelies.id,
        set: {
          nome: atelieNome,
          email: atelieEmail,
          telefone: atelieTelefone,
          plano: ateliePlano,
          ativo: atelieAtivo,
          data_vencimento: atelieVencimento,
        },
      });

    // 2. Upsert clientes (and track valid IDs for foreign key integrity)
    const validClientIds = new Set<string>();
    if (Array.isArray(clientesList)) {
      for (const c of clientesList) {
        if (!c || !c.id) continue;
        const cId = String(c.id).trim();
        if (!cId) continue;
        validClientIds.add(cId);

        const cNome = (c.nome && String(c.nome).trim()) || 'Cliente';
        const cTelefone = c.telefone ? String(c.telefone).trim() : null;
        const cEmail = c.email ? String(c.email).trim().toLowerCase() : null;
        const cObs = c.observacoes ? String(c.observacoes).trim() : null;
        const cMedidas = (typeof c.medidas === 'object' && c.medidas !== null) ? c.medidas : {};

        try {
          await db
            .insert(clientes)
            .values({
              id: cId,
              atelie_id: atelieId,
              nome: cNome,
              telefone: cTelefone,
              email: cEmail,
              observacoes: cObs,
              medidas: cMedidas,
            })
            .onConflictDoUpdate({
              target: clientes.id,
              set: {
                nome: cNome,
                telefone: cTelefone,
                email: cEmail,
                observacoes: cObs,
                medidas: cMedidas,
              },
            });
        } catch (clientErr) {
          console.warn(`[Neon sync-atelie] Aviso ao sincronizar cliente ${cId}:`, clientErr);
        }
      }
    }

    // 3. Upsert encomendas / pedidos
    if (Array.isArray(finalEncomendas)) {
      for (const e of finalEncomendas) {
        if (!e || !e.id) continue;
        const eId = String(e.id).trim();
        if (!eId) continue;

        const rawClientId = e.clienteId || e.cliente_id;
        const cId = rawClientId ? String(rawClientId).trim() : null;
        // Only reference cliente_id if it exists in validClientIds
        const safeClienteId = cId && validClientIds.has(cId) ? cId : null;

        const eDesc = (e.descricaoPeca || e.descricao || 'Encomenda').trim();
        const eTipo = (e.tipoPeca || e.tipo_peca || 'vestido').trim();
        const eTecido = e.tecido ? String(e.tecido).trim() : null;
        const eValor = sanitizeNumeric(e.valor ?? e.precoKz ?? e.valor_kz, '0');
        const eSinal = sanitizeNumeric(e.sinalPago ?? e.sinal_pago, '0');
        const eEstado = (e.status || e.estado || 'em_andamento').trim();
        const ePrazo = sanitizeDate(e.prazoEntrega || e.dataEntrega || e.prazo_entrega);
        const eFoto = e.fotoReferencia || e.foto_referencia || null;
        const eObs = e.observacoes ? String(e.observacoes).trim() : null;
        const eClienteNome = e.clienteNome || e.cliente_nome || null;
        const eClienteTelefone = e.clienteTelefone || e.cliente_telefone || null;

        try {
          await db
            .insert(encomendas)
            .values({
              id: eId,
              atelie_id: atelieId,
              cliente_id: safeClienteId,
              cliente_nome: eClienteNome,
              cliente_telefone: eClienteTelefone,
              descricao: eDesc,
              tipo_peca: eTipo,
              tecido: eTecido,
              valor_kz: eValor,
              sinal_pago: eSinal,
              estado: eEstado,
              prazo_entrega: ePrazo,
              foto_referencia: eFoto,
              observacoes: eObs,
            })
            .onConflictDoUpdate({
              target: encomendas.id,
              set: {
                cliente_id: safeClienteId,
                cliente_nome: eClienteNome,
                cliente_telefone: eClienteTelefone,
                descricao: eDesc,
                tipo_peca: eTipo,
                tecido: eTecido,
                valor_kz: eValor,
                sinal_pago: eSinal,
                estado: eEstado,
                prazo_entrega: ePrazo,
                foto_referencia: eFoto,
                observacoes: eObs,
              },
            });
        } catch (encErr) {
          console.warn(`[Neon sync-atelie] Aviso ao sincronizar encomenda ${eId}:`, encErr);
        }
      }
    }

    // 4. Upsert medidas
    if (Array.isArray(medidasList)) {
      for (const m of medidasList) {
        if (!m || !m.id || !m.clienteId) continue;
        const mId = String(m.id).trim();
        const mClienteId = String(m.clienteId).trim();
        if (!mId || !mClienteId) continue;

        // Ensure the referenced client exists to prevent foreign key violation
        if (!validClientIds.has(mClienteId)) {
          try {
            await db
              .insert(clientes)
              .values({
                id: mClienteId,
                atelie_id: atelieId,
                nome: 'Cliente',
              })
              .onConflictDoNothing();
            validClientIds.add(mClienteId);
          } catch (createClientErr) {
            console.warn(`[Neon sync-atelie] Falha ao criar cliente referenciado por medida:`, createClientErr);
          }
        }

        const mBusto = sanitizeNullableNumeric(m.busto);
        const mCintura = sanitizeNullableNumeric(m.cintura);
        const mQuadril = sanitizeNullableNumeric(m.quadril);
        const mOmbro = sanitizeNullableNumeric(m.ombro);
        const mComprimentoTronco = sanitizeNullableNumeric(m.comprimentoTronco ?? m.comprimento_tronco);
        const mComprimentoSaia = sanitizeNullableNumeric(m.comprimentoSaia ?? m.comprimento_saia);
        const mComprimentoCalca = sanitizeNullableNumeric(m.comprimentoCalca ?? m.comprimento_calca);
        const mManga = sanitizeNullableNumeric(m.manga);
        const mObs = m.observacoes ? String(m.observacoes).trim() : null;
        const mReg = sanitizeDate(m.registradoEm || m.registrado_em) || new Date();

        try {
          await db
            .insert(medidas)
            .values({
              id: mId,
              atelie_id: atelieId,
              cliente_id: mClienteId,
              busto: mBusto,
              cintura: mCintura,
              quadril: mQuadril,
              ombro: mOmbro,
              comprimento_tronco: mComprimentoTronco,
              comprimento_saia: mComprimentoSaia,
              comprimento_calca: mComprimentoCalca,
              manga: mManga,
              observacoes: mObs,
              registrado_em: mReg,
            })
            .onConflictDoUpdate({
              target: medidas.id,
              set: {
                busto: mBusto,
                cintura: mCintura,
                quadril: mQuadril,
                ombro: mOmbro,
                comprimento_tronco: mComprimentoTronco,
                comprimento_saia: mComprimentoSaia,
                comprimento_calca: mComprimentoCalca,
                manga: mManga,
                observacoes: mObs,
              },
            });
        } catch (medErr) {
          console.warn(`[Neon sync-atelie] Aviso ao sincronizar medida ${mId}:`, medErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Dados do ateliê sincronizados com sucesso.',
      synced: {
        atelieId,
        clientesCount: Array.isArray(clientesList) ? clientesList.length : 0,
        encomendasCount: finalEncomendas.length,
        medidasCount: Array.isArray(medidasList) ? medidasList.length : 0,
      },
    });
  } catch (err: any) {
    console.error('Sync error:', err);
    return res.status(500).json({
      success: false,
      message: "Falha ao sincronizar dados do ateliê",
      details: err?.message || String(err),
    });
  }
});

// ==============================================================================
// 9. BATCH SYNC ADMIN: Sincronização em massa de dados de Administração
// ==============================================================================
router.post(['/neon/sync-admin', '/sync-admin'], async (req: Request, res: Response) => {
  try {
    // 1. Validação de autenticação: verifica se o utilizador está autenticado como admin
    const token = extractToken(req);
    let isAuthenticated = false;
    let authUserEmail = '';

    if (token) {
      const v = verifyJwtToken(token);
      if (v.valid && v.payload) {
        isAuthenticated = true;
        authUserEmail = v.payload.email || '';
      }
    }

    const candidateEmail = (
      req.body?.adminEmail ||
      req.headers['x-admin-email'] ||
      (Array.isArray(req.body?.admins) && req.body.admins[0]) ||
      authUserEmail
    );

    if (!isAuthenticated && candidateEmail && typeof candidateEmail === 'string') {
      const mailLower = candidateEmail.toLowerCase().trim();
      if (INITIAL_AUTHORIZED_ADMINS.includes(mailLower) || (getDatabaseUrl() && await isAuthorizedAdminEmail(mailLower).catch(() => false))) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return res.status(200).json({
        success: false,
        message: 'Modo offline/local ativo. Dados mantidos no IndexedDB.',
        offline: true,
        error: 'Sessão administrativa local ativa.',
      });
    }

    // 2. Validação da presença da variável de ambiente DATABASE_URL antes de executar consultas SQL
    const dbUrl = process.env.DATABASE_URL || getDatabaseUrl();
    if (!dbUrl) {
      console.warn('[Neon sync-admin] process.env.DATABASE_URL não configurada. Ativando fallback offline.');
      return res.status(200).json({
        success: false,
        message: 'Modo offline/local ativo. Dados mantidos no IndexedDB.',
        offline: true,
      });
    }

    await ensureTablesExist().catch((tableErr) => {
      console.warn('[Neon sync-admin] AutoMigration notice:', tableErr);
    });

    const { atelies: ateliesList = [], solicitacoes: solList = [], configs, admins: adminList = [] } = req.body || {};
    const db = getDb();
    let count = 0;

    // 1. Sync Atelies (com tratamento robusto de valores nulos e chaves)
    if (Array.isArray(ateliesList)) {
      for (const a of ateliesList) {
        if (!a) continue;
        const aId = String(a.id || '').trim();
        if (!aId) continue;
        const aNome = String(a.nome || 'Ateliê').trim() || 'Ateliê';
        const aEmail = String(a.emailOwner || a.email || `${aId}@flowtailor.local`).toLowerCase().trim() || `${aId}@flowtailor.local`;
        const aTelefone = a.telefone != null ? String(a.telefone).trim() : '';
        const aPlano = String(a.plano || 'basico').trim() || 'basico';
        const aAtivo = a.ativo !== undefined ? Boolean(a.ativo) : true;
        const aVencimento = sanitizeDate(a.dataVencimento) || null;

        try {
          await db
            .insert(atelies)
            .values({
              id: aId,
              nome: aNome,
              email: aEmail,
              telefone: aTelefone,
              plano: aPlano,
              ativo: aAtivo,
              data_vencimento: aVencimento,
            })
            .onConflictDoUpdate({
              target: atelies.id,
              set: {
                nome: aNome,
                email: aEmail,
                telefone: aTelefone,
                plano: aPlano,
                ativo: aAtivo,
                data_vencimento: aVencimento,
              },
            });
          count++;
        } catch (errA) {
          console.warn(`[Neon sync-admin] Erro ao sincronizar ateliê ${aId}:`, errA);
        }
      }
    }

    // 2. Sync Solicitacoes (com tratamento de campos vazios/nulos)
    if (Array.isArray(solList)) {
      for (const s of solList) {
        if (!s) continue;
        const sId = String(s.id || '').trim();
        const sAtelieId = String(s.atelieId || '').trim();
        if (!sId || !sAtelieId) continue;

        const sAtelieNome = String(s.atelieNome || 'Ateliê').trim() || 'Ateliê';
        const sEmail = String(s.emailOwner || `${sAtelieId}@flowtailor.local`).toLowerCase().trim() || `${sAtelieId}@flowtailor.local`;
        const sTelefone = s.telefoneOwner != null ? String(s.telefoneOwner).trim() : '';
        const sPlano = String(s.plano || 'basico').trim() || 'basico';
        const sMetodo = String(s.metodoPagamento || 'multicaixa').trim() || 'multicaixa';
        const sComprovativo = s.comprovativoUrl != null ? String(s.comprovativoUrl).trim() : '';
        const sStatus = String(s.status || 'pendente').trim() || 'pendente';
        const sObs = s.observacoesAdmin != null ? String(s.observacoesAdmin).trim() : '';
        const sSolEm = sanitizeDate(s.solicitadoEm) || new Date();
        const sResEm = sanitizeDate(s.resolvidoEm) || null;

        try {
          await db
            .insert(solicitacoesPagamento)
            .values({
              id: sId,
              atelie_id: sAtelieId,
              atelie_nome: sAtelieNome,
              email_owner: sEmail,
              telefone_owner: sTelefone,
              plano: sPlano,
              metodo_pagamento: sMetodo,
              comprovativo_url: sComprovativo,
              status: sStatus,
              observacoes_admin: sObs,
              solicitado_em: sSolEm,
              resolvido_em: sResEm,
            })
            .onConflictDoUpdate({
              target: solicitacoesPagamento.id,
              set: {
                atelie_nome: sAtelieNome,
                email_owner: sEmail,
                telefone_owner: sTelefone,
                plano: sPlano,
                metodo_pagamento: sMetodo,
                comprovativo_url: sComprovativo,
                status: sStatus,
                observacoes_admin: sObs,
                resolvido_em: sResEm,
              },
            });
          count++;
        } catch (errS) {
          console.warn(`[Neon sync-admin] Erro ao sincronizar solicitação ${sId}:`, errS);
        }
      }
    }

    // 3. Sync Configs (tratamento estrito de nulos com fallback para strings vazias)
    if (configs && typeof configs === 'object') {
      try {
        const numExpress = (configs.numeroExpress != null ? String(configs.numeroExpress).trim() : '') || '';
        const ibanVal = (configs.iban != null ? String(configs.iban).trim() : '') || '';
        const bancoVal = (configs.banco != null ? String(configs.banco).trim() : '') || '';
        const titularVal = (configs.titular != null ? String(configs.titular).trim() : '') || '';
        const zapVal = (configs.whatsappAdmin != null ? String(configs.whatsappAdmin).trim() : '') || '';

        await db
          .insert(configuracoes)
          .values({
            id: 'geral',
            numero_express: numExpress,
            iban: ibanVal,
            banco: bancoVal,
            titular: titularVal,
            whatsapp_admin: zapVal,
          })
          .onConflictDoUpdate({
            target: configuracoes.id,
            set: {
              numero_express: numExpress,
              iban: ibanVal,
              banco: bancoVal,
              titular: titularVal,
              whatsapp_admin: zapVal,
              atualizado_em: new Date(),
            },
          });
        count++;
      } catch (errC) {
        console.warn('[Neon sync-admin] Erro ao sincronizar configurações:', errC);
      }
    }

    // 4. Sync Admins (tratamento estrito de nulos e validação de formato de e-mail)
    if (Array.isArray(adminList)) {
      for (const item of adminList) {
        let mailStr = '';
        let passHash = '';
        if (typeof item === 'string') {
          mailStr = item.toLowerCase().trim();
        } else if (item && typeof item === 'object') {
          mailStr = String(item.email || '').toLowerCase().trim();
          passHash = String(item.senha_hash || item.passwordHash || '').trim();
        }

        if (!mailStr || !mailStr.includes('@')) continue;

        try {
          await db
            .insert(admins)
            .values({
              email: mailStr,
              senha_hash: passHash || '',
            })
            .onConflictDoUpdate({
              target: admins.email,
              set: {
                senha_hash: passHash || '',
              },
            });
          count++;
        } catch (errAdm) {
          console.warn(`[Neon sync-admin] Erro ao sincronizar admin ${mailStr}:`, errAdm);
        }
      }
    }

    return res.status(200).json({
      success: true,
      syncedItemsCount: count,
      message: 'Dados administrativos gravados com sucesso no Neon PostgreSQL.',
    });
  } catch (err: any) {
    console.warn('[Neon sync-admin] Falha na conexão ou execução SQL, ativando fallback offline:', err);
    return res.status(200).json({
      success: false,
      message: 'Modo offline/local ativo. Dados mantidos no IndexedDB.',
      offline: true,
      error: err?.message || String(err),
    });
  }
});

export default router;
