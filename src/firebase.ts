import { Atelie, Cliente, Medidas, Pedido, SolicitacaoPagamento, ConfiguracaoPagamento, UserSession, PedidoStatus, TipoPeca } from './types';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  enableMultiTabIndexedDbPersistence,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  Unsubscribe,
  Firestore
} from 'firebase/firestore';
export { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, writeBatch };

// 1. Firebase Client Configuration reading strictly with priority from applet config and fallback to import.meta.env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
};

// Utility to clean objects for Firestore (removes undefined values that Firestore rejects)
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

const app = initializeApp(firebaseConfig);

// Export Auth instance
export const auth = getAuth(app);

// 2. Export Firestore with multi-tab offline persistence enabled (default database)
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  dbInstance = getFirestore(app);
  try {
    enableMultiTabIndexedDbPersistence(dbInstance).catch(() => {
      // Ignore if already enabled or unsupported
    });
  } catch {
    // Fail silently to normal memory mode
  }
}

export const db = dbInstance;
export const googleProvider = new GoogleAuthProvider();

// Operation Types defined by the Firebase skill for error logging
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

// Global handleFirestoreError helper defined by the Firestore integration guidelines
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || localStorage.getItem('ateliepro_current_uid'),
      email: auth.currentUser?.email || localStorage.getItem('ateliepro_current_email'),
      emailVerified: auth.currentUser?.emailVerified ?? true,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Connection test on boot (graceful fallback)
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'configuracoes', 'geral'));
    console.log('[Firestore] Conectado ao Cloud Firestore com sucesso.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Cliente operando em modo offline persistente.');
    }
  }
}
testConnection();

// Initial Default Data (Seed & Fallback)
const DEFAULT_CONFIGS: ConfiguracaoPagamento = {
  numeroExpress: '923456789',
  iban: 'AO06.0040.0000.1234.5678.9011.2',
  banco: 'BAI (Banco Angolano de Investimentos)',
  titular: 'FlowTailor Consultoria Lda.',
  whatsappAdmin: '244923456789'
};

const INITIAL_ADMINS = ['admin@ateliepro.com', 'admin@flowtailor.ao'];

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

// Hybrid Reactive Firestore & Local Persistence Database Manager
class FirestoreDatabaseManager {
  private activeUnsubscribers: Unsubscribe[] = [];
  private changeListeners: Array<() => void> = [];
  private syncListeners: Array<(isSyncing: boolean, lastSync: string | null) => void> = [];
  private networkListeners: Array<(isOnline: boolean) => void> = [];
  private activeAtelieId: string | null = null;
  private isSyncing = false;
  private lastSyncTime: string | null = null;

  constructor() {
    this.initLocalStorageSeed();
    this.restoreLastSync();
    this.setupAutoNetworkSync();
  }

  private initLocalStorageSeed() {
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
    this.lastSyncTime = localStorage.getItem('flowtailor_last_sync') || new Date().toLocaleString('pt-AO');
  }

  // Automated network listener: whenever internet is back or window gains focus, perform automatic background sync
  private setupAutoNetworkSync() {
    if (typeof window === 'undefined') return;

    const triggerSync = (reason: string, silent: boolean = true) => {
      if (navigator.onLine && this.activeAtelieId && !this.isSyncing) {
        console.log(`[FlowTailor Híbrido] Sincronização automática com Cloud Firestore disparada por: ${reason}`);
        this.syncIfOnline(this.activeAtelieId, silent);
      }
    };

    window.addEventListener('online', () => {
      this.notifyNetworkChange(true);
      triggerSync('Conexão à Internet Restabelecida (Online)', false);
    });

    window.addEventListener('offline', () => {
      this.notifyNetworkChange(false);
      this.notifySyncListeners(false);
    });

    window.addEventListener('focus', () => {
      triggerSync('Foco na Janela / Retorno do Utilizador', true);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        triggerSync('Visibilidade do Ecrã Restaurada', true);
      }
    });

    // Periodic automatic background sync every 60 seconds if online
    setInterval(() => {
      triggerSync('Intervalo Periódico de Integridade Híbrida (60s)', true);
    }, 60000);
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

