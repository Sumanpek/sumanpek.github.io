/**
 * Asistencia Sumanpek, C.A. · Service worker
 * © 2026 Anabel Martínez RRHH
 *
 * - Página y código (index.html, app.js): primero la red (sin usar la caché del navegador) y, si no hay
 *   conexión, la copia guardada. Así nunca se queda pegada una versión vieja.
 * - Librerías (Tailwind, Chart.js, íconos, fuentes): copia guardada al instante y se actualiza por detrás.
 * - Imágenes y sonido propios: copia guardada.
 * - La API de Google (script.google.com) y el inicio de sesión NUNCA se guardan.
 */
const VERSION_SW = 'asistencia-sumanpek-3.1.0';
const BASICOS = ['./', 'index.html', 'logo.png', 'icono-192.png', 'icono-512.png', 'manifest.webmanifest'];
const CDN = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NUNCA = ['script.google.com', 'script.googleusercontent.com', 'accounts.google.com', 'oauth2.googleapis.com'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION_SW).then(c => c.addAll(BASICOS)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== VERSION_SW).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NUNCA.some(d => url.hostname.endsWith(d))) return;

  // Librerías externas: stale-while-revalidate
  if (CDN.some(d => url.hostname.endsWith(d))) {
    ev.respondWith(caches.open(VERSION_SW).then(async c => {
      const guardada = await c.match(req);
      const red = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => guardada);
      return guardada || red;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Imágenes y sonido propios: caché primero
  if (/\.(png|jpg|jpeg|webp|svg|mp3)$/i.test(url.pathname)) {
    ev.respondWith(caches.open(VERSION_SW).then(async c =>
      (await c.match(req)) || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }

  // HTML, JS y demás: red primero, pidiendo siempre la versión más reciente publicada
  const fresco = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' })
    .then(r => (r.redirected || !r.ok) ? fetch(req) : r)
    .catch(() => fetch(req));
  ev.respondWith(fresco.then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSION_SW).then(c => c.put(req, copia)); }
    return r;
  }).catch(() => caches.match(req).then(g => g || caches.match('index.html'))));
});
