import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("public/sw.js", "utf8").replace("__REVISION__", "prueba").replace("/* __ASSETS__ */", '"./assets/Notas.js"');
const scope = "https://ejemplo.test/planner/";
const prefijo = `notas-planner:${scope}:`;

function worker() {
  const respuestas = new Map<string, Response>();
  const cache = { addAll: vi.fn(async (_urls: string[]) => {}), put: vi.fn(async (_req: unknown, _res: Response) => {}),
    match: vi.fn(async (req: { url: string } | string) => respuestas.get(typeof req === "string" ? req : req.url)) };
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => [prefijo + "vieja", prefijo + "prueba", "otra-app", "notas-planner:https://ejemplo.test/otro/:vieja"]), delete: vi.fn(async (_key: string) => true) };
  const fetch = vi.fn(async (_req: unknown) => new Response("Red"));
  const claim = vi.fn(async () => {});
  interface Evento { request?: { url: string; method: string; mode: string }; waitUntil: (p: Promise<unknown>) => void; respondWith: (p: Promise<Response>) => void }
  const listeners: Record<string, (e: Evento) => void> = {};
  runInNewContext(source, { URL, caches, fetch, self: { registration: { scope }, location: new URL(scope), clients: { claim }, addEventListener: (tipo: string, fn: (e: Evento) => void) => { listeners[tipo] = fn; } } });
  const ciclo = (tipo: string) => new Promise((resolve, reject) => {
    listeners[tipo]({ waitUntil: (p) => p.then(resolve, reject), respondWith() {} });
  });
  const solicitar = (url: string, mode = "cors", method = "GET") => {
    let resultado: Promise<Response> | undefined;
    listeners.fetch({ request: { url, method, mode }, waitUntil() {}, respondWith: (p) => { resultado = p; } });
    return resultado;
  };
  return { cache, caches, fetch, claim, respuestas, ciclo, solicitar };
}

describe("modo sin conexión", () => {
  it("precachea las secciones diferidas y deja fallar una instalación incompleta", async () => {
    const w = worker();
    await w.ciclo("install");
    expect(w.cache.addAll.mock.calls[0][0]).toContain("./assets/Notas.js");
    w.cache.addAll.mockRejectedValueOnce(new Error("Sin red"));
    await expect(w.ciclo("install")).rejects.toThrow("Sin red");
  });

  it("limpia solo las versiones antiguas de esta app y esta ruta", async () => {
    const w = worker();
    await w.ciclo("activate");
    expect(w.caches.delete.mock.calls).toEqual([[prefijo + "vieja"]]);
    expect(w.claim).toHaveBeenCalledTimes(1);
  });

  it("abre una sección que no se visitó antes usando su chunk guardado", async () => {
    const w = worker();
    const url = scope + "assets/Notas.js";
    w.respuestas.set(url, new Response("Notas"));
    expect(await (await w.solicitar(url))!.text()).toBe("Notas");
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("usa el HTML como respaldo solo al navegar", async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new Error("Sin red"));
    w.respuestas.set("./index.html", new Response("Inicio"));
    expect(await (await w.solicitar(scope, "navigate"))!.text()).toBe("Inicio");
    await expect(w.solicitar(scope + "desconocido.json")).rejects.toThrow("Sin red");
  });

  it("entrega la respuesta de red aunque la caché esté llena", async () => {
    const w = worker();
    w.cache.put.mockRejectedValue(new Error("Cuota llena"));
    expect(await (await w.solicitar(scope, "navigate"))!.text()).toBe("Red");
  });

  it("deja Firebase y las escrituras a cargo de la red", () => {
    const w = worker();
    expect(w.solicitar("https://firestore.googleapis.com/datos")).toBeUndefined();
    expect(w.solicitar(scope, "cors", "POST")).toBeUndefined();
  });
});