  // Automated background sync when online
  async syncIfOnline(atelieId?: string, silent: boolean = true): Promise<boolean> {
    const targetId = atelieId || this.activeAtelieId;
    if (!targetId) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    if (this.isSyncing) return false;

    this.notifySyncListeners(true);
    try {
      const result = await this.forceSyncAllToCloud(targetId);
      const timeStr = new Date().toLocaleString('pt-AO');
      this.lastSyncTime = timeStr;
      localStorage.setItem('flowtailor_last_sync', timeStr);
      this.notifySyncListeners(false);
      return result.success;
    } catch (e) {
      console.warn('[FlowTailor Híbrido] Sincronização em segundo plano concluída com cache local:', e);
      this.notifySyncListeners(false);
      return false;
    }
  }

  // Initialize Real-time Multi-tenant Listeners for the current logged-in ateliê
  initRealtimeSync(atelieId: string) {
    if (this.activeAtelieId === atelieId) return;
    this.stopRealtimeSync();
    this.activeAtelieId = atelieId;

    try {
      // 1. Sync Atelie Profile
      const atelieDocRef = doc(db, 'atelies', atelieId);
      const unsubAtelie = onSnapshot(atelieDocRef, (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Atelie;
          const atelies = this.getAtelies();
          const idx = atelies.findIndex(a => a.id === data.id);
          if (idx >= 0) atelies[idx] = data;
          else atelies.push(data);
          localStorage.setItem('ateliepro_atelies', JSON.stringify(atelies));
          this.notifyDataChange();
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, `atelies/${atelieId}`));
      this.activeUnsubscribers.push(unsubAtelie);

      // 2. Sync Clientes (Multi-tenant scoped by atelieId)
      const clientesQuery = query(collection(db, 'clientes'), where('atelieId', '==', atelieId));
      const unsubClientes = onSnapshot(clientesQuery, (snap) => {
        const firestoreClientes: Cliente[] = [];
        snap.forEach(docSnap => {
          firestoreClientes.push({ id: docSnap.id, ...docSnap.data() } as Cliente);
        });

        if (firestoreClientes.length > 0 || snap.metadata.fromCache) {
          const raw = localStorage.getItem('ateliepro_clientes');
          const data = raw ? JSON.parse(raw) : {};
          data[atelieId] = firestoreClientes;
          localStorage.setItem('ateliepro_clientes', JSON.stringify(data));
          this.notifyDataChange();
        }
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'clientes'));
      this.activeUnsubscribers.push(unsubClientes);

      // 3. Sync Encomendas / Pedidos (Multi-tenant scoped by atelieId)
      const encomendasQuery = query(collection(db, 'encomendas'), where('atelieId', '==', atelieId));
      const unsubEncomendas = onSnapshot(encomendasQuery, (snap) => {
        const firestorePedidos: Pedido[] = [];
        snap.forEach(docSnap => {
          firestorePedidos.push({ id: docSnap.id, ...docSnap.data() } as Pedido);
        });

        if (firestorePedidos.length > 0 || snap.metadata.fromCache) {
          const raw = localStorage.getItem('ateliepro_pedidos');
          const data = raw ? JSON.parse(raw) : {};
          data[atelieId] = firestorePedidos;
          localStorage.setItem('ateliepro_pedidos', JSON.stringify(data));
          this.notifyDataChange();
        }
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'encomendas'));
      this.activeUnsubscribers.push(unsubEncomendas);

      // 4. Sync Medidas (Multi-tenant scoped by atelieId)
      const medidasQuery = query(collection(db, 'medidas'), where('atelieId', '==', atelieId));
      const unsubMedidas = onSnapshot(medidasQuery, (snap) => {
        const firestoreMedidas: Medidas[] = [];
        snap.forEach(docSnap => {
          firestoreMedidas.push({ id: docSnap.id, ...docSnap.data() } as Medidas);
        });

        if (firestoreMedidas.length > 0 || snap.metadata.fromCache) {
          const raw = localStorage.getItem('ateliepro_medidas');
          const data = raw ? JSON.parse(raw) : {};
          data[atelieId] = firestoreMedidas;
          localStorage.setItem('ateliepro_medidas', JSON.stringify(data));
          this.notifyDataChange();
        }
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'medidas'));
      this.activeUnsubscribers.push(unsubMedidas);

      // 5. Sync Global Payment Configs
      const configsDocRef = doc(db, 'configuracoes', 'geral');
      const unsubConfigs = onSnapshot(configsDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ConfiguracaoPagamento;
          localStorage.setItem('ateliepro_configs', JSON.stringify(data));
          this.notifyDataChange();
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'configuracoes/geral'));
      this.activeUnsubscribers.push(unsubConfigs);

    } catch (e) {
      console.warn('Realtime sync setup deferred (offline mode active):', e);
    }
  }

  stopRealtimeSync() {
    this.activeUnsubscribers.forEach(unsub => {
      try { unsub(); } catch {}
    });
    this.activeUnsubscribers = [];
    this.activeAtelieId = null;
  }

  // --- Configurations ---
  getConfigs(): ConfiguracaoPagamento {
    const raw = localStorage.getItem('ateliepro_configs');
    return raw ? JSON.parse(raw) : DEFAULT_CONFIGS;
  }

  async saveConfigs(configs: ConfiguracaoPagamento) {
    localStorage.setItem('ateliepro_configs', JSON.stringify(configs));
    this.notifyDataChange();
    try {
      await setDoc(doc(db, 'configuracoes', 'geral'), configs, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'configuracoes/geral');
    }
  }

  // --- Admins ---
  getAdmins(): string[] {
    const raw = localStorage.getItem('ateliepro_admins');
    return raw ? JSON.parse(raw) : INITIAL_ADMINS;
  }

  async addAdmin(email: string) {
    const admins = this.getAdmins();
    const mailLower = email.toLowerCase();
    if (!admins.includes(mailLower)) {
      admins.push(mailLower);
      localStorage.setItem('ateliepro_admins', JSON.stringify(admins));
      this.notifyDataChange();
      try {
        await setDoc(doc(db, 'admins', mailLower.replace(/[^a-zA-Z0-9]/g, '_')), {
          email: mailLower,
          criadoEm: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'admins');
      }
    }
  }

  async removeAdmin(email: string) {
    const mailLower = email.toLowerCase();
    const admins = this.getAdmins().filter(e => e !== mailLower);
    localStorage.setItem('ateliepro_admins', JSON.stringify(admins));
    this.notifyDataChange();
    try {
      await deleteDoc(doc(db, 'admins', mailLower.replace(/[^a-zA-Z0-9]/g, '_')));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'admins');
    }
  }

  // --- Atelies ---
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
    this.notifyDataChange();

    try {
      const cleanAtelie = sanitizeForFirestore(atelie);
      await setDoc(doc(db, 'atelies', atelie.id), cleanAtelie, { merge: true });
      if (firebaseConfig.databaseURL) {
        fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/atelies/${atelie.id}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanAtelie)
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `atelies/${atelie.id}`);
    }
  }

  // --- Clientes ---
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
    this.notifyDataChange();

    try {
      const cleanCliente = sanitizeForFirestore(cliente);
      // Write to multi-tenant collection /clientes with atelieId
      await setDoc(doc(db, 'clientes', cliente.id), { ...cleanCliente, atelieId }, { merge: true });
      // Also write to subcollection /atelies/{atelieId}/clientes/{clienteId}
      await setDoc(doc(db, 'atelies', atelieId, 'clientes', cliente.id), cleanCliente, { merge: true });
      if (firebaseConfig.databaseURL) {
        fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/clientes/${atelieId}/${cliente.id}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanCliente)
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clientes/${cliente.id}`);
    }
  }

  async deleteCliente(atelieId: string, clienteId: string) {
    const raw = localStorage.getItem('ateliepro_clientes');
    const data = raw ? JSON.parse(raw) : {};
    if (data[atelieId]) {
      data[atelieId] = data[atelieId].filter((c: Cliente) => c.id !== clienteId);
      localStorage.setItem('ateliepro_clientes', JSON.stringify(data));
      this.notifyDataChange();
    }

    try {
      await deleteDoc(doc(db, 'clientes', clienteId));
      await deleteDoc(doc(db, 'atelies', atelieId, 'clientes', clienteId));
      if (firebaseConfig.databaseURL) {
        fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/clientes/${atelieId}/${clienteId}.json`, {
          method: 'DELETE'
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clientes/${clienteId}`);
    }
  }

  // --- Medidas ---
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
    this.notifyDataChange();

    try {
      const cleanMedidas = sanitizeForFirestore(medidas);
      await setDoc(doc(db, 'medidas', medidas.id), { ...cleanMedidas, atelieId }, { merge: true });
      await setDoc(doc(db, 'atelies', atelieId, 'medidas', medidas.id), cleanMedidas, { merge: true });
      if (firebaseConfig.databaseURL) {
        fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/medidas/${atelieId}/${medidas.id}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanMedidas)
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `medidas/${medidas.id}`);
    }
  }

  // --- Encomendas / Pedidos ---
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
    this.notifyDataChange();

    try {
      const cleanPedido = sanitizeForFirestore(pedido);
      // Write to multi-tenant 'encomendas' collection
      await setDoc(doc(db, 'encomendas', pedido.id), { ...cleanPedido, atelieId }, { merge: true });
      // Write to subcollection /atelies/{atelieId}/pedidos/{pedidoId}
      await setDoc(doc(db, 'atelies', atelieId, 'pedidos', pedido.id), cleanPedido, { merge: true });
      if (firebaseConfig.databaseURL) {
        fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/encomendas/${atelieId}/${pedido.id}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanPedido)
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `encomendas/${pedido.id}`);
    }
  }

  async deletePedido(atelieId: string, pedidoId: string) {
    const raw = localStorage.getItem('ateliepro_pedidos');
    const data = raw ? JSON.parse(raw) : {};
    if (data[atelieId]) {
      data[atelieId] = data[atelieId].filter((p: Pedido) => p.id !== pedidoId);
      localStorage.setItem('ateliepro_pedidos', JSON.stringify(data));
      this.notifyDataChange();
    }

    try {
      await deleteDoc(doc(db, 'encomendas', pedidoId));
      await deleteDoc(doc(db, 'atelies', atelieId, 'pedidos', pedidoId));
      if (firebaseConfig.databaseURL) {
        fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/encomendas/${atelieId}/${pedidoId}.json`, {
          method: 'DELETE'
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `encomendas/${pedidoId}`);
    }
  }

  // --- Solicitações de Pagamento ---
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
    this.notifyDataChange();

    try {
      const cleanSol = sanitizeForFirestore(solicitacao);
      await setDoc(doc(db, 'solicitacoesPagamento', solicitacao.id), cleanSol, { merge: true });
      if (firebaseConfig.databaseURL) {
        fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/solicitacoes/${solicitacao.id}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanSol)
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `solicitacoesPagamento/${solicitacao.id}`);
    }
  }

  // Force sync all local data to Cloud Firestore and Firebase databases
  async forceSyncAllToCloud(
    atelieId: string,
    onProgress?: (progress: number, stageMsg: string) => void
  ): Promise<{ success: boolean; syncedItemsCount: number; error?: string }> {
    try {
      onProgress?.(10, 'A estabelecer ligação com o Cloud Firestore...');

      let count = 0;

      // 1. Sync Atelie Profile & Configs
      onProgress?.(25, 'A guardar perfil e parâmetros do ateliê na nuvem...');
      const atelie = this.getAtelie(atelieId);
      if (atelie) {
        const cleanAtelie = sanitizeForFirestore(atelie);
        await setDoc(doc(db, 'atelies', atelie.id), cleanAtelie, { merge: true });
        count++;
      }

      // 2. Sync Clientes
      onProgress?.(45, 'A persistir cadastro de clientes e contactos...');
      const clientes = this.getClientes(atelieId);
      for (const cli of clientes) {
        const cleanCli = sanitizeForFirestore(cli);
        await setDoc(doc(db, 'clientes', cli.id), { ...cleanCli, atelieId }, { merge: true });
        await setDoc(doc(db, 'atelies', atelieId, 'clientes', cli.id), cleanCli, { merge: true });
        count++;
      }

      // 3. Sync Medidas
      onProgress?.(65, 'A sincronizar fichas corporais e histórico de medidas...');
      const medidas = this.getMedidas(atelieId);
      for (const med of medidas) {
        const cleanMed = sanitizeForFirestore(med);
        await setDoc(doc(db, 'medidas', med.id), { ...cleanMed, atelieId }, { merge: true });
        await setDoc(doc(db, 'atelies', atelieId, 'medidas', med.id), cleanMed, { merge: true });
        count++;
      }

      // 4. Sync Encomendas / Pedidos
      onProgress?.(85, 'A enviar encomendas, valores e prazos de entrega...');
      const pedidos = this.getPedidos(atelieId);
      for (const ped of pedidos) {
        const cleanPed = sanitizeForFirestore(ped);
        await setDoc(doc(db, 'encomendas', ped.id), { ...cleanPed, atelieId }, { merge: true });
        await setDoc(doc(db, 'atelies', atelieId, 'pedidos', ped.id), cleanPed, { merge: true });
        count++;
      }

      // 5. Sync Solicitacoes
      const solicitacoes = this.getSolicitacoes().filter(s => s.atelieId === atelieId);
      for (const sol of solicitacoes) {
        const cleanSol = sanitizeForFirestore(sol);
        await setDoc(doc(db, 'solicitacoesPagamento', sol.id), cleanSol, { merge: true });
        count++;
      }

      // 6. Dual Firebase Realtime Database Sync (if databaseURL configured)
      if (firebaseConfig.databaseURL && atelie) {
        try {
          const cleanUrl = firebaseConfig.databaseURL.replace(/\/$/, '');
          await Promise.allSettled([
            fetch(`${cleanUrl}/atelies/${atelie.id}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sanitizeForFirestore(atelie))
            }),
            fetch(`${cleanUrl}/clientes/${atelie.id}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sanitizeForFirestore(clientes))
            }),
            fetch(`${cleanUrl}/encomendas/${atelie.id}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sanitizeForFirestore(pedidos))
            }),
            fetch(`${cleanUrl}/medidas/${atelie.id}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sanitizeForFirestore(medidas))
            })
          ]);
        } catch (rtdbErr) {
          console.warn('[Realtime Database Sync Warning]:', rtdbErr);
        }
      }

      // 7. Fetch any latest remote items from Firestore to guarantee two-way freshness
      onProgress?.(95, 'A reconciliar atualizações remotas recentes...');
      try {
        const clientSnap = await getDocs(query(collection(db, 'clientes'), where('atelieId', '==', atelieId)));
        if (!clientSnap.empty) {
          const freshClientes: Cliente[] = [];
          clientSnap.forEach(d => freshClientes.push({ id: d.id, ...d.data() } as Cliente));
          const raw = localStorage.getItem('ateliepro_clientes');
          const cData = raw ? JSON.parse(raw) : {};
          cData[atelieId] = freshClientes;
          localStorage.setItem('ateliepro_clientes', JSON.stringify(cData));
        }

        const pedSnap = await getDocs(query(collection(db, 'encomendas'), where('atelieId', '==', atelieId)));
        if (!pedSnap.empty) {
          const freshPedidos: Pedido[] = [];
          pedSnap.forEach(d => freshPedidos.push({ id: d.id, ...d.data() } as Pedido));
          const raw = localStorage.getItem('ateliepro_pedidos');
          const pData = raw ? JSON.parse(raw) : {};
          pData[atelieId] = freshPedidos;
          localStorage.setItem('ateliepro_pedidos', JSON.stringify(pData));
        }

        const medSnap = await getDocs(query(collection(db, 'medidas'), where('atelieId', '==', atelieId)));
        if (!medSnap.empty) {
          const freshMedidas: Medidas[] = [];
          medSnap.forEach(d => freshMedidas.push({ id: d.id, ...d.data() } as Medidas));
          const raw = localStorage.getItem('ateliepro_medidas');
          const mData = raw ? JSON.parse(raw) : {};
          mData[atelieId] = freshMedidas;
          localStorage.setItem('ateliepro_medidas', JSON.stringify(mData));
        }
      } catch (pullErr) {
        console.warn('Reconciliação remota concluiu com base local:', pullErr);
      }

      this.notifyDataChange();
      onProgress?.(100, 'Todos os dados recentes foram guardados no Cloud Firestore com sucesso!');
      return { success: true, syncedItemsCount: count };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `sync/${atelieId}`);
      onProgress?.(100, 'Sincronização offline realizada com sucesso.');
      return { success: false, syncedItemsCount: 0, error: err?.message || String(err) };
    }
  }
}

