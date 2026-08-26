import { z } from 'zod';

// ==============================================================================
// 1. REUSABLE CUSTOM PATTERNS & REGEX
// ==============================================================================

/**
 * Regex for international telephone formats (supports Angola +244, Portugal +351, Brazil +55, etc.)
 */
export const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;

/**
 * Regex for standard NIF/Tax ID (allows alphanumeric with 6 to 20 chars)
 */
export const nifRegex = /^[A-Za-z0-9-]{6,20}$/;

// ==============================================================================
// 2. AUTHENTICATION & JWT SCHEMAS (ZOD)
// ==============================================================================

export const authLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Formato de e-mail inválido.')
    .min(1, 'O e-mail é obrigatório.'),
  password: z
    .string()
    .min(4, 'A senha deve conter pelo menos 4 caracteres.')
    .max(128, 'A senha não pode exceder 128 caracteres.')
    .optional(),
  pin: z
    .string()
    .min(4, 'O PIN de segurança deve ter pelo menos 4 dígitos.')
    .max(32, 'O PIN de segurança não pode exceder 32 dígitos.')
    .optional(),
  role: z
    .enum(['admin', 'atelie_owner', 'staff', 'user'])
    .default('atelie_owner'),
  atelieId: z.string().trim().max(100).optional().nullable(),
  atelieName: z.string().trim().max(120).optional().nullable(),
  authProvider: z.enum(['google', 'email', 'anonymous']).default('email'),
});

export type AuthLoginInput = z.infer<typeof authLoginSchema>;

export const authTokenIssueSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(2, 'O identificador de usuário (userId) deve ter no mínimo 2 caracteres.')
    .max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Forneça um endereço de e-mail válido.')
    .optional(),
  role: z
    .enum(['admin', 'atelie_owner', 'staff', 'user'])
    .default('atelie_owner'),
  atelieId: z.string().trim().max(100).optional().nullable(),
  atelieName: z.string().trim().max(120).optional().nullable(),
  authProvider: z.enum(['google', 'email', 'anonymous']).default('email'),
});

export type AuthTokenIssueInput = z.infer<typeof authTokenIssueSchema>;

export const tokenVerifySchema = z.object({
  token: z
    .string()
    .trim()
    .min(10, 'Token JWT malformado ou muito curto.'),
});

export type TokenVerifyInput = z.infer<typeof tokenVerifySchema>;

export const refreshTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(10, 'O refresh token é obrigatório.')
    .optional(), // Can come from HttpOnly cookie
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const pinHashSchema = z.object({
  pin: z
    .string()
    .trim()
    .min(4, 'O PIN deve conter pelo menos 4 dígitos.')
    .max(32, 'O PIN não pode exceder 32 dígitos.'),
});

export type PinHashInput = z.infer<typeof pinHashSchema>;

export const pinVerifySchema = z.object({
  pin: z
    .string()
    .trim()
    .min(4, 'O PIN é obrigatório.'),
  hash: z
    .string()
    .trim()
    .min(10, 'O hash bcrypt é obrigatório.'),
});

export type PinVerifyInput = z.infer<typeof pinVerifySchema>;

// ==============================================================================
// 3. ATELIÊ (CREATION, UPDATE & STAFF) SCHEMAS (ZOD)
// ==============================================================================

export const whatsappConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultSenderPhone: z.string().trim().regex(phoneRegex, 'Telefone WhatsApp inválido.').optional().nullable(),
  autoNotifyOnStatusChange: z.boolean().default(true),
  includeProofReceiptLink: z.boolean().default(true),
}).default({
  enabled: true,
  autoNotifyOnStatusChange: true,
  includeProofReceiptLink: true,
});

export const atelieSettingsSchema = z.object({
  measurementUnit: z.enum(['cm', 'in']).default('cm'),
  defaultDeliveryDays: z.number().int().min(1).max(90).default(7),
  allowClientMeasurementsEdit: z.boolean().default(false),
  enableAiDrafts: z.boolean().default(true),
  themePreference: z.enum(['light', 'dark', 'system']).default('light'),
}).default({
  measurementUnit: 'cm',
  defaultDeliveryDays: 7,
  allowClientMeasurementsEdit: false,
  enableAiDrafts: true,
  themePreference: 'light',
});

