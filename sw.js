// Service worker: la app funciona sin conexión. Al publicar una versión nueva, cambia VERSION.
const VERSION = "1.4.0-beta";
const SHELL = `geomundo-app-${VERSION}`, IMG = "geomundo-img-1";
const ARCHIVOS = ["./", "index.html", "app.css", "manifest.webmanifest", "data/catalogo.json", "data/cuarentena.json", "data/config.json",
  "js/app.js", "js/logica.js", "js/srs.js", "js/comparar.js", "js/almacen.js", "js/util.js", "js/logros.js", "js/medallas_ui.js", "js/voz.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ARCHIVOS))); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("geomundo-app-") && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "activar") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const ruta = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (ruta === "img/indice.json") { // primero la red, para ver imágenes nuevas
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(IMG).then((c) => c.put(req, cp)); } return r; }).catch(() => caches.match(req, { cacheName: IMG })));
    return;
  }
  if (ruta.startsWith("img/")) { // imágenes: caché primero, se guardan al usarlas
    e.respondWith(caches.open(IMG).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }
  if (req.mode === "navigate") { e.respondWith(caches.match("index.html").then((r) => r || fetch(req))); return; }
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
