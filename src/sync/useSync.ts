// Sincronización opcional con una cuenta de Google (Firebase Auth + Firestore).
// Solo se activa si defines las variables VITE_FIREBASE_* (ver README). Sin ellas,
// la app funciona igual guardando todo en el navegador.
// La copia en la nube va cifrada de extremo a extremo (ver cifrado.ts).
import { create } from "zustand";
import { normalizarEstado, type PlannerState } from "../core/state";
import { CARRERA_ID, leerTodosLosEstados, useApp } from "../store/app";
import { confirmar, pedirTexto, toast } from "../store/ui";
import { ITERACIONES, cifrar, derivarClave, descifrar, esSobre, nuevaSal, type Sobre } from "./cifrado";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const COLECCION = "usuarios";
const ESPERA_SUBIDA_MS = 1500;

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const syncDisponible = !!(config.apiKey && config.projectId);

type EstadoSync = "local" | "conectando" | "sincronizando" | "sincronizado" | "sin-conexion" | "error" | "bloqueado";

interface Nube {
  estados: Record<string, PlannerState>;
  carreraActual: string | null;
  actualizado: number;
}

export interface Conflicto {
  nube: Nube;
  local: Record<string, PlannerState>;
}

interface Usuario {
  uid: string;
  nombre: string;
  correo: string;
  foto: string | null;
}

interface SyncStore {
  estado: EstadoSync;
  usuario: Usuario | null;
  ultima: number | null;
  conflicto: Conflicto | null;
}

export const useSync = create<SyncStore>(() => ({
  estado: "local",
  usuario: null,
  ultima: null,
  conflicto: null,
}));

export function estadoSync(s: SyncStore): { texto: string; tono: "ok" | "warn" | "neutro" } {
  if (!s.usuario) return { texto: syncDisponible ? "Sin sincronizar" : "Guardado en este equipo", tono: "neutro" };
  switch (s.estado) {
    case "sincronizado":
      return { texto: "Sincronizado", tono: "ok" };
    case "sincronizando":
    case "conectando":
      return { texto: "Sincronizando…", tono: "warn" };
    case "sin-conexion":
      return { texto: "Sin conexión", tono: "warn" };
    case "error":
      return { texto: "Error al sincronizar", tono: "warn" };
    case "bloqueado":
      return { texto: "Cifrado: falta tu contraseña", tono: "warn" };
    default:
      return { texto: "Conectado", tono: "neutro" };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let fb: { auth: any; db: any; m: any } | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let aplicandoNube = false;
// Nada se sube hasta comparar con la nube: si no, el progreso de otro equipo se pisa.
let reconciliado = false;
let enCurso: Promise<void> | null = null;
// Clave de cifrado de la cuenta. Se recuerda en IndexedDB como CryptoKey no extraíble:
// no hay que escribir la contraseña en cada visita y sus bytes nunca quedan legibles.
let llave: { clave: CryptoKey; sal: string; iter: number } | null = null;
const CANCELADO = Symbol("cancelado");

function almacen<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((ok) => {
    try {
      const abrir = indexedDB.open("notas-cifrado", 1);
      abrir.onupgradeneeded = () => abrir.result.createObjectStore("claves");
      abrir.onerror = () => ok(undefined);
      abrir.onsuccess = () => {
        const bd = abrir.result;
        const r = fn(bd.transaction("claves", modo).objectStore("claves"));
        r.onsuccess = () => (ok(r.result as T), bd.close());
        r.onerror = () => (ok(undefined), bd.close());
      };
    } catch {
      ok(undefined); // sin IndexedDB (modo privado): la contraseña se pide en cada visita
    }
  });
}

async function recordar(u: Usuario, l: NonNullable<typeof llave>) {
  llave = l;
  await almacen("readwrite", (s) => s.put(l, u.uid));
}

async function olvidarClave() {
  const u = useSync.getState().usuario;
  llave = null;
  if (u) await almacen("readwrite", (s) => s.delete(u.uid));
}

async function crearContrasena(u: Usuario, intro: string): Promise<boolean> {
  const c = await pedirTexto({
    titulo: "Crea tu contraseña de cifrado",
    mensaje: `${intro}\n\nNo se puede recuperar: si la olvidas, se pierde la copia en la nube (no lo guardado en cada dispositivo).`,
    aceptar: "Continuar",
    campo: {
      etiqueta: "Contraseña (mínimo 12 caracteres)",
      tipo: "password",
      autoComplete: "new-password",
      validar: (v) => (v.length < 12 ? "Usa al menos 12 caracteres. Una frase de varias palabras es fácil de recordar y difícil de adivinar." : null),
    },
  });
  if (c === null) return false;
  const repetida = await pedirTexto({
    titulo: "Repite tu contraseña",
    aceptar: "Cifrar",
    campo: { etiqueta: "Contraseña de cifrado", tipo: "password", autoComplete: "new-password", validar: (v) => (v === c ? null : "No coincide con la anterior.") },
  });
  if (repetida === null) return false;
  const sal = nuevaSal();
  await recordar(u, { clave: await derivarClave(c, sal), sal, iter: ITERACIONES });
  return true;
}

function nubeDesde(d: unknown): Nube {
  const x = (d ?? {}) as { estados?: Record<string, unknown>; carreraActual?: string; actualizado?: number };
  return {
    // Se normaliza igual que lo local: mismos ids migrados, y la nube también es una entrada no confiable.
    estados: Object.fromEntries(Object.entries(x.estados ?? {}).map(([k, v]) => [k, normalizarEstado(v)])),
    carreraActual: x.carreraActual ?? null,
    actualizado: Number(x.actualizado) || 0,
  };
}

/** Consigue la clave (la recordada o pidiendo la contraseña) y descifra la nube. */
async function abrirSobre(u: Usuario, sobre: Sobre | null): Promise<Nube | null | typeof CANCELADO> {
  llave ??= (await almacen<NonNullable<typeof llave>>("readonly", (s) => s.get(u.uid))) ?? null;
  if (!sobre) {
    if (llave) return null;
    return (await crearContrasena(u, "Tu progreso se cifra en este dispositivo antes de subirlo: nadie más puede leerlo, ni quien administra la app.")) ? null : CANCELADO;
  }
  if (llave?.sal === sobre.sal) {
    try {
      return nubeDesde(await descifrar(llave.clave, u.uid, sobre));
    } catch {
      /* la contraseña cambió en otro dispositivo: se pide de nuevo */
    }
  }
  let error = "";
  for (;;) {
    const c = await pedirTexto({
      titulo: "Desbloquea tu progreso",
      mensaje: `${error}Tu copia en la nube está cifrada. Escribe tu contraseña de cifrado.\n¿La olvidaste? Cancela y usa «Olvidé mi contraseña» en Mi cuenta.`,
      aceptar: "Desbloquear",
      campo: { etiqueta: "Contraseña de cifrado", tipo: "password", autoComplete: "current-password" },
    });
    if (c === null) return CANCELADO;
    const clave = await derivarClave(c, sobre.sal, sobre.iter);
    try {
      const nube = nubeDesde(await descifrar(clave, u.uid, sobre));
      await recordar(u, { clave, sal: sobre.sal, iter: sobre.iter });
      return nube;
    } catch {
      error = "Contraseña incorrecta.\n\n";
    }
  }
}

const importar = (ruta: string) => import(/* @vite-ignore */ `${SDK}/${ruta}`);

export async function cargarFirebase() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([importar("firebase-app.js"), importar("firebase-auth.js"), importar("firebase-firestore.js")]);
  const instancia = app.initializeApp(config);
  fb = { auth: auth.getAuth(instancia), db: fs.getFirestore(instancia), m: { ...auth, ...fs } };
  return fb;
}

