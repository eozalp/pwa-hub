'use strict';
const DB_NAME    = 'pwahub';
const DB_VERSION = 1;
const STORE_APPS = 'apps';
const CACHE_NAME = 'pwahub-shell-v2';
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
  // Use .catch() so a missing index.html on GitHub Pages never aborts SW activation.
  // The hub shell is cached properly on first navigation or via CACHE_HUB message.
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.add(new Request(BASE_PATH, { cache: 'reload' })).catch(() => {}))
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
  const basePathname = new URL(BASE_PATH).pathname; // e.g. /repo/ or /
  const appPrefix    = basePathname + 'app/';       // e.g. /repo/app/

  // ════════════════════════════════════════════
  // PATH-BASED APP ROUTING  /app/{slug}/...
  // This gives each app a DISTINCT scope so
  // Chrome treats them as separate installable PWAs.
  // ════════════════════════════════════════════
  if (url.pathname.startsWith(appPrefix)) {
    const remainder = url.pathname.slice(appPrefix.length); // "slug/" or "slug/manifest.json"
    const slug      = remainder.split('/')[0];
    const subpath   = remainder.slice(slug.length).replace(/^[/]/, ''); // "" | "manifest.json"

    if (!slug) { /* fall through to network */ }

    // ── Per-app manifest: /app/{slug}/manifest.json
    else if (subpath === 'manifest.json') {
      e.respondWith(
        openDB().then(() => dbGet(slug)).then(app => {
          if (!app) return new Response('{}', { headers: { 'Content-Type': 'application/manifest+json' } });
          const scopeUrl = BASE_PATH + 'app/' + app.slug + '/';
          const m = {
            id:               scopeUrl,
            name:             app.name,
            short_name:       app.shortName || app.name,
            start_url:        scopeUrl,
            scope:            scopeUrl,
            display:          app.displayMode  || 'standalone',
            orientation:      app.orientation  || 'any',
            background_color: '#000000',
            theme_color:      '#000000',
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

    // ── App document: /app/{slug}/ (also handles in-scope sub-navigations)
    else {
      e.respondWith(
        openDB().then(() => dbGet(slug)).then(app => {
          if (!app) return new Response(
            '<h1 style="font-family:sans-serif;padding:2rem">App not found — open PWA Hub to reinstall.</h1>',
            { headers: { 'Content-Type': 'text/html' } }
          );
          return new Response(app.html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
          });
        }).catch(() => new Response('<h1>Error loading app</h1>', { headers: { 'Content-Type': 'text/html' } }))
      );
      return;
    }
  }

  // ── Hub manifest: /manifest.json  (no app in path)
  if (url.pathname === basePathname + 'manifest.json' ||
      url.pathname === basePathname.replace(/[/]$/, '') + '/manifest.json') {
    e.respondWith(
      caches.match(MANIFEST_PATH).then(r => r || new Response('{}', {
        headers: { 'Content-Type': 'application/manifest+json' }
      }))
    );
    return;
  }

  // ── Hub shell — serve from cache
  if (e.request.destination === 'document' &&
      (url.pathname === basePathname ||
       url.pathname === basePathname + 'index.html' ||
       url.pathname.endsWith('/pwa-hub.html'))) {
    e.respondWith(
      caches.match(BASE_PATH).then(cached => cached || fetch(e.request).then(r => {
        caches.open(CACHE_NAME).then(c => c.put(BASE_PATH, r.clone()));
        return r;
      }))
    );
    return;
  }

  // ── Legacy: ?app=slug  (backward-compat for apps stored before v2)
  const appSlug = url.searchParams.get('app');
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
  // Client tells SW the real hub file URL (e.g. /pwa-hub.html, not just /dir/).
  // Needed on GitHub Pages when the file isn't named index.html.
  if (e.data.type === 'CACHE_HUB' && e.data.url) {
    // Fetch the real hub file (e.g. pwa-hub.html) and store it under the
    // canonical BASE_PATH key so caches.match(BASE_PATH) finds it offline,
    // even when the hub is not named index.html.
    caches.open(CACHE_NAME).then(c =>
      fetch(new Request(e.data.url, { cache: 'reload' }))
        .then(r => { if (r.ok) { c.put(BASE_PATH, r.clone()); c.put(e.data.url, r); } })
        .catch(() => {})
    );
  }
});