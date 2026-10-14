import { NOTA_APROB, clamp } from "./format";
import type { Categoria, ConfigExamen, Entrada, EscalaPresentacion, ModoPromedio } from "./state";

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

/**
 * - "sin-eximicion": el ramo no exime (siempre se rinde el examen).
 * - "eximido": la presentación está completa y alcanza la nota de eximición.
 * - "asegurada": aunque saques 1,0 en lo que queda antes del examen, te eximes.
 * - "posible": aún puedes eximirte (ver necesariaEximir).
 * - "no-eximido": ya no te eximes (ver motivo); vas a examen.
 */
export type EstadoEximicion = "sin-eximicion" | "eximido" | "asegurada" | "posible" | "no-eximido";

export interface InfoExamen {
  /** % de la nota final que vale el examen. */
  peso: number;
  escala: EscalaPresentacion;
  /** Nota de presentación con lo rendido (null si no hay notas). */
  np: number | null;
  /** Nota de presentación con lo pendiente como 1,0. */
  npPeor: number | null;
  /** Ya se rindió todo lo previo al examen. */
  presentacionCompleta: boolean;
  /** Suma de los % de las categorías previas al examen, tal como se escribieron. */
  pesoPresentacion: number;
  /** Lo que deberían sumar: 100 (escala presentación) o 100 − % del examen (escala ramo). */
  pesoPresentacionEsperado: number;
  eximicion: number | null;
  estado: EstadoEximicion;
  /** Promedio que necesitas en lo que queda antes del examen para eximirte. */
  necesariaEximir: number | null;
  motivo: "asistencia" | "requisito" | "nota" | null;
  /** Se exige asistencia y aún no registras la tuya. */
  asistenciaPendiente: boolean;
  /** Nota que necesitas en el examen para el 4,0 (presentación completa, sin eximición y examen pendiente). */
  necesariaExamen: number | null;
}

export interface CalculoRamo {
  cerrado: boolean;
  /** Nota que se muestra (final, actual o peor caso según el modo). */
  nf: number | null;
  nfActual: number | null;
  nfPeor: number | null;
  modo: ModoPromedio;
  decimas: number;
  /** % del ramo ya evaluado (de la presentación si ya te eximiste). */
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
  /** Nota de presentación y eximición (null si ninguna categoría es el examen). */
  examen: InfoExamen | null;
}

export const modoPromedio = (e: Entrada): ModoPromedio => (e.modo === "peor" ? "peor" : "actual");

export function notaFinalEfectiva(e: Pick<Entrada, "notaFinal" | "decimas">): number | null {
  if (e.notaFinal === null || e.notaFinal === undefined || Number.isNaN(e.notaFinal)) return null;
  return clamp(e.notaFinal + (e.decimas || 0), 1, 7);
}

const numOpc = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);

/** Configuración del examen con valores por defecto (los % escritos como % del ramo, sin eximición). */
export function configExamen(e: Pick<Entrada, "examen">): ConfigExamen {
  const c = e.examen;
  return {
    escala: c?.escala === "presentacion" ? "presentacion" : "ramo",
    eximicion: numOpc(c?.eximicion, 1, 7),
    asistenciaMin: numOpc(c?.asistenciaMin, 0, 100),
    asistencia: numOpc(c?.asistencia, 0, 100),
  };
}

/** Índice de la categoría que es el examen (la primera marcada con %), o -1. */
export function indiceExamen(e: Pick<Entrada, "categorias">): number {
  return e.categorias.findIndex((c) => c.examen && c.peso > 0);
}

/** % real del ramo que vale una categoría (convierte los % escritos sobre la nota de presentación). */
export function pesoEnRamo(e: Pick<Entrada, "categorias" | "examen">, c: Categoria): number {
  const iEx = indiceExamen(e);
  if (iEx < 0 || c === e.categorias[iEx] || configExamen(e).escala !== "presentacion") return c.peso;
  return (c.peso * (100 - Math.min(100, e.categorias[iEx].peso))) / 100;
}

/** % ya asignado en la escala en que se escribe una categoría nueva (previa al examen). */
export function pesoAsignado(e: Pick<Entrada, "categorias" | "examen">): number {
  const iEx = indiceExamen(e);
  const sinExamen = iEx >= 0 && configExamen(e).escala === "presentacion";
  return e.categorias.reduce((s, c, i) => s + (sinExamen && i === iEx ? 0 : c.peso), 0);
}

