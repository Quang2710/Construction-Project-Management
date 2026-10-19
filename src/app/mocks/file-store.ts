/**
 * Kho file của fake BE. Ảnh lưu dạng Blob trong IndexedDB (localStorage chỉ ~5MB,
 * không đủ cho ảnh base64). Môi trường không có IndexedDB (unit test) dùng Map trong bộ nhớ.
 */
export interface StoredFile {
  readonly id: string;
  readonly blob: Blob;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly createdAt: string;
}

const DB_NAME = 'cpm-mock-files';
const STORE_NAME = 'files';

interface FileStoreBackend {
  put(file: StoredFile): Promise<void>;
  get(id: string): Promise<StoredFile | undefined>;
  clear(): Promise<void>;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class IndexedDbBackend implements FileStoreBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  async put(file: StoredFile): Promise<void> {
    await promisify((await this.store('readwrite')).put(file));
  }

  async get(id: string): Promise<StoredFile | undefined> {
    const result: unknown = await promisify((await this.store('readonly')).get(id));
    return (result as StoredFile | undefined) ?? undefined;
  }

  async clear(): Promise<void> {
    await promisify((await this.store('readwrite')).clear());
  }
}

class MemoryBackend implements FileStoreBackend {
  private readonly files = new Map<string, StoredFile>();

  async put(file: StoredFile): Promise<void> {
    this.files.set(file.id, file);
  }

  async get(id: string): Promise<StoredFile | undefined> {
    return this.files.get(id);
  }

  async clear(): Promise<void> {
    this.files.clear();
  }
}

export const fileStore: FileStoreBackend =
  typeof indexedDB === 'undefined' ? new MemoryBackend() : new IndexedDbBackend();
