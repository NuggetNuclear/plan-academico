// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({})),
  onAuth: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  pedirTexto: vi.fn(),
  toast: vi.fn(),
  leerEstados: vi.fn(),
  cifrar: vi.fn(),
  reemplazarTodo: vi.fn(),
}));
vi.mock("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js", () => ({ getAuth: () => ({}), onAuthStateChanged: mocks.onAuth }));
vi.mock("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js", () => ({ getFirestore: () => ({}), getDoc: mocks.getDoc, setDoc: mocks.setDoc, doc: (_db: unknown, _col: string, uid: string) => uid }));
vi.mock("../store/app", () => ({ CARRERA_ID: "inf", leerTodosLosEstados: mocks.leerEstados, useApp: { getState: () => ({ reemplazarTodo: mocks.reemplazarTodo }) } }));
vi.mock("../store/ui", () => ({ confirmar: async () => true, pedirTexto: mocks.pedirTexto, toast: mocks.toast }));
vi.mock("./cifrado", () => ({ ITERACIONES: 1, nuevaSal: () => "sal", derivarClave: async () => ({}), cifrar: mocks.cifrar, descifrar: async () => ({}), esSobre: () => false }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_FIREBASE_API_KEY", "prueba");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "prueba");
  mocks.getDoc.mockResolvedValue({ exists: () => false });
  mocks.setDoc.mockResolvedValue(undefined);
  mocks.pedirTexto.mockResolvedValue("una contraseña de prueba");
  mocks.leerEstados.mockReturnValue({ inf: { valor: 1 } });
  mocks.cifrar.mockImplementation(async (_clave, _sal, _iter, _uid, datos) => datos);
  // Simula un error dentro de onsuccess, no al abrir la base: tampoco debe bloquear la sincronización.
  vi.stubGlobal("indexedDB", { open: () => {
    const request = { result: { transaction: () => { throw new Error("Base no disponible"); }, close: vi.fn() }, onsuccess: () => {} };
    queueMicrotask(() => request.onsuccess());
    return request;
  } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function conectar() {
  const sync = await import("./useSync");
  await sync.iniciarSync();
  mocks.onAuth.mock.calls[0][1]({ uid: "persona", displayName: "Prueba" });
  await vi.waitFor(() => expect(sync.useSync.getState().estado).toBe("sincronizado"));
  return sync;
}

describe("sincronización", () => {
  it("comparte la inicialización del SDK entre llamadas concurrentes", async () => {
    const { cargarFirebase } = await import("./useSync");
    const instancias = await Promise.all([cargarFirebase(), cargarFirebase()]);
    expect(instancias[0]).toBe(instancias[1]);
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("serializa las subidas y termina con el progreso más reciente", async () => {
    const { sincronizarAhora } = await conectar();
    mocks.setDoc.mockClear();
    let terminar!: () => void;
    mocks.setDoc.mockImplementationOnce(() => new Promise<void>((resolve) => { terminar = resolve; }));
    const primera = sincronizarAhora();
    await vi.waitFor(() => expect(mocks.setDoc).toHaveBeenCalledTimes(1));
    mocks.leerEstados.mockReturnValue({ inf: { valor: 2 } });
    const segunda = sincronizarAhora();
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    terminar();
    await Promise.all([primera, segunda]);
    expect(mocks.setDoc).toHaveBeenCalledTimes(2);
    expect(mocks.setDoc.mock.calls[1][1].estados).toEqual({ inf: { valor: 2 } });
  });

  it("no muestra éxito al cambiar la contraseña si falla la escritura", async () => {
    const { cambiarContrasena, useSync } = await conectar();
    mocks.setDoc.mockRejectedValueOnce(new Error("Sin conexión"));
    await cambiarContrasena();
    expect(useSync.getState().estado).toBe("error");
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.stringContaining("No se pudo guardar"), "error");
  });

  it.each([false, true])("ignora una consulta de nube pendiente tras cerrar sesión (error: %s)", async (falla) => {
    const sync = await import("./useSync");
    let terminar!: (valor: unknown) => void;
    mocks.getDoc.mockImplementationOnce(() => new Promise((resolve, reject) => { terminar = (valor) => falla ? reject(new Error("Sin red")) : resolve(valor); }));
    await sync.iniciarSync();
    const onAuth = mocks.onAuth.mock.calls[0][1];
    onAuth({ uid: "persona" });
    await vi.waitFor(() => expect(mocks.getDoc).toHaveBeenCalledTimes(1));
    onAuth(null);
    terminar({ exists: () => false });
    await vi.waitFor(() => expect(sync.useSync.getState().estado).toBe("local"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sync.useSync.getState().estado).toBe("local");
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.reemplazarTodo).not.toHaveBeenCalled();
  });
});
