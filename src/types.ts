export interface Atelie {
  id: string;
  nome: string;
  emailOwner: string;
  telefone: string;
  plano: 'basico' | 'pro';
  ativo: boolean;
  dataVencimento: string; // ISO date-time string
  criadoEm: string;
  pais?: 'AO' | 'PT' | 'BR';
  avatarIcon?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string; // E.g., 244923000000
  email?: string;
  observacoes?: string;
  criadoEm: string;
}

export interface Medidas {
  id: string;
  clienteId: string;
  busto?: number;
  cintura?: number;
  quadril?: number;
  ombro?: number;
  comprimentoTronco?: number;
  comprimentoSaia?: number;
  comprimentoCalca?: number;
  manga?: number;
  observacoes?: string;
  registradoEm: string;
}

export type TipoPeca = 'vestido' | 'calca' | 'saia' | 'camisa' | 'blazer' | 'ajuste' | 'outro';
export type PedidoStatus = 'em_andamento' | 'aguardando_prova' | 'finalizado' | 'entregue' | 'cancelado';

export interface Pedido {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  descricao: string;
  tipoPeca: TipoPeca;
  tecido: string;
  valor: number;
  sinalPago: number;
  prazoEntrega: string; // ISO string
  status: PedidoStatus;
  observacoes?: string;
  fotoReferenciaUrl?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface SolicitacaoPagamento {
  id: string;
  atelieId: string;
  atelieNome: string;
  emailOwner: string;
  telefoneOwner: string;
  plano: 'basico' | 'pro';
  metodoPagamento: 'multicaixa' | 'transferencia';
  comprovativoUrl: string; // URL or base64 data url for preview
  status: 'pendente' | 'aprovado' | 'rejeitado';
  observacoesAdmin?: string;
  solicitadoEm: string;
  resolvidoEm: string | null;
}

export interface ConfiguracaoPagamento {
  numeroExpress: string;
  iban: string;
  banco: string;
  titular: string;
  whatsappAdmin: string; // Mandatory WhatsApp contact
}

export interface UserSession {
  uid: string;
  email: string | null;
  isAdmin: boolean;
  atelie?: Atelie | null;
}
