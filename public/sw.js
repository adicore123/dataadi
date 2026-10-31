const CACHE_NAME = 'smart-vault-crm-v1';
const DB_NAME = 'smart_vault_crm_db';
const DB_VERSION = 1;
const SHARE_STORE = 'incoming_shares';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/icon.svg', '/pwa-192x192.png', '/pwa-512x512.png']).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function openShareDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedPayload(payload) {
  const db = await openShareDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readwrite');
    tx.objectStore(SHARE_STORE).put(payload);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept Web Share Target POST from Mobile OS Share Sheet
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const title = formData.get('title') || '';
          const text = formData.get('text') || '';
          const sharedUrl = formData.get('url') || '';
          const file = formData.get('file');

          let fileData = null;
          if (file && typeof file === 'object' && 'arrayBuffer' in file) {
            const buffer = await file.arrayBuffer();
            fileData = {
              name: file.name || 'shared-file',
              type: file.type || 'application/octet-stream',
              size: file.size || buffer.byteLength,
              buffer,
            };
          }

          await saveSharedPayload({
            id: 'latest_share',
            title: String(title),
            text: String(text),
            url: String(sharedUrl),
            file: fileData,
            receivedAt: new Date().toISOString(),
          });

          return Response.redirect('/?shared=1', 303);
        } catch (err) {
          return Response.redirect('/?shared=error', 303);
        }
      })()
    );
    return;
  }
});
