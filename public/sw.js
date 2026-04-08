// ─────────────────────────────────────────────────────────────
// sw.js — Service Worker de Aura Core
// Estrategia: Cache First para assets, Network First para datos
// ─────────────────────────────────────────────────────────────

const CACHE_VERSION  = 'aura-core-v1';
const CACHE_ASSETS   = 'aura-assets-v1';

// Archivos que se cachean al instalar (app shell)
const ASSETS_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Instalación: precachea el app shell ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ASSETS).then((cache) => {
      return cache.addAll(ASSETS_PRECACHE);
    }),
  );
  self.skipWaiting();
});

// ── Activación: limpia caches viejos ────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_ASSETS)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// ── Fetch: estrategia según tipo de request ─────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Peticiones a la API de IA o Firebase → siempre red
  //    (no cacheamos datos dinámicos de Firebase ni del backend)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('localhost') ||
    url.pathname.includes('/api/')
  ) {
    return; // deja que el navegador maneje normalmente
  }

  // 2. Navegación (HTML) → Network First con fallback a caché
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Si la red responde, actualiza la caché
          const clone = response.clone();
          caches.open(CACHE_ASSETS).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Sin red: sirve desde caché
          return caches.match('/index.html');
        }),
    );
    return;
  }

  // 3. Assets (JS, CSS, imágenes, fuentes) → Cache First
  if (
    request.destination === 'script'  ||
    request.destination === 'style'   ||
    request.destination === 'image'   ||
    request.destination === 'font'    ||
    url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_ASSETS).then((cache) => cache.put(request, clone));
          return response;
        });
      }),
    );
    return;
  }

  // 4. Todo lo demás → red directa
});

// ── Mensaje desde la app para forzar actualización ──────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});