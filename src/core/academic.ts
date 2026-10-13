import { cumpleRequisitos, evaluarReglaPractica, anualDisponibleEn, esSoloMalla, type Curriculum } from "./curriculum";
import { NOTA_APROB } from "./format";
import { notaFinalEfectiva } from "./grades";
import type { Entrada, Periodo, PlannerState } from "./state";
import type { Ramo, RamoDef } from "./types";

export interface Ctx {
  cur: Curriculum;
  st: PlannerState;
}

export type EstadoRamo = "aprobado" | "cursando" | "disponible" | "bloqueado";

export const ETIQUETA_ESTADO: Record<EstadoRamo, string> = {
  aprobado: "Aprobado",
  cursando: "Cursando",
  disponible: "Puedo tomar",
  bloqueado: "Bloqueado",
};

// ── Periodos ──

export const ordenPeriodo = (p: Pick<Periodo, "tipo" | "numero">) =>
  p.tipo === "convalidaciones" ? 0 : p.numero + (p.tipo === "verano" ? 0.5 : 0);

export const clavePeriodo = (p: Pick<Periodo, "tipo" | "numero">) =>
  p.tipo === "convalidaciones" ? "c0" : (p.tipo === "verano" ? "v" : "s") + p.numero;

export function nombrePeriodo(p: Pick<Periodo, "tipo" | "numero">, verano = "Semestre de verano"): string {
  if (p.tipo === "convalidaciones") return "Convalidaciones";
  if (p.tipo === "verano") return `${verano} ${p.numero}`;
  return `Semestre ${p.numero}`;
}

export function periodosOrdenados(st: PlannerState): Periodo[] {
  return [...st.periodos].sort((a, b) => ordenPeriodo(a) - ordenPeriodo(b));
}

export const esPeriodoActual = (st: PlannerState, p: Periodo) => p.tipo === "regular" && p.numero === st.semestreActual;

// ── Catálogo ──

export function ramoCatalogo(ctx: Ctx, id: string): RamoDef | undefined {
  return ctx.cur.map[id] ?? ctx.cur.catalogo[id];
}

export function siglaRamo(ctx: Ctx, id: string): string {
  const r = ramoCatalogo(ctx, id);
  if (r?.tipo === "OFG") return r.sigla || id;
  return ctx.st.alias[id]?.sigla || r?.sigla || id;
}

export function nombreRamo(ctx: Ctx, id: string): string {
  const r = ramoCatalogo(ctx, id);
  if (r?.tipo === "OFG") return r.nombre || id;
  return ctx.st.alias[id]?.nombre || r?.nombre || id;
}

export function siglaEntrada(ctx: Ctx, e: Entrada): string {
  return e.siglaReal?.trim() || siglaRamo(ctx, e.id);
}

export function nombreEntrada(ctx: Ctx, e: Entrada): string {
  return e.nombreReal?.trim() || nombreRamo(ctx, e.id);
}

// ── Inglés y OFG ──

export function idsInglesEximidos(ctx: Ctx): Set<string> {
  const niveles = (ctx.cur.malla.nivelesIngles ?? []).filter((id) => ramoCatalogo(ctx, id));
  return new Set(niveles.slice(0, Math.min(niveles.length, ctx.st.inglesEximido)));
}

export function esEximido(ctx: Ctx, id: string): boolean {
  return idsInglesEximidos(ctx).has(id) && !tieneConvalidacion(ctx, id);
}

function creditosInglesComoLibres(ctx: Ctx): number {
  const cfg = ctx.cur.malla.configuracionOFG;
  if (!cfg) return 0;
  const niveles = (ctx.cur.malla.nivelesIngles ?? []).filter((id) => ramoCatalogo(ctx, id));
  const porCursar = niveles.slice(ctx.st.inglesEximido).reduce((s, id) => s + (ramoCatalogo(ctx, id)?.creditos ?? 0), 0);
  return Math.min(cfg.maxCreditosInglesComoLibres || 0, porCursar);
}

/** Créditos que un ramo aporta a la malla (el OFG libre puede quedar cubierto por inglés). */
export function creditosCurriculares(ctx: Ctx, ramo: RamoDef | undefined): number {
  if (!ramo) return 0;
  const cfg = ctx.cur.malla.configuracionOFG;
  if (!cfg || ramo.tipo !== "OFG" || ramo.id !== cfg.ofgLibreId) return ramo.creditos;
  return Math.max(0, ramo.creditos - creditosInglesComoLibres(ctx));
}

export const cubiertoPorIngles = (ctx: Ctx, ramo: RamoDef) => ramo.tipo === "OFG" && creditosCurriculares(ctx, ramo) === 0;

export function creditosEntrada(ctx: Ctx, e: Entrada): number {
  if (typeof e.creditos === "number" && e.creditos >= 0) return e.creditos;
  return ramoCatalogo(ctx, e.id)?.creditos ?? 0;
}

/** Nota final efectiva de una entrada, sin contar niveles de inglés eximidos. */
export function notaEntrada(ctx: Ctx, e: Entrada): number | null {
  return esEximido(ctx, e.id) ? null : notaFinalEfectiva(e);
}

export const entradaAprobada = (ctx: Ctx, e: Entrada) => {
  const n = notaEntrada(ctx, e);
  return n !== null && n >= NOTA_APROB;
};

export function tieneConvalidacion(ctx: Ctx, id: string): boolean {
  return ctx.st.periodos.some((p) => p.tipo === "convalidaciones" && p.ramos.some((e) => e.id === id));
}

// ── Estado de cada ramo ──

export interface RegistroIntento {
  entrada: Entrada;
  periodo: Periodo;
  nota: number;
}

/** Aprobación más reciente registrada en Notas. */
export function aprobacionEnNotas(ctx: Ctx, id: string): RegistroIntento | null {
  let mejor: RegistroIntento | null = null;
  ctx.st.periodos.forEach((p) =>
    p.ramos.forEach((e) => {
      if (e.id !== id || !entradaAprobada(ctx, e)) return;
      if (!mejor || ordenPeriodo(p) >= ordenPeriodo(mejor.periodo)) mejor = { entrada: e, periodo: p, nota: notaEntrada(ctx, e)! };
    }),
  );
  return mejor;
}

/** Último intento cerrado (aprobado o reprobado), sin contar convalidaciones. */
export function ultimoIntento(ctx: Ctx, id: string): RegistroIntento | null {
  let ultimo: RegistroIntento | null = null;
  ctx.st.periodos.forEach((p) => {
    if (p.tipo === "convalidaciones") return;
    p.ramos.forEach((e) => {
      const nota = e.id === id ? notaEntrada(ctx, e) : null;
      if (nota === null) return;
      if (!ultimo || ordenPeriodo(p) >= ordenPeriodo(ultimo.periodo)) ultimo = { entrada: e, periodo: p, nota };
    });
  });
  return ultimo;
}

/** Todos los ramos que cuentan como aprobados para requisitos. */
export function aprobadosSet(ctx: Ctx): Set<string> {
  const set = new Set<string>(Object.keys(ctx.st.marcas));
  idsInglesEximidos(ctx).forEach((id) => set.add(id));
  ctx.st.periodos.forEach((p) => p.ramos.forEach((e) => entradaAprobada(ctx, e) && set.add(e.id)));
  return set;
}

export function estaAprobado(ctx: Ctx, id: string, aprobados = aprobadosSet(ctx)): boolean {
  return aprobados.has(id);
}

export function estadoRamo(ctx: Ctx, id: string, aprobados = aprobadosSet(ctx)): EstadoRamo {
  const ramo = ctx.cur.map[id];
  if (ramo && cubiertoPorIngles(ctx, ramo)) return "bloqueado";
  if (aprobados.has(id)) return "aprobado";
  if (ctx.st.cursando.includes(id)) return "cursando";
  if (!ramo) return "bloqueado";
  if (ramo.semestreMinimo && ctx.st.semestreActual < ramo.semestreMinimo) return "bloqueado";
  if (!anualDisponibleEn(ramo, ctx.st.semestreActual, ctx.st.congelaciones)) return "bloqueado";
  if (ramo.reglaPractica) return evaluarReglaPractica(ramo, aprobados).ok ? "disponible" : "bloqueado";
  return cumpleRequisitos(ramo, aprobados, new Set(ctx.st.cursando)) ? "disponible" : "bloqueado";
}

/** Prerrequisitos que aún impiden marcar el ramo. */
export function prerrequisitosPendientes(ctx: Ctx, ramo: Ramo, aprobados = aprobadosSet(ctx)): string[] {
  if (ramo.reglaPractica) {
    const ev = evaluarReglaPractica(ramo, aprobados);
    if (ev.ok) return [];
    return ev.faltan.length <= (ramo.reglaPractica.maxDeuda ?? 1) ? ev.bloqueanPorSinDeuda : ev.faltan;
  }
  const cursando = new Set(ctx.st.cursando);
  return [...ramo.req.filter((id) => !aprobados.has(id)), ...ramo.coreq.filter((id) => !aprobados.has(id) && !cursando.has(id))];
}

/** Ramos del semestre en curso: los que estás cursando y los ya cerrados este semestre. */
export function ramosSemestreActual(ctx: Ctx): Ramo[] {
  const actual = ctx.st.periodos.find((p) => esPeriodoActual(ctx.st, p));
  const cerradosAqui = new Set(actual?.ramos.filter((e) => entradaAprobada(ctx, e)).map((e) => e.id) ?? []);
  Object.entries(ctx.st.marcas).forEach(([id, sem]) => sem === ctx.st.semestreActual && cerradosAqui.add(id));
  return ctx.cur.ramos.filter((r) => !esSoloMalla(r) && (ctx.st.cursando.includes(r.id) || cerradosAqui.has(r.id)));
}

/** Semestre en que se aprobó un ramo (para la etiqueta S# de la malla). */
export function infoAprobacion(ctx: Ctx, id: string): { etiqueta: string; tipo: "semestre" | "convalidado" | "rapido" | "eximido" | "cumplido" } | null {
  const reg = aprobacionEnNotas(ctx, id);
  if (reg) {
    if (reg.periodo.tipo === "convalidaciones") return { etiqueta: "Convalidado", tipo: "convalidado" };
    return { etiqueta: reg.periodo.tipo === "verano" ? `V${reg.periodo.numero}` : `S${reg.periodo.numero}`, tipo: "semestre" };
  }
  if (esEximido(ctx, id)) return { etiqueta: "Eximido", tipo: "eximido" };
  if (id in ctx.st.marcas) {
    const sem = ctx.st.marcas[id];
    if (ramoCatalogo(ctx, id)?.tipo === "REQUERIDO") return { etiqueta: "Cumplido", tipo: "cumplido" };
    if (sem === null) return { etiqueta: "Cursado", tipo: "rapido" };
    if (sem === 0) return { etiqueta: "Convalidado", tipo: "convalidado" };
    return { etiqueta: `S${sem}`, tipo: "semestre" };
  }
  return null;
}

/** Última nota final conocida de un ramo (para mostrarla en la malla). */
export function notaRamo(ctx: Ctx, id: string): number | null {
  let nota: number | null = null;
  let orden = -Infinity;
  ctx.st.periodos.forEach((p) =>
    p.ramos.forEach((e) => {
      if (e.id !== id) return;
      const n = notaEntrada(ctx, e);
      if (n !== null && ordenPeriodo(p) >= orden) {
        orden = ordenPeriodo(p);
        nota = n;
      }
    }),
  );
  return nota;
}

// ── Créditos ──

export type ResultadoIntento = "aprobado" | "reprobado" | "cursando";

export interface Intento {
  id: string;
  creditos: number;
  resultado: ResultadoIntento;
}

/**
 * Cada inscripción registrada: intentos cerrados en Notas, ramos cursando ahora y
 * aprobaciones marcadas en la malla sin nota (cuentan una vez).
 */
export function intentosInscritos(ctx: Ctx): Intento[] {
  const out: Intento[] = [];
  const idsActivos = new Set(ctx.cur.ramos.map((r) => r.id));
  const aprobadosConNota = new Set<string>();
  const cursandoConEntrada = new Set<string>();

  ctx.st.periodos.forEach((p) => {
    const vistos = new Set<string>();
    p.ramos.forEach((e) => {
      const esOFG = ramoCatalogo(ctx, e.id)?.tipo === "OFG";
      if (!esOFG && vistos.has(e.id)) return;
      vistos.add(e.id);
      if (esEximido(ctx, e.id)) return;
      const nota = notaFinalEfectiva(e);
      let resultado: ResultadoIntento | null = null;
      if (nota !== null) resultado = nota >= NOTA_APROB ? "aprobado" : "reprobado";
      else if (esPeriodoActual(ctx.st, p) && ctx.st.cursando.includes(e.id)) resultado = "cursando";
      if (!resultado) return;
      if (resultado === "aprobado") aprobadosConNota.add(e.id);
      if (resultado === "cursando") cursandoConEntrada.add(e.id);
      out.push({ id: e.id, creditos: creditosEntrada(ctx, e), resultado });
    });
  });

  Object.keys(ctx.st.marcas).forEach((id) => {
    if (aprobadosConNota.has(id) || !idsActivos.has(id) || esEximido(ctx, id)) return;
    const ramo = ctx.cur.map[id];
    if (!ramo || cubiertoPorIngles(ctx, ramo) || ramo.creditos <= 0) return;
    out.push({ id, creditos: creditosCurriculares(ctx, ramo), resultado: "aprobado" });
  });

  ctx.st.cursando.forEach((id) => {
    if (cursandoConEntrada.has(id) || !idsActivos.has(id)) return;
    out.push({ id, creditos: ctx.cur.map[id]?.creditos ?? 0, resultado: "cursando" });
  });
  return out;
}

export interface ResumenCreditos {
  inscritos: number;
  aprobados: number;
  reprobados: number;
  cursando: number;
  ramosCursando: number;
  /** Aprobados que avanzan la malla (sin repetir ramos y con topes por área OFG). */
  avance: number;
  /** Créditos totales del plan. */
  total: number;
}

export function resumenCreditos(ctx: Ctx): ResumenCreditos {
  const intentos = intentosInscritos(ctx);
  const suma = (r: ResultadoIntento) => intentos.filter((i) => i.resultado === r).reduce((s, i) => s + i.creditos, 0);
  return {
    inscritos: intentos.reduce((s, i) => s + i.creditos, 0),
    aprobados: suma("aprobado"),
    reprobados: suma("reprobado"),
    cursando: suma("cursando"),
    ramosCursando: intentos.filter((i) => i.resultado === "cursando").length,
    avance: creditosAvance(ctx, intentos),
    total: creditosTotalesPlan(ctx),
  };
}

function creditosAvance(ctx: Ctx, intentos: Intento[]): number {
  const cfg = ctx.cur.malla.configuracionOFG;
  const maxOFG = cfg?.maxCreditosPorArea ?? Infinity;
  const maxIngles = cfg ? cfg.maxCreditosInglesComoLibres || 0 : Infinity;
  const areaLibre = cfg ? ramoCatalogo(ctx, cfg.ofgLibreId)?.areaOFG ?? cfg.ofgLibreId : null;
  const idsActivos = new Set(ctx.cur.ramos.map((r) => r.id));
  const contados = new Set<string>();
  const ofgPorArea = new Map<string, number>();
  let ingles = 0;
  let total = 0;

  intentos
    .filter((i) => i.resultado === "aprobado" && i.creditos > 0)
    .forEach((i) => {
      const ramo = ramoCatalogo(ctx, i.id);
      if (ramo?.tipo === "OFG") {
        const area = ramo.areaOFG ?? ramo.id;
        ofgPorArea.set(area, (ofgPorArea.get(area) ?? 0) + i.creditos);
        return;
      }
      if (contados.has(i.id)) return;
      if (ramo && !idsActivos.has(i.id) && ramo.tipo !== "INGLES") return;
      contados.add(i.id);
      if (ramo?.tipo === "INGLES") ingles += i.creditos;
      else total += i.creditos;
    });

  ofgPorArea.forEach((cr, area) => {
    const max = area === areaLibre ? Math.max(0, maxOFG - creditosInglesComoLibres(ctx)) : maxOFG;
    total += Math.min(max, cr);
  });
  return total + Math.min(maxIngles, ingles);
}

export function creditosTotalesPlan(ctx: Ctx): number {
  if (ctx.cur.ruta?.creditosPlan) return ctx.cur.ruta.creditosPlan;
  const eximidos = idsInglesEximidos(ctx);
  return ctx.cur.ramos
    .filter((r) => !esSoloMalla(r) && !eximidos.has(r.id))
    .reduce((s, r) => s + creditosCurriculares(ctx, r), 0);
}

