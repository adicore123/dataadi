'use client';

import {
  VaultItem,
  VaultItemUpdates,
  Folder,
  formatTimestampHe,
  isModuleType,
  isVaultItemSource,
  normalizeTags,
  normalizeExpiryDate,
} from './vault-logic';

/**
 * Vault storage layer — local-first over IndexedDB (+localStorage
 * fallback), with cloud sync through the app's own API routes
 * (MongoDB Atlas behind them). A 401 simply means "not signed in" —
 * local-only mode continues.
 */

const CLEAN_DB_NAME = 'smart_vault_crm_clean_v2';
// v2: photo_albums store migrated into the folders store.
const CLEAN_DB_VERSION = 2;
const ITEMS_STORE = 'vault_items';
const FOLDERS_STORE = 'folders';
const LEGACY_ALBUMS_STORE = 'photo_albums';

// Web Share Target DB used by /public/sw.js
const SHARE_DB_NAME = 'smart_vault_crm_db';
const SHARE_DB_VERSION = 1;
const SHARE_STORE = 'incoming_shares';

const LS_ITEMS_KEY = 'smart_vault_crm_clean_items_v2';
const LS_FOLDERS_KEY = 'smart_vault_crm_clean_folders_v2';
const LS_LEGACY_ALBUMS_KEY = 'smart_vault_crm_clean_albums_v2';
const LEGACY_LS_KEY = 'smart_vault_crm_items_v1';

export interface IncomingSharedPayload {
  id: string;
  title: string;
  text: string;
  url: string;
  file?: {
    name: string;
    type: string;
    size: number;
    buffer: ArrayBuffer;
  } | null;
  receivedAt: string;
}

/* ------------------------------------------------------------------ */
/* Generic IndexedDB plumbing                                          */
/* ------------------------------------------------------------------ */