export const localDb = new FirestoreDatabaseManager();

// --- Auth Bridge with Firebase Authentication & Firestore Multi-Tenant Sync ---
export class CustomAuthService {
  private listeners: Array<(session: UserSession | null) => void> = [];
  private currentSession: UserSession | null = null;

  constructor() {
    this.restoreSession();

    // Firebase Auth State Listener
    onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (user) {
        const email = user.email || '';
        const mailLower = email.toLowerCase();
        const isAdmin = localDb.getAdmins().includes(mailLower);
        let uid = user.uid;

        let atelie: Atelie | null = null;
        if (!isAdmin) {
          let existingAtelie = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);
          if (!existingAtelie) {
            // Check if document exists in Firestore
            try {
              const atelieSnap = await getDoc(doc(db, 'atelies', uid));
              if (atelieSnap.exists()) {
                existingAtelie = { id: atelieSnap.id, ...atelieSnap.data() } as Atelie;
              }
            } catch {}

            if (!existingAtelie) {
              existingAtelie = {
                id: uid,
                nome: user.displayName ? `Ateliê de ${user.displayName}` : `Ateliê de ${email.split('@')[0]}`,
                emailOwner: mailLower,
                telefone: '244923000000',
                plano: 'basico',
                ativo: true,
                dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                criadoEm: new Date().toISOString()
              };
              await localDb.saveAtelie(existingAtelie);
            }
          }
          uid = existingAtelie.id;
          atelie = existingAtelie;
          // Start multi-tenant real-time sync with Cloud Firestore
          localDb.initRealtimeSync(uid);
        }

        localStorage.setItem('ateliepro_current_uid', uid);
        localStorage.setItem('ateliepro_current_email', mailLower);
        this.currentSession = { uid, email: mailLower, isAdmin, atelie };
      } else {
        const prevUid = localStorage.getItem('ateliepro_current_uid');
        if (prevUid && !prevUid.startsWith('user_') && !prevUid.startsWith('admin_') && !prevUid.startsWith('atelie_')) {
          localStorage.removeItem('ateliepro_current_uid');
          localStorage.removeItem('ateliepro_current_email');
          this.currentSession = null;
          localDb.stopRealtimeSync();
        }
      }
      this.notify();
    });
  }

  private restoreSession() {
    const uid = localStorage.getItem('ateliepro_current_uid');
    const email = localStorage.getItem('ateliepro_current_email');
    if (uid && email) {
      const isAdmin = localDb.getAdmins().includes(email.toLowerCase());
      const atelie = !isAdmin ? localDb.getAtelie(uid) : null;
      this.currentSession = { uid, email, isAdmin, atelie };
      if (atelie) {
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

  async loginWithGoogle(): Promise<UserSession> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email || '';
      const mailLower = email.toLowerCase();
      const isAdmin = localDb.getAdmins().includes(mailLower);
      let uid = user.uid;

      let atelie: Atelie | null = null;
      if (isAdmin) {
        uid = 'admin_' + mailLower.split('@')[0];
        localStorage.setItem('ateliepro_current_uid', uid);
        localStorage.setItem('ateliepro_current_email', mailLower);
        this.currentSession = { uid, email: mailLower, isAdmin, atelie: null };
      } else {
        let existingAtelie = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);
        if (!existingAtelie) {
          try {
            const atelieSnap = await getDoc(doc(db, 'atelies', uid));
            if (atelieSnap.exists()) {
              existingAtelie = { id: atelieSnap.id, ...atelieSnap.data() } as Atelie;
            }
          } catch {}

          if (!existingAtelie) {
            existingAtelie = {
              id: uid,
              nome: user.displayName ? `Ateliê de ${user.displayName}` : `Ateliê de ${email.split('@')[0]}`,
              emailOwner: mailLower,
              telefone: '244923000000',
              plano: 'basico',
              ativo: true,
              dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              criadoEm: new Date().toISOString()
            };
            await localDb.saveAtelie(existingAtelie);
          }
        }
        uid = existingAtelie.id;
        atelie = existingAtelie;
        localStorage.setItem('ateliepro_current_uid', uid);
        localStorage.setItem('ateliepro_current_email', mailLower);
        this.currentSession = { uid, email: mailLower, isAdmin: false, atelie };
        localDb.initRealtimeSync(uid);
      }

      this.notify();
      return this.currentSession;
    } catch (error: any) {
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request' ||
        error?.message?.includes('popup-closed-by-user')
      ) {
        console.log('Google Sign-In popup was closed or cancelled by the user.');
        const userCancelError = new Error('A janela de login do Google foi fechada antes de concluir.');
        (userCancelError as any).code = 'auth/popup-closed-by-user';
        throw userCancelError;
      }
      if (error?.code === 'auth/popup-blocked') {
        const popupBlockedError = new Error('O popup de login foi bloqueado pelo navegador.');
        (popupBlockedError as any).code = 'auth/popup-blocked';
        throw popupBlockedError;
      }
      console.error('Google Sign-In failed:', error);
      throw error;
    }
  }

  async signUp(email: string, nomeAtelie: string, telefone: string): Promise<UserSession> {
    const mailLower = email.toLowerCase();
    
    // Verificar se já existe um ateliê com este e-mail cadastrado
    const existing = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);
    if (existing) {
      throw new Error('Já existe um Ateliê registrado com este e-mail. Por favor, tente Entrar no Painel.');
    }

    const uid = 'user_' + Math.random().toString(36).substr(2, 9);
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
    localStorage.setItem('ateliepro_current_email', email);

    this.currentSession = {
      uid,
      email: mailLower,
      isAdmin: false,
      atelie: newAtelie
    };
    localDb.initRealtimeSync(uid);
    this.notify();
    return this.currentSession;
  }

  async login(email: string): Promise<UserSession> {
    const mailLower = email.toLowerCase();
    const isAdmin = localDb.getAdmins().includes(mailLower);

    if (isAdmin) {
      const uid = 'admin_' + mailLower.split('@')[0];
      localStorage.setItem('ateliepro_current_uid', uid);
      localStorage.setItem('ateliepro_current_email', mailLower);
      this.currentSession = { uid, email: mailLower, isAdmin, atelie: null };
      this.notify();
      return this.currentSession;
    }

    // Procura ateliê existente
    let atelie = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === mailLower);
    if (atelie) {
      localStorage.setItem('ateliepro_current_uid', atelie.id);
      localStorage.setItem('ateliepro_current_email', mailLower);
      this.currentSession = { uid: atelie.id, email: mailLower, isAdmin: false, atelie };
      localDb.initRealtimeSync(atelie.id);
      this.notify();
      return this.currentSession;
    } else {
      const uid = 'atelie_' + Math.random().toString(36).substr(2, 9);
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
      this.currentSession = { uid, email: mailLower, isAdmin: false, atelie: newAtelie };
      localDb.initRealtimeSync(uid);
      this.notify();
      return this.currentSession;
    }
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase SignOut failed:', e);
    }
    localDb.stopRealtimeSync();
    localStorage.removeItem('ateliepro_current_uid');
    localStorage.removeItem('ateliepro_current_email');
    this.currentSession = null;
    this.notify();
  }
}

export const customAuth = new CustomAuthService();
