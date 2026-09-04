import { pgTable, text, timestamp, boolean, numeric, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Tabela: atelies
 * Armazena os dados principais dos ateliês cadastrados.
 */
export const atelies = pgTable('atelies', {
  id: text('id').primaryKey(), // UUID ou UID do Ateliê
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  telefone: text('telefone'),
  plano: text('plano').default('basico').notNull(), // 'basico' | 'pro'
  ativo: boolean('ativo').default(true).notNull(),
  data_vencimento: timestamp('data_vencimento', { withTimezone: true }),
  senha_hash: text('senha_hash'),
  criado_em: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tabela: clientes
 * Clientes atendidos por um ateliê específico (isolamento por atelie_id).
 */
export const clientes = pgTable('clientes', {
  id: text('id').primaryKey(),
  atelie_id: text('atelie_id').notNull().references(() => atelies.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  telefone: text('telefone'),
  email: text('email'),
  observacoes: text('observacoes'),
  medidas: jsonb('medidas').$type<Record<string, any>>().default({}),
  criado_em: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tabela: encomendas
 * Encomendas e pedidos de confecção com relação ao cliente e ao ateliê.
 */
export const encomendas = pgTable('encomendas', {
  id: text('id').primaryKey(),
  atelie_id: text('atelie_id').notNull().references(() => atelies.id, { onDelete: 'cascade' }),
  cliente_id: text('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
  cliente_nome: text('cliente_nome'),
  cliente_telefone: text('cliente_telefone'),
  descricao: text('descricao').notNull(),
  tipo_peca: text('tipo_peca').default('vestido'),
  tecido: text('tecido'),
  valor_kz: numeric('valor_kz', { precision: 12, scale: 2 }).default('0'),
  sinal_pago: numeric('sinal_pago', { precision: 12, scale: 2 }).default('0'),
  estado: text('estado').default('pendente').notNull(), // 'pendente' | 'em_andamento' | 'aguardando_prova' | 'pronto' | 'entregue' | 'cancelado'
  prazo_entrega: timestamp('prazo_entrega', { withTimezone: true }),
  foto_referencia: text('foto_referencia'),
  observacoes: text('observacoes'),
  criado_em: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tabela: medidas
 * Histórico de medições corporais por cliente e ateliê.
 */
export const medidas = pgTable('medidas', {
  id: text('id').primaryKey(),
  atelie_id: text('atelie_id').notNull().references(() => atelies.id, { onDelete: 'cascade' }),
  cliente_id: text('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  busto: numeric('busto'),
  cintura: numeric('cintura'),
  quadril: numeric('quadril'),
  ombro: numeric('ombro'),
  comprimento_tronco: numeric('comprimento_tronco'),
  comprimento_saia: numeric('comprimento_saia'),
  comprimento_calca: numeric('comprimento_calca'),
  manga: numeric('manga'),
  observacoes: text('observacoes'),
  registrado_em: timestamp('registrado_em', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tabela: solicitacoes_pagamento
 * Comprovativos de pagamento submetidos pelos ateliês para validação administrativa.
 */
export const solicitacoesPagamento = pgTable('solicitacoes_pagamento', {
  id: text('id').primaryKey(),
  atelie_id: text('atelie_id').notNull().references(() => atelies.id, { onDelete: 'cascade' }),
  atelie_nome: text('atelie_nome').notNull(),
  email_owner: text('email_owner').notNull(),
  telefone_owner: text('telefone_owner'),
  plano: text('plano').default('basico').notNull(),
  metodo_pagamento: text('metodo_pagamento').default('multicaixa').notNull(),
  comprovativo_url: text('comprovativo_url'),
  status: text('status').default('pendente').notNull(), // 'pendente' | 'aprovado' | 'rejeitado'
  observacoes_admin: text('observacoes_admin'),
  solicitado_em: timestamp('solicitado_em', { withTimezone: true }).defaultNow().notNull(),
  resolvido_em: timestamp('resolvido_em', { withTimezone: true }),
});

/**
 * Tabela: configuracoes
 * Parâmetros bancários e de contacto globais da plataforma.
 */
export const configuracoes = pgTable('configuracoes', {
  id: text('id').primaryKey().default('geral'),
  numero_express: text('numero_express'),
  iban: text('iban'),
  banco: text('banco'),
  titular: text('titular'),
  whatsapp_admin: text('whatsapp_admin'),
  nome: text('nome'),
  telefone: text('telefone'),
  avatar: text('avatar'),
  avatar_icon: text('avatar_icon'),
  modo_armazenamento: text('modo_armazenamento'),
  storage_mode: text('storage_mode'),
  atualizado_em: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tabela: admins
 * Lista de administradores com permissões de gestão global.
 */
export const admins = pgTable('admins', {
  email: text('email').primaryKey(),
  nome: text('nome'),
  telefone: text('telefone'),
  avatar: text('avatar'),
  avatar_icon: text('avatar_icon'),
  modo_armazenamento: text('modo_armazenamento'),
  storage_mode: text('storage_mode'),
  senha_hash: text('senha_hash'),
  senha_definida_em: timestamp('senha_definida_em', { withTimezone: true }),
  criado_em: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tabela: usuarios
 * Utilizadores da plataforma autenticados com email e senha_hash.
 */
export const usuarios = pgTable('usuarios', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  nome: text('nome'),
  senha_hash: text('senha_hash').notNull(),
  role: text('role').default('atelie_owner').notNull(),
  atelie_id: text('atelie_id'),
  criado_em: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Tabela: users (alias para compatibilidade)
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  nome: text('nome'),
  senha_hash: text('senha_hash').notNull(),
  role: text('role').default('atelie_owner').notNull(),
  atelie_id: text('atelie_id'),
  criado_em: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
});

// Relacionamentos Drizzle ORM
export const ateliesRelations = relations(atelies, ({ many }) => ({
  clientes: many(clientes),
  encomendas: many(encomendas),
  medidas: many(medidas),
  solicitacoes: many(solicitacoesPagamento),
}));

export const clientesRelations = relations(clientes, ({ one, many }) => ({
  atelie: one(atelies, {
    fields: [clientes.atelie_id],
    references: [atelies.id],
  }),
  encomendas: many(encomendas),
  medidas: many(medidas),
}));

export const encomendasRelations = relations(encomendas, ({ one }) => ({
  atelie: one(atelies, {
    fields: [encomendas.atelie_id],
    references: [atelies.id],
  }),
  cliente: one(clientes, {
    fields: [encomendas.cliente_id],
    references: [clientes.id],
  }),
}));

export const medidasRelations = relations(medidas, ({ one }) => ({
  atelie: one(atelies, {
    fields: [medidas.atelie_id],
    references: [atelies.id],
  }),
  cliente: one(clientes, {
    fields: [medidas.cliente_id],
    references: [clientes.id],
  }),
}));

export const solicitacoesRelations = relations(solicitacoesPagamento, ({ one }) => ({
  atelie: one(atelies, {
    fields: [solicitacoesPagamento.atelie_id],
    references: [atelies.id],
  }),
}));