export const createAtelieSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'O nome do ateliê deve conter pelo menos 2 caracteres.')
    .max(120, 'O nome do ateliê não pode exceder 120 caracteres.'),
  proprietarioNome: z
    .string()
    .trim()
    .min(2, 'O nome do proprietário deve ter no mínimo 2 caracteres.')
    .max(100, 'O nome do proprietário não pode exceder 100 caracteres.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Por favor, insira um formato de e-mail corporativo válido.'),
  telefone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Telefone inválido. Utilize formato internacional como +244 923 456 789 ou 923456789.'),
  pais: z
    .enum(['AO', 'PT', 'BR', 'outro'])
    .default('AO'),
  moeda: z
    .enum(['AOA', 'EUR', 'BRL', 'USD'])
    .default('AOA'),
  cidade: z.string().trim().max(100).optional().nullable(),
  endereco: z.string().trim().max(255).optional().nullable(),
  nif: z
    .string()
    .trim()
    .regex(nifRegex, 'NIF inválido (6 a 20 caracteres alfanuméricos).')
    .optional()
    .nullable(),
  plano: z
    .enum(['gratis', 'basico', 'pro', 'premium'])
    .default('gratis'),
  avatarIcon: z.string().trim().max(50).default('Scissors'),
  whatsappConfig: whatsappConfigSchema,
  settings: atelieSettingsSchema,
});

export type CreateAtelieInput = z.infer<typeof createAtelieSchema>;

export const updateAtelieSchema = createAtelieSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'É necessário fornecer pelo menos um campo para atualização do ateliê.' }
);

export type UpdateAtelieInput = z.infer<typeof updateAtelieSchema>;

export const atelieMemberSchema = z.object({
  userId: z.string().trim().min(2).max(100),
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['gerente', 'cortador', 'costureira', 'atendente', 'ajudante']),
  status: z.enum(['ativo', 'inativo', 'pendente']).default('ativo'),
  telefone: z.string().trim().regex(phoneRegex, 'Contacto telefónico inválido.').optional().nullable(),
});

export type AtelieMemberInput = z.infer<typeof atelieMemberSchema>;

// ==============================================================================
// 4. CLIENTE, PEDIDO & IA SCHEMAS (ZOD)
// ==============================================================================

export const createClienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'O nome do cliente deve ter no mínimo 2 caracteres.')
    .max(100, 'O nome do cliente não pode exceder 100 caracteres.'),
  telefone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Número de telefone do cliente inválido.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail do cliente inválido.')
    .optional()
    .nullable()
    .or(z.literal('')),
  genero: z
    .enum(['feminino', 'masculino', 'infantil', 'outro'])
    .default('outro'),
  notas: z.string().trim().max(1000).optional().nullable(),
  medidas: z.record(z.string(), z.any()).optional().nullable(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;

export const updateClienteSchema = createClienteSchema.partial();
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;

export const createPedidoSchema = z.object({
  clienteId: z.string().trim().min(2).max(100),
  clienteNome: z.string().trim().min(2).max(100).optional(),
  descricao: z
    .string()
    .trim()
    .min(3, 'A descrição do pedido deve ter pelo menos 3 caracteres.')
    .max(500),
  tipoPeca: z.string().trim().max(80).optional().nullable(),
  valorTotal: z
    .number()
    .min(0, 'O valor total não pode ser negativo.')
    .max(100000000, 'Valor excede o limite máximo permitido.'),
  valorPago: z
    .number()
    .min(0, 'O valor pago não pode ser negativo.')
    .max(100000000)
    .default(0),
  status: z
    .enum(['pendente', 'em_corte', 'em_costura', 'prova', 'concluido', 'entregue', 'cancelado'])
    .default('pendente'),
  prazoEntrega: z.string().optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export type CreatePedidoInput = z.infer<typeof createPedidoSchema>;

export const updatePedidoSchema = createPedidoSchema.partial();
export type UpdatePedidoInput = z.infer<typeof updatePedidoSchema>;

export const geminiMessageSchema = z.object({
  clienteNome: z.string().trim().min(1, 'Nome do cliente é obrigatório.').max(100),
  descricaoPeca: z.string().trim().min(2, 'Descrição da peça é obrigatória.').max(300),
  tipoPeca: z.string().trim().max(80).optional().nullable(),
  prazoEntrega: z.string().trim().max(50).optional().nullable(),
});

export type GeminiMessageInput = z.infer<typeof geminiMessageSchema>;