interface Acumulado {
  /** Σ (peso decimal × suma rendida / factor total): aporte asegurado. */
  S: number;
  /** Fracción ya evaluada. */
  R: number;
  /** Fracción total definida en categorías. */
  W: number;
  pendienteNoReq: number;
  reqFallidos: string[];
  reqMetas: MetaRequisito[];
}

function acumular(pares: { c: Categoria; w: number }[]): Acumulado {
  const a: Acumulado = { S: 0, R: 0, W: 0, pendienteNoReq: 0, reqFallidos: [], reqMetas: [] };
  pares.forEach(({ c, w }) => {
    a.W += w;
    const st = statsCategoria(c);
    if (st.fTot === 0) {
      if (!c.req) a.pendienteNoReq += w * 100;
      return;
    }
    a.S += w * (st.sumRend / st.fTot);
    a.R += w * (st.fRend / st.fTot);
    if (!c.req) a.pendienteNoReq += w * 100 * (1 - st.fRend / st.fTot);
    else {
      const nombre = c.nombre || "Requisito";
      if (st.fRend >= st.fTot) {
        if ((st.prom ?? 0) < NOTA_APROB) a.reqFallidos.push(nombre);
      } else {
        const nec = (NOTA_APROB * st.fTot - st.sumRend) / (st.fTot - st.fRend);
        if (nec > 7) a.reqFallidos.push(nombre);
        else if (nec > 1) a.reqMetas.push({ nombre, nec });
      }
    }
  });
  return a;
}

function armar(e: Entrada, a: Acumulado, examen: InfoExamen | null): CalculoRamo {
  const modo = modoPromedio(e);
  const { S, R, W } = a;
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
    decimas: e.decimas || 0,
    pesoEvaluado: Math.round(R * 1000) / 10,
    pesoTotal: Math.round(W * 1000) / 10,
    restante: Math.round(pendiente * 1000) / 10,
    necesaria: necesitar(NOTA_APROB),
    necesariaMeta: meta !== null ? necesitar(meta - 0.05) : null,
    reqFallidos: a.reqFallidos,
    reqMetas: a.reqMetas,
    pendienteNoReq: Math.round(a.pendienteNoReq * 10) / 10,
    avisoPorcentaje: W > 1.0001,
    examen,
  };
}

/**
 * Nota de un ramo a partir de sus categorías.
 * NF = Σ promedio_categoría × %categoría. "Actual" reescala lo rendido al % evaluado;
 * "Peor caso" cuenta todo lo pendiente como 1,0 (si igual da 4,0, el ramo está salvado).
 *
 * Con examen, las demás categorías forman la nota de presentación (NP). Si NP alcanza la nota
 * de eximición (redondeada a una décima) y cumples la asistencia, la nota final es NP;
 * si no, NF = NP × (100% − %examen) + examen × %examen.
 */
