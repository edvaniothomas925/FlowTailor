import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, getSql, getDatabaseUrl, ensureTablesExist } from '../db/index.js';
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

// Middleware helper to ensure Database connection is available
function checkDbAvailable(req: Request, res: Response, next: () => void) {
  const url = getDatabaseUrl();
  if (!url) {
    return res.status(503).json({
      error: 'Base de dados Neon PostgreSQL não configurada. Defina DATABASE_URL no seu ambiente.',
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
      message: 'Tabelas relacionais (atelies, clientes, encomendas, medidas, solicitacoes_pagamento, configuracoes, admins) criadas/validadas com sucesso no Neon PostgreSQL com o admin inicial edvaniothomas925@gmail.com configurado.' 
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
  const initialAdmins = ['edvaniothomas925@gmail.com', 'admin@ateliepro.com', 'admin@flowtailor.ao'];
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
    const initialAdmins = ['edvaniothomas925@gmail.com', 'admin@ateliepro.com', 'admin@flowtailor.ao'];
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
    const initialAdmins = ['edvaniothomas925@gmail.com', 'admin@ateliepro.com', 'admin@flowtailor.ao'];
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

    const initialAdmins = ['edvaniothomas925@gmail.com', 'admin@ateliepro.com', 'admin@flowtailor.ao'];
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
router.post('/neon/sync-atelie', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const { atelie, clientes: clientesList = [], encomendas: encomendasList = [], pedidos: pedidosList = [], medidas: medidasList = [] } = req.body;
    if (!atelie || !atelie.id) {
      return res.status(400).json({ error: 'Dados do ateliê são obrigatórios.' });
    }

    const db = getDb();
    const atelieId = atelie.id;
    const finalEncomendas = encomendasList.length > 0 ? encomendasList : pedidosList;

    // 1. Upsert ateliê
    await db
      .insert(atelies)
      .values({
        id: atelieId,
        nome: atelie.nome || 'Ateliê sem nome',
        email: atelie.emailOwner || atelie.email || `${atelieId}@ateliepro.local`,
        telefone: atelie.telefone || null,
        plano: atelie.plano || 'basico',
        ativo: atelie.ativo !== undefined ? Boolean(atelie.ativo) : true,
        data_vencimento: atelie.dataVencimento ? new Date(atelie.dataVencimento) : null,
      })
      .onConflictDoUpdate({
        target: atelies.id,
        set: {
          nome: atelie.nome || 'Ateliê sem nome',
          email: atelie.emailOwner || atelie.email || `${atelieId}@ateliepro.local`,
          telefone: atelie.telefone || null,
          plano: atelie.plano || 'basico',
          ativo: atelie.ativo !== undefined ? Boolean(atelie.ativo) : true,
          data_vencimento: atelie.dataVencimento ? new Date(atelie.dataVencimento) : null,
        },
      });

    // 2. Upsert clientes
    for (const c of clientesList) {
      if (c.id && c.nome) {
        await db
          .insert(clientes)
          .values({
            id: c.id,
            atelie_id: atelieId,
            nome: c.nome,
            telefone: c.telefone || null,
            email: c.email || null,
            observacoes: c.observacoes || null,
            medidas: c.medidas || {},
          })
          .onConflictDoUpdate({
            target: clientes.id,
            set: {
              nome: c.nome,
              telefone: c.telefone || null,
              email: c.email || null,
              observacoes: c.observacoes || null,
              medidas: c.medidas || {},
            },
          });
      }
    }

    // 3. Upsert encomendas
    for (const e of finalEncomendas) {
      if (e.id && (e.descricaoPeca || e.descricao)) {
        await db
          .insert(encomendas)
          .values({
            id: e.id,
            atelie_id: atelieId,
            cliente_id: e.clienteId || e.cliente_id || null,
            cliente_nome: e.clienteNome || e.cliente_nome || null,
            cliente_telefone: e.clienteTelefone || e.cliente_telefone || null,
            descricao: e.descricaoPeca || e.descricao || 'Encomenda',
            tipo_peca: e.tipoPeca || e.tipo_peca || 'vestido',
            tecido: e.tecido || null,
            valor_kz: e.valor != null ? String(e.valor) : (e.precoKz != null ? String(e.precoKz) : (e.valor_kz != null ? String(e.valor_kz) : '0')),
            sinal_pago: e.sinalPago != null ? String(e.sinalPago) : (e.sinal_pago != null ? String(e.sinal_pago) : '0'),
            estado: e.status || e.estado || 'em_andamento',
            prazo_entrega: e.prazoEntrega || e.dataEntrega || e.prazo_entrega ? new Date(e.prazoEntrega || e.dataEntrega || e.prazo_entrega) : null,
            foto_referencia: e.fotoReferencia || e.foto_referencia || null,
            observacoes: e.observacoes || null,
          })
          .onConflictDoUpdate({
            target: encomendas.id,
            set: {
              cliente_id: e.clienteId || e.cliente_id || null,
              cliente_nome: e.clienteNome || e.cliente_nome || null,
              cliente_telefone: e.clienteTelefone || e.cliente_telefone || null,
              descricao: e.descricaoPeca || e.descricao || 'Encomenda',
              tipo_peca: e.tipoPeca || e.tipo_peca || 'vestido',
              tecido: e.tecido || null,
              valor_kz: e.valor != null ? String(e.valor) : (e.precoKz != null ? String(e.precoKz) : (e.valor_kz != null ? String(e.valor_kz) : '0')),
              sinal_pago: e.sinalPago != null ? String(e.sinalPago) : (e.sinal_pago != null ? String(e.sinal_pago) : '0'),
              estado: e.status || e.estado || 'em_andamento',
              prazo_entrega: e.prazoEntrega || e.dataEntrega || e.prazo_entrega ? new Date(e.prazoEntrega || e.dataEntrega || e.prazo_entrega) : null,
              foto_referencia: e.fotoReferencia || e.foto_referencia || null,
              observacoes: e.observacoes || null,
            },
          });
      }
    }

    // 4. Upsert medidas
    for (const m of medidasList) {
      if (m.id && m.clienteId) {
        await db
          .insert(medidas)
          .values({
            id: m.id,
            atelie_id: atelieId,
            cliente_id: m.clienteId,
            busto: m.busto != null ? String(m.busto) : null,
            cintura: m.cintura != null ? String(m.cintura) : null,
            quadril: m.quadril != null ? String(m.quadril) : null,
            ombro: m.ombro != null ? String(m.ombro) : null,
            comprimento_tronco: m.comprimentoTronco != null ? String(m.comprimentoTronco) : null,
            comprimento_saia: m.comprimentoSaia != null ? String(m.comprimentoSaia) : null,
            comprimento_calca: m.comprimentoCalca != null ? String(m.comprimentoCalca) : null,
            manga: m.manga != null ? String(m.manga) : null,
            observacoes: m.observacoes || null,
            registrado_em: m.registradoEm ? new Date(m.registradoEm) : new Date(),
          })
          .onConflictDoUpdate({
            target: medidas.id,
            set: {
              busto: m.busto != null ? String(m.busto) : null,
              cintura: m.cintura != null ? String(m.cintura) : null,
              quadril: m.quadril != null ? String(m.quadril) : null,
              ombro: m.ombro != null ? String(m.ombro) : null,
              comprimento_tronco: m.comprimentoTronco != null ? String(m.comprimentoTronco) : null,
              comprimento_saia: m.comprimentoSaia != null ? String(m.comprimentoSaia) : null,
              comprimento_calca: m.comprimentoCalca != null ? String(m.comprimentoCalca) : null,
              manga: m.manga != null ? String(m.manga) : null,
              observacoes: m.observacoes || null,
            },
          });
      }
    }

    res.json({
      success: true,
      synced: {
        atelieId,
        clientesCount: clientesList.length,
        encomendasCount: finalEncomendas.length,
        medidasCount: medidasList.length,
      },
    });
  } catch (err: any) {
    console.error('[Neon] Erro no batch sync:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

// ==============================================================================
// 9. BATCH SYNC ADMIN: Sincronização em massa de dados de Administração
// ==============================================================================
router.post('/neon/sync-admin', checkDbAvailable, async (req: Request, res: Response) => {
  try {
    const { atelies: ateliesList = [], solicitacoes: solList = [], configs, admins: adminList = [] } = req.body;
    const db = getDb();
    let count = 0;

    // 1. Sync Atelies
    for (const a of ateliesList) {
      if (a.id && a.nome) {
        await db
          .insert(atelies)
          .values({
            id: a.id,
            nome: a.nome,
            email: a.emailOwner || a.email || `${a.id}@ateliepro.local`,
            telefone: a.telefone || null,
            plano: a.plano || 'basico',
            ativo: a.ativo !== undefined ? Boolean(a.ativo) : true,
            data_vencimento: a.dataVencimento ? new Date(a.dataVencimento) : null,
          })
          .onConflictDoUpdate({
            target: atelies.id,
            set: {
              nome: a.nome,
              email: a.emailOwner || a.email || `${a.id}@ateliepro.local`,
              telefone: a.telefone || null,
              plano: a.plano || 'basico',
              ativo: a.ativo !== undefined ? Boolean(a.ativo) : true,
              data_vencimento: a.dataVencimento ? new Date(a.dataVencimento) : null,
            },
          });
        count++;
      }
    }

    // 2. Sync Solicitacoes
    for (const s of solList) {
      if (s.id && s.atelieId) {
        await db
          .insert(solicitacoesPagamento)
          .values({
            id: s.id,
            atelie_id: s.atelieId,
            atelie_nome: s.atelieNome || 'Ateliê',
            email_owner: s.emailOwner || `${s.atelieId}@ateliepro.local`,
            telefone_owner: s.telefoneOwner || null,
            plano: s.plano || 'basico',
            metodo_pagamento: s.metodoPagamento || 'multicaixa',
            comprovativo_url: s.comprovativoUrl || null,
            status: s.status || 'pendente',
            observacoes_admin: s.observacoesAdmin || null,
            solicitado_em: s.solicitadoEm ? new Date(s.solicitadoEm) : new Date(),
            resolvido_em: s.resolvidoEm ? new Date(s.resolvidoEm) : null,
          })
          .onConflictDoUpdate({
            target: solicitacoesPagamento.id,
            set: {
              atelie_nome: s.atelieNome || 'Ateliê',
              email_owner: s.emailOwner || `${s.atelieId}@ateliepro.local`,
              telefone_owner: s.telefoneOwner || null,
              plano: s.plano || 'basico',
              metodo_pagamento: s.metodoPagamento || 'multicaixa',
              comprovativo_url: s.comprovativoUrl || null,
              status: s.status || 'pendente',
              observacoes_admin: s.observacoesAdmin || null,
              resolvido_em: s.resolvidoEm ? new Date(s.resolvidoEm) : null,
            },
          });
        count++;
      }
    }

    // 3. Sync Configs
    if (configs) {
      await db
        .insert(configuracoes)
        .values({
          id: 'geral',
          numero_express: configs.numeroExpress || null,
          iban: configs.iban || null,
          banco: configs.banco || null,
          titular: configs.titular || null,
          whatsapp_admin: configs.whatsappAdmin || null,
        })
        .onConflictDoUpdate({
          target: configuracoes.id,
          set: {
            numero_express: configs.numeroExpress || null,
            iban: configs.iban || null,
            banco: configs.banco || null,
            titular: configs.titular || null,
            whatsapp_admin: configs.whatsappAdmin || null,
          },
        });
      count++;
    }

    // 4. Sync Admins
    for (const mail of adminList) {
      if (mail && typeof mail === 'string') {
        await db.insert(admins).values({ email: mail.toLowerCase().trim() }).onConflictDoNothing();
        count++;
      }
    }

    res.json({
      success: true,
      syncedItemsCount: count,
      message: 'Dados administrativos gravados com sucesso no Neon PostgreSQL.',
    });
  } catch (err: any) {
    console.error('[Neon] Erro no sync-admin:', err);
    res.status(500).json({ error: "Erro interno ao processar operação no banco de dados." });
  }
});

export default router;
