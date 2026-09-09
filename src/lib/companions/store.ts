const DB_NAME = "everheart";
const STORE_NAME = "companions";

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

export interface StoredCompanionEntry {
  id: string;
  md: string;
  updatedAt: number;
}

function openStore(db: IDBDatabase): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, "readwrite");
  return tx.objectStore(STORE_NAME);
}

export function openCompanionStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) return reject(new Error("indexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listCompanions(): Promise<StoredCompanionEntry[]> {
  if (!hasIDB()) return [];
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openCompanionStore();
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function getCompanionMd(id: string): Promise<string | null> {
  if (!hasIDB()) return null;
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openCompanionStore();
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        const rec = req.result as StoredCompanionEntry | undefined;
        resolve(rec?.md ?? null);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function putCompanionMd(id: string, md: string): Promise<void> {
  if (!hasIDB()) return;
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openCompanionStore();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ id, md, updatedAt: Date.now() } satisfies StoredCompanionEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteCompanionMd(id: string): Promise<void> {
  if (!hasIDB()) return;
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openCompanionStore();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}