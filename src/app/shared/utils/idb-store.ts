/**
 * Kho key–value trên IndexedDB cho dữ liệu offline (cache API, hàng đợi đồng bộ).
 * IndexedDB lưu được Blob (ảnh chụp offline) và dung lượng lớn hơn localStorage nhiều.
 * Môi trường không có IndexedDB (unit test, trình duyệt chặn) dùng Map trong bộ nhớ.
 */
export interface KeyValueStore<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  entries(): Promise<[string, T][]>;
  clear(): Promise<void>;
}

const DB_NAME = 'cpm-offline';
const DB_VERSION = 1;
/** Tất cả store của DB cpm-offline phải khai báo ở đây để được tạo khi nâng version. */
export const OFFLINE_STORES = ['http-cache', 'outbox'] as const;
export type OfflineStoreName = (typeof OFFLINE_STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      for (const name of OFFLINE_STORES) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

class IndexedDbStore<T> implements KeyValueStore<T> {
  constructor(private readonly name: OfflineStoreName) {}

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await openDb()).transaction(this.name, mode).objectStore(this.name);
  }

  async get(key: string): Promise<T | undefined> {
    const value: unknown = await promisify((await this.store('readonly')).get(key));
    return value as T | undefined;
  }

  async set(key: string, value: T): Promise<void> {
    await promisify((await this.store('readwrite')).put(value, key));
  }

  async delete(key: string): Promise<void> {
    await promisify((await this.store('readwrite')).delete(key));
  }

  async entries(): Promise<[string, T][]> {
    const store = await this.store('readonly');
    const [keys, values] = await Promise.all([promisify(store.getAllKeys()), promisify(store.getAll())]);
    return keys.map((key, index) => [String(key), values[index] as T]);
  }

  async clear(): Promise<void> {
    await promisify((await this.store('readwrite')).clear());
  }
}

class MemoryStore<T> implements KeyValueStore<T> {
  private readonly items = new Map<string, T>();

  async get(key: string): Promise<T | undefined> {
    return this.items.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.items.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.items.delete(key);
  }

  async entries(): Promise<[string, T][]> {
    return [...this.items.entries()];
  }

  async clear(): Promise<void> {
    this.items.clear();
  }
}

export function createKeyValueStore<T>(name: OfflineStoreName): KeyValueStore<T> {
  return typeof indexedDB === 'undefined' ? new MemoryStore<T>() : new IndexedDbStore<T>(name);
}