// ── PPA ──

/** PPA = Σ(nota final × créditos) ÷ Σ créditos con nota final (incluye reprobados). */
export function calcularPPA(ctx: Ctx, periodos: Periodo[] = ctx.st.periodos): { ppa: number | null; creditos: number } {
  let suma = 0;
  let cred = 0;
  periodos.forEach((p) =>
    p.ramos.forEach((e) => {
      const n = notaEntrada(ctx, e);
      if (n === null) return;
      const c = creditosEntrada(ctx, e);
      suma += n * c;
      cred += c;
    }),
  );
  return { ppa: cred > 0 ? suma / cred : null, creditos: cred };
}

export interface PuntoPPA {
  numero: number;
  etiqueta: string;
  ppa: number;
  acumulado: number;
  creditos: number;
  ventana?: string;
}

/** Evolución del PPA: convalidaciones como base; el verano se suma al semestre que sigue. */
export function evolucionPPA(ctx: Ctx): PuntoPPA[] {
  const grupos = new Map<number, { etiqueta: string; ventana?: string; entradas: Entrada[] }>();
  ctx.st.periodos.forEach((p) => {
    let g = grupos.get(p.numero);
    if (!g) {
      g = { etiqueta: p.tipo === "convalidaciones" ? "Conv." : `S${p.numero}`, entradas: [] };
      grupos.set(p.numero, g);
    }
    if (p.tipo === "regular" && p.ventana) g.ventana = p.ventana;
    p.ramos.forEach((e) => notaEntrada(ctx, e) !== null && g.entradas.push(e));
  });
  const out: PuntoPPA[] = [];
  let sumA = 0;
  let credA = 0;
  [...grupos.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([numero, g]) => {
      let s = 0;
      let cr = 0;
      g.entradas.forEach((e) => {
        const c = creditosEntrada(ctx, e);
        s += notaEntrada(ctx, e)! * c;
        cr += c;
      });
      if (cr === 0) return;
      sumA += s;
      credA += cr;
      out.push({ numero, etiqueta: g.etiqueta, ppa: s / cr, acumulado: sumA / credA, creditos: cr, ventana: g.ventana });
    });
  return out;
}

export interface ResumenPeriodo {
  numero: number;
  sumaPonderada: number;
  credTotal: number;
  credAprobados: number;
  ppa: number;
  ppaAcumulado: number;
  porcentajeAprobado: number;
}

/** Periodos efectivamente cursados (sin convalidaciones) con su aprobación de créditos. */
export function resumenPeriodos(ctx: Ctx, { incluirVerano = false } = {}): ResumenPeriodo[] {
  const por = new Map<number, { numero: number; sumaPonderada: number; credTotal: number; credAprobados: number }>();
  let sumaConv = 0;
  let credConv = 0;
  ctx.st.periodos.forEach((p) => {
    if (p.tipo === "convalidaciones") {
      p.ramos.forEach((e) => {
        const n = notaEntrada(ctx, e);
        if (n === null) return;
        sumaConv += n * creditosEntrada(ctx, e);
        credConv += creditosEntrada(ctx, e);
      });
      return;
    }
    if (p.tipo === "verano" && !incluirVerano) return;
    let g = por.get(p.numero);
    if (!g) por.set(p.numero, (g = { numero: p.numero, sumaPonderada: 0, credTotal: 0, credAprobados: 0 }));
    p.ramos.forEach((e) => {
      const n = notaEntrada(ctx, e);
      if (n === null) return;
      const c = creditosEntrada(ctx, e);
      g.sumaPonderada += n * c;
      g.credTotal += c;
      if (n >= NOTA_APROB) g.credAprobados += c;
    });
  });
  let sumA = sumaConv;
  let credA = credConv;
  return [...por.values()]
    .filter((p) => p.credTotal > 0)
    .sort((a, b) => a.numero - b.numero)
    .map((p) => {
      sumA += p.sumaPonderada;
      credA += p.credTotal;
      return { ...p, ppa: p.sumaPonderada / p.credTotal, ppaAcumulado: sumA / credA, porcentajeAprobado: (p.credAprobados / p.credTotal) * 100 };
    });
}