function openDB(
  name: string,
  version: number,
  stores: string[],
  migrate?: (idb: IDBDatabase, tx: IDBTransaction, oldVersion: number) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = window.indexedDB.open(name, version);
    request.onupgradeneeded = (event) => {
      const idb = request.result;
      for (const store of stores) {
        if (!idb.objectStoreNames.contains(store)) {
          idb.createObjectStore(store, { keyPath: 'id' });
        }
      }
      if (migrate && event.oldVersion > 0 && event.oldVersion < version) {
        migrate(idb, request.transaction!, event.oldVersion);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGetAll<T extends { id: string }>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

function idbPutAll<T extends { id: string }>(db: IDBDatabase, store: string, rows: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    objectStore.clear();
    for (const row of rows) {
      objectStore.put(row);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Purges any legacy v1 mock/seed items so the workspace starts clean. */
function purgeLegacySeedStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_LS_KEY);
  } catch {
    // ignore
  }
}

/** IndexedDB first, localStorage as fallback/mirror. */
async function loadRows<T extends { id: string }>(
  db: IDBDatabase | null,
  store: string,
  lsKey: string
): Promise<T[]> {
  if (db) {
    try {
      const rows = await idbGetAll<T>(db, store);
      if (rows.length > 0) return rows;
    } catch {
      // fall through to localStorage
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(lsKey);
      const parsed = raw ? (JSON.parse(raw) as T[]) : [];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
}

async function saveRows<T extends { id: string }>(
  db: IDBDatabase | null,
  store: string,
  lsKey: string,
  rows: T[]
): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(lsKey, JSON.stringify(rows));
    } catch {
      // Quota exceeded for large dataUrls in localStorage is handled by IndexedDB
    }
  }
  if (db) {
    try {
      await idbPutAll(db, store, rows);
    } catch {
      // ignore — localStorage copy already saved
    }
  }
}

/** Legacy items kept albumId/albumName — surface them as folder fields. */
function normalizeLegacyItem(item: VaultItem): VaultItem {
  if (item.folderId !== undefined) return item;
  const legacy = item as VaultItem & { albumId?: string; albumName?: string };
  return {
    ...item,
    folderId: legacy.albumId || '',
    folderName: legacy.albumName || '',
    tags: normalizeTags(item.tags),
  };
}

async function withCleanDb<T>(fn: (db: IDBDatabase | null) => Promise<T>): Promise<T> {
  const migrateAlbumsToFolders = (idb: IDBDatabase, tx: IDBTransaction, oldVersion: number) => {
    if (oldVersion < 2 && idb.objectStoreNames.contains(LEGACY_ALBUMS_STORE)) {
      const legacy = tx.objectStore(LEGACY_ALBUMS_STORE);
      const target = tx.objectStore(FOLDERS_STORE);
      legacy.getAll().onsuccess = (event) => {
        const albums = (event.target as IDBRequest<{ id: string }[]>).result || [];
        for (const album of albums) {
          target.put({ ...album, module: 'photos' });
        }
      };
    }
  };
  try {
    const db = await openDB(
      CLEAN_DB_NAME,
      CLEAN_DB_VERSION,
      [ITEMS_STORE, FOLDERS_STORE],
      migrateAlbumsToFolders
    );
    return await fn(db);
  } catch {
    // No IndexedDB — run the same logic against localStorage only.
    return await fn(null);
  }
}

/* ------------------------------------------------------------------ */
/* Local persistence                                                   */
/* ------------------------------------------------------------------ */

export async function loadLocalVaultItems(): Promise<VaultItem[]> {
  purgeLegacySeedStorage();
  const items = await withCleanDb((db) => loadRows<VaultItem>(db, ITEMS_STORE, LS_ITEMS_KEY));
  return items.map(normalizeLegacyItem);
}

export async function saveLocalVaultItems(items: VaultItem[]): Promise<void> {
  await withCleanDb((db) => saveRows(db, ITEMS_STORE, LS_ITEMS_KEY, items));
}

export async function loadLocalFolders(): Promise<Folder[]> {
  purgeLegacySeedStorage();
  const folders = await withCleanDb((db) => loadRows<Folder>(db, FOLDERS_STORE, LS_FOLDERS_KEY));
  if (folders.length > 0) return folders;

  // One-time localStorage migration: albums → photos folders.
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LS_LEGACY_ALBUMS_KEY);
      if (raw) {
        const legacy = JSON.parse(raw) as Array<{ id: string; name: string; createdAt: string; formattedDate: string }>;
        if (Array.isArray(legacy) && legacy.length > 0) {
          return legacy.map((album) => ({ ...album, module: 'photos' as const }));
        }
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function saveLocalFolders(folders: Folder[]): Promise<void> {
  await withCleanDb((db) => saveRows(db, FOLDERS_STORE, LS_FOLDERS_KEY, folders));
}

/* ------------------------------------------------------------------ */
/* Cloud-safe image compression                                        */
/* ------------------------------------------------------------------ */

/**
 * Compresses large image DataURLs on the client so cloud payloads stay
 * within the 780KB field cap enforced by the API routes.
 */
export async function ensureCloudSafeDataUrl(
  dataUrl: string | undefined,
  mimeType: string
): Promise<string> {
  if (!dataUrl) return '';
  if (dataUrl.length <= 740000) return dataUrl;

  if (typeof window !== 'undefined' && mimeType.startsWith('image/') && !mimeType.includes('svg')) {
    try {
      const compressed = await new Promise<string>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl.slice(0, 740000));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let out = canvas.toDataURL('image/jpeg', 0.72);
          if (out.length > 740000) {
            out = canvas.toDataURL('image/jpeg', 0.5);
          }
          resolve(out.length <= 760000 ? out : '');
        };
        img.onerror = () => resolve('');
        img.src = dataUrl;
      });
      if (compressed && compressed.length <= 760000) {
        return compressed;
      }
    } catch {
      // fallback below
    }
  }

  return dataUrl.length <= 760000 ? dataUrl : '';
}

/* ------------------------------------------------------------------ */
/* Cloud API                                                           */
/* ------------------------------------------------------------------ */

/**
 * Same-origin JSON fetch against the vault API. Returns null on 401
 * (not signed in — caller silently stays local-only). Non-2xx answers
 * throw with the server's error message.
 */
async function apiFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    let detail = '';
    try {
      detail = String((await res.json())?.error ?? '');
    } catch {
      // no body
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res;
}

