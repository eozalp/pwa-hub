
const DB_NAME    = 'pwahub';
const DB_VERSION = 1;
const STORE_APPS = 'apps';
const CACHE_NAME = 'pwahub-shell-v1';
const HUB_URL    = 'content://com.android.providers.downloads.documents/document/1366';
const BASE_PATH  = 'content://com.android.providers.downloads.documents/document/';
const HUB_MANIFEST_URL = BASE_PATH + 'manifest.json';

let db;
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_APPS)) {
        d.createObjectStore(STORE_APPS, { keyPath: 'slug' });
      }
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror   = e => rej(e.target.error);
  });
}

function dbGet(key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_APPS, 'readonly');
    tx.objectStore(STORE_APPS).get(key).onsuccess = e => res(e.target.result);
    tx.onerror = e => rej(e.target.error);
  });
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.add(new Request(HUB_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Hub shell — serve from cache
  if (e.request.url === HUB_URL || e.request.destination === 'document' && url.pathname === new URL(HUB_URL).pathname && !url.searchParams.has('app')) {
    e.respondWith(
      caches.match(HUB_URL).then(cached => cached || fetch(e.request).then(r => {
        caches.open(CACHE_NAME).then(c => c.put(HUB_URL, r.clone()));
        return r;
      }))
    );
    return;
  }

  // App requests: ?app=slug or /app/slug/
  const appSlug = url.searchParams.get('app') || (() => {
    const m = url.pathname.match(/\/app\/([^\/]+)\//);
    return m ? m[1] : null;
  })();

  if (appSlug) {
    e.respondWith(
      openDB().then(() => dbGet(appSlug)).then(app => {
        if (!app) return new Response('<h1>App not found</h1>', { headers: { 'Content-Type': 'text/html' } });
        return new Response(app.html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        });
      }).catch(() => new Response('<h1>Error loading app</h1>', { headers: { 'Content-Type': 'text/html' } }))
    );
    return;
  }

  // Hub manifest — served from cache (populated by injectHubManifest)
  if (e.request.url === HUB_MANIFEST_URL && !url.searchParams.has('app')) {
    e.respondWith(
      caches.match(HUB_MANIFEST_URL).then(r => r || new Response('{}', {
        headers: { 'Content-Type': 'application/manifest+json' }
      }))
    );
    return;
  }

  // Manifest for generated apps: /manifest.json?app=slug
  if (e.request.url.startsWith(HUB_MANIFEST_URL) && url.searchParams.has('app')) {
    const slug = url.searchParams.get('app');
    e.respondWith(
      openDB().then(() => dbGet(slug)).then(app => {
        if (!app) return new Response('{}', { headers: { 'Content-Type': 'application/manifest+json' } });
        const m = {
          name: app.name,
          short_name: app.shortName || app.name,
          start_url: BASE_PATH + '?app=' + app.slug,
          display: app.displayMode || 'standalone',
          background_color: '#000000',
          theme_color: '#000000',
          icons: [
            { src: app.icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: app.icon, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        };
        return new Response(JSON.stringify(m), {
          headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' }
        });
      }).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/manifest+json' } }))
    );
    return;
  }

  // Fonts — cache
  if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request).then(r => {
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, r.clone()));
        return r;
      }))
    );
    return;
  }
  // Everything else — network
});

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'CACHE_APP') {
    // Apps are served dynamically from IndexedDB — no URL caching needed.
    // Hub shell is already cached on install.
    console.log('[SW] CACHE_APP ack for', e.data.url);
  }
});