// ── Historial de intentos y reglamentos ──

export const claveHistorial = (e: Entrada) => e.siglaReal?.trim().toUpperCase() || e.id;

/** Notas finales de cada ramo por intento (un intento por periodo). */
export function historialIntentos(ctx: Ctx): Record<string, number[]> {
  const h: Record<string, number[]> = {};
  periodosOrdenados(ctx.st).forEach((p) => {
    if (p.tipo === "convalidaciones") return;
    const vistos = new Set<string>();
    p.ramos.forEach((e) => {
      const n = notaEntrada(ctx, e);
      const clave = claveHistorial(e);
      if (n === null || vistos.has(clave)) return;
      vistos.add(clave);
      (h[clave] ??= []).push(n);
    });
  });
  return h;
}

export function nombreHistorial(ctx: Ctx, clave: string): string {
  if (ramoCatalogo(ctx, clave)) return nombreRamo(ctx, clave);
  for (const p of ctx.st.periodos) {
    const e = p.ramos.find((x) => claveHistorial(x) === clave);
    if (e) return nombreEntrada(ctx, e);
  }
  return clave;
}

export interface Alerta {
  tipo: string;
  descripcion: string;
  nivel: "critica" | "advertencia";
}

// UDP · Reglamento de Pregrado, artículo 38 (causales de eliminación)
export interface PeriodoUDP {
  numero: number;
  cursadas: number;
  reprobadas: number;
}

export function periodosUDP(ctx: Ctx): PeriodoUDP[] {
  const por = new Map<number, PeriodoUDP>();
  ctx.st.periodos.forEach((p) => {
    if (p.tipo !== "regular") return;
    let g = por.get(p.numero);
    if (!g) por.set(p.numero, (g = { numero: p.numero, cursadas: 0, reprobadas: 0 }));
    const vistos = new Set<string>();
    p.ramos.forEach((e) => {
      const n = notaEntrada(ctx, e);
      const clave = claveHistorial(e);
      if (n === null || vistos.has(clave)) return;
      vistos.add(clave);
      g.cursadas++;
      if (n < NOTA_APROB) g.reprobadas++;
    });
  });
  return [...por.values()].filter((p) => p.cursadas > 0).sort((a, b) => a.numero - b.numero);
}

export interface EvaluacionCausalC {
  semestre: number;
  considerados: number[];
  cursadas: number;
  reprobadas: number;
  porcentaje: number;
  cumple: boolean;
  exenta: boolean;
}

/** Un registro de permanencia aceptada exime al siguiente semestre efectivamente cursado. */
export function semestreProtegido(origen: number, periodos: PeriodoUDP[]): number | null {
  return periodos.find((p) => p.numero > origen)?.numero ?? null;
}

export function evaluacionesCausalC(ctx: Ctx, periodos = periodosUDP(ctx)): EvaluacionCausalC[] {
  const protegidos = new Set(
    ctx.st.excepcionesCausalC.map((o) => semestreProtegido(o, periodos)).filter((s): s is number => s !== null),
  );
  const out: EvaluacionCausalC[] = [];
  for (let i = 1; i < periodos.length; i++) {
    const dos = periodos.slice(i - 1, i + 1);
    const cursadas = dos.reduce((s, p) => s + p.cursadas, 0);
    const reprobadas = dos.reduce((s, p) => s + p.reprobadas, 0);
    out.push({
      semestre: periodos[i].numero,
      considerados: dos.map((p) => p.numero),
      cursadas,
      reprobadas,
      porcentaje: cursadas > 0 ? (reprobadas / cursadas) * 100 : 0,
      cumple: cursadas > 0 && reprobadas > cursadas / 2,
      exenta: protegidos.has(periodos[i].numero),
    });
  }
  return out;
}

