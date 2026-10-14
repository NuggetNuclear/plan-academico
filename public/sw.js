// Service worker: la app funciona sin conexión después de la primera visita.
const CACHE = "notas-v2";
const BASE = ["./", "./index.html", "./carreras/inf.json", "./icon.svg", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches
      .open(CACHE)
      .then(async (c) => {
        await c.addAll(BASE);
        // Los bundles con hash de Vite: en la primera visita se bajaron antes de que existiera el SW.
        const html = await (await c.match("./index.html")).text();
        await c.addAll([...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]));
      })
      .catch(() => {}),
  );
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

// Tras un deploy, los bundles con hash del anterior ya no los pide nadie: se borran.
// ponytail: también caen los chunks diferidos (pdf); se vuelven a bajar al usarlos con conexión.
async function podarAssets(res) {
  const vivos = [...(await res.text()).matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((m) => m[1]);
  const cache = await caches.open(CACHE);
  const assets = (await cache.keys()).filter((r) => r.url.includes("/assets/"));
  const vigente = (r) => vivos.some((v) => r.url.endsWith("/" + v));
  // Si todo lo que pide el index ya está guardado, es el mismo deploy.
  if (!vivos.length || vivos.every((v) => assets.some((r) => r.url.endsWith("/" + v)))) return;
  await Promise.all(assets.filter((r) => !vigente(r)).map((r) => cache.delete(r)));
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
  if (req.mode === "navigate") e.respondWith(primeroRed(req).then((res) => (res?.ok && e.waitUntil(podarAssets(res.clone())), res)));
  else if (url.pathname.endsWith(".json")) e.respondWith(primeroRed(req));
  else e.respondWith(primeroCache(req));
});
