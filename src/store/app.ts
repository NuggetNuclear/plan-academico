import { useMemo } from "react";
import { create } from "zustand";
import { aprobadosSet, ramosSemestreActual, type Ctx } from "../core/academic";
import { construirCurriculum, type Curriculum } from "../core/curriculum";
import type { Plan } from "../core/planner";
import { estadoInicial, normalizarEstado, type PlannerState } from "../core/state";
import type { CarreraIndice, MallaDef } from "../core/types";
import { sincronizar } from "./mutaciones";

const CLAVE_CARRERA = "notas.v1.carrera";
const claveEstado = (carrera: string) => `notas.v1.estado.${carrera}`;
const MAX_DESHACER = 40;

function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirLocal(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* modo privado o almacenamiento lleno: la app sigue funcionando en memoria */
  }
}

export function leerEstadoGuardado(carrera: string): PlannerState | null {
  const raw = leerLocal(claveEstado(carrera));
  if (!raw) return null;
  try {
    return normalizarEstado(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Todas las carreras con progreso guardado en este navegador. */
export function leerTodosLosEstados(indice: CarreraIndice[]): Record<string, PlannerState> {
  const out: Record<string, PlannerState> = {};
  indice.forEach((c) => {
    const st = leerEstadoGuardado(c.id);
    if (st) out[c.id] = st;
  });
  return out;
}

export function guardarEstadoLocal(carrera: string, st: PlannerState) {
  escribirLocal(claveEstado(carrera), JSON.stringify(st));
  window.dispatchEvent(new CustomEvent("notas:guardado"));
}

export function borrarEstadosLocales(indice: CarreraIndice[]) {
  indice.forEach((c) => escribirLocal(claveEstado(c.id), null));
  escribirLocal(CLAVE_CARRERA, null);
}

const cacheMallas = new Map<string, MallaDef>();

export async function cargarMalla(info: CarreraIndice): Promise<MallaDef> {
  const cached = cacheMallas.get(info.id);
  if (cached) return cached;
  const res = await fetch(info.archivo);
  if (!res.ok) throw new Error(`No se pudo cargar la malla (${info.archivo}).`);
  const malla = (await res.json()) as MallaDef;
  cacheMallas.set(info.id, malla);
  return malla;
}

export interface PlanesEditados {
  firma: string;
  planes: Plan[];
}

interface AppStore {
  carga: "cargando" | "listo" | "error";
  error: string | null;
  indice: CarreraIndice[];
  carreraId: string | null;
  malla: MallaDef | null;
  cur: Curriculum | null;
  st: PlannerState;
  pilaDeshacer: { st: PlannerState; etiqueta: string }[];
  planesEditados: PlanesEditados | null;

  iniciar: () => Promise<void>;
  cambiarCarrera: (id: string, estado?: PlannerState) => Promise<void>;
  /** Aplica un cambio sobre una copia del estado, lo sincroniza y lo guarda. */
  mutar: (etiqueta: string | null, fn: (ctx: Ctx) => void) => void;
  deshacer: () => string | null;
  reemplazarTodo: (estados: Record<string, PlannerState>, carrera: string | null) => Promise<void>;
  setPlanesEditados: (p: PlanesEditados | null) => void;
}

export const useApp = create<AppStore>((set, get) => ({
  carga: "cargando",
  error: null,
  indice: [],
  carreraId: null,
  malla: null,
  cur: null,
  st: estadoInicial(),
  pilaDeshacer: [],
  planesEditados: null,

  async iniciar() {
    try {
      const res = await fetch("carreras/index.json");
      if (!res.ok) throw new Error("No se encontró el listado de carreras.");
      const data = (await res.json()) as { default: string; carreras: CarreraIndice[] };
      const indice = data.carreras ?? [];
      if (!indice.length) throw new Error("No hay carreras configuradas.");
      set({ indice });
      let id = leerLocal(CLAVE_CARRERA);
      if (!id || !indice.some((c) => c.id === id)) id = data.default;
      if (!indice.some((c) => c.id === id)) id = indice[0].id;
      await get().cambiarCarrera(id!);
    } catch (e) {
      set({ carga: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },

  async cambiarCarrera(id, estado) {
    const info = get().indice.find((c) => c.id === id);
    if (!info) return;
    const malla = await cargarMalla(info);
    const st = estado ?? leerEstadoGuardado(id) ?? estadoInicial();
    const cur = construirCurriculum(malla, { rutaId: st.rutaAcademica, gruposAltModo: st.gruposAltModo });
    const ctx = { cur, st };
    sincronizar(ctx);
    escribirLocal(CLAVE_CARRERA, id);
    set({ carreraId: id, malla, cur, st, carga: "listo", error: null, pilaDeshacer: [], planesEditados: null });
  },

  mutar(etiqueta, fn) {
    const s = get();
    if (!s.malla || !s.cur || !s.carreraId) return;
    const borrador = structuredClone(s.st);
    const ctx: Ctx = { cur: s.cur, st: borrador };
    fn(ctx);
    if (borrador.rutaAcademica !== s.st.rutaAcademica || JSON.stringify(borrador.gruposAltModo) !== JSON.stringify(s.st.gruposAltModo)) {
      ctx.cur = construirCurriculum(s.malla, { rutaId: borrador.rutaAcademica, gruposAltModo: borrador.gruposAltModo });
    }
    // Al cambiar de semestre, la carpeta vacía del semestre anterior ya no sirve.
    if (borrador.semestreActual !== s.st.semestreActual) {
      borrador.periodos = borrador.periodos.filter(
        (p) => !(p.tipo === "regular" && p.numero === s.st.semestreActual && p.ramos.length === 0 && !p.ventana),
      );
    }
    sincronizar(ctx);
    guardarEstadoLocal(s.carreraId, borrador);
    set({
      st: borrador,
      cur: ctx.cur,
      pilaDeshacer: etiqueta ? [...s.pilaDeshacer.slice(-(MAX_DESHACER - 1)), { st: s.st, etiqueta }] : s.pilaDeshacer,
    });
  },

  deshacer() {
    const s = get();
    const ultimo = s.pilaDeshacer.at(-1);
    if (!ultimo || !s.malla || !s.carreraId) return null;
    const st = ultimo.st;
    const cur = construirCurriculum(s.malla, { rutaId: st.rutaAcademica, gruposAltModo: st.gruposAltModo });
    guardarEstadoLocal(s.carreraId, st);
    set({ st, cur, pilaDeshacer: s.pilaDeshacer.slice(0, -1) });
    return ultimo.etiqueta;
  },

  async reemplazarTodo(estados, carrera) {
    const { indice } = get();
    borrarEstadosLocales(indice);
    Object.entries(estados).forEach(([id, st]) => indice.some((c) => c.id === id) && escribirLocal(claveEstado(id), JSON.stringify(st)));
    const destino = carrera && indice.some((c) => c.id === carrera) ? carrera : Object.keys(estados)[0] ?? get().carreraId ?? indice[0]?.id;
    if (destino) await get().cambiarCarrera(destino, estados[destino]);
    window.dispatchEvent(new CustomEvent("notas:guardado"));
  },

  setPlanesEditados(p) {
    set({ planesEditados: p });
  },
}));

/** Malla y progreso actuales, listos para las funciones de core/. */
export function useCtx(): Ctx {
  const cur = useApp((s) => s.cur);
  const st = useApp((s) => s.st);
  return useMemo(() => ({ cur: cur!, st }), [cur, st]);
}

/** Lo que afecta a la planificación: si cambia, los planes se recalculan. */
export function firmaPlanificacion(ctx: Ctx, carreraId: string | null): string {
  const { st } = ctx;
  return JSON.stringify([
    carreraId,
    st.rutaAcademica,
    [...aprobadosSet(ctx)].sort(),
    [...st.cursando].sort(),
    ramosSemestreActual(ctx).map((r) => r.id).sort(),
    st.semestreActual,
    st.maxCreditos,
    st.modoPractica,
    st.congelaciones,
    st.gruposAltModo,
    st.inglesEximido,
  ]);
}
