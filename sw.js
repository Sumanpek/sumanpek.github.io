/**
 * Asistencia Sumanpek, C.A. · Service worker
 * © 2026 Anabel Martínez RRHH
 *
 * - Página y código (index.html, app.js): primero la red (sin usar la caché del navegador) y, si no hay
 *   conexión, la copia guardada. Así nunca se queda pegada una versión vieja.
 * - Librerías (Tailwind, Chart.js, íconos, fuentes): copia guardada al instante y se actualiza por detrás.
 * - Imágenes y sonido propios: copia guardada.
 * - La API de Google (script.google.com) y el inicio de sesión NUNCA se guardan.
 * - v3.3: notificaciones push. El aviso llega vacío; el teléfono pregunta al servidor qué mostrar
 *   usando la clave de este dispositivo (guardada en la caché "sumanpek-push").
 */
const VERSION_SW = 'asistencia-sumanpek-3.3.0';
const PUSH_CACHE = 'sumanpek-push';
const BASICOS = ['./', 'index.html', 'logo.png', 'icono-192.png', 'icono-512.png', 'manifest.webmanifest', 'insignia-notif.png', 'notificacion.mp3'];
const CDN = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NUNCA = ['script.google.com', 'script.googleusercontent.com', 'accounts.google.com', 'oauth2.googleapis.com'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION_SW).then(c => c.addAll(BASICOS)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== VERSION_SW && n !== PUSH_CACHE).map(n => caches.delete(n))))
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

/* ======================= Notificaciones push ======================= */
async function configPush() {
  try {
    const r = await (await caches.open(PUSH_CACHE)).match(new URL('__push_cfg', self.registration.scope).href);
    return r ? await r.json() : null;
  } catch (e) { return null; }
}

self.addEventListener('push', ev => {
  ev.waitUntil((async () => {
    let nuevas = [], ultima = null;
    const cfg = await configPush();
    if (cfg && cfg.api && cfg.clave) {
      try {
        const r = await fetch(cfg.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
          body: JSON.stringify({ action: 'pushPendientes', payload: { clave: cfg.clave } }) });
        const j = await r.json();
        if (j.ok) { nuevas = j.data.nuevas || []; ultima = j.data.ultima; }
      } catch (e) { /* sin conexión: se muestra un aviso genérico */ }
    }
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = ventanas.some(c => c.visibilityState === 'visible');
    ventanas.forEach(c => c.postMessage({ tipo: 'push', nuevas }));
    let mostrar = nuevas;
    if (!mostrar.length) mostrar = [ultima ? Object.assign({}, ultima, { repetida: true }) : { id: 'sumanpek', titulo: 'Asistencia Sumanpek', cuerpo: 'Tienes una novedad. Toca para verla.', ruta: '#/asistencia' }];
    await Promise.all(mostrar.map(n => self.registration.showNotification(n.titulo || 'Asistencia Sumanpek', {
      body: n.cuerpo || '', icon: 'icono-192.png', badge: 'insignia-notif.png', tag: n.id || 'sumanpek', renotify: !n.repetida,
      silent: visible || !!n.repetida,   // con la app abierta suena el sonido propio de Sumanpek (lo reproduce la página)
      vibrate: [120, 60, 120], data: { ruta: n.ruta || '#/asistencia' }
    })));
  })());
});

self.addEventListener('notificationclick', ev => {
  ev.notification.close();
  const ruta = (ev.notification.data && ev.notification.data.ruta) || '#/asistencia';
  ev.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const propia = ventanas.find(c => c.url.startsWith(self.registration.scope));
    if (propia) { await propia.focus(); propia.postMessage({ tipo: 'abrir', ruta }); return; }
    await self.clients.openWindow(new URL(ruta, self.registration.scope).href);
  })());
});
