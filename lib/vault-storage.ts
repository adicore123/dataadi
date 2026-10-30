'use client';

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from './firebase';
import {
  VaultItem,
  PhotoAlbum,
  ModuleType,
  formatTimestampHe,
} from './vault-logic';

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
 * Compresses large image DataURLs on the client so they always fit within Firestore's 780KB field limit.
 */
export async function ensureFirestoreSafeDataUrl(
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
 * Saves a VaultItem to Firebase Firestore (when user is signed in) AND local IndexedDB.
 */
export async function saveVaultItemToDatabase(
  item: VaultItem,
  currentItems: VaultItem[]
): Promise<VaultItem[]> {
  const safeDataUrl = await ensureFirestoreSafeDataUrl(item.dataUrl, item.mimeType);
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

  const user = auth.currentUser;
  if (user) {
    const path = `vault_items/${normalizedItem.id}`;
    try {
      await setDoc(doc(db, 'vault_items', normalizedItem.id), {
        ownerId: user.uid,
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  return updatedLocal;
}

/**
 * Updates an existing VaultItem's title, module, album, or notes in Firestore AND local storage.
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

  const user = auth.currentUser;
  if (user) {
    const path = `vault_items/${id}`;
    try {
      await updateDoc(doc(db, 'vault_items', id), {
        title: updates.title.trim().slice(0, 200),
        module: updates.module,
        albumId: cleanAlbumId.slice(0, 128),
        albumName: cleanAlbumName.slice(0, 120),
        notes: (updates.notes || '').trim().slice(0, 1000),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return updatedLocal;
}

/**
 * Deletes a VaultItem from Firestore AND local storage.
 */
export async function deleteVaultItemFromDatabase(
  id: string,
  currentItems: VaultItem[]
): Promise<VaultItem[]> {
  const updatedLocal = currentItems.filter((item) => item.id !== id);
  await saveLocalVaultItems(updatedLocal);

  const user = auth.currentUser;
  if (user) {
    const path = `vault_items/${id}`;
    try {
      await deleteDoc(doc(db, 'vault_items', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  return updatedLocal;
}

/**
 * Saves a PhotoAlbum to Firebase Firestore AND local storage.
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

  const user = auth.currentUser;
  if (user) {
    const path = `photo_albums/${album.id}`;
    try {
      await setDoc(doc(db, 'photo_albums', album.id), {
        ownerId: user.uid,
        name: album.name.trim().slice(0, 120),
        createdAtIso: album.createdAt.slice(0, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  return updatedLocal;
}

/**
 * Deletes a PhotoAlbum from Firebase Firestore AND local storage.
 */
export async function deletePhotoAlbumFromDatabase(
  albumId: string,
  currentAlbums: PhotoAlbum[]
): Promise<PhotoAlbum[]> {
  const updatedLocal = currentAlbums.filter((a) => a.id !== albumId);
  await saveLocalPhotoAlbums(updatedLocal);

  const user = auth.currentUser;
  if (user) {
    const path = `photo_albums/${albumId}`;
    try {
      await deleteDoc(doc(db, 'photo_albums', albumId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  return updatedLocal;
}

/**
 * Subscribes to real-time updates for `vault_items` and `photo_albums` in Firestore for the signed-in user,
 * and automatically syncs any locally created items/albums up to Firestore on initial sign-in.
 */
export function subscribeToUserVaultFirestore(
  uid: string,
  callbacks: {
    onItemsChange: (items: VaultItem[]) => void;
    onAlbumsChange: (albums: PhotoAlbum[]) => void;
  }
): () => void {
  testFirestoreConnection();

  const itemsQuery = query(collection(db, 'vault_items'), where('ownerId', '==', uid));
  const albumsQuery = query(collection(db, 'photo_albums'), where('ownerId', '==', uid));

  const unsubItems = onSnapshot(
    itemsQuery,
    async (snapshot) => {
      const cloudItems: VaultItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const iso = typeof d.createdAtIso === 'string' ? d.createdAtIso : new Date().toISOString();
        const ts = formatTimestampHe(iso);
        return {
          id: docSnap.id,
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
      });

      // Sync any local unsynced items up to Firestore
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
      callbacks.onItemsChange(merged);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vault_items');
    }
  );

  const unsubAlbums = onSnapshot(
    albumsQuery,
    async (snapshot) => {
      const cloudAlbums: PhotoAlbum[] = snapshot.docs
        .map((docSnap) => {
          const d = docSnap.data();
          const iso =
            typeof d.createdAtIso === 'string' ? d.createdAtIso : new Date().toISOString();
          const { formattedDate } = formatTimestampHe(iso);
          return {
            id: docSnap.id,
            name: String(d.name || ''),
            createdAt: iso,
            formattedDate,
          };
        })
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
      callbacks.onAlbumsChange(merged);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'photo_albums');
    }
  );

  return () => {
    unsubItems();
    unsubAlbums();
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
