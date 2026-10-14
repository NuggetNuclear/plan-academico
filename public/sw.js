// Service worker: la app funciona sin conexión después de la primera visita.
const CACHE = "notas-v2";
const BASE = ["./", "./index.html", "./carreras/inf.json", "./icon.svg", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function primeroRed(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req)) || (await caches.match("./index.html"));
  }
}

async function primeroCache(req) {
  const enCache = await caches.match(req);
  if (enCache) return enCache;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") (await caches.open(CACHE)).put(req, res.clone());
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
