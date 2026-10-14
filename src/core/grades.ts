import { NOTA_APROB, clamp } from "./format";
import type { Categoria, Entrada, ModoPromedio } from "./state";

export interface StatsCategoria {
  /** Promedio con lo pendiente como 1,0 (null si no hay casillas). */
  prom: number | null;
  /** Promedio solo de lo rendido (null si no hay notas). */
  promRendido: number | null;
  fTot: number;
  fRend: number;
  sumRend: number;
}

/**
 * Promedio ponderado de una categoría. Cada casilla tiene un factor (×1 por defecto);
 * un factor 0 hace que la nota no cuente (ej. se elimina la peor prueba).
 */
export function statsCategoria(cat: Categoria): StatsCategoria {
  const items = cat.notas.filter((x) => (x.f ?? 1) > 0);
  const fTot = items.reduce((s, x) => s + (x.f ?? 1), 0);
  if (fTot === 0) return { prom: null, promRendido: null, fTot: 0, fRend: 0, sumRend: 0 };
  const rendidas = items.filter((x) => x.n !== null && !Number.isNaN(x.n));
  const fRend = rendidas.reduce((s, x) => s + (x.f ?? 1), 0);
  const sumRend = rendidas.reduce((s, x) => s + (x.n as number) * (x.f ?? 1), 0);
  return {
    prom: (sumRend + 1.0 * (fTot - fRend)) / fTot,
    promRendido: fRend > 0 ? sumRend / fRend : null,
    fTot,
    fRend,
    sumRend,
  };
}

export interface MetaRequisito {
  nombre: string;
  /** Promedio que necesita en lo que queda de la categoría. */
  nec: number;
}

export interface CalculoRamo {
  cerrado: boolean;
  /** Nota que se muestra (final, actual o peor caso según el modo). */
  nf: number | null;
  nfActual: number | null;
  nfPeor: number | null;
  modo: ModoPromedio;
  decimas: number;
  /** % del ramo ya evaluado. */
  pesoEvaluado: number;
  /** Suma de los % de las categorías. */
  pesoTotal: number;
  /** % que falta por rendir (incluye categorías sin definir hasta completar 100%). */
  restante: number;
  /** Nota necesaria en lo que falta para llegar a 4,0. */
  necesaria: number | null;
  /** Nota necesaria en lo que falta para la meta personal del ramo. */
  necesariaMeta: number | null;
  reqFallidos: string[];
  reqMetas: MetaRequisito[];
  /** % pendiente fuera de categorías con requisito. */
  pendienteNoReq: number;
  avisoPorcentaje: boolean;
}

export const modoPromedio = (e: Entrada): ModoPromedio => (e.modo === "peor" ? "peor" : "actual");

export function notaFinalEfectiva(e: Pick<Entrada, "notaFinal" | "decimas">): number | null {
  if (e.notaFinal === null || e.notaFinal === undefined || Number.isNaN(e.notaFinal)) return null;
  return clamp(e.notaFinal + (e.decimas || 0), 1, 7);
}

/**
 * Nota de un ramo a partir de sus categorías.
 * NF = Σ promedio_categoría × %categoría. "Actual" reescala lo rendido al % evaluado;
 * "Peor caso" cuenta todo lo pendiente como 1,0 (si igual da 4,0, el ramo está salvado).
 */
export function calcularRamo(e: Entrada): CalculoRamo {
  const modo = modoPromedio(e);
  const decimas = e.decimas || 0;
  if (e.notaFinal !== null && e.notaFinal !== undefined) {
    return {
      cerrado: true, nf: e.notaFinal, nfActual: e.notaFinal, nfPeor: e.notaFinal, modo, decimas,
      pesoEvaluado: 100, pesoTotal: 100, restante: 0, necesaria: null, necesariaMeta: null,
      reqFallidos: [], reqMetas: [], pendienteNoReq: 0, avisoPorcentaje: false,
    };
  }
  const cats = e.categorias.filter((c) => c.peso > 0);
  let S = 0; // Σ (peso decimal × suma rendida / factor total): aporte asegurado a la nota final
  let R = 0; // fracción del ramo ya evaluada
  let W = 0; // fracción total definida en categorías
  let pendienteNoReq = 0;
  const reqFallidos: string[] = [];
  const reqMetas: MetaRequisito[] = [];

  cats.forEach((c) => {
    const w = c.peso / 100;
    W += w;
    const st = statsCategoria(c);
    if (st.fTot === 0) {
      if (!c.req) pendienteNoReq += c.peso;
      return;
    }
    S += w * (st.sumRend / st.fTot);
    R += w * (st.fRend / st.fTot);
    if (!c.req) pendienteNoReq += c.peso * (1 - st.fRend / st.fTot);
    else {
      const nombre = c.nombre || "Requisito";
      if (st.fRend >= st.fTot) {
        if ((st.prom ?? 0) < NOTA_APROB) reqFallidos.push(nombre);
      } else {
        const nec = (NOTA_APROB * st.fTot - st.sumRend) / (st.fTot - st.fRend);
        if (nec > 7) reqFallidos.push(nombre);
        else if (nec > 1) reqMetas.push({ nombre, nec });
      }
    }
  });

  // Si las categorías aún no suman 100%, lo no definido también cuenta como pendiente.
  const base = Math.max(W, 1);
  const pendiente = base - R;
  const nfActual = R > 0 ? S / R : null;
  const nfPeor = R > 0 ? S + pendiente * 1.0 : null;
  const necesitar = (objetivo: number) => (R > 0 && pendiente > 1e-9 ? (objetivo - S) / pendiente : null);
  const meta = typeof e.meta === "number" && e.meta >= 1 && e.meta <= 7 ? e.meta : null;

  return {
    cerrado: false,
    nf: modo === "actual" ? nfActual : nfPeor,
    nfActual,
    nfPeor,
    modo,
    decimas,
    pesoEvaluado: Math.round(R * 1000) / 10,
    pesoTotal: Math.round(W * 1000) / 10,
    restante: Math.round(pendiente * 1000) / 10,
    necesaria: necesitar(NOTA_APROB),
    necesariaMeta: meta !== null ? necesitar(meta - 0.05) : null,
    reqFallidos,
    reqMetas,
    pendienteNoReq: Math.round(pendienteNoReq * 10) / 10,
    avisoPorcentaje: W > 1.0001,
  };
}

