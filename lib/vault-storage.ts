'use client';

import {
  VaultItem,
  PhotoAlbum,
  ModuleType,
  formatTimestampHe,
} from './vault-logic';

/**
 * Vault storage layer — local-first over IndexedDB (+localStorage
 * fallback), with cloud sync through the app's own API routes
 * (MongoDB Atlas behind them). Replaces the direct Firestore client
 * SDK access: every cloud operation is now a same-origin fetch, and
 * a 401 simply means "not signed in" — local-only mode continues.
 */

const CLEAN_DB_NAME = 'smart_vault_crm_clean_v2';
const CLEAN_DB_VERSION = 1;
const ITEMS_STORE = 'vault_items';
const ALBUMS_STORE = 'photo_albums';

// Web Share Target DB used by /public/sw.js
const SHARE_DB_NAME = 'smart_vault_crm_db';
const SHARE_DB_VERSION = 1;
const SHARE_STORE = 'incoming_shares';

const LS_ITEMS_KEY = 'smart_vault_crm_clean_items_v2';
const LS_ALBUMS_KEY = 'smart_vault_crm_clean_albums_v2';
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

function openCleanDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = window.indexedDB.open(CLEAN_DB_NAME, CLEAN_DB_VERSION);
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(ITEMS_STORE)) {
        idb.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
      }
      if (!idb.objectStoreNames.contains(ALBUMS_STORE)) {
        idb.createObjectStore(ALBUMS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openShareDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = window.indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains('vault_items')) {
        idb.createObjectStore('vault_items', { keyPath: 'id' });
      }
      if (!idb.objectStoreNames.contains(SHARE_STORE)) {
        idb.createObjectStore(SHARE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Purges any legacy v1 mock/seed items so the workspace starts 100% clean.
 */
function purgeLegacySeedStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_LS_KEY);
  } catch {
    // ignore
  }
}

