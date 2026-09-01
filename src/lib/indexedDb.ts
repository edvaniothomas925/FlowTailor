/**
 * FlowTailor Offline Storage Engine (IndexedDB)
 * High-performance, robust, and secure local client-side persistence
 * for 100% Offline Mode and Hybrid Offline Caching.
 */

const DB_NAME = 'flowtailor_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Clientes
        if (!db.objectStoreNames.contains('clientes')) {
          const store = db.createObjectStore('clientes', { keyPath: 'id' });
          store.createIndex('atelieId', 'atelieId', { unique: false });
        }

        // 2. Medidas
        if (!db.objectStoreNames.contains('medidas')) {
          const store = db.createObjectStore('medidas', { keyPath: 'id' });
          store.createIndex('atelieId', 'atelieId', { unique: false });
          store.createIndex('clienteId', 'clienteId', { unique: false });
        }

        // 3. Encomendas / Pedidos
        if (!db.objectStoreNames.contains('encomendas')) {
          const store = db.createObjectStore('encomendas', { keyPath: 'id' });
          store.createIndex('atelieId', 'atelieId', { unique: false });
          store.createIndex('clienteId', 'clienteId', { unique: false });
        }

        // 4. Ateliês
        if (!db.objectStoreNames.contains('atelies')) {
          db.createObjectStore('atelies', { keyPath: 'id' });
        }

        // 5. Configurações
        if (!db.objectStoreNames.contains('configs')) {
          db.createObjectStore('configs', { keyPath: 'id' });
        }

        // 6. Solicitações de Pagamento
        if (!db.objectStoreNames.contains('solicitacoes')) {
          db.createObjectStore('solicitacoes', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database open request blocked.');
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Save single item in IndexedDB store
 */
export async function idbSave<T extends { id: string }>(storeName: string, item: T): Promise<void> {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB Save Error in ${storeName}]:`, err);
  }
}

/**
 * Save multiple items in IndexedDB store in a single transaction
 */
export async function idbSaveBulk<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      for (const item of items) {
        store.put(item);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB SaveBulk Error in ${storeName}]:`, err);
  }
}

/**
 * Get all items from IndexedDB store
 */
export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB GetAll Error in ${storeName}]:`, err);
    return [];
  }
}

/**
 * Delete single item from IndexedDB store
 */
export async function idbDelete(storeName: string, id: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB Delete Error in ${storeName}]:`, err);
  }
}