const tieneProgreso = (estados: Record<string, PlannerState>) =>
  Object.values(estados).some((s) => Object.keys(s.marcas).length > 0 || s.cursando.length > 0 || s.periodos.some((p) => p.ramos.length > 0));

const firma = (estados: Record<string, PlannerState>) => JSON.stringify(Object.keys(estados).sort().map((k) => [k, estados[k]]));

async function leerSobre(uid: string): Promise<Sobre | null> {
  const { db, m } = await cargarFirebase();
  const snap = await m.getDoc(m.doc(db, COLECCION, uid));
  const d = snap.exists() ? snap.data() : null;
  // Un documento sin cifrar (anterior al cifrado) cuenta como vacío y se reemplaza al subir.
  return esSobre(d) ? d : null;
}

async function subir() {
  const { usuario: u, conflicto } = useSync.getState();
  if (!u || conflicto || !reconciliado || !llave) return;
  const { db, m } = await cargarFirebase();
  useSync.setState({ estado: "sincronizando" });
  try {
    const ahora = Date.now();
    const sobre = await cifrar(llave.clave, llave.sal, llave.iter, u.uid, { estados: leerTodosLosEstados(), carreraActual: CARRERA_ID, actualizado: ahora });
    await m.setDoc(m.doc(db, COLECCION, u.uid), sobre);
    useSync.setState({ estado: "sincronizado", ultima: ahora });
  } catch {
    useSync.setState({ estado: navigator.onLine ? "error" : "sin-conexion" });
  }
}

// Una sola a la vez: si no, el inicio de sesión y el evento "online" pedirían la contraseña dos veces.
const reconciliar = (u: Usuario) => (enCurso ??= reconciliarAhora(u).finally(() => (enCurso = null)));

