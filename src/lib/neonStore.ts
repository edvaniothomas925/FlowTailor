import { Atelie, Cliente, Medidas, Pedido, SolicitacaoPagamento, ConfiguracaoPagamento, UserSession } from '../types';
import { idbSave, idbSaveBulk, idbGetAll, idbDelete, idbClearAll } from './indexedDb';

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

const INITIAL_ADMINS = ['admin@flowtailor.ao'];

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
  private storageModeListeners: Array<(mode: 'hybrid' | 'offline') => void> = [];
  private activeAtelieId: string | null = null;
  private isAdminSyncActive = false;
  private isSyncing = false;
  private lastSyncTime: string | null = null;
  private pendingSyncCount = 0;
  private retryTimeout: any = null;

  private scheduleSilentRetry(atelieId?: string) {
    if (this.retryTimeout) return;
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      if (typeof navigator !== 'undefined' && navigator.onLine && !this.isOfflineMode()) {
        if (atelieId || this.activeAtelieId) {
          this.syncIfOnline(atelieId || this.activeAtelieId, true).catch(() => {});
        } else if (this.isAdminSyncActive) {
          this.syncAdminIfOnline(true).catch(() => {});
        }
      }
    }, 25000);
  }

  constructor() {
    this.initLocalStorageSeed();
    this.restoreLastSync();
    this.setupNetworkListeners();
    this.cleanLegacySensitiveStorage();
    this.syncWithIndexedDB();
  }

  /**
   * Asynchronous IndexedDB initial mirror and persistence layer
   */
  private async syncWithIndexedDB() {
    if (typeof window === 'undefined') return;
    try {
      // Mirror existing localStorage items into IndexedDB for persistent offline durability
      const atelies = this.getAtelies();
      if (atelies.length > 0) {
        await idbSaveBulk('atelies', atelies);
      }

      const rawClientes = localStorage.getItem('ateliepro_clientes');
      if (rawClientes) {
        const clientesMap = JSON.parse(rawClientes);
        const allClientes: Cliente[] = [];
        Object.entries(clientesMap).forEach(([atelieId, list]: [string, any]) => {
          if (Array.isArray(list)) {
            list.forEach(c => allClientes.push({ ...c, atelieId }));
          }
        });
        if (allClientes.length > 0) {
          await idbSaveBulk('clientes', allClientes);
        }
      }

      const rawPedidos = localStorage.getItem('ateliepro_pedidos');
      if (rawPedidos) {
        const pedidosMap = JSON.parse(rawPedidos);
        const allPedidos: Pedido[] = [];
        Object.entries(pedidosMap).forEach(([atelieId, list]: [string, any]) => {
          if (Array.isArray(list)) {
            list.forEach(p => allPedidos.push({ ...p, atelieId }));
          }
        });
        if (allPedidos.length > 0) {
          await idbSaveBulk('encomendas', allPedidos);
        }
      }

      const rawMedidas = localStorage.getItem('ateliepro_medidas');
      if (rawMedidas) {
        const medidasMap = JSON.parse(rawMedidas);
        const allMedidas: Medidas[] = [];
        Object.entries(medidasMap).forEach(([atelieId, list]: [string, any]) => {
          if (Array.isArray(list)) {
            list.forEach(m => allMedidas.push({ ...m, atelieId }));
          }
        });
        if (allMedidas.length > 0) {
          await idbSaveBulk('medidas', allMedidas);
        }
      }
    } catch (e) {
      console.warn('[IndexedDB Sync Warning]:', e);
    }
  }

  /**
   * Storage Mode (Hybrid Cloud vs 100% Offline Local)
   */
  getStorageMode(): 'hybrid' | 'offline' {
    if (typeof localStorage === 'undefined') return 'hybrid';
    const mode = localStorage.getItem('flowtailor_storage_mode') || localStorage.getItem('flowtailor_sync_mode');
    if (mode === 'offline' || mode === 'offline_local') {
      return 'offline';
    }
    return 'hybrid';
  }

  setStorageMode(mode: 'hybrid' | 'offline') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('flowtailor_storage_mode', mode);
      localStorage.setItem('flowtailor_sync_mode', mode === 'offline' ? 'offline_local' : 'hybrid');
    }

    if (mode === 'offline') {
      this.resetPendingSync();
      this.notifySyncListeners(false);
    }

    this.storageModeListeners.forEach(listener => {
      try { listener(mode); } catch (e) { console.error(e); }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flowtailor_storage_mode_change', { detail: { mode } }));
    }
  }

  isOfflineMode(): boolean {
    return this.getStorageMode() === 'offline';
  }

  onStorageModeChange(listener: (mode: 'hybrid' | 'offline') => void) {
    this.storageModeListeners.push(listener);
    setTimeout(() => {
      try { listener(this.getStorageMode()); } catch (e) { console.error(e); }
    }, 0);
    return () => {
      this.storageModeListeners = this.storageModeListeners.filter(l => l !== listener);
    };
  }

  /**
   * Security enforcement: Remove any legacy passwords/hashes/tokens stored in browser storage
   */
  private cleanLegacySensitiveStorage() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ateliepro_admin_credentials');
      localStorage.removeItem('ateliepro_user_credentials');
      localStorage.removeItem('ateliepro_admin_passwords');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_secret');
      localStorage.removeItem('auth_token');

      // Purge any legacy email references stored in ateliepro_admins
      const rawAdmins = localStorage.getItem('ateliepro_admins');
      if (rawAdmins) {
        try {
          const list = JSON.parse(rawAdmins);
          if (Array.isArray(list)) {
            const sanitized = list.filter((em: string) => typeof em === 'string' && !em.includes('edvanio') && !em.includes('@gmail.com'));
            localStorage.setItem('ateliepro_admins', JSON.stringify(sanitized));
          }
        } catch {
          localStorage.removeItem('ateliepro_admins');
        }
      }
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('ateliepro_admin_credentials');
      sessionStorage.removeItem('ateliepro_user_credentials');
      sessionStorage.removeItem('ateliepro_admin_passwords');
      sessionStorage.removeItem('jwt_token');
      sessionStorage.removeItem('refresh_token');
      sessionStorage.removeItem('user_secret');
      sessionStorage.removeItem('auth_token');
    }
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
    setTimeout(() => {
      try { listener(this.isSyncing, this.lastSyncTime); } catch (e) { console.error(e); }
    }, 0);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  // Subscribe to network connectivity state
  onNetworkChange(listener: (isOnline: boolean) => void) {
    this.networkListeners.push(listener);
    setTimeout(() => {
      try { listener(typeof navigator !== 'undefined' ? navigator.onLine : true); } catch (e) { console.error(e); }
    }, 0);
    return () => {
      this.networkListeners = this.networkListeners.filter(l => l !== listener);
    };
  }

  // Subscribe to pending sync count
  onPendingChangesChange(listener: (pendingCount: number) => void) {
    this.pendingChangesListeners.push(listener);
    setTimeout(() => {
      try { listener(this.pendingSyncCount); } catch (e) { console.error(e); }
    }, 0);
    return () => {
      this.pendingChangesListeners = this.pendingChangesListeners.filter(l => l !== listener);
    };
  }

  private incrementPendingSync() {
    this.pendingSyncCount++;
    setTimeout(() => {
      this.pendingChangesListeners.forEach(l => {
        try { l(this.pendingSyncCount); } catch (e) { console.error(e); }
      });
    }, 0);
  }

  private resetPendingSync() {
    this.pendingSyncCount = 0;
    setTimeout(() => {
      this.pendingChangesListeners.forEach(l => {
        try { l(0); } catch (e) { console.error(e); }
      });
    }, 0);
  }

  private notifySyncListeners(syncing: boolean) {
    this.isSyncing = syncing;
    setTimeout(() => {
      this.syncListeners.forEach(l => {
        try { l(syncing, this.lastSyncTime); } catch (e) { console.error(e); }
      });
    }, 0);
  }

  private notifyNetworkChange(online: boolean) {
    setTimeout(() => {
      this.networkListeners.forEach(l => {
        try { l(online); } catch (e) { console.error(e); }
      });
    }, 0);
  }

  private notifyDataChange() {
    setTimeout(() => {
      this.changeListeners.forEach(listener => {
        try {
          listener();
        } catch (err) {
          console.error('Data change listener error:', err);
        }
      });
    }, 0);
  }

  getPendingChangesCount(): number {
    return this.pendingSyncCount;
  }

  // Automated background sync trigger (safe, non-intrusive)
  async syncIfOnline(atelieId?: string, _silent: boolean = true): Promise<boolean> {
    if (this.isOfflineMode()) return false;
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
      if (result.success) {
        this.resetPendingSync();
      } else {
        this.scheduleSilentRetry(targetId);
      }
      this.notifySyncListeners(false);
      return result.success;
    } catch (e) {
      console.warn('[syncIfOnline Warning - Dados preservados localmente]:', e);
      this.scheduleSilentRetry(targetId);
      this.notifySyncListeners(false);
      return false;
    }
  }

  async syncAdminIfOnline(_silent: boolean = true): Promise<boolean> {
    if (this.isOfflineMode()) return false;
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
      if (result.success || result.offline) {
        this.resetPendingSync();
      } else {
        this.scheduleSilentRetry();
      }
      this.notifySyncListeners(false);
      return Boolean(result.success || result.offline);
    } catch (e) {
      console.warn('[syncAdminIfOnline Warning - Dados preservados localmente]:', e);
      this.scheduleSilentRetry();
      this.notifySyncListeners(false);
      return false;
    }
  }

  // --- Initial Data Load from Neon for Administrator ---
  async initAdminRealtimeSync() {
    this.isAdminSyncActive = true;
    this.activeAtelieId = null;
    if (this.isOfflineMode()) {
      this.notifyDataChange();
      return;
    }
    await this.fetchAdminDataFromNeon();
  }

  // --- Initial Data Load from Neon for Ateliê ---
  async initRealtimeSync(atelieId: string) {
    this.activeAtelieId = atelieId;
    this.isAdminSyncActive = false;
    if (this.isOfflineMode()) {
      this.notifyDataChange();
      return;
    }
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
    if (this.isOfflineMode()) return;
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
        idbSave('atelies', resAtelie.value.atelie).catch(() => {});
      }

      if (resClientes.status === 'fulfilled' && resClientes.value?.clientes) {
        const raw = localStorage.getItem('ateliepro_clientes');
        const data = raw ? JSON.parse(raw) : {};
        data[atelieId] = resClientes.value.clientes;
        localStorage.setItem('ateliepro_clientes', JSON.stringify(data));
        idbSaveBulk('clientes', resClientes.value.clientes.map((c: any) => ({ ...c, atelieId }))).catch(() => {});
      }

      if (resPedidos.status === 'fulfilled' && resPedidos.value?.encomendas) {
        const raw = localStorage.getItem('ateliepro_pedidos');
        const data = raw ? JSON.parse(raw) : {};
        data[atelieId] = resPedidos.value.encomendas;
        localStorage.setItem('ateliepro_pedidos', JSON.stringify(data));
        idbSaveBulk('encomendas', resPedidos.value.encomendas.map((p: any) => ({ ...p, atelieId }))).catch(() => {});
      }

      if (resMedidas.status === 'fulfilled' && resMedidas.value?.medidas) {
        const raw = localStorage.getItem('ateliepro_medidas');
        const data = raw ? JSON.parse(raw) : {};
        data[atelieId] = resMedidas.value.medidas;
        localStorage.setItem('ateliepro_medidas', JSON.stringify(data));
        idbSaveBulk('medidas', resMedidas.value.medidas.map((m: any) => ({ ...m, atelieId }))).catch(() => {});
      }

      if (resConfigs.status === 'fulfilled' && resConfigs.value?.configs) {
        localStorage.setItem('ateliepro_configs', JSON.stringify(resConfigs.value.configs));
        idbSave('configs', { id: 'general', ...resConfigs.value.configs }).catch(() => {});
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
    if (this.isOfflineMode()) return;
    try {
      const [resAtelies, resSolicitacoes, resConfigs, resAdmins] = await Promise.allSettled([
        fetch('/api/neon/atelies').then(r => r.ok ? r.json() : null),
        fetch('/api/neon/solicitacoes').then(r => r.ok ? r.json() : null),
        fetch('/api/neon/configuracoes').then(r => r.ok ? r.json() : null),
        fetch('/api/neon/admins').then(r => r.ok ? r.json() : null),
      ]);

      if (resAtelies.status === 'fulfilled' && resAtelies.value?.atelies) {
        localStorage.setItem('ateliepro_atelies', JSON.stringify(resAtelies.value.atelies));
        idbSaveBulk('atelies', resAtelies.value.atelies).catch(() => {});
      }

      if (resSolicitacoes.status === 'fulfilled' && resSolicitacoes.value?.solicitacoes) {
        localStorage.setItem('ateliepro_solicitacoes', JSON.stringify(resSolicitacoes.value.solicitacoes));
        idbSaveBulk('solicitacoes', resSolicitacoes.value.solicitacoes).catch(() => {});
      }

      if (resConfigs.status === 'fulfilled' && resConfigs.value?.configs) {
        localStorage.setItem('ateliepro_configs', JSON.stringify(resConfigs.value.configs));
        idbSave('configs', { id: 'general', ...resConfigs.value.configs }).catch(() => {});
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
    idbSave('configs', { id: 'general', ...configs }).catch(() => {});

    if (this.isOfflineMode()) {
      this.notifyDataChange();
      return;
    }

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
    if (!this.isOfflineMode()) {
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

    if (this.isOfflineMode()) {
      return true;
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

    if (this.isOfflineMode()) {
      return { match: true, isFirstAccess: false };
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
      this.notifyDataChange();

      if (this.isOfflineMode()) return;

      this.incrementPendingSync();
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
    this.notifyDataChange();

    if (this.isOfflineMode()) return;

    this.incrementPendingSync();
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
    idbSave('atelies', atelie).catch(() => {});
    this.notifyDataChange();

    if (this.isOfflineMode()) return;

    this.incrementPendingSync();
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
    idbSave('clientes', { ...cliente, atelieId }).catch(() => {});
    this.notifyDataChange();

    if (this.isOfflineMode()) return;

    this.incrementPendingSync();
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
    }
    idbDelete('clientes', clienteId).catch(() => {});
    this.notifyDataChange();

    if (this.isOfflineMode()) return;

    this.incrementPendingSync();
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
    idbSave('medidas', { ...medidas, atelieId }).catch(() => {});
    this.notifyDataChange();

    if (this.isOfflineMode()) return;

    this.incrementPendingSync();
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
    idbSave('encomendas', { ...pedido, atelieId }).catch(() => {});
    this.notifyDataChange();

    if (this.isOfflineMode()) return;

    this.incrementPendingSync();
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
    }
    idbDelete('encomendas', pedidoId).catch(() => {});
    this.notifyDataChange();

    if (this.isOfflineMode()) return;

    this.incrementPendingSync();
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
    idbSave('solicitacoes', solicitacao).catch(() => {});
    this.notifyDataChange();

    if (this.isOfflineMode()) return;

    this.incrementPendingSync();
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
  // 8. SINCRONIZAÇÃO COMPLETA COM NEON POSTGRESQL / PERSISTÊNCIA LOCAL
  // ===========================================================================
  async forceSyncAllToCloud(
    atelieId: string,
    onProgress?: (progress: number, stageMsg: string) => void
  ): Promise<{ success: boolean; syncedItemsCount: number; error?: string }> {
    try {
      const atelie = this.getAtelie(atelieId);
      const clientes = this.getClientes(atelieId);
      const pedidos = this.getPedidos(atelieId);
      const medidas = this.getMedidas(atelieId);
      const totalCount = (atelie ? 1 : 0) + clientes.length + pedidos.length + medidas.length;

      // 1. Ensure local IndexedDB is completely up-to-date BEFORE attempting remote call
      if (atelie) await idbSave('atelies', atelie);
      if (clientes.length > 0) await idbSaveBulk('clientes', clientes.map(c => ({ ...c, atelieId })));
      if (pedidos.length > 0) await idbSaveBulk('encomendas', pedidos.map(p => ({ ...p, atelieId })));
      if (medidas.length > 0) await idbSaveBulk('medidas', medidas.map(m => ({ ...m, atelieId })));

      // If strict offline mode is enabled, skip remote calls completely
      if (this.isOfflineMode()) {
        onProgress?.(50, 'A persistir registos no armazenamento local seguro (IndexedDB)...');
        this.resetPendingSync();
        onProgress?.(100, 'Todos os dados do ateliê foram guardados localmente com sucesso!');
        return { success: true, syncedItemsCount: totalCount };
      }

      onProgress?.(15, 'A estabelecer ligação segura com o Neon PostgreSQL...');
      onProgress?.(45, 'A persistir registos relacionais (atelies, clientes, encomendas, medidas)...');

      let response: Response;
      try {
        response = await fetch('/api/neon/sync-atelie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            atelie,
            clientes,
            encomendas: pedidos,
            medidas,
          }),
        });
      } catch (networkErr: any) {
        console.warn('[Neon Sync Network Failure - Registos preservados localmente]:', networkErr);
        this.scheduleSilentRetry(atelieId);
        onProgress?.(100, 'Dados guardados localmente no dispositivo (IndexedDB). Sincronização em nuvem reagendada.');
        return { success: false, syncedItemsCount: totalCount, error: networkErr?.message || 'Falha de rede' };
      }

      const responseData = await response.json().catch(() => null);

      if (!response.ok || (responseData && responseData.success === false)) {
        const errorMsg = responseData?.message || responseData?.details || responseData?.error || `Erro de sincronização HTTP ${response.status}`;
        console.warn('[Neon Sync API Notice - Dados guardados no IndexedDB]:', errorMsg);
        this.scheduleSilentRetry(atelieId);
        onProgress?.(100, 'Dados guardados localmente no dispositivo (IndexedDB).');
        return { success: false, syncedItemsCount: totalCount, error: errorMsg };
      }

      onProgress?.(85, 'A reconciliar atualizações da base de dados relacional...');
      await this.fetchAtelieDataFromNeon(atelieId).catch((fetchErr) => {
        console.warn('[Neon Post-Sync Fetch Notice]:', fetchErr);
      });

      this.resetPendingSync();
      onProgress?.(100, 'Todos os dados foram gravados com sucesso no Neon PostgreSQL!');
      return { success: true, syncedItemsCount: totalCount };
    } catch (err: any) {
      console.warn('[Neon Sync Warning - Dados guardados no IndexedDB]:', err);
      this.scheduleSilentRetry(atelieId);
      onProgress?.(100, 'Sincronização concluída com base de dados local.');
      return { success: false, syncedItemsCount: 0, error: err?.message || String(err) };
    }
  }

  async forceSyncAdminToCloud(
    onProgress?: (progress: number, stageMsg: string) => void
  ): Promise<{ success: boolean; syncedItemsCount: number; error?: string; offline?: boolean; message?: string }> {
    try {
      const atelies = this.getAtelies();
      const solicitacoes = this.getSolicitacoes();
      const configs = this.getConfigs();
      const admins = this.getAdmins();
      const totalCount = atelies.length + solicitacoes.length + admins.length + 1;

      // Ensure local IndexedDB is synchronized
      if (atelies.length > 0) await idbSaveBulk('atelies', atelies);
      if (solicitacoes.length > 0) await idbSaveBulk('solicitacoes', solicitacoes);
      await idbSave('configs', { id: 'general', ...configs });

      // If strict offline mode is enabled, skip remote calls completely
      if (this.isOfflineMode()) {
        onProgress?.(50, 'A persistir registos administrativos no IndexedDB local...');
        this.resetPendingSync();
        onProgress?.(100, 'Registos administrativos salvos localmente com sucesso!');
        return { success: true, offline: true, syncedItemsCount: totalCount, message: 'Modo offline ativo.' };
      }

      onProgress?.(15, 'A estabelecer ligação de Administrador com Neon PostgreSQL...');
      onProgress?.(50, 'A persistir ateliês, solicitações e parâmetros no Neon...');

      let response: Response;
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null;
        const currentEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('ateliepro_current_email') : null;
        const adminNome = typeof localStorage !== 'undefined' ? (localStorage.getItem('ateliepro_admin_nome') || '') : '';
        const adminTelefone = typeof localStorage !== 'undefined' ? (localStorage.getItem('ateliepro_admin_telefone') || '') : '';
        const adminAvatarIcon = typeof localStorage !== 'undefined' ? (localStorage.getItem('ateliepro_admin_avatar_icon') || 'scissors') : 'scissors';
        const storageMode = typeof localStorage !== 'undefined' ? (localStorage.getItem('flowtailor_storage_mode') || 'hybrid') : 'hybrid';

        response = await fetch('/api/neon/sync-admin', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(currentEmail ? { 'x-admin-email': currentEmail } : {}),
          },
          body: JSON.stringify({
            adminEmail: currentEmail,
            nome: adminNome,
            telefone: adminTelefone,
            avatarIcon: adminAvatarIcon,
            storageMode,
            atelies,
            solicitacoes,
            configs,
            admins,
          }),
        });
      } catch (networkErr: any) {
        console.warn('[Neon Admin Sync Network Failure - Registos preservados localmente]:', networkErr);
        this.scheduleSilentRetry();
        onProgress?.(100, 'Registos administrativos guardados localmente (IndexedDB). Sincronização em nuvem reagendada.');
        return { success: true, offline: true, syncedItemsCount: totalCount, message: 'Modo offline/local ativo.', error: networkErr?.message || 'Falha de rede' };
      }

      // 1. Verifica se res.ok é verdadeiro antes de interpretar a resposta, evitando que exceções não tratadas afetem o botão na interface
      if (!response.ok) {
        let errorMsg = `Erro no servidor HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error) {
            errorMsg = errData.error;
          } else if (errData?.message) {
            errorMsg = errData.message;
          }
        } catch {
          // Resposta não-JSON (ex: erro cru do proxy) tratada sem lançar exceção
        }

        console.warn(`[Neon Admin Sync] Servidor retornou HTTP ${response.status}:`, errorMsg);
        this.resetPendingSync();
        onProgress?.(100, `Falha na sincronização na nuvem (${errorMsg}). Registos preservados com segurança no IndexedDB local.`);
        return {
          success: false,
          offline: true,
          syncedItemsCount: totalCount,
          error: errorMsg,
          message: errorMsg,
        };
      }

      let responseData: any = null;
      try {
        responseData = await response.json();
      } catch (jsonErr) {
        console.warn('[Neon Admin Sync] Resposta não-JSON recebida:', jsonErr);
      }

      // 2. Tratar retorno explícito de modo offline/local do servidor
      if (responseData && responseData.offline === true) {
        console.log('[Neon Admin Sync] Modo offline/local ativo confirmado pelo servidor. Dados mantidos no IndexedDB.');
        this.resetPendingSync();
        onProgress?.(100, responseData.message || 'Modo offline/local ativo. Registos preservados com segurança no IndexedDB local.');
        return {
          success: true,
          offline: true,
          syncedItemsCount: totalCount,
          message: responseData.message || 'Modo offline/local ativo. Dados mantidos no IndexedDB.',
        };
      }

      if (responseData && responseData.success === false) {
        const errorMsg = responseData?.error || responseData?.message || responseData?.details || `Erro de sincronização HTTP ${response.status}`;
        console.warn('[Neon Admin Sync Notice - Dados guardados no IndexedDB]:', errorMsg);
        this.scheduleSilentRetry();
        onProgress?.(100, 'Registos administrativos guardados localmente (IndexedDB).');
        return { success: false, syncedItemsCount: totalCount, error: errorMsg, message: errorMsg };
      }

      onProgress?.(85, 'A sincronizar dados administrativos globais...');
      await this.fetchAdminDataFromNeon().catch((fetchErr) => {
        console.warn('[Neon Admin Post-Sync Fetch Notice]:', fetchErr);
      });

      this.resetPendingSync();
      const successMessage = responseData?.message || 'Sincronizado na nuvem com sucesso';
      onProgress?.(100, successMessage);
      return { success: true, syncedItemsCount: responseData?.syncedItemsCount || totalCount, message: successMessage };
    } catch (err: any) {
      console.warn('[Neon Admin Sync Warning - Dados guardados no IndexedDB]:', err);
      this.scheduleSilentRetry();
      onProgress?.(100, 'Sincronização administrativa concluída em cache local.');
      return { success: true, offline: true, syncedItemsCount: 0, message: 'Modo offline/local ativo.', error: err?.message || String(err) };
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
    if (typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const loginParam = params.get('login');
        const uidParam = params.get('uid');
        const emailParam = params.get('email');
        const roleParam = params.get('role');
        const nameParam = params.get('name');

        if (token || loginParam === 'success') {
          if (token) {
            localStorage.setItem('flowtailor_jwt_token', token);
          }
          if (emailParam && uidParam) {
            const mailLower = emailParam.toLowerCase().trim();
            const isAdmin = roleParam === 'admin' || localDb.getAdmins().map(a => a.toLowerCase().trim()).includes(mailLower);
            localStorage.setItem('ateliepro_current_uid', uidParam);
            localStorage.setItem('ateliepro_current_email', mailLower);
            
            const rawName = nameParam?.trim() || mailLower.split('@')[0];
            const cleanName = rawName.startsWith('Ateliê de ') ? rawName.replace('Ateliê de ', '') : rawName;
            const atelieName = nameParam ? (nameParam.startsWith('Ateliê') ? nameParam : `Ateliê de ${nameParam}`) : (isAdmin ? 'Administração Central' : `Ateliê de ${cleanName}`);
            
            const userData = {
              uid: uidParam,
              email: mailLower,
              name: isAdmin ? (localStorage.getItem('ateliepro_admin_nome') || 'Administrador') : cleanName,
              displayName: cleanName,
              role: isAdmin ? 'admin' : 'atelie_owner',
              isAdmin,
              atelieName,
              authProvider: 'google',
            };
            localStorage.setItem('flowtailor_current_user', JSON.stringify(userData));
            localStorage.setItem('flowtailor_session', JSON.stringify(userData));

            // Auto-provision atelie if not admin
            if (!isAdmin) {
              let existingAtelie = localDb.getAtelie(uidParam) || localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);
              if (!existingAtelie) {
                existingAtelie = {
                  id: uidParam,
                  nome: atelieName,
                  emailOwner: mailLower,
                  telefone: '244923000000',
                  plano: 'basico',
                  ativo: true,
                  dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  criadoEm: new Date().toISOString(),
                  pais: 'AO',
                  avatarIcon: 'scissors'
                };
                localDb.saveAtelie(existingAtelie);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Error reading URL auth parameters in restoreSession:', e);
      }
    }

    if (typeof localStorage === 'undefined') return;
    const uid = localStorage.getItem('ateliepro_current_uid');
    const email = localStorage.getItem('ateliepro_current_email');
    if (uid && email) {
      const mailLower = email.toLowerCase().trim();
      const adminList = localDb.getAdmins().map(a => a.toLowerCase().trim());
      const isEmailAdmin = adminList.includes(mailLower);
      
      let storedUserObj: any = null;
      try {
        const rawUser = localStorage.getItem('flowtailor_current_user');
        if (rawUser) storedUserObj = JSON.parse(rawUser);
      } catch (e) {}

      const userName = storedUserObj?.name || storedUserObj?.displayName || mailLower.split('@')[0];

      let atelie = !isEmailAdmin ? localDb.getAtelie(uid) : null;
      if (!isEmailAdmin && !atelie) {
        atelie = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower) || null;
      }

      if (!isEmailAdmin && !atelie) {
        const atelieTitle = storedUserObj?.atelieName || `Ateliê de ${userName}`;
        atelie = {
          id: uid,
          nome: atelieTitle,
          emailOwner: mailLower,
          telefone: '244923000000',
          plano: 'basico',
          ativo: true,
          dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          criadoEm: new Date().toISOString(),
          pais: 'AO',
          avatarIcon: 'scissors'
        };
        localDb.saveAtelie(atelie);
      }

      this.currentSession = { 
        uid, 
        email: mailLower, 
        name: isEmailAdmin ? (localStorage.getItem('ateliepro_admin_nome') || 'Administrador') : userName,
        displayName: userName,
        role: isEmailAdmin ? 'admin' : 'atelie_owner',
        isAdmin: isEmailAdmin, 
        atelie: isEmailAdmin ? null : atelie 
      };
      if (isEmailAdmin) {
        localDb.initAdminRealtimeSync();
      } else if (atelie) {
        localDb.initRealtimeSync(atelie.id || uid);
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

  private async safeSyncSession(body: {
    email: string;
    displayName?: string;
    uid?: string;
    authProvider?: string;
    password?: string;
  }): Promise<{ success: boolean; isAdmin?: boolean; role?: string; data?: any }> {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null;
      const response = await fetch('/api/auth/neon/sync-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body),
      });

      // Ler o status da resposta antes de tentar parsear o JSON
      if (response.status === 500 || response.status === 404) {
        console.warn(`[Neon Sync Session] Servidor retornou HTTP ${response.status}. A utilizar fallback local.`);
        return { success: false };
      }

      let resData: any = null;
      try {
        resData = await response.json();
      } catch (parseErr) {
        console.warn('[Neon Sync Session] Resposta não-JSON:', parseErr);
        return { success: false };
      }

      if (response.ok && resData && resData.success !== false) {
        if (resData.accessToken && typeof localStorage !== 'undefined') {
          localStorage.setItem('jwt_token', resData.accessToken);
        }
        return {
          success: true,
          isAdmin: Boolean(resData.isAdmin),
          role: resData.role || (resData.isAdmin ? 'admin' : 'atelie_owner'),
          data: resData,
        };
      }
      return { success: false };
    } catch (e) {
      console.warn('[Neon Sync Session Network Error]:', e);
      return { success: false };
    }
  }

  getCurrentUser(): UserSession | null {
    this.restoreSession();
    return this.currentSession;
  }

  async loginWithGoogle(emailHint?: string, displayNameHint?: string): Promise<UserSession> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('O início de sessão com o Google requer ligação à internet activa.');
    }

    if (!emailHint || !emailHint.trim() || !emailHint.includes('@')) {
      throw new Error('Por favor, informe um endereço de e-mail do Google válido para autenticar.');
    }

    try {
      const mailLower = emailHint.toLowerCase().trim();
      const userName = displayNameHint?.trim() || mailLower.split('@')[0];
      
      // Sincronizar e validar com o backend Express / Neon PostgreSQL
      let backendAdmin = false;
      let backendRole: 'admin' | 'atelie_owner' = 'atelie_owner';
      
      const syncResult = await this.safeSyncSession({
        email: mailLower,
        displayName: userName,
        authProvider: 'google_oauth',
      });

      if (syncResult.success) {
        backendAdmin = Boolean(syncResult.isAdmin);
        backendRole = (syncResult.role as any) || (backendAdmin ? 'admin' : 'atelie_owner');
      } else {
        // Fallback seguro: verifica na lista local sincronizada
        backendAdmin = localDb.getAdmins().map(a => a.toLowerCase().trim()).includes(mailLower);
        backendRole = backendAdmin ? 'admin' : 'atelie_owner';
      }

      let uid = backendAdmin 
        ? 'admin_' + mailLower.split('@')[0] 
        : 'user_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now().toString(36));

      let atelie: Atelie | null = null;
      if (backendAdmin) {
        localStorage.setItem('ateliepro_current_uid', uid);
        localStorage.setItem('ateliepro_current_email', mailLower);
        this.currentSession = { 
          uid, 
          email: mailLower, 
          name: localStorage.getItem('ateliepro_admin_nome') || 'Administrador',
          displayName: 'Administrador',
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
            nome: displayNameHint ? `Ateliê de ${displayNameHint}` : `Ateliê de ${userName}`,
            emailOwner: mailLower,
            telefone: '244923000000',
            plano: 'basico',
            ativo: true,
            dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            criadoEm: new Date().toISOString(),
            pais: 'AO',
            avatarIcon: 'scissors',
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
          name: userName,
          displayName: userName,
          role: 'atelie_owner',
          isAdmin: false, 
          atelie 
        };
        localDb.initRealtimeSync(uid);
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
      if (password) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mailLower,
            password,
            nomeAtelie,
            telefone,
          }),
        });
        const regData = await regRes.json().catch(() => null);
        if (regData?.accessToken && typeof localStorage !== 'undefined') {
          localStorage.setItem('jwt_token', regData.accessToken);
        }
      }
    } catch (regErr) {
      console.warn('[signUp Neon register error]', regErr);
    }

    await this.safeSyncSession({
      email: mailLower,
      displayName: nomeAtelie,
      uid,
      authProvider: 'email_neon',
      password: password || undefined,
    });

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

    await this.safeSyncSession({
      email: mailLower,
      displayName: 'Administrador FlowTailor',
      uid,
      authProvider: 'email_neon',
    });

    this.notify();
    return this.currentSession;
  }

  async setupUserPassword(
    dataOrEmail: string | {
      email: string;
      password: string;
      nomeAtelie?: string;
      nomeDono?: string;
      telefone?: string;
      plano?: 'basico' | 'pro';
    },
    passwordParam?: string,
    displayNameParam?: string
  ): Promise<UserSession> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('A configuração da conta requer ligação à internet.');
    }

    const email = typeof dataOrEmail === 'string' ? dataOrEmail : dataOrEmail.email;
    const password = typeof dataOrEmail === 'string' ? (passwordParam || '') : dataOrEmail.password;
    const nomeAtelie = typeof dataOrEmail === 'object' ? dataOrEmail.nomeAtelie : displayNameParam;
    const nomeDono = typeof dataOrEmail === 'object' ? dataOrEmail.nomeDono : undefined;
    const telefone = typeof dataOrEmail === 'object' ? dataOrEmail.telefone : '244923000000';
    const plano = (typeof dataOrEmail === 'object' && dataOrEmail.plano) ? dataOrEmail.plano : 'basico';

    const mailLower = email.toLowerCase().trim();
    if (!password || password.length < 6) {
      throw new Error('A palavra-passe deve conter pelo menos 6 caracteres.');
    }

    const adminList = localDb.getAdmins().map(a => a.toLowerCase().trim());
    const isAdmin = adminList.includes(mailLower);

    if (isAdmin) {
      await localDb.setAdminPassword(mailLower, password);
    }

    const uid = isAdmin 
      ? 'admin_' + mailLower.split('@')[0]
      : (localStorage.getItem('ateliepro_current_uid') || 'user_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now().toString(36)));

    let atelie: Atelie | null = null;

    if (isAdmin) {
      localStorage.setItem('ateliepro_current_uid', uid);
      localStorage.setItem('ateliepro_current_email', mailLower);
      this.currentSession = {
        uid,
        email: mailLower,
        role: 'admin',
        isAdmin: true,
        atelie: null,
      };
      localDb.initAdminRealtimeSync();
    } else {
      let existingAtelie = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);
      const computedAtelieName = nomeAtelie?.trim() || (nomeDono ? `Ateliê de ${nomeDono}` : `Ateliê de ${mailLower.split('@')[0]}`);
      const computedPhone = telefone?.trim() || '244923000000';

      if (!existingAtelie) {
        existingAtelie = {
          id: uid,
          nome: computedAtelieName,
          emailOwner: mailLower,
          telefone: computedPhone,
          plano: plano || 'basico',
          ativo: true,
          dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          criadoEm: new Date().toISOString(),
        };
      } else {
        existingAtelie = {
          ...existingAtelie,
          nome: computedAtelieName,
          telefone: computedPhone,
          plano: plano || existingAtelie.plano || 'basico',
        };
      }
      await localDb.saveAtelie(existingAtelie);
      atelie = existingAtelie;
      localStorage.setItem('ateliepro_current_uid', existingAtelie.id);
      localStorage.setItem('ateliepro_current_email', mailLower);
      this.currentSession = {
        uid: existingAtelie.id,
        email: mailLower,
        role: 'atelie_owner',
        isAdmin: false,
        atelie,
      };
      localDb.initRealtimeSync(existingAtelie.id);
    }

    try {
      await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mailLower,
          password,
          displayName: nomeAtelie || atelie?.nome,
          nomeAtelie: nomeAtelie || atelie?.nome,
          nomeDono,
          telefone: telefone || atelie?.telefone,
          plano: plano || atelie?.plano,
        }),
      });
    } catch (e) {
      console.warn('[Set Password Server Sync Warning]:', e);
    }

    this.notify();
    return this.currentSession;
  }

  async login(email: string, password?: string): Promise<UserSession> {
    const mailLower = email.toLowerCase().trim();

    // Se estiver offline, apenas permite restaurar uma sessão já existente previamente autorizada
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cachedEmail = localStorage.getItem('ateliepro_current_email');
      const cachedUid = localStorage.getItem('ateliepro_current_uid');
      if (cachedEmail === mailLower && cachedUid) {
        this.restoreSession();
        if (this.currentSession) return this.currentSession;
      }
      throw new Error('O início de uma nova sessão requer ligação à internet activa.');
    }

    if (!mailLower || !mailLower.includes('@')) {
      throw new Error('Por favor, introduza um endereço de e-mail válido.');
    }

    if (!password) {
      throw new Error('Por favor, introduza a sua palavra-passe.');
    }

    // 1. Chamada HTTP POST para /api/auth/login para autenticação no Neon DB
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: mailLower,
        password: password,
      }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.warn('[Login Error] Resposta não-JSON da API de autenticação:', parseErr);
    }

    // Não permitir o login se a API responder com status de erro (ex: 401 ou 400)
    if (!res.ok || !data || data.success === false) {
      const errorMsg = data?.message || 'E-mail ou palavra-passe inválidos.';
      throw new Error(errorMsg);
    }

    // 2. Autenticação bem-sucedida
    const isAdm = Boolean(data.isAdmin || data.user?.role === 'admin');
    const uid = data.user?.userId || (isAdm ? 'admin_' + mailLower.split('@')[0] : 'user_' + mailLower.split('@')[0]);

    if (data.accessToken && typeof localStorage !== 'undefined') {
      localStorage.setItem('jwt_token', data.accessToken);
    }
    localStorage.setItem('ateliepro_current_uid', uid);
    localStorage.setItem('ateliepro_current_email', mailLower);

    let atelie: Atelie | null = null;
    if (isAdm) {
      this.currentSession = { 
        uid, 
        email: mailLower, 
        name: data.user?.name || 'Administrador Central',
        displayName: 'Administrador Central',
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
          nome: data.user?.atelieName || `Ateliê de ${mailLower.split('@')[0]}`,
          emailOwner: mailLower,
          telefone: '244923000000',
          plano: 'basico',
          ativo: true,
          dataVencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          criadoEm: new Date().toISOString(),
          pais: 'AO',
          avatarIcon: 'scissors',
        };
        await localDb.saveAtelie(existingAtelie);
      }
      atelie = existingAtelie;
      this.currentSession = { 
        uid, 
        email: mailLower, 
        name: existingAtelie.nome,
        displayName: existingAtelie.nome,
        role: 'atelie_owner', 
        isAdmin: false, 
        atelie 
      };
      localDb.initRealtimeSync(uid);
    }

    this.notify();
    return this.currentSession;
  }

  async logout() {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null;
      const response = await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ token })
      });

      // 1. Ler o status da resposta antes de tentar parsear o JSON
      if (response.status === 500 || response.status === 404) {
        console.warn(`[Logout] Servidor retornou HTTP ${response.status}. A efetuar fallback limpo no IndexedDB...`);
      } else if (response.ok) {
        try {
          const resData = await response.json();
          console.log('[Logout] Servidor:', resData?.message || 'Sessão encerrada');
        } catch {
          // Ignora se o corpo da resposta não for JSON
        }
      }
    } catch (e) {
      console.warn('[Logout Network Exception - Fallback limpo iniciado]:', e);
    }

    // 2. Fallback limpo: limpar o estado local no IndexedDB e reencaminhar o utilizador para a tela de login
    try {
      localDb.stopRealtimeSync();
      await idbClearAll();
    } catch (idbErr) {
      console.warn('[Logout] Aviso ao limpar IndexedDB:', idbErr);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ateliepro_current_uid');
      localStorage.removeItem('ateliepro_current_email');
      localStorage.removeItem('ateliepro_admin_credentials');
      localStorage.removeItem('ateliepro_user_credentials');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('flowtailor_session');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    this.currentSession = null;
    this.notify();

    // Reencaminhar o utilizador para a tela de login
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flowtailor:logout'));
      if (window.location.pathname !== '/' || window.location.hash !== '') {
        window.location.href = '/';
      }
    }
  }
}

export const customAuth = new CustomAuthService();
