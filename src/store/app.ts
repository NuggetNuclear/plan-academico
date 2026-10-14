import { useMemo } from "react";
import { create } from "zustand";
import { aprobadosSet, ramosSemestreActual, type Ctx } from "../core/academic";
import { construirCurriculum, type Curriculum } from "../core/curriculum";
import type { Plan } from "../core/planner";
import { estadoInicial, normalizarEstado, type PlannerState } from "../core/state";
import type { MallaDef } from "../core/types";
import { sincronizar } from "./mutaciones";

/** La app es solo para Ingeniería Civil en Informática y Telecomunicaciones (UDP). */
export const CARRERA_ID = "inf";
const ARCHIVO_MALLA = "carreras/inf.json";
const claveEstado = (carrera: string) => `notas.v1.estado.${carrera}`;
/** Claves de versiones con varias carreras: se limpian al borrar los datos. */
const CLAVES_ANTIGUAS = ["notas.v1.carrera", claveEstado("ds")];
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

export function leerEstadoGuardado(): PlannerState | null {
  const raw = leerLocal(claveEstado(CARRERA_ID));
  if (!raw) return null;
  try {
    return normalizarEstado(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Progreso guardado en este navegador, con el formato de respaldos y sincronización ({ inf: estado }). */
export function leerTodosLosEstados(): Record<string, PlannerState> {
  const st = leerEstadoGuardado();
  return st ? { [CARRERA_ID]: st } : {};
}

export function guardarEstadoLocal(st: PlannerState) {
  escribirLocal(claveEstado(CARRERA_ID), JSON.stringify(st));
  window.dispatchEvent(new CustomEvent("notas:guardado"));
}

export function borrarEstadosLocales() {
  [claveEstado(CARRERA_ID), ...CLAVES_ANTIGUAS].forEach((k) => escribirLocal(k, null));
}

async function cargarMalla(): Promise<MallaDef> {
  const res = await fetch(ARCHIVO_MALLA);
  if (!res.ok) throw new Error(`No se pudo cargar la malla (${ARCHIVO_MALLA}).`);
  return (await res.json()) as MallaDef;
}

export interface PlanesEditados {
  firma: string;
  planes: Plan[];
}

interface AppStore {
  carga: "cargando" | "listo" | "error";
  error: string | null;
  malla: MallaDef | null;
  cur: Curriculum | null;
  st: PlannerState;
  pilaDeshacer: { st: PlannerState; etiqueta: string }[];
  planesEditados: PlanesEditados | null;

  iniciar: () => Promise<void>;
  /** Aplica un cambio sobre una copia del estado, lo sincroniza y lo guarda. */
  mutar: (etiqueta: string | null, fn: (ctx: Ctx) => void) => void;
  deshacer: () => string | null;
  /** Reemplaza el progreso por el de un respaldo o de la nube ({ inf: estado }). */
  reemplazarTodo: (estados: Record<string, PlannerState>) => void;
  setPlanesEditados: (p: PlanesEditados | null) => void;
}

export const useApp = create<AppStore>((set, get) => ({
  carga: "cargando",
  error: null,
  malla: null,
  cur: null,
  st: estadoInicial(),
  pilaDeshacer: [],
  planesEditados: null,

  async iniciar() {
    try {
      const malla = await cargarMalla();
      const st = leerEstadoGuardado() ?? estadoInicial();
      const cur = construirCurriculum(malla);
      sincronizar({ cur, st });
      set({ malla, cur, st, carga: "listo", error: null, pilaDeshacer: [], planesEditados: null });
    } catch (e) {
      set({ carga: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },

  mutar(etiqueta, fn) {
    const s = get();
    if (!s.cur) return;
    const borrador = structuredClone(s.st);
    const ctx: Ctx = { cur: s.cur, st: borrador };
    fn(ctx);
    // Al cambiar de semestre, la carpeta vacía del semestre anterior ya no sirve.
    if (borrador.semestreActual !== s.st.semestreActual) {
      borrador.periodos = borrador.periodos.filter(
        (p) => !(p.tipo === "regular" && p.numero === s.st.semestreActual && p.ramos.length === 0 && !p.ventana),
      );
    }
    sincronizar(ctx);
    guardarEstadoLocal(borrador);
    set({
      st: borrador,
      pilaDeshacer: etiqueta ? [...s.pilaDeshacer.slice(-(MAX_DESHACER - 1)), { st: s.st, etiqueta }] : s.pilaDeshacer,
    });
  },

  deshacer() {
    const s = get();
    const ultimo = s.pilaDeshacer.at(-1);
    if (!ultimo) return null;
    guardarEstadoLocal(ultimo.st);
    set({ st: ultimo.st, pilaDeshacer: s.pilaDeshacer.slice(0, -1) });
    return ultimo.etiqueta;
  },

  reemplazarTodo(estados) {
    const { cur } = get();
    const st = structuredClone(estados[CARRERA_ID] ?? estadoInicial());
    if (cur) sincronizar({ cur, st });
    borrarEstadosLocales();
    guardarEstadoLocal(st);
    set({ st, pilaDeshacer: [], planesEditados: null });
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
export function firmaPlanificacion(ctx: Ctx): string {
  const { st } = ctx;
  return JSON.stringify([
    [...aprobadosSet(ctx)].sort(),
    [...st.cursando].sort(),
    ramosSemestreActual(ctx).map((r) => r.id).sort(),
    st.semestreActual,
    st.maxCreditos,
    st.modoPractica,
    st.congelaciones,
    st.inglesEximido,
  ]);
}
