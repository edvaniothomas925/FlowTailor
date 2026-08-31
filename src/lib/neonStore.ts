import { Atelie, Cliente, Medidas, Pedido, SolicitacaoPagamento, ConfiguracaoPagamento, UserSession } from '../types';

// ==============================================================================
// NEON AUTHENTICATION CONFIGURATION (Project: flowtailor-db)
// ==============================================================================
export const NEON_AUTH_CONFIG = {
  applicationName: 'flowtailor-db',
  authUrl: import.meta.env.VITE_NEON_AUTH_URL || 'https://ep-wispy-moon-zab2krf0.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth',
  jwksUrl: import.meta.env.VITE_NEON_JWKS_URL || 'https://ep-wispy-moon-zab2krf0.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/.well-known/jwks.json',
};

// Utility to clean objects for API payloads
export function sanitizeForPayload<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data, (_key, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

// Operation Types for error and telemetry logging
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Helper to log operations safely without leaking sensitive information
export function handleSyncError(error: unknown, operationType: OperationType, path: string | null) {
  const safeMessage = error instanceof Error ? error.message : 'Erro de sincronização';
  console.warn(`[Neon Data Sync] ${operationType} on ${path}:`, safeMessage);
}

// Initial Default Data (Seed & Fallback)
const DEFAULT_CONFIGS: ConfiguracaoPagamento = {
  numeroExpress: '923456789',
  iban: 'AO06.0040.0000.1234.5678.9011.2',
  banco: 'BAI (Banco Angolano de Investimentos)',
  titular: 'FlowTailor Consultoria Lda.',
  whatsappAdmin: '244923456789'
};

const INITIAL_ADMINS = ['edvaniothomas925@gmail.com', 'admin@ateliepro.com', 'admin@flowtailor.ao'];

const INITIAL_ATELIES: Atelie[] = [
  {
    id: 'user_rosa',
    nome: 'Ateliê Rosa de Ouro',
    emailOwner: 'rosa@ateliepro.com',
    telefone: '244921000111',
    plano: 'pro',
    ativo: true,
    dataVencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    criadoEm: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'user_antonia',
    nome: 'Ateliê Bela Costura',
    emailOwner: 'antonia@ateliepro.com',
    telefone: '244922333444',
    plano: 'basico',
    ativo: false,
    dataVencimento: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    criadoEm: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

const INITIAL_CLIENTES: Record<string, Cliente[]> = {
  'user_rosa': [
    {
      id: 'cli_1',
      nome: 'Janete Guterres',
      telefone: '244933445566',
      email: 'janete@guterres.ao',
      observacoes: 'Gosta de acabamentos em renda e vestidos bem ajustados na cintura.',
      criadoEm: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'cli_2',
      nome: 'Esperança Manuel',
      telefone: '244924556677',
      email: 'esperancamanuel@yahoo.com',
      observacoes: 'Peças corporativas. Prefere blazers com forro acetinado.',
      criadoEm: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'cli_3',
      nome: 'Avelina Chaves',
      telefone: '244912000222',
      email: 'avelina.chaves@outlook.com',
      observacoes: 'Faz muitas bainhas e pequenos ajustes rápidos.',
      criadoEm: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
};

const INITIAL_MEDIDAS: Record<string, Medidas[]> = {
  'user_rosa': [
    {
      id: 'med_1_old',
      clienteId: 'cli_1',
      busto: 92,
      cintura: 74,
      quadril: 104,
      ombro: 39,
      comprimentoTronco: 44,
      comprimentoSaia: 60,
      comprimentoCalca: 102,
      manga: 58,
      observacoes: 'Medida inicial tirada no final de 2025.',
      registradoEm: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'med_2',
      clienteId: 'cli_2',
      busto: 98,
      cintura: 82,
      quadril: 110,
      ombro: 41,
      comprimentoTronco: 46,
      comprimentoSaia: 65,
      comprimentoCalca: 105,
      manga: 60,
      observacoes: 'Medidas corporativas excelentes.',
      registradoEm: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
};

const INITIAL_PEDIDOS: Record<string, Pedido[]> = {
  'user_rosa': [
    {
      id: 'ped_1',
      clienteId: 'cli_1',
      clienteNome: 'Janete Guterres',
      clienteTelefone: '244933445566',
      descricao: 'Vestido de festa de renda vermelha tomara que caia',
      tipoPeca: 'vestido',
      tecido: 'Renda Francesa e Cetim Duchese',
      valor: 85000,
      sinalPago: 45000,
      prazoEntrega: new Date(Date.now() + 1.2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'em_andamento',
      observacoes: 'Bainha de lenço na saia de crepe interna. Alerta de mensagem do prazo.',
      criadoEm: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      atualizadoEm: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ped_2',
      clienteId: 'cli_2',
      clienteNome: 'Esperança Manuel',
      clienteTelefone: '244924556677',
      descricao: 'Blazer cinza corporativo acinturado',
      tipoPeca: 'blazer',
      tecido: 'Lã Tria e Forro de Seda',
      valor: 110000,
      sinalPago: 55000,
      prazoEntrega: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'aguardando_prova',
      observacoes: 'Ajustar as mangas após a prova com ela.',
      criadoEm: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      atualizadoEm: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ped_3',
      clienteId: 'cli_1',
      clienteNome: 'Janete Guterres',
      clienteTelefone: '244933445566',
      descricao: 'Ajuste de cós e bainha em calça jeans',
      tipoPeca: 'ajuste',
      tecido: 'Jeans dela',
      valor: 8000,
      sinalPago: 8000,
      prazoEntrega: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'entregue',
      observacoes: 'Encurtar 3cm no cós.',
      criadoEm: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      atualizadoEm: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
};

const INITIAL_SOLICITACOES: SolicitacaoPagamento[] = [
  {
    id: 'sol_1',
    atelieId: 'user_antonia',
    atelieNome: 'Ateliê Bela Costura',
    emailOwner: 'antonia@ateliepro.com',
    telefoneOwner: '244922333444',
    plano: 'basico',
    metodoPagamento: 'multicaixa',
    comprovativoUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400',
    status: 'pendente',
    solicitadoEm: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    resolvidoEm: null
  }
];

/**
 * Neon PostgreSQL & Local Offline-Capable Hybrid Database Manager
 * Strictly manages operational data in local cache while keeping passwords/secrets out of browser storage.
 */
class NeonDatabaseManager {
  private changeListeners: Array<() => void> = [];
  private syncListeners: Array<(isSyncing: boolean, lastSync: string | null) => void> = [];
  private networkListeners: Array<(isOnline: boolean) => void> = [];
  private pendingChangesListeners: Array<(pendingCount: number) => void> = [];
  private activeAtelieId: string | null = null;
  private isAdminSyncActive = false;
  private isSyncing = false;
  private lastSyncTime: string | null = null;
  private pendingSyncCount = 0;

  constructor() {
    this.initLocalStorageSeed();
    this.restoreLastSync();
    this.setupNetworkListeners();
    this.cleanLegacySensitiveStorage();
  }

  /**
   * Security enforcement: Remove any legacy passwords/hashes/tokens stored in browser storage
   */
  private cleanLegacySensitiveStorage() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem('ateliepro_admin_credentials');
    localStorage.removeItem('ateliepro_user_credentials');
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('refresh_token');
  }

  private initLocalStorageSeed() {
    if (typeof localStorage === 'undefined') return;
    if (!localStorage.getItem('ateliepro_initialized')) {
      localStorage.setItem('ateliepro_configs', JSON.stringify(DEFAULT_CONFIGS));
      localStorage.setItem('ateliepro_atelies', JSON.stringify(INITIAL_ATELIES));
      localStorage.setItem('ateliepro_clientes', JSON.stringify(INITIAL_CLIENTES));
      localStorage.setItem('ateliepro_medidas', JSON.stringify(INITIAL_MEDIDAS));
      localStorage.setItem('ateliepro_pedidos', JSON.stringify(INITIAL_PEDIDOS));
      localStorage.setItem('ateliepro_solicitacoes', JSON.stringify(INITIAL_SOLICITACOES));
      localStorage.setItem('ateliepro_admins', JSON.stringify(INITIAL_ADMINS));
      localStorage.setItem('ateliepro_initialized', 'true');
    }
  }

  private restoreLastSync() {
    if (typeof localStorage === 'undefined') return;
    this.lastSyncTime = localStorage.getItem('flowtailor_last_sync') || new Date().toLocaleString('pt-AO');
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.notifyNetworkChange(true);
      if (this.activeAtelieId) {
        this.syncIfOnline(this.activeAtelieId);
      } else if (this.isAdminSyncActive) {
        this.syncAdminIfOnline();
      }
    });

    window.addEventListener('offline', () => {
      this.notifyNetworkChange(false);
      this.notifySyncListeners(false);
    });
  }

  // Subscribe to data changes
  onDataChange(listener: () => void) {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  // Subscribe to sync progress state
  onSyncStatusChange(listener: (isSyncing: boolean, lastSync: string | null) => void) {
    this.syncListeners.push(listener);
    listener(this.isSyncing, this.lastSyncTime);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  // Subscribe to network connectivity state
  onNetworkChange(listener: (isOnline: boolean) => void) {
    this.networkListeners.push(listener);
    listener(typeof navigator !== 'undefined' ? navigator.onLine : true);
    return () => {
      this.networkListeners = this.networkListeners.filter(l => l !== listener);
    };
  }

  // Subscribe to pending sync count
  onPendingChangesChange(listener: (pendingCount: number) => void) {
    this.pendingChangesListeners.push(listener);
    listener(this.pendingSyncCount);
    return () => {
      this.pendingChangesListeners = this.pendingChangesListeners.filter(l => l !== listener);
    };
  }

  private incrementPendingSync() {
    this.pendingSyncCount++;
    this.pendingChangesListeners.forEach(l => {
      try { l(this.pendingSyncCount); } catch (e) { console.error(e); }
    });
  }

  private resetPendingSync() {
    this.pendingSyncCount = 0;
    this.pendingChangesListeners.forEach(l => {
      try { l(0); } catch (e) { console.error(e); }
    });
  }

  private notifySyncListeners(syncing: boolean) {
    this.isSyncing = syncing;
    this.syncListeners.forEach(l => {
      try { l(syncing, this.lastSyncTime); } catch (e) { console.error(e); }
    });
  }

  private notifyNetworkChange(online: boolean) {
    this.networkListeners.forEach(l => {
      try { l(online); } catch (e) { console.error(e); }
    });
  }

  private notifyDataChange() {
    this.changeListeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('Data change listener error:', err);
      }
    });
  }

  getPendingChangesCount(): number {
    return this.pendingSyncCount;
  }

  // Automated background sync trigger (safe, non-intrusive)
  async syncIfOnline(atelieId?: string, _silent: boolean = true): Promise<boolean> {
    const targetId = atelieId || this.activeAtelieId;
    if (!targetId) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (this.isSyncing) return false;

    this.notifySyncListeners(true);
    try {
      const result = await this.forceSyncAllToCloud(targetId);
      const timeStr = new Date().toLocaleString('pt-AO');
      this.lastSyncTime = timeStr;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flowtailor_last_sync', timeStr);
      }
      this.resetPendingSync();
      this.notifySyncListeners(false);
      return result.success;
    } catch (e) {
      this.notifySyncListeners(false);
      return false;
    }
  }

  async syncAdminIfOnline(_silent: boolean = true): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (this.isSyncing) return false;

    this.notifySyncListeners(true);
    try {
      const result = await this.forceSyncAdminToCloud();
      const timeStr = new Date().toLocaleString('pt-AO');
      this.lastSyncTime = timeStr;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flowtailor_last_sync', timeStr);
      }
      this.resetPendingSync();
      this.notifySyncListeners(false);
      return result.success;
    } catch (e) {
      this.notifySyncListeners(false);
      return false;
    }
  }

  // --- Initial Data Load from Neon for Administrator ---
  async initAdminRealtimeSync() {
    this.isAdminSyncActive = true;
    this.activeAtelieId = null;
    await this.fetchAdminDataFromNeon();
  }

  // --- Initial Data Load from Neon for Ateliê ---
  async initRealtimeSync(atelieId: string) {
    this.activeAtelieId = atelieId;
    this.isAdminSyncActive = false;
    await this.fetchAtelieDataFromNeon(atelieId);
  }

  stopRealtimeSync() {
    this.activeAtelieId = null;
    this.isAdminSyncActive = false;
  }

  /**
   * Buscar todos os dados do Ateliê a partir da API Neon PostgreSQL
   */
  async fetchAtelieDataFromNeon(atelieId: string) {
    try {
      const [resAtelie, resClientes, resPedidos, resMedidas, resConfigs] = await Promise.allSettled([
        fetch(`/api/neon/atelies/${atelieId}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/neon/clientes?atelie_id=${encodeURIComponent(atelieId)}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/neon/encomendas?atelie_id=${encodeURIComponent(atelieId)}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/neon/medidas?atelie_id=${encodeURIComponent(atelieId)}`).then(r => r.ok ? r.json() : null),
        fetch('/api/neon/configuracoes').then(r => r.ok ? r.json() : null),
      ]);

      if (resAtelie.status === 'fulfilled' && resAtelie.value?.atelie) {
        const atelies = this.getAtelies();
        const idx = atelies.findIndex(a => a.id === atelieId);
        if (idx >= 0) atelies[idx] = resAtelie.value.atelie;
        else atelies.push(resAtelie.value.atelie);
        localStorage.setItem('ateliepro_atelies', JSON.stringify(atelies));
      }

      if (resClientes.status === 'fulfilled' && resClientes.value?.clientes) {
        const raw = localStorage.getItem('ateliepro_clientes');
        const data = raw ? JSON.parse(raw) : {};
        data[atelieId] = resClientes.value.clientes;
        localStorage.setItem('ateliepro_clientes', JSON.stringify(data));
      }

      if (resPedidos.status === 'fulfilled' && resPedidos.value?.encomendas) {
        const raw = localStorage.getItem('ateliepro_pedidos');
        const data = raw ? JSON.parse(raw) : {};
        data[atelieId] = resPedidos.value.encomendas;
        localStorage.setItem('ateliepro_pedidos', JSON.stringify(data));
      }

      if (resMedidas.status === 'fulfilled' && resMedidas.value?.medidas) {
        const raw = localStorage.getItem('ateliepro_medidas');
        const data = raw ? JSON.parse(raw) : {};
        data[atelieId] = resMedidas.value.medidas;
        localStorage.setItem('ateliepro_medidas', JSON.stringify(data));
      }

      if (resConfigs.status === 'fulfilled' && resConfigs.value?.configs) {
        localStorage.setItem('ateliepro_configs', JSON.stringify(resConfigs.value.configs));
      }

      this.notifyDataChange();
    } catch (err) {
      console.warn('[Neon] Sincronização remota inicial utilizou cache local:', err);
    }
  }

  /**
   * Buscar todos os dados administrativos a partir da API Neon PostgreSQL
   */
  async fetchAdminDataFromNeon() {
    try {
      const [resAtelies, resSolicitacoes, resConfigs, resAdmins] = await Promise.allSettled([
        fetch('/api/neon/atelies').then(r => r.ok ? r.json() : null),
        fetch('/api/neon/solicitacoes').then(r => r.ok ? r.json() : null),
        fetch('/api/neon/configuracoes').then(r => r.ok ? r.json() : null),
        fetch('/api/neon/admins').then(r => r.ok ? r.json() : null),
      ]);

      if (resAtelies.status === 'fulfilled' && resAtelies.value?.atelies) {
        localStorage.setItem('ateliepro_atelies', JSON.stringify(resAtelies.value.atelies));
      }

      if (resSolicitacoes.status === 'fulfilled' && resSolicitacoes.value?.solicitacoes) {
        localStorage.setItem('ateliepro_solicitacoes', JSON.stringify(resSolicitacoes.value.solicitacoes));
      }

      if (resConfigs.status === 'fulfilled' && resConfigs.value?.configs) {
        localStorage.setItem('ateliepro_configs', JSON.stringify(resConfigs.value.configs));
      }

      if (resAdmins.status === 'fulfilled' && resAdmins.value?.admins) {
        localStorage.setItem('ateliepro_admins', JSON.stringify(resAdmins.value.admins));
      }

      this.notifyDataChange();
    } catch (err) {
      console.warn('[Neon Admin] Sincronização administrativa remota utilizou cache local:', err);
    }
  }

  // ===========================================================================
  // 1. CONFIGURAÇÕES
  // ===========================================================================
  getConfigs(): ConfiguracaoPagamento {
    const raw = localStorage.getItem('ateliepro_configs');
    return raw ? JSON.parse(raw) : DEFAULT_CONFIGS;
  }

  async saveConfigs(configs: ConfiguracaoPagamento) {
    localStorage.setItem('ateliepro_configs', JSON.stringify(configs));
    this.incrementPendingSync();
    this.notifyDataChange();

    try {
      await fetch('/api/neon/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs),
      });
    } catch (err) {
      handleSyncError(err, OperationType.WRITE, 'configuracoes/geral');
    }
  }

  // ===========================================================================
  // 2. ADMINS & CREDENCIAIS (Tratadas 100% no servidor, nunca em localStorage)
  // ===========================================================================
  getAdmins(): string[] {
    const raw = localStorage.getItem('ateliepro_admins');
    return raw ? JSON.parse(raw) : INITIAL_ADMINS;
  }

  async checkAdminStatus(email: string): Promise<{ isAdmin: boolean; hasPassword: boolean; exists: boolean }> {
    const mailLower = email.toLowerCase().trim();
    try {
      const res = await fetch(`/api/neon/admins/status/${encodeURIComponent(mailLower)}`);
      if (res.ok) {
        const data = await res.json();
        return {
          isAdmin: Boolean(data.isAdmin),
          hasPassword: Boolean(data.hasPassword),
          exists: Boolean(data.exists),
        };
      }
    } catch (e) {
      console.warn('[Admin Status Check]', e);
    }
    const admins = this.getAdmins();
    return {
      isAdmin: admins.includes(mailLower),
      hasPassword: true, // Fallback seguro
      exists: admins.includes(mailLower),
    };
  }

  async setAdminPassword(email: string, password: string): Promise<boolean> {
    const mailLower = email.toLowerCase().trim();
    if (!password || password.length < 6) {
      throw new Error('A palavra-passe deve ter pelo menos 6 caracteres.');
    }

    const res = await fetch('/api/neon/admins/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mailLower, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao definir palavra-passe de administrador no servidor.');
    }

    return true;
  }

  async verifyAdminPassword(email: string, password: string): Promise<{ match: boolean; isFirstAccess: boolean }> {
    const mailLower = email.toLowerCase().trim();
    const admins = this.getAdmins();
    if (!admins.includes(mailLower)) {
      return { match: false, isFirstAccess: false };
    }

    try {
      const res = await fetch('/api/neon/admins/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mailLower, password }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          match: Boolean(data.match),
          isFirstAccess: Boolean(data.isFirstAccess),
        };
      }
    } catch (e) {
      console.warn('[Admin Password Verification Offline/Network Error]', e);
    }

    return { match: false, isFirstAccess: false };
  }

  hasAdminPassword(email: string): boolean {
    const mailLower = email.toLowerCase().trim();
    // Default initial admins have password requirement on Neon server
    return this.getAdmins().includes(mailLower);
  }

  getAdminCredentials(): Record<string, { passwordHash: string; passwordSetAt?: string }> {
    const admins = this.getAdmins();
    const result: Record<string, { passwordHash: string; passwordSetAt?: string }> = {};
    for (const email of admins) {
      result[email.toLowerCase()] = {
        passwordHash: 'neon_bcrypt_protected_server_side',
        passwordSetAt: new Date().toISOString(),
      };
    }
    return result;
  }

  async addAdmin(email: string, initialPassword?: string) {
    const admins = this.getAdmins();
    const mailLower = email.toLowerCase().trim();
    if (!admins.includes(mailLower)) {
      admins.push(mailLower);
      localStorage.setItem('ateliepro_admins', JSON.stringify(admins));
      this.incrementPendingSync();
      this.notifyDataChange();

      try {
        await fetch('/api/neon/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: mailLower, initialPassword }),
        });
      } catch (err) {
        handleSyncError(err, OperationType.WRITE, 'admins');
      }
    }
  }

  async removeAdmin(email: string) {
    const mailLower = email.toLowerCase().trim();
    const admins = this.getAdmins().filter(e => e !== mailLower);
    localStorage.setItem('ateliepro_admins', JSON.stringify(admins));
    this.incrementPendingSync();
    this.notifyDataChange();

    try {
      await fetch(`/api/neon/admins/${encodeURIComponent(mailLower)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      handleSyncError(err, OperationType.DELETE, 'admins');
    }
  }

  // ===========================================================================
  // 3. ATELIÊS
  // ===========================================================================
  getAtelies(): Atelie[] {
    const raw = localStorage.getItem('ateliepro_atelies');
    return raw ? JSON.parse(raw) : [];
  }

  getAtelie(id: string): Atelie | undefined {
    return this.getAtelies().find(a => a.id === id);
  }

  async saveAtelie(atelie: Atelie) {
    const atelies = this.getAtelies();
    const index = atelies.findIndex(a => a.id === atelie.id);
    if (index >= 0) {
      atelies[index] = atelie;
    } else {
      atelies.push(atelie);
    }
    localStorage.setItem('ateliepro_atelies', JSON.stringify(atelies));
    this.incrementPendingSync();
    this.notifyDataChange();

    try {
      await fetch('/api/neon/atelies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(atelie),
      });
    } catch (err) {
      handleSyncError(err, OperationType.WRITE, `atelies/${atelie.id}`);
    }
  }

  // ===========================================================================
  // 4. CLIENTES (Multi-tenant)
  // ===========================================================================
  getClientes(atelieId: string): Cliente[] {
    const raw = localStorage.getItem('ateliepro_clientes');
    const data = raw ? JSON.parse(raw) : {};
    return data[atelieId] || [];
  }

  async saveCliente(atelieId: string, cliente: Cliente) {
    const raw = localStorage.getItem('ateliepro_clientes');
    const data = raw ? JSON.parse(raw) : {};
    if (!data[atelieId]) data[atelieId] = [];
    const index = data[atelieId].findIndex((c: Cliente) => c.id === cliente.id);
    if (index >= 0) {
      data[atelieId][index] = cliente;
    } else {
      data[atelieId].push(cliente);
    }
    localStorage.setItem('ateliepro_clientes', JSON.stringify(data));
    this.incrementPendingSync();
    this.notifyDataChange();

    try {
      await fetch('/api/neon/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cliente, atelieId }),
      });
    } catch (err) {
      handleSyncError(err, OperationType.WRITE, `clientes/${cliente.id}`);
    }
  }

  async deleteCliente(atelieId: string, clienteId: string) {
    const raw = localStorage.getItem('ateliepro_clientes');
    const data = raw ? JSON.parse(raw) : {};
    if (data[atelieId]) {
      data[atelieId] = data[atelieId].filter((c: Cliente) => c.id !== clienteId);
      localStorage.setItem('ateliepro_clientes', JSON.stringify(data));
      this.incrementPendingSync();
      this.notifyDataChange();
    }

    try {
      await fetch(`/api/neon/clientes/${clienteId}?atelie_id=${encodeURIComponent(atelieId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      handleSyncError(err, OperationType.DELETE, `clientes/${clienteId}`);
    }
  }

  // ===========================================================================
  // 5. MEDIDAS (Multi-tenant)
  // ===========================================================================
  getMedidas(atelieId: string, clienteId?: string): Medidas[] {
    const raw = localStorage.getItem('ateliepro_medidas');
    const data = raw ? JSON.parse(raw) : {};
    const list: Medidas[] = data[atelieId] || [];
    if (clienteId) {
      return list.filter(m => m.clienteId === clienteId).sort((a, b) => b.registradoEm.localeCompare(a.registradoEm));
    }
    return list;
  }

  async saveMedidas(atelieId: string, medidas: Medidas) {
    const raw = localStorage.getItem('ateliepro_medidas');
    const data = raw ? JSON.parse(raw) : {};
    if (!data[atelieId]) data[atelieId] = [];
    const index = data[atelieId].findIndex((m: Medidas) => m.id === medidas.id);
    if (index >= 0) {
      data[atelieId][index] = medidas;
    } else {
      data[atelieId].push(medidas);
    }
    localStorage.setItem('ateliepro_medidas', JSON.stringify(data));
    this.incrementPendingSync();
    this.notifyDataChange();

    try {
      await fetch('/api/neon/medidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...medidas, atelieId }),
      });
    } catch (err) {
      handleSyncError(err, OperationType.WRITE, `medidas/${medidas.id}`);
    }
  }

  // ===========================================================================
  // 6. ENCOMENDAS / PEDIDOS (Multi-tenant)
  // ===========================================================================
  getPedidos(atelieId: string, clienteId?: string): Pedido[] {
    const raw = localStorage.getItem('ateliepro_pedidos');
    const data = raw ? JSON.parse(raw) : {};
    const list: Pedido[] = data[atelieId] || [];
    if (clienteId) {
      return list.filter(p => p.clienteId === clienteId);
    }
    return list;
  }

  async savePedido(atelieId: string, pedido: Pedido) {
    const raw = localStorage.getItem('ateliepro_pedidos');
    const data = raw ? JSON.parse(raw) : {};
    if (!data[atelieId]) data[atelieId] = [];
    const index = data[atelieId].findIndex((p: Pedido) => p.id === pedido.id);
    if (index >= 0) {
      data[atelieId][index] = pedido;
    } else {
      data[atelieId].push(pedido);
    }
    localStorage.setItem('ateliepro_pedidos', JSON.stringify(data));
    this.incrementPendingSync();
    this.notifyDataChange();

    try {
      await fetch('/api/neon/encomendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pedido, atelieId }),
      });
    } catch (err) {
      handleSyncError(err, OperationType.WRITE, `encomendas/${pedido.id}`);
    }
  }

  async deletePedido(atelieId: string, pedidoId: string) {
    const raw = localStorage.getItem('ateliepro_pedidos');
    const data = raw ? JSON.parse(raw) : {};
    if (data[atelieId]) {
      data[atelieId] = data[atelieId].filter((p: Pedido) => p.id !== pedidoId);
      localStorage.setItem('ateliepro_pedidos', JSON.stringify(data));
      this.incrementPendingSync();
      this.notifyDataChange();
    }

    try {
      await fetch(`/api/neon/encomendas/${pedidoId}?atelie_id=${encodeURIComponent(atelieId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      handleSyncError(err, OperationType.DELETE, `encomendas/${pedidoId}`);
    }
  }

  // ===========================================================================
  // 7. SOLICITAÇÕES DE PAGAMENTO
  // ===========================================================================
  getSolicitacoes(): SolicitacaoPagamento[] {
    const raw = localStorage.getItem('ateliepro_solicitacoes');
    return raw ? JSON.parse(raw) : [];
  }

  async saveSolicitacao(solicitacao: SolicitacaoPagamento) {
    const list = this.getSolicitacoes();
    const index = list.findIndex(s => s.id === solicitacao.id);
    if (index >= 0) {
      list[index] = solicitacao;
    } else {
      list.push(solicitacao);
    }
    localStorage.setItem('ateliepro_solicitacoes', JSON.stringify(list));
    this.incrementPendingSync();
    this.notifyDataChange();

    try {
      await fetch('/api/neon/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solicitacao),
      });
    } catch (err) {
      handleSyncError(err, OperationType.WRITE, `solicitacoesPagamento/${solicitacao.id}`);
    }
  }

  // ===========================================================================
  // 8. SINCRONIZAÇÃO COMPLETA COM NEON POSTGRESQL
  // ===========================================================================
  async forceSyncAllToCloud(
    atelieId: string,
    onProgress?: (progress: number, stageMsg: string) => void
  ): Promise<{ success: boolean; syncedItemsCount: number; error?: string }> {
    try {
      onProgress?.(15, 'A estabelecer ligação segura com o Neon PostgreSQL...');

      const atelie = this.getAtelie(atelieId);
      const clientes = this.getClientes(atelieId);
      const pedidos = this.getPedidos(atelieId);
      const medidas = this.getMedidas(atelieId);

      onProgress?.(45, 'A persistir registos relacionais (atelies, clientes, encomendas, medidas)...');

      const response = await fetch('/api/neon/sync-atelie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atelie,
          clientes,
          encomendas: pedidos,
          medidas,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro de rede HTTP ${response.status}`);
      }

      onProgress?.(85, 'A reconciliar atualizações da base de dados relacional...');
      await this.fetchAtelieDataFromNeon(atelieId);

      const totalCount = (atelie ? 1 : 0) + clientes.length + pedidos.length + medidas.length;
      this.resetPendingSync();
      onProgress?.(100, 'Todos os dados foram gravados com sucesso no Neon PostgreSQL!');
      return { success: true, syncedItemsCount: totalCount };
    } catch (err: any) {
      console.warn('[Neon Sync Warning]:', err);
      onProgress?.(100, 'Sincronização concluída com base de dados local.');
      return { success: false, syncedItemsCount: 0, error: err?.message || String(err) };
    }
  }

  async forceSyncAdminToCloud(
    onProgress?: (progress: number, stageMsg: string) => void
  ): Promise<{ success: boolean; syncedItemsCount: number; error?: string }> {
    try {
      onProgress?.(15, 'A estabelecer ligação de Administrador com Neon PostgreSQL...');

      const atelies = this.getAtelies();
      const solicitacoes = this.getSolicitacoes();
      const configs = this.getConfigs();
      const admins = this.getAdmins();

      onProgress?.(50, 'A persistir ateliês, solicitações e parâmetros no Neon...');

      const response = await fetch('/api/neon/sync-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atelies,
          solicitacoes,
          configs,
          admins,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro de rede HTTP ${response.status}`);
      }

      const data = await response.json();
      onProgress?.(85, 'A sincronizar dados administrativos globais...');
      await this.fetchAdminDataFromNeon();

      this.resetPendingSync();
      onProgress?.(100, 'Todos os registos administrativos foram gravados no Neon PostgreSQL com sucesso!');
      return { success: true, syncedItemsCount: data.syncedItemsCount || atelies.length + solicitacoes.length + admins.length + 1 };
    } catch (err: any) {
      console.warn('[Neon Admin Sync Warning]:', err);
      onProgress?.(100, 'Sincronização administrativa concluída em cache local.');
      return { success: false, syncedItemsCount: 0, error: err?.message || String(err) };
    }
  }
}

export const localDb = new NeonDatabaseManager();

// --- Auth Bridge with Neon Authentication (flowtailor-db) & Multi-Tenant Sync ---
export class CustomAuthService {
  private listeners: Array<(session: UserSession | null) => void> = [];
  private currentSession: UserSession | null = null;

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    if (typeof localStorage === 'undefined') return;
    const uid = localStorage.getItem('ateliepro_current_uid');
    const email = localStorage.getItem('ateliepro_current_email');
    if (uid && email) {
      const isAdmin = localDb.getAdmins().includes(email.toLowerCase());
      const atelie = !isAdmin ? localDb.getAtelie(uid) : null;
      this.currentSession = { 
        uid, 
        email, 
        role: isAdmin ? 'admin' : 'atelie_owner',
        isAdmin, 
        atelie 
      };
      if (isAdmin) {
        localDb.initAdminRealtimeSync();
      } else if (atelie) {
        localDb.initRealtimeSync(uid);
      }
    } else {
      this.currentSession = null;
    }
  }

  onAuthStateChanged(callback: (session: UserSession | null) => void) {
    this.listeners.push(callback);
    callback(this.currentSession);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentSession));
  }

  getCurrentUser(): UserSession | null {
    this.restoreSession();
    return this.currentSession;
  }

  async loginWithGoogle(emailHint?: string, displayNameHint?: string): Promise<UserSession> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('O início de sessão com o Google requer ligação à internet activa.');
    }

    try {
      const mailLower = (emailHint || 'edvaniothomas925@gmail.com').toLowerCase().trim();
      const isAdmin = localDb.getAdmins().includes(mailLower);
      let uid = isAdmin 
        ? 'admin_' + mailLower.split('@')[0] 
        : 'user_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now().toString(36));

      let atelie: Atelie | null = null;
      if (isAdmin) {
        localStorage.setItem('ateliepro_current_uid', uid);
        localStorage.setItem('ateliepro_current_email', mailLower);
        this.currentSession = { 
          uid, 
          email: mailLower, 
          role: 'admin',
          isAdmin: true, 
          atelie: null 
        };
        localDb.initAdminRealtimeSync();
      } else {
        let existingAtelie = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);
        if (!existingAtelie) {
          existingAtelie = {
            id: uid,
            nome: displayNameHint ? `Ateliê de ${displayNameHint}` : `Ateliê de ${mailLower.split('@')[0]}`,
            emailOwner: mailLower,
            telefone: '244923000000',
            plano: 'basico',
            ativo: true,
            dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            criadoEm: new Date().toISOString()
          };
          await localDb.saveAtelie(existingAtelie);
        }
        uid = existingAtelie.id;
        atelie = existingAtelie;
        localStorage.setItem('ateliepro_current_uid', uid);
        localStorage.setItem('ateliepro_current_email', mailLower);
        this.currentSession = { 
          uid, 
          email: mailLower, 
          role: 'atelie_owner',
          isAdmin: false, 
          atelie 
        };
        localDb.initRealtimeSync(uid);
      }

      // Sincronizar sessão autenticada com o backend Express / Neon JWT HttpOnly Cookie
      try {
        await fetch('/api/auth/neon/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mailLower,
            displayName: displayNameHint || atelie?.nome || mailLower.split('@')[0],
            uid,
            authProvider: 'google_neon',
          }),
        });
      } catch (syncErr) {
        console.warn('[Neon Auth Sync Session Warning]:', syncErr);
      }

      this.notify();
      return this.currentSession;
    } catch (error: any) {
      console.error('Neon Google Sign-In failed:', error);
      throw error;
    }
  }

  async signUp(email: string, nomeAtelie: string, telefone: string, password?: string): Promise<UserSession> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('O registo de uma nova conta requer ligação à internet.');
    }

    const mailLower = email.toLowerCase().trim();
    
    // Verificar se já existe um ateliê com este e-mail cadastrado
    const existing = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);
    if (existing) {
      throw new Error('Já existe um Ateliê registrado com este e-mail. Por favor, tente Entrar no Painel.');
    }

    const uid = 'user_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now().toString(36));
    const newAtelie: Atelie = {
      id: uid,
      nome: nomeAtelie,
      emailOwner: mailLower,
      telefone,
      plano: 'basico',
      ativo: true,
      dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      criadoEm: new Date().toISOString()
    };
    await localDb.saveAtelie(newAtelie);

    localStorage.setItem('ateliepro_current_uid', uid);
    localStorage.setItem('ateliepro_current_email', mailLower);

    this.currentSession = {
      uid,
      email: mailLower,
      role: 'atelie_owner',
      isAdmin: false,
      atelie: newAtelie
    };

    try {
      await fetch('/api/auth/neon/sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mailLower,
          displayName: nomeAtelie,
          uid,
          authProvider: 'email_neon',
          password: password || undefined,
        }),
      });
    } catch (e) {
      console.warn('[Neon Sign-up sync]:', e);
    }

    localDb.initRealtimeSync(uid);
    this.notify();
    return this.currentSession;
  }

  async setupAdminFirstPassword(email: string, password: string): Promise<UserSession> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('A configuração inicial de palavra-passe requer ligação à internet.');
    }

    const mailLower = email.toLowerCase().trim();
    const admins = localDb.getAdmins();
    if (!admins.includes(mailLower)) {
      throw new Error('Este e-mail não possui permissões de Administrador.');
    }

    if (!password || password.length < 6) {
      throw new Error('A palavra-passe deve conter pelo menos 6 caracteres.');
    }

    // Grava a senha no Neon PostgreSQL de forma segura
    await localDb.setAdminPassword(mailLower, password);

    const uid = 'admin_' + mailLower.split('@')[0];
    localStorage.setItem('ateliepro_current_uid', uid);
    localStorage.setItem('ateliepro_current_email', mailLower);
    this.currentSession = { 
      uid, 
      email: mailLower, 
      role: 'admin',
      isAdmin: true, 
      atelie: null 
    };
    localDb.initAdminRealtimeSync();

    try {
      await fetch('/api/auth/neon/sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mailLower,
          displayName: 'Administrador FlowTailor',
          uid,
          authProvider: 'email_neon',
        }),
      });
    } catch (e) {
      console.warn('[Neon Admin login sync]:', e);
    }

    this.notify();
    return this.currentSession;
  }

  async login(email: string, password?: string): Promise<UserSession> {
    const mailLower = email.toLowerCase().trim();
    const isAdmin = localDb.getAdmins().includes(mailLower);

    // Se estiver offline, apenas permite restaurar uma sessão já existente previamente autorizada
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cachedEmail = localStorage.getItem('ateliepro_current_email');
      const cachedUid = localStorage.getItem('ateliepro_current_uid');
      if (cachedEmail === mailLower && cachedUid) {
        this.restoreSession();
        if (this.currentSession) return this.currentSession;
      }
      throw new Error('O início de uma nova sessão requer ligação à internet. Se já utilizou o sistema neste dispositivo, reconecte-se para revalidar a sessão.');
    }

    if (isAdmin) {
      const status = await localDb.checkAdminStatus(mailLower);

      // Se for o primeiro dia de acesso do Administrador (sem senha)
      if (!status.hasPassword) {
        if (password && password.length >= 6) {
          await localDb.setAdminPassword(mailLower, password);
        } else {
          const err: any = new Error('Primeiro acesso de Administrador: Por favor, defina a sua palavra-passe de segurança.');
          err.isFirstAdminAccess = true;
          err.adminEmail = mailLower;
          throw err;
        }
      } else {
        if (!password) {
          throw new Error('Por favor, introduza a sua palavra-passe de Administrador.');
        }
        const verify = await localDb.verifyAdminPassword(mailLower, password);
        if (!verify.match) {
          throw new Error('Palavra-passe de administrador incorreta. Por favor, tente novamente.');
        }
      }

      const uid = 'admin_' + mailLower.split('@')[0];
      localStorage.setItem('ateliepro_current_uid', uid);
      localStorage.setItem('ateliepro_current_email', mailLower);
      this.currentSession = { 
        uid, 
        email: mailLower, 
        role: 'admin',
        isAdmin: true, 
        atelie: null 
      };
      localDb.initAdminRealtimeSync();

      try {
        await fetch('/api/auth/neon/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mailLower,
            displayName: 'Administrador FlowTailor',
            uid,
            authProvider: 'email_neon',
          }),
        });
      } catch (e) {
        console.warn('[Neon Admin login sync]:', e);
      }

      this.notify();
      return this.currentSession;
    }

    // Procura ateliê existente
    let atelie = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);

    if (atelie) {
      localStorage.setItem('ateliepro_current_uid', atelie.id);
      localStorage.setItem('ateliepro_current_email', mailLower);
      this.currentSession = { 
        uid: atelie.id, 
        email: mailLower, 
        role: 'atelie_owner',
        isAdmin: false, 
        atelie 
      };
      localDb.initRealtimeSync(atelie.id);
      
      try {
        await fetch('/api/auth/neon/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mailLower,
            displayName: atelie.nome,
            uid: atelie.id,
            authProvider: 'email_neon',
          }),
        });
      } catch (e) {
        console.warn('[Neon Login sync]:', e);
      }

      this.notify();
      return this.currentSession;
    } else {
      const uid = 'atelie_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now().toString(36));
      const newAtelie: Atelie = {
        id: uid,
        nome: `Ateliê de ${email.split('@')[0]}`,
        emailOwner: mailLower,
        telefone: '244923000000',
        plano: 'basico',
        ativo: true,
        dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        criadoEm: new Date().toISOString()
      };
      await localDb.saveAtelie(newAtelie);

      localStorage.setItem('ateliepro_current_uid', uid);
      localStorage.setItem('ateliepro_current_email', mailLower);
      this.currentSession = { 
        uid, 
        email: mailLower, 
        role: 'atelie_owner', 
        isAdmin: false, 
        atelie: newAtelie 
      };
      localDb.initRealtimeSync(uid);

      try {
        await fetch('/api/auth/neon/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mailLower,
            displayName: newAtelie.nome,
            uid,
            authProvider: 'email_neon',
          }),
        });
      } catch (e) {
        console.warn('[Neon New Atelie sync]:', e);
      }

      this.notify();
      return this.currentSession;
    }
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Neon Logout failed:', e);
    }
    localDb.stopRealtimeSync();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ateliepro_current_uid');
      localStorage.removeItem('ateliepro_current_email');
      localStorage.removeItem('ateliepro_admin_credentials');
      localStorage.removeItem('ateliepro_user_credentials');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
    }
    this.currentSession = null;
    this.notify();
  }
}

export const customAuth = new CustomAuthService();