async function reconciliarAhora(u: Usuario) {
  reconciliado = false;
  useSync.setState({ estado: "conectando" });
  try {
    const nube = await abrirSobre(u, await leerSobre(u.uid));
    if (nube === CANCELADO) return void useSync.setState({ estado: "bloqueado" });
    const local = leerTodosLosEstados();
    if (!nube || !tieneProgreso(nube.estados)) {
      reconciliado = true;
      return subir();
    }
    if (!tieneProgreso(local) || firma(local) === firma(nube.estados)) {
      reconciliado = true;
      aplicandoNube = true;
      useApp.getState().reemplazarTodo(nube.estados);
      aplicandoNube = false;
      useSync.setState({ estado: "sincronizado", ultima: nube.actualizado });
      return;
    }
    useSync.setState({ conflicto: { nube, local }, estado: "local" });
  } catch {
    useSync.setState({ estado: navigator.onLine ? "error" : "sin-conexion" });
  }
}

export async function resolverConflicto(eleccion: "nube" | "local") {
  const c = useSync.getState().conflicto;
  if (!c) return;
  useSync.setState({ conflicto: null });
  reconciliado = true;
  if (eleccion === "nube") {
    aplicandoNube = true;
    useApp.getState().reemplazarTodo(c.nube.estados);
    aplicandoNube = false;
    useSync.setState({ estado: "sincronizado", ultima: c.nube.actualizado });
    toast("Se cargó el progreso de tu cuenta.");
  } else {
    await subir();
    toast("Tu cuenta quedó con el progreso de este dispositivo.");
  }
}

let iniciado = false;
export async function iniciarSync() {
  if (iniciado || !syncDisponible) return;
  iniciado = true;
  try {
    const { auth, m } = await cargarFirebase();
    m.onAuthStateChanged(auth, (user: any) => {
      if (!user) {
        reconciliado = false;
        // Al cerrar sesión, este dispositivo olvida la clave.
        olvidarClave();
        useSync.setState({ usuario: null, estado: "local", conflicto: null });
        return;
      }
      const u: Usuario = { uid: user.uid, nombre: user.displayName ?? "Tu cuenta", correo: user.email ?? "", foto: user.photoURL ?? null };
      useSync.setState({ usuario: u });
      reconciliar(u);
    });
    window.addEventListener("notas:guardado", () => {
      if (aplicandoNube || !useSync.getState().usuario || useSync.getState().conflicto) return;
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(subir, ESPERA_SUBIDA_MS);
    });
    window.addEventListener("online", sincronizarAhora);
  } catch {
    // Sin conexión al abrir: se reintenta cuando vuelva la red.
    iniciado = false;
    window.addEventListener("online", iniciarSync, { once: true });
    useSync.setState({ estado: "error" });
  }
}

export async function entrarConGoogle() {
  if (!syncDisponible) return;
  try {
    const { auth, m } = await cargarFirebase();
    await m.signInWithPopup(auth, new m.GoogleAuthProvider());
  } catch (e: any) {
    if (e?.code !== "auth/popup-closed-by-user") toast("No se pudo iniciar sesión con Google.", "error");
  }
}

export async function cerrarSesion() {
  if (!fb) return;
  await fb.m.signOut(fb.auth);
  toast("Sesión cerrada. Tu progreso sigue en este dispositivo.", "info");
}

export function sincronizarAhora() {
  const u = useSync.getState().usuario;
  if (u) return reconciliado ? subir() : reconciliar(u);
}

/** Contraseña nueva: vuelve a cifrar con el progreso de este dispositivo. Sirve también si la olvidaste. */
export async function cambiarContrasena() {
  const { usuario: u, estado } = useSync.getState();
  if (!u) return;
  const bloqueada = estado === "bloqueado";
  if (!reconciliado && !bloqueada) return toast("Sincroniza antes de cambiar la contraseña.", "error");
  if (
    bloqueada &&
    !(await confirmar({
      titulo: "Restablecer el cifrado",
      mensaje: "Sin tu contraseña no se puede leer la copia en la nube. Se reemplazará por el progreso de este dispositivo, cifrado con una contraseña nueva. Lo que estaba solo en la nube se pierde.",
      aceptar: "Reemplazar",
      peligro: true,
    }))
  )
    return;
  if (!(await crearContrasena(u, "Elige una contraseña nueva. Tus otros dispositivos te la pedirán la próxima vez que sincronicen."))) return;
  reconciliado = true;
  await subir();
  toast("Tu progreso quedó cifrado con la contraseña nueva.");
}

export async function eliminarCuenta() {
  const u = useSync.getState().usuario;
  if (!u || !fb) return;
  const { auth, db, m } = fb;
  try {
    // Firebase exige un inicio de sesión reciente para borrar la cuenta: se pide antes de tocar los datos.
    await m.reauthenticateWithPopup(auth.currentUser, new m.GoogleAuthProvider());
    reconciliado = false;
    await m.deleteDoc(m.doc(db, COLECCION, u.uid));
    await auth.currentUser.delete();
    toast("Se eliminaron tu cuenta y los datos guardados en la nube.");
  } catch (e: any) {
    if (e?.code !== "auth/popup-closed-by-user") toast("No se pudo eliminar la cuenta. Inténtalo de nuevo.", "error");
  }
}
