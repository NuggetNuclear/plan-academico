// Sincronización opcional con una cuenta de Google (Firebase Auth + Firestore).
// Solo se activa si defines las variables VITE_FIREBASE_* (ver README). Sin ellas,
// la app funciona igual guardando todo en el navegador.
import { create } from "zustand";
import type { PlannerState } from "../core/state";
import { leerTodosLosEstados, useApp } from "../store/app";
import { toast } from "../store/ui";

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

export type EstadoSync = "local" | "conectando" | "sincronizando" | "sincronizado" | "sin-conexion" | "error";

export interface Conflicto {
  nube: { estados: Record<string, PlannerState>; carreraActual: string | null; actualizado: number };
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
    default:
      return { texto: "Conectado", tono: "neutro" };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let fb: { auth: any; db: any; m: any } | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let aplicandoNube = false;

const importar = (ruta: string) => import(/* @vite-ignore */ `${SDK}/${ruta}`);

async function cargarFirebase() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([importar("firebase-app.js"), importar("firebase-auth.js"), importar("firebase-firestore.js")]);
  const instancia = app.initializeApp(config);
  fb = { auth: auth.getAuth(instancia), db: fs.getFirestore(instancia), m: { ...auth, ...fs } };
  return fb;
}

const tieneProgreso = (estados: Record<string, PlannerState>) =>
  Object.values(estados).some((s) => Object.keys(s.marcas).length > 0 || s.cursando.length > 0 || s.periodos.some((p) => p.ramos.length > 0));

const firma = (estados: Record<string, PlannerState>) => JSON.stringify(Object.keys(estados).sort().map((k) => [k, estados[k]]));

async function leerNube(uid: string) {
  const { db, m } = await cargarFirebase();
  const snap = await m.getDoc(m.doc(db, COLECCION, uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    estados: JSON.parse(d.estados || "{}") as Record<string, PlannerState>,
    carreraActual: (d.carreraActual as string) ?? null,
    actualizado: Number(d.actualizado) || 0,
  };
}

async function subir() {
  const u = useSync.getState().usuario;
  if (!u) return;
  const { db, m } = await cargarFirebase();
  const { indice, carreraId } = useApp.getState();
  useSync.setState({ estado: "sincronizando" });
  try {
    const ahora = Date.now();
    await m.setDoc(m.doc(db, COLECCION, u.uid), {
      estados: JSON.stringify(leerTodosLosEstados(indice)),
      carreraActual: carreraId,
      actualizado: ahora,
      version: 1,
    });
    useSync.setState({ estado: "sincronizado", ultima: ahora });
  } catch {
    useSync.setState({ estado: navigator.onLine ? "error" : "sin-conexion" });
  }
}

async function reconciliar(u: Usuario) {
  useSync.setState({ estado: "conectando" });
  try {
    const nube = await leerNube(u.uid);
    const local = leerTodosLosEstados(useApp.getState().indice);
    if (!nube || !tieneProgreso(nube.estados)) return subir();
    if (!tieneProgreso(local) || firma(local) === firma(nube.estados)) {
      aplicandoNube = true;
      await useApp.getState().reemplazarTodo(nube.estados, nube.carreraActual);
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
  if (eleccion === "nube") {
    aplicandoNube = true;
    await useApp.getState().reemplazarTodo(c.nube.estados, c.nube.carreraActual);
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
        useSync.setState({ usuario: null, estado: "local" });
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
    window.addEventListener("online", () => useSync.getState().usuario && subir());
  } catch {
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

export const sincronizarAhora = () => subir();

export async function eliminarCuenta() {
  const u = useSync.getState().usuario;
  if (!u || !fb) return;
  try {
    await fb.m.deleteDoc(fb.m.doc(fb.db, COLECCION, u.uid));
    await fb.auth.currentUser?.delete();
    toast("Se eliminaron tu cuenta y los datos guardados en la nube.");
  } catch {
    toast("Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.", "error");
  }
}