function reportCloudError(operation: string, path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Cloud sync error: ${JSON.stringify({ operation, path, message })}`);
  throw new Error(`cloud-sync ${operation} ${path} failed: ${message}`);
}

/** Wire shape returned by GET /api/vault-items (our own server). */
interface CloudItemDoc {
  id: string;
  title: string;
  module: string;
  folderId?: string;
  folderName?: string;
  tags?: string[];
  favorite?: boolean;
  expiresAt?: string;
  deletedAt?: string | null;
  createdAtIso: string;
  formattedDate?: string;
  formattedTime?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl?: string;
  durationSec?: number;
  notes?: string;
  source?: string;
}

/** Wire shape returned by GET /api/folders. */
interface CloudFolderDoc {
  id: string;
  name: string;
  module: string;
  createdAtIso: string;
}

function mapCloudItem(d: CloudItemDoc): VaultItem {
  const iso = d.createdAtIso || new Date().toISOString();
  const ts = formatTimestampHe(iso);
  return {
    id: d.id,
    title: d.title || '',
    module: isModuleType(d.module) ? d.module : 'documents',
    folderId: d.folderId || '',
    folderName: d.folderName || '',
    tags: normalizeTags(d.tags),
    favorite: d.favorite === true,
    expiresAt: normalizeExpiryDate(d.expiresAt),
    deletedAt: d.deletedAt || undefined,
    createdAt: iso,
    formattedDate: d.formattedDate || ts.formattedDate,
    formattedTime: d.formattedTime || ts.formattedTime,
    fileName: d.fileName || 'file',
    fileSize: Number(d.fileSize) || 0,
    mimeType: d.mimeType || 'application/octet-stream',
    dataUrl: d.dataUrl || undefined,
    durationSec: Number(d.durationSec) > 0 ? Number(d.durationSec) : undefined,
    notes: d.notes || undefined,
    source: isVaultItemSource(d.source) ? d.source : 'upload',
  };
}

function mapCloudFolder(d: CloudFolderDoc): Folder {
  const iso = d.createdAtIso || new Date().toISOString();
  return {
    id: d.id,
    name: d.name || '',
    module: isModuleType(d.module) ? d.module : 'photos',
    createdAt: iso,
    formattedDate: formatTimestampHe(iso).formattedDate,
  };
}

/**
 * Saves a VaultItem to the cloud (when signed in) AND local IndexedDB.
 */
export async function saveVaultItemToDatabase(
  item: VaultItem,
  currentItems: VaultItem[]
): Promise<VaultItem[]> {
  const safeDataUrl = await ensureCloudSafeDataUrl(item.dataUrl, item.mimeType);
  const normalizedItem: VaultItem = {
    ...item,
    dataUrl: safeDataUrl || item.dataUrl,
    folderId: item.folderId || '',
    folderName: item.folderName || '',
    tags: normalizeTags(item.tags),
    favorite: Boolean(item.favorite),
    expiresAt: normalizeExpiryDate(item.expiresAt),
    deletedAt: item.deletedAt,
  };

  const updatedLocal = [
    normalizedItem,
    ...currentItems.filter((existing) => existing.id !== normalizedItem.id),
  ];
  await saveLocalVaultItems(updatedLocal);

  try {
    const cloud = await apiFetch('/api/vault-items', {
      method: 'POST',
      body: JSON.stringify({
        id: normalizedItem.id,
        title: normalizedItem.title.slice(0, 200),
        module: normalizedItem.module,
        folderId: (normalizedItem.folderId || '').slice(0, 128),
        folderName: (normalizedItem.folderName || '').slice(0, 120),
        tags: normalizedItem.tags,
        favorite: normalizedItem.favorite,
        expiresAt: normalizedItem.expiresAt,
        deletedAt: normalizedItem.deletedAt,
        createdAtIso: normalizedItem.createdAt.slice(0, 64),
        formattedDate: normalizedItem.formattedDate.slice(0, 32),
        formattedTime: normalizedItem.formattedTime.slice(0, 32),
        fileName: (normalizedItem.fileName || 'file').slice(0, 255),
        fileSize: Math.min(50000000, Math.max(0, Number(normalizedItem.fileSize) || 0)),
        mimeType: (normalizedItem.mimeType || 'application/octet-stream').slice(0, 128),
        dataUrl: safeDataUrl,
        durationSec:
          normalizedItem.durationSec !== undefined
            ? Math.min(86400, Math.max(0, Math.round(normalizedItem.durationSec)))
            : 0,
        notes: (normalizedItem.notes || '').slice(0, 1000),
        source: normalizedItem.source || 'upload',
      }),
    });
    void cloud;
  } catch (error) {
    reportCloudError('create', `vault_items/${normalizedItem.id}`, error);
  }

  return updatedLocal;
}

/**
 * Updates an existing VaultItem's title, module, folder, tags or notes
 * in the cloud AND local storage.
 */
export async function updateVaultItemInDatabase(
  id: string,
  updates: VaultItemUpdates,
  currentItems: VaultItem[]
): Promise<VaultItem[]> {
  const cleanFolderId = (updates.folderId || '').trim().slice(0, 128);
  const cleanFolderName = (updates.folderName || '').trim().slice(0, 120);
  const cleanTags = normalizeTags(updates.tags);
  const cleanFavorite = updates.favorite === true;
  const cleanExpiresAt = normalizeExpiryDate(updates.expiresAt);

  const updatedLocal = currentItems.map((item) =>
    item.id === id
      ? {
          ...item,
          title: updates.title.trim().slice(0, 200),
          module: updates.module,
          folderId: cleanFolderId,
          folderName: cleanFolderName,
          tags: cleanTags,
          favorite: cleanFavorite,
          expiresAt: cleanExpiresAt,
          notes: updates.notes ? updates.notes.trim().slice(0, 1000) : undefined,
        }
      : item
  );
  await saveLocalVaultItems(updatedLocal);

  try {
    const cloud = await apiFetch(`/api/vault-items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: updates.title.trim().slice(0, 200),
        module: updates.module,
        folderId: cleanFolderId,
        folderName: cleanFolderName,
        tags: cleanTags,
        favorite: cleanFavorite,
        expiresAt: cleanExpiresAt,
        notes: (updates.notes || '').trim().slice(0, 1000),
      }),
    });
    void cloud;
  } catch (error) {
    reportCloudError('update', `vault_items/${id}`, error);
  }

  return updatedLocal;
}