/** El ramo ya no puede reprobar (peor caso ≥ 4,0 y sin requisitos pendientes o perdidos). */
export function ramoAsegurado(c: CalculoRamo): boolean {
  if (c.cerrado) return (c.nf ?? 0) >= NOTA_APROB;
  return c.nfPeor !== null && c.nfPeor >= NOTA_APROB && c.reqFallidos.length === 0 && c.reqMetas.length === 0;
}

/** Cómo vas en un ramo abierto: "perdido" = ya no alcanzas el 4,0 ni con 7,0 en lo que queda. */
export type RendimientoRamo = "sin-notas" | "asegurado" | "aprobando" | "reprobando" | "perdido";

export function rendimientoRamo(c: CalculoRamo): RendimientoRamo {
  if (ramoAsegurado(c)) return "asegurado";
  if (c.reqFallidos.length || (c.necesaria !== null && c.necesaria > 7)) return "perdido";
  if (c.nfActual === null) return "sin-notas";
  if (c.nfActual >= NOTA_APROB) return "aprobando";
  return c.restante > 0 ? "reprobando" : "perdido";
}

// ── Escala de notas chilena: puntaje → nota ──

export interface Escala {
  puntajeMax: number;
  /** Exigencia para el 4,0 (0,6 = 60%). */
  exigencia: number;
  notaMin?: number;
  notaMax?: number;
  notaAprob?: number;
}

export function notaDesdePuntaje(puntaje: number, esc: Escala): number {
  const { puntajeMax, exigencia, notaMin = 1, notaMax = 7, notaAprob = 4 } = esc;
  if (!(puntajeMax > 0)) return NaN;
  const p = clamp(puntaje, 0, puntajeMax);
  const corte = exigencia * puntajeMax;
  const nota =
    p < corte
      ? notaMin + ((notaAprob - notaMin) * p) / corte
      : notaAprob + ((notaMax - notaAprob) * (p - corte)) / (puntajeMax - corte || 1);
  return Math.round(clamp(nota, notaMin, notaMax) * 10) / 10;
}

/** Puntaje mínimo para obtener cierta nota (inversa de la escala). */
export function puntajeParaNota(nota: number, esc: Escala): number {
  const { puntajeMax, exigencia, notaMin = 1, notaMax = 7, notaAprob = 4 } = esc;
  const corte = exigencia * puntajeMax;
  const n = clamp(nota, notaMin, notaMax);
  return n < notaAprob
    ? ((n - notaMin) * corte) / (notaAprob - notaMin)
    : corte + ((n - notaAprob) * (puntajeMax - corte)) / (notaMax - notaAprob);
}

// ── Plantillas rápidas de evaluación ──

export interface Plantilla {
  nombre: string;
  categorias: { nombre: string; peso: number; casillas: number; req?: boolean }[];
}

export const PLANTILLAS: Plantilla[] = [
  { nombre: "Cátedra + Laboratorio", categorias: [
    { nombre: "Solemnes", peso: 60, casillas: 3 },
    { nombre: "Laboratorios", peso: 25, casillas: 4, req: true },
    { nombre: "Controles", peso: 15, casillas: 4 },
  ] },
  { nombre: "Solemnes + Examen", categorias: [
    { nombre: "Solemnes", peso: 70, casillas: 3 },
    { nombre: "Examen", peso: 30, casillas: 1 },
  ] },
  { nombre: "Proyecto", categorias: [
    { nombre: "Entregas", peso: 60, casillas: 3 },
    { nombre: "Presentación final", peso: 25, casillas: 1 },
    { nombre: "Coevaluación", peso: 15, casillas: 1 },
  ] },
  { nombre: "Pruebas + Tareas", categorias: [
    { nombre: "Pruebas", peso: 60, casillas: 3 },
    { nombre: "Tareas", peso: 40, casillas: 4 },
  ] },
];
