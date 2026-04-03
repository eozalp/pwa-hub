'use strict';
const DB_NAME    = 'pwahub';
const DB_VERSION = 1;
const STORE_APPS = 'apps';
const CACHE_NAME = 'pwahub-shell-v1';
// Derive paths from SW script location — works regardless of deployment directory
const BASE_PATH  = new URL('./', self.location).href;
const MANIFEST_PATH = BASE_PATH + 'manifest.json';

let db;
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_APPS))
        d.createObjectStore(STORE_APPS, { keyPath: 'slug' });
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
      .then(c => c.add(new Request(BASE_PATH, { cache: 'reload' })))
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
  const appSlug = url.searchParams.get('app');

  // Hub manifest
  if (e.request.url.startsWith(MANIFEST_PATH) && !appSlug) {
    e.respondWith(
      caches.match(MANIFEST_PATH).then(r => r || new Response('{}', {
        headers: { 'Content-Type': 'application/manifest+json' }
      }))
    );
    return;
  }

  // Generated app manifest: /manifest.json?app=slug
  if (e.request.url.startsWith(MANIFEST_PATH) && appSlug) {
    e.respondWith(
      openDB().then(() => dbGet(appSlug)).then(app => {
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

  // Hub shell — serve from cache
  if (!appSlug && e.request.destination === 'document' &&
      (url.pathname === new URL(BASE_PATH).pathname ||
       url.pathname === new URL(BASE_PATH).pathname + 'index.html' ||
       url.pathname.endsWith('/pwa-hub.html'))) {
    e.respondWith(
      caches.match(BASE_PATH).then(cached => cached || fetch(e.request).then(r => {
        caches.open(CACHE_NAME).then(c => c.put(BASE_PATH, r.clone()));
        return r;
      }))
    );
    return;
  }

  // Generated app: ?app=slug
  if (appSlug) {
    e.respondWith(
      openDB().then(() => dbGet(appSlug)).then(app => {
        if (!app) return new Response('<h1>App not found</h1>', { headers: { 'Content-Type': 'text/html' } });
        return new Response(app.html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }).catch(() => new Response('<h1>Error loading app</h1>', { headers: { 'Content-Type': 'text/html' } }))
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
    console.log('[SW] CACHE_APP ack', e.data.url);
  }
});