/**
 * Deletes a VaultItem — soft by default (recycle bin, restorable),
 * permanent with {permanent: true}. Updates the cloud AND local storage.
 */
export async function deleteVaultItemFromDatabase(
  id: string,
  currentItems: VaultItem[],
  options?: { permanent?: boolean }
): Promise<VaultItem[]> {
  const permanent = options?.permanent === true;
  const deletedAt = new Date().toISOString();
  const updatedLocal = permanent
    ? currentItems.filter((item) => item.id !== id)
    : currentItems.map((item) => (item.id === id ? { ...item, deletedAt } : item));
  await saveLocalVaultItems(updatedLocal);

  try {
    const cloud = await apiFetch(
      `/api/vault-items/${encodeURIComponent(id)}${permanent ? '?permanent=1' : ''}`,
      { method: 'DELETE' }
    );
    void cloud;
  } catch (error) {
    reportCloudError('delete', `vault_items/${id}`, error);
  }

  return updatedLocal;
}

/**
 * Restores a recycled VaultItem (cloud AND local).
 */
export async function restoreVaultItem(
  id: string,
  currentItems: VaultItem[]
): Promise<VaultItem[]> {
  const updatedLocal = currentItems.map((item) =>
    item.id === id ? { ...item, deletedAt: undefined } : item
  );
  await saveLocalVaultItems(updatedLocal);

  try {
    const cloud = await apiFetch(`/api/vault-items/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    });
    void cloud;
  } catch (error) {
    reportCloudError('restore', `vault_items/${id}`, error);
  }

  return updatedLocal;
}

/**
 * Saves a Folder to the cloud AND local storage.
 */
export async function saveFolderToDatabase(
  folder: Folder,
  currentFolders: Folder[]
): Promise<Folder[]> {
  const updatedLocal = [
    folder,
    ...currentFolders.filter((existing) => existing.id !== folder.id),
  ];
  await saveLocalFolders(updatedLocal);

  try {
    const cloud = await apiFetch('/api/folders', {
      method: 'POST',
      body: JSON.stringify({
        id: folder.id,
        name: folder.name.trim().slice(0, 120),
        module: folder.module,
        createdAtIso: folder.createdAt.slice(0, 64),
      }),
    });
    void cloud;
  } catch (error) {
    reportCloudError('create', `folders/${folder.id}`, error);
  }

  return updatedLocal;
}

/**
 * Renames a Folder in the cloud AND local storage.
 */
export async function renameFolderInDatabase(
  folderId: string,
  name: string,
  currentFolders: Folder[]
): Promise<Folder[]> {
  const updatedLocal = currentFolders.map((f) =>
    f.id === folderId ? { ...f, name: name.trim().slice(0, 120) } : f
  );
  await saveLocalFolders(updatedLocal);

  try {
    const cloud = await apiFetch(`/api/folders/${encodeURIComponent(folderId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: name.trim().slice(0, 120) }),
    });
    void cloud;
  } catch (error) {
    reportCloudError('rename', `folders/${folderId}`, error);
  }

  return updatedLocal;
}

/**
 * Deletes a Folder from the cloud AND local storage.
 */
export async function deleteFolderFromDatabase(
  folderId: string,
  currentFolders: Folder[]
): Promise<Folder[]> {
  const updatedLocal = currentFolders.filter((f) => f.id !== folderId);
  await saveLocalFolders(updatedLocal);

  try {
    const cloud = await apiFetch(`/api/folders/${encodeURIComponent(folderId)}`, {
      method: 'DELETE',
    });
    void cloud;
  } catch (error) {
    reportCloudError('delete', `folders/${folderId}`, error);
  }

  return updatedLocal;
}

/* ------------------------------------------------------------------ */
/* Sync engine                                                         */
/* ------------------------------------------------------------------ */

