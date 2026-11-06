// Vite inserta la revisión y los chunks del build, incluidas las secciones diferidas.
const PREFIJO = `notas-planner:${self.registration.scope}:`;
const CACHE = PREFIJO + "__REVISION__";
const BASE = ["./", "./index.html", "./carreras/inf.json", "./icon.svg", "./manifest.webmanifest", "./icon-192.png", "./icon-maskable-192.png", /* __ASSETS__ */];

self.addEventListener("install", (e) => {
  // Si falla la descarga, la versión anterior sigue disponible. La actualización espera a que se cierren sus pestañas.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)));
});

// La app pide activar la versión nueva cuando el usuario acepta actualizar.
self.addEventListener("message", (e) => {
  if (e.data === "activar") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIJO) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function guardar(req, res) {
  try {
    await (await caches.open(CACHE)).put(req, res);
  } catch {
    // Una cuota llena no impide entregar la respuesta de red.
  }
}

async function primeroRed(req) {
  try {
    const res = await fetch(req);
    if (res.ok) await guardar(req, res.clone());
    return res;
  } catch (error) {
    const cache = await caches.open(CACHE);
    const respaldo = await cache.match(req) || (req.mode === "navigate" ? await cache.match("./index.html") : null);
    if (respaldo) return respaldo;
    throw error;
  }
}

async function primeroCache(req) {
  const enCache = await (await caches.open(CACHE)).match(req);
  if (enCache) return enCache;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") await guardar(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // Solo las fuentes de Google se guardan; Firebase y el resto van siempre a la red.
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(primeroCache(req));
    return;
  }
  if (req.mode === "navigate" || url.pathname.endsWith(".json")) e.respondWith(primeroRed(req));
  else e.respondWith(primeroCache(req));
});