export function calcularRamo(e: Entrada): CalculoRamo {
  if (e.notaFinal !== null && e.notaFinal !== undefined) {
    return {
      cerrado: true, nf: e.notaFinal, nfActual: e.notaFinal, nfPeor: e.notaFinal, modo: modoPromedio(e), decimas: e.decimas || 0,
      pesoEvaluado: 100, pesoTotal: 100, restante: 0, necesaria: null, necesariaMeta: null,
      reqFallidos: [], reqMetas: [], pendienteNoReq: 0, avisoPorcentaje: false, examen: null,
    };
  }
  const cats = e.categorias.filter((c) => c.peso > 0);
  const ex = cats.find((c) => c.examen);
  if (!ex) return armar(e, acumular(cats.map((c) => ({ c, w: c.peso / 100 }))), null);

  const cfg = configExamen(e);
  const We = Math.min(ex.peso, 100) / 100;
  const Wp = 1 - We;
  const factor = cfg.escala === "presentacion" ? Wp : 1;
  const pares = cats.filter((c) => c !== ex).map((c) => ({ c, w: (c.peso / 100) * factor }));
  const pres = acumular(pares);
  const basePres = Math.max(pres.W, Wp);
  const pendPres = basePres - pres.R;
  const presentacionCompleta = pendPres < 1e-9;
  const np = pres.R > 0 ? pres.S / pres.R : null;
  const npPeor = pres.R > 0 && basePres > 0 ? (pres.S + pendPres) / basePres : null;

  const umbral = cfg.eximicion;
  const corte = umbral !== null ? umbral - 0.05 : Infinity; // 4,95 se redondea a 5,0
  let estado: EstadoEximicion = "sin-eximicion";
  let motivo: InfoExamen["motivo"] = null;
  let necesariaEximir: number | null = null;
  if (umbral !== null) {
    if (cfg.asistenciaMin !== null && cfg.asistencia !== null && cfg.asistencia < cfg.asistenciaMin) [estado, motivo] = ["no-eximido", "asistencia"];
    else if (pres.reqFallidos.length) [estado, motivo] = ["no-eximido", "requisito"];
    else if (presentacionCompleta) [estado, motivo] = np !== null && np >= corte - 1e-9 ? ["eximido", null] : ["no-eximido", "nota"];
    else if (npPeor !== null && npPeor >= corte - 1e-9 && pres.reqMetas.length === 0) estado = "asegurada";
    else {
      const nec = (corte * basePres - pres.S) / pendPres;
      if (nec > 7) [estado, motivo] = ["no-eximido", "nota"];
      else [estado, necesariaEximir] = ["posible", Math.max(1, nec)];
    }
  }

  const info: InfoExamen = {
    peso: Math.round(We * 1000) / 10,
    escala: cfg.escala,
    np,
    npPeor,
    presentacionCompleta,
    pesoPresentacion: Math.round(pares.reduce((s, p) => s + p.c.peso, 0) * 10) / 10,
    pesoPresentacionEsperado: cfg.escala === "presentacion" ? 100 : Math.round(Wp * 1000) / 10,
    eximicion: umbral,
    estado,
    necesariaEximir,
    motivo,
    asistenciaPendiente: cfg.asistenciaMin !== null && cfg.asistencia === null,
    necesariaExamen: null,
  };

  if (estado === "eximido" || estado === "asegurada") {
    // Te eximes: la nota final es la de presentación y el examen no cuenta.
    const k = basePres > 0 ? 1 / basePres : 0;
    const r = armar(e, { ...pres, S: pres.S * k, R: pres.R * k, W: pres.W * k }, info);
    return { ...r, pesoTotal: Math.round((pres.W + We) * 1000) / 10, avisoPorcentaje: pres.W > Wp + 1e-4 };
  }
  const r = armar(e, acumular([...pares, { c: ex, w: We }]), info);
  const st = statsCategoria(ex);
  if (presentacionCompleta && st.fRend < st.fTot) info.necesariaExamen = r.necesaria;
  return r;
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
  categorias: { nombre: string; peso: number; casillas: number; req?: boolean; examen?: boolean }[];
  examen?: ConfigExamen;
}

/** Reemplaza las categorías de un ramo por las de una plantilla. */
export function aplicarPlantilla(e: Entrada, p: Plantilla) {
  e.categorias = p.categorias.map((c) => ({ nombre: c.nombre, peso: c.peso, req: c.req, examen: c.examen, notas: Array.from({ length: c.casillas }, () => ({ n: null, f: 1 })) }));
  if (p.examen) e.examen = { ...p.examen };
  else delete e.examen;
}

export const PLANTILLAS: Plantilla[] = [
  { nombre: "Cátedra + Laboratorio", categorias: [
    { nombre: "Solemnes", peso: 60, casillas: 3 },
    { nombre: "Laboratorios", peso: 25, casillas: 4, req: true },
    { nombre: "Controles", peso: 15, casillas: 4 },
  ] },
  { nombre: "Solemnes + Examen", categorias: [
    { nombre: "Solemnes", peso: 70, casillas: 3 },
    { nombre: "Examen", peso: 30, casillas: 1, examen: true },
  ] },
  { nombre: "Presentación + Examen", categorias: [
    { nombre: "Solemnes", peso: 70, casillas: 3 },
    { nombre: "Controles", peso: 30, casillas: 3 },
    { nombre: "Examen", peso: 30, casillas: 1, examen: true },
  ], examen: { escala: "presentacion", eximicion: 5, asistenciaMin: null, asistencia: null } },
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