const SYNC_POLL_MS = 30_000;

/** Merges cloud + local-only rows of one kind (cloud wins on conflicts). */
async function mergeAndBackfill<T extends { id: string }>(
  fetchCloud: () => Promise<T[]>,
  loadLocal: () => Promise<T[]>,
  saveLocal: (rows: T[]) => Promise<void>,
  pushOne: (row: T, current: T[]) => Promise<unknown>,
  onChange: (merged: T[]) => void,
  isStopped: () => boolean
): Promise<void> {
  const cloudRows = await fetchCloud();
  const localRows = await loadLocal();
  const cloudIds = new Set(cloudRows.map((r) => r.id));

  for (const row of localRows) {
    if (!cloudIds.has(row.id)) {
      try {
        await pushOne(row, cloudRows);
      } catch {
        // ignore individual sync error
      }
    }
  }

  const merged = [...cloudRows, ...localRows.filter((r) => !cloudIds.has(r.id))];
  await saveLocal(merged);
  if (!isStopped()) onChange(merged);
}

/** Live sync state surfaced by the header indicator. */
export interface VaultSyncState {
  lastSyncedAt: Date | null;
  syncing: boolean;
}

/** Unsubscribe handle with a manual "sync now" trigger. */
export interface VaultSyncHandle {
  (): void;
  syncNow: () => void;
}

/**
 * Keeps the signed-in user's vault in sync with the cloud: initial pull,
 * backfill of any local-only docs up to the cloud, then a poll every
 * 30 seconds plus a refresh whenever the tab regains focus.
 */
export function subscribeToUserVault(
  ownerId: string,
  callbacks: {
    onItemsChange: (items: VaultItem[]) => void;
    onFoldersChange: (folders: Folder[]) => void;
    onSyncStateChange?: (state: VaultSyncState) => void;
  }
): VaultSyncHandle {
  void ownerId; // routing happens server-side via the session cookie
  let stopped = false;
  let syncing = false;
  let lastSyncedAt: Date | null = null;

  const reportState = () => callbacks.onSyncStateChange?.({ lastSyncedAt, syncing });

  const syncItems = () =>
    mergeAndBackfill(
      async () => {
        const res = await apiFetch('/api/vault-items');
        if (!res) return []; // signed out mid-session
        return ((await res.json()) as CloudItemDoc[]).map(mapCloudItem);
      },
      loadLocalVaultItems,
      saveLocalVaultItems,
      (item, current) => saveVaultItemToDatabase(item, current),
      callbacks.onItemsChange,
      () => stopped
    );

  const syncFolders = () =>
    mergeAndBackfill(
      async () => {
        const res = await apiFetch('/api/folders');
        if (!res) return [];
        return ((await res.json()) as CloudFolderDoc[])
          .map(mapCloudFolder)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      loadLocalFolders,
      saveLocalFolders,
      (folder, current) => saveFolderToDatabase(folder, current),
      callbacks.onFoldersChange,
      () => stopped
    );

  const syncAll = async (): Promise<void> => {
    if (syncing || stopped) return;
    syncing = true;
    reportState();
    try {
      await Promise.all([
        syncItems().catch((err) => console.error('vault items sync failed:', err)),
        syncFolders().catch((err) => console.error('folders sync failed:', err)),
      ]);
      lastSyncedAt = new Date();
    } finally {
      syncing = false;
      reportState();
    }
  };

  void syncAll();

  const pollTimer =
    typeof setInterval === 'function'
      ? setInterval(() => {
          if (typeof document === 'undefined' || !document.hidden) void syncAll();
        }, SYNC_POLL_MS)
      : null;

  const onWake = () => void syncAll();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onWake);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onWake);
  }

  const handle = () => {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onWake);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onWake);
    }
  };
  handle.syncNow = () => void syncAll();
  return handle;
}

/* ------------------------------------------------------------------ */
/* Share-target intake                                                 */
/* ------------------------------------------------------------------ */

/** One-time consume of the payload the service worker stashed for us. */
export async function consumeIncomingShare(): Promise<IncomingSharedPayload | null> {
  try {
    const idb = await openDB(SHARE_DB_NAME, SHARE_DB_VERSION, [SHARE_STORE]);
    return await new Promise<IncomingSharedPayload | null>((resolve, reject) => {
      const tx = idb.transaction(SHARE_STORE, 'readwrite');
      const store = tx.objectStore(SHARE_STORE);
      const req = store.get('latest_share');
      req.onsuccess = () => {
        const res = req.result || null;
        if (res) {
          store.delete('latest_share');
        }
        resolve(res);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return `data:${mimeType || 'application/octet-stream'};base64,${base64}`;
}