export async function loadLocalVaultItems(): Promise<VaultItem[]> {
  purgeLegacySeedStorage();
  try {
    const idb = await openCleanDB();
    const items = await new Promise<VaultItem[]>((resolve, reject) => {
      const tx = idb.transaction(ITEMS_STORE, 'readonly');
      const store = tx.objectStore(ITEMS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (Array.isArray(items) && items.length > 0) {
      return items;
    }
  } catch {
    // fallback to localStorage
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LS_ITEMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VaultItem[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
  }

  return [];
}

export async function saveLocalVaultItems(items: VaultItem[]): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(items));
    } catch {
      // Quota exceeded for large dataUrls in localStorage is handled by IndexedDB
    }
  }

  try {
    const idb = await openCleanDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(ITEMS_STORE, 'readwrite');
      const store = tx.objectStore(ITEMS_STORE);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function loadLocalPhotoAlbums(): Promise<PhotoAlbum[]> {
  purgeLegacySeedStorage();
  try {
    const idb = await openCleanDB();
    const albums = await new Promise<PhotoAlbum[]>((resolve, reject) => {
      const tx = idb.transaction(ALBUMS_STORE, 'readonly');
      const store = tx.objectStore(ALBUMS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (Array.isArray(albums) && albums.length > 0) {
      return albums;
    }
  } catch {
    // fallback to localStorage
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LS_ALBUMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PhotoAlbum[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
  }

  return [];
}

export async function saveLocalPhotoAlbums(albums: PhotoAlbum[]): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_ALBUMS_KEY, JSON.stringify(albums));
    } catch {
      // ignore
    }
  }

  try {
    const idb = await openCleanDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(ALBUMS_STORE, 'readwrite');
      const store = tx.objectStore(ALBUMS_STORE);
      store.clear();
      for (const album of albums) {
        store.put(album);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

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
  console.error(
    `Cloud sync error: ${JSON.stringify({ operation, path, message })}`
  );
  throw new Error(`cloud-sync ${operation} ${path} failed: ${message}`);
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
    albumId: item.module === 'photos' && item.albumId ? item.albumId : '',
    albumName: item.module === 'photos' && item.albumName ? item.albumName : '',
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
        albumId: (normalizedItem.albumId || '').slice(0, 128),
        albumName: (normalizedItem.albumName || '').slice(0, 120),
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
 * Updates an existing VaultItem's title, module, album, or notes in the cloud AND local storage.
 */
export async function updateVaultItemInDatabase(
  id: string,
  updates: {
    title: string;
    module: ModuleType;
    albumId?: string;
    albumName?: string;
    notes?: string;
  },
  currentItems: VaultItem[]
): Promise<VaultItem[]> {
  const cleanAlbumId = updates.module === 'photos' ? (updates.albumId || '').trim() : '';
  const cleanAlbumName = updates.module === 'photos' ? (updates.albumName || '').trim() : '';

  const updatedLocal = currentItems.map((item) =>
    item.id === id
      ? {
          ...item,
          title: updates.title.trim().slice(0, 200),
          module: updates.module,
          albumId: cleanAlbumId,
          albumName: cleanAlbumName,
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
        albumId: cleanAlbumId.slice(0, 128),
        albumName: cleanAlbumName.slice(0, 120),
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
 * Deletes a VaultItem from the cloud AND local storage.
 */
export async function deleteVaultItemFromDatabase(
  id: string,
  currentItems: VaultItem[]
): Promise<VaultItem[]> {
  const updatedLocal = currentItems.filter((item) => item.id !== id);
  await saveLocalVaultItems(updatedLocal);

  try {
    const cloud = await apiFetch(`/api/vault-items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    void cloud;
  } catch (error) {
    reportCloudError('delete', `vault_items/${id}`, error);
  }

  return updatedLocal;
}

/**
 * Saves a PhotoAlbum to the cloud AND local storage.
 */
export async function savePhotoAlbumToDatabase(
  album: PhotoAlbum,
  currentAlbums: PhotoAlbum[]
): Promise<PhotoAlbum[]> {
  const updatedLocal = [
    album,
    ...currentAlbums.filter((existing) => existing.id !== album.id),
  ];
  await saveLocalPhotoAlbums(updatedLocal);

  try {
    const cloud = await apiFetch('/api/photo-albums', {
      method: 'POST',
      body: JSON.stringify({
        id: album.id,
        name: album.name.trim().slice(0, 120),
        createdAtIso: album.createdAt.slice(0, 64),
      }),
    });
    void cloud;
  } catch (error) {
    reportCloudError('create', `photo_albums/${album.id}`, error);
  }

  return updatedLocal;
}

/**
 * Deletes a PhotoAlbum from the cloud AND local storage.
 */
export async function deletePhotoAlbumFromDatabase(
  albumId: string,
  currentAlbums: PhotoAlbum[]
): Promise<PhotoAlbum[]> {
  const updatedLocal = currentAlbums.filter((a) => a.id !== albumId);
  await saveLocalPhotoAlbums(updatedLocal);

  try {
    const cloud = await apiFetch(`/api/photo-albums/${encodeURIComponent(albumId)}`, {
      method: 'DELETE',
    });
    void cloud;
  } catch (error) {
    reportCloudError('delete', `photo_albums/${albumId}`, error);
  }

  return updatedLocal;
}

interface CloudItemDoc {
  id: string;
  title?: unknown;
  module?: unknown;
  albumId?: unknown;
  albumName?: unknown;
  createdAtIso?: unknown;
  formattedDate?: unknown;
  formattedTime?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
  dataUrl?: unknown;
  durationSec?: unknown;
  notes?: unknown;
  source?: unknown;
}

interface CloudAlbumDoc {
  id: string;
  name?: unknown;
  createdAtIso?: unknown;
}

function mapCloudItem(d: CloudItemDoc): VaultItem {
  const iso = typeof d.createdAtIso === 'string' ? d.createdAtIso : new Date().toISOString();
  const ts = formatTimestampHe(iso);
  return {
    id: d.id,
    title: String(d.title || ''),
    module: (d.module as ModuleType) || 'documents',
    albumId: d.albumId ? String(d.albumId) : '',
    albumName: d.albumName ? String(d.albumName) : '',
    createdAt: iso,
    formattedDate: d.formattedDate ? String(d.formattedDate) : ts.formattedDate,
    formattedTime: d.formattedTime ? String(d.formattedTime) : ts.formattedTime,
    fileName: String(d.fileName || 'file'),
    fileSize: Number(d.fileSize) || 0,
    mimeType: String(d.mimeType || 'application/octet-stream'),
    dataUrl: d.dataUrl ? String(d.dataUrl) : undefined,
    durationSec: Number(d.durationSec) > 0 ? Number(d.durationSec) : undefined,
    notes: d.notes ? String(d.notes) : undefined,
    source: (d.source as VaultItem['source']) || 'upload',
  };
}

function mapCloudAlbum(d: CloudAlbumDoc): PhotoAlbum {
  const iso = typeof d.createdAtIso === 'string' ? d.createdAtIso : new Date().toISOString();
  const { formattedDate } = formatTimestampHe(iso);
  return {
    id: d.id,
    name: String(d.name || ''),
    createdAt: iso,
    formattedDate,
  };
}

const SYNC_POLL_MS = 30_000;

/**
 * Keeps the signed-in user's vault in sync with the cloud: initial pull,
 * backfill of any local-only docs up to the cloud, then a poll every
 * 30 seconds plus a refresh whenever the tab regains focus. Replaces the
 * Firestore onSnapshot listeners (Atlas has no browser push).
 */
export function subscribeToUserVault(
  ownerId: string,
  callbacks: {
    onItemsChange: (items: VaultItem[]) => void;
    onAlbumsChange: (albums: PhotoAlbum[]) => void;
  }
): () => void {
  void ownerId; // routing happens server-side via the session cookie
  let stopped = false;
  let syncing = false;

  const syncItems = async (): Promise<void> => {
    const res = await apiFetch('/api/vault-items');
    if (!res) return; // signed out mid-session
    const cloudItems = ((await res.json()) as CloudItemDoc[]).map(mapCloudItem);

    // Sync any local unsynced items up to the cloud
    const localItems = await loadLocalVaultItems();
    const cloudIds = new Set(cloudItems.map((i) => i.id));
    for (const localItem of localItems) {
      if (!cloudIds.has(localItem.id)) {
        try {
          await saveVaultItemToDatabase(localItem, cloudItems);
        } catch {
          // ignore individual sync error
        }
      }
    }

    const merged = [
      ...cloudItems,
      ...localItems.filter((l) => !cloudIds.has(l.id)),
    ];
    await saveLocalVaultItems(merged);
    if (!stopped) callbacks.onItemsChange(merged);
  };

  const syncAlbums = async (): Promise<void> => {
    const res = await apiFetch('/api/photo-albums');
    if (!res) return;
    const cloudAlbums = ((await res.json()) as CloudAlbumDoc[])
      .map(mapCloudAlbum)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const localAlbums = await loadLocalPhotoAlbums();
    const cloudAlbumIds = new Set(cloudAlbums.map((a) => a.id));
    for (const localAlbum of localAlbums) {
      if (!cloudAlbumIds.has(localAlbum.id)) {
        try {
          await savePhotoAlbumToDatabase(localAlbum, cloudAlbums);
        } catch {
          // ignore
        }
      }
    }

    const merged = [
      ...cloudAlbums,
      ...localAlbums.filter((l) => !cloudAlbumIds.has(l.id)),
    ];
    await saveLocalPhotoAlbums(merged);
    if (!stopped) callbacks.onAlbumsChange(merged);
  };

  const syncAll = async (): Promise<void> => {
    if (syncing) return;
    syncing = true;
    try {
      await Promise.all([
        syncItems().catch((err) => console.error('vault items sync failed:', err)),
        syncAlbums().catch((err) => console.error('photo albums sync failed:', err)),
      ]);
    } finally {
      syncing = false;
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

  return () => {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onWake);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onWake);
    }
  };
}

export async function consumeIncomingShare(): Promise<IncomingSharedPayload | null> {
  try {
    const idb = await openShareDB();
    const payload = await new Promise<IncomingSharedPayload | null>((resolve, reject) => {
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
    return payload;
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