export function causalesEliminacionUDP(ctx: Ctx): Alerta[] {
  const out: Alerta[] = [];
  const reprob = Object.entries(historialIntentos(ctx))
    .map(([clave, notas]) => ({ clave, n: notas.filter((x) => x < NOTA_APROB).length }))
    .filter((x) => x.n > 0);

  const dosVeces = reprob.filter((x) => x.n >= 2);
  if (dosVeces.length >= 3) {
    const nombres = dosVeces.map((x) => nombreHistorial(ctx, x.clave));
    const detalle = nombres.length <= 3 ? nombres.join(", ") : `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`;
    out.push({ tipo: "a", descripcion: `${dosVeces.length} asignaturas reprobadas al menos dos veces: ${detalle}`, nivel: "critica" });
  }
  reprob
    .filter((x) => x.n >= 3)
    .forEach((x) => out.push({ tipo: "b", descripcion: `${nombreHistorial(ctx, x.clave)}: reprobada ${x.n} veces`, nivel: "critica" }));

  const ultima = evaluacionesCausalC(ctx).at(-1);
  if (ultima?.cumple && !ultima.exenta) {
    out.push({
      tipo: "c",
      descripcion: `${ultima.reprobadas} de ${ultima.cursadas} asignaturas reprobadas (${Math.round(ultima.porcentaje)}%) en ${ultima.considerados.map((s) => "S" + s).join(" y ")}`,
      nivel: "critica",
    });
  }
  return out;
}

// UC · alertas académicas y revisión de permanencia
export function alertasUC(ctx: Ctx): Alerta[] {
  const out: Alerta[] = [];
  const periodos = resumenPeriodos(ctx);
  const ultimo = periodos.at(-1);
  const primero = periodos[0];
  if (ultimo && ultimo.ppaAcumulado < 4.0) out.push({ tipo: "a", descripcion: `PPA acumulado ${fmt(ultimo.ppaAcumulado)} bajo 4,0`, nivel: "critica" });
  if (primero && primero.porcentajeAprobado < 50)
    out.push({ tipo: "b", descripcion: `Primer semestre: ${Math.round(primero.porcentajeAprobado)}% de créditos aprobados (menos del 50%)`, nivel: "critica" });
  if (periodos.length >= 2 && ultimo) {
    const dos = periodos.slice(-2);
    const tot = dos.reduce((s, p) => s + p.credTotal, 0);
    const apr = dos.reduce((s, p) => s + p.credAprobados, 0);
    const pct = tot > 0 ? (apr / tot) * 100 : 0;
    if (ultimo.ppaAcumulado < 4.5 && pct < 40)
      out.push({ tipo: "c", descripcion: `PPA ${fmt(ultimo.ppaAcumulado)} bajo 4,5 y ${Math.round(pct)}% de aprobación en los dos últimos semestres`, nivel: "critica" });
  }
  Object.entries(historialIntentos(ctx)).forEach(([clave, notas]) => {
    const n = notas.filter((x) => x < NOTA_APROB).length;
    if (n >= 3) out.push({ tipo: "d", descripcion: `${nombreHistorial(ctx, clave)}: reprobado ${n} veces`, nivel: "advertencia" });
  });
  return out;
}

export function revisionPermanenciaUC(ctx: Ctx): Alerta[] {
  const periodos = resumenPeriodos(ctx);
  const ultimo = periodos.at(-1);
  if (periodos.length >= 3 && ultimo && ultimo.ppaAcumulado < 4.0 && ultimo.porcentajeAprobado < 80) {
    return [{
      tipo: "a",
      descripcion: `PPA acumulado ${fmt(ultimo.ppaAcumulado)} bajo 4,0 y ${Math.round(ultimo.porcentajeAprobado)}% de créditos aprobados en el último periodo`,
      nivel: "critica",
    }];
  }
  return [];
}

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

// ── Semestre en curso ──

/** El semestre terminó si todos sus ramos tienen nota final. */
export function semestreListoParaAvanzar(ctx: Ctx): boolean {
  const p = ctx.st.periodos.find((x) => esPeriodoActual(ctx.st, x));
  if (!p || p.ramos.length === 0) return false;
  return p.ramos.every((e) => notaFinalEfectiva(e) !== null || esEximido(ctx, e.id));
}

/** Ramos que se pueden inscribir ahora (para el resumen de la malla). */
export function ramosDisponibles(ctx: Ctx): Ramo[] {
  const apr = aprobadosSet(ctx);
  return ctx.cur.ramos.filter((r) => !esSoloMalla(r) && estadoRamo(ctx, r.id, apr) === "disponible");
}
