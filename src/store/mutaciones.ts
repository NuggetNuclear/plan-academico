// Cambios sobre el progreso. Todas las funciones reciben un borrador (copia) del
// estado y lo modifican directamente; el store se encarga de copiar y guardar.
import {
  aprobadosSet,
  clavePeriodo,
  entradaAprobada,
  esPeriodoActual,
  idsInglesEximidos,
  ordenPeriodo,
  type Ctx,
} from "../core/academic";
import { NOTA_APROB } from "../core/format";
import { nuevoUid, type Entrada, type Periodo, type PlannerState, type TipoPeriodo } from "../core/state";

export function obtenerPeriodo(st: PlannerState, tipo: TipoPeriodo, numero: number, crear = false): Periodo | undefined {
  const n = tipo === "convalidaciones" ? 0 : numero;
  let p = st.periodos.find((x) => x.tipo === tipo && x.numero === n);
  if (!p && crear) {
    p = { tipo, numero: n, ramos: [] };
    st.periodos.push(p);
    st.periodos.sort((a, b) => ordenPeriodo(a) - ordenPeriodo(b));
  }
  return p;
}

export const periodoPorClave = (st: PlannerState, clave: string) => st.periodos.find((p) => clavePeriodo(p) === clave);

export function nuevaEntrada(id: string): Entrada {
  return { uid: nuevoUid(), id, categorias: [], notaFinal: null };
}

function asegurarEntrada(p: Periodo, id: string): Entrada {
  let e = p.ramos.find((x) => x.id === id);
  if (!e) {
    e = nuevaEntrada(id);
    p.ramos.push(e);
  }
  return e;
}

/** Entradas creadas automáticamente y nunca editadas (se pueden mover o quitar sin perder nada). */
function esEntradaVacia(e: Entrada): boolean {
  return e.notaFinal === null && e.categorias.length === 0 && !e.siglaReal?.trim() && !e.nombreReal?.trim();
}

export function quitarEntradasVacias(st: PlannerState, id: string, { incluirActual = true } = {}) {
  st.periodos.forEach((p) => {
    if (p.tipo === "verano" || p.tipo === "convalidaciones") return;
    if (!incluirActual && esPeriodoActual(st, p)) return;
    p.ramos = p.ramos.filter((e) => e.id !== id || !esEntradaVacia(e));
  });
}

function quitarConvalidacion(st: PlannerState, id: string) {
  const conv = obtenerPeriodo(st, "convalidaciones", 0);
  if (!conv) return;
  conv.ramos = conv.ramos.filter((e) => e.id !== id);
  if (conv.ramos.length === 0) st.periodos = st.periodos.filter((p) => p !== conv);
}

const sacarCursando = (st: PlannerState, id: string) => (st.cursando = st.cursando.filter((x) => x !== id));
const sacarRapido = (st: PlannerState, id: string) => (st.rapidosDesdeCursando = st.rapidosDesdeCursando.filter((x) => x !== id));

/** Mantiene coherentes el semestre actual, lo que estás cursando y sus carpetas de notas. */
export function sincronizar(ctx: Ctx) {
  const { st } = ctx;
  const actual = obtenerPeriodo(st, "regular", st.semestreActual, true)!;
  const eximidos = idsInglesEximidos(ctx);
  const aprobados = aprobadosSet(ctx);
  st.cursando = st.cursando.filter((id) => !eximidos.has(id) && !aprobados.has(id));
  Object.keys(st.marcas).forEach((id) => {
    if (eximidos.has(id) && st.marcas[id] === null) delete st.marcas[id];
  });
  st.cursando.forEach((id) => {
    quitarEntradasVacias(st, id, { incluirActual: false });
    asegurarEntrada(actual, id);
  });
  Object.entries(st.marcas).forEach(([id, sem]) => {
    if (sem === st.semestreActual && ctx.cur.map[id]) asegurarEntrada(actual, id);
  });
}

// ── Malla ──

export function marcarCursando(ctx: Ctx, id: string) {
  const { st } = ctx;
  delete st.marcas[id];
  sacarRapido(st, id);
  quitarConvalidacion(st, id);
  if (!st.cursando.includes(id)) st.cursando.push(id);
}

export function desmarcar(ctx: Ctx, id: string) {
  const { st } = ctx;
  delete st.marcas[id];
  sacarCursando(st, id);
  sacarRapido(st, id);
  quitarConvalidacion(st, id);
  quitarEntradasVacias(st, id);
}

/** semestre: número (0 = convalidado) o null para marcado rápido sin semestre. */
export function marcarAprobado(ctx: Ctx, id: string, semestre: number | null) {
  const { st } = ctx;
  const estabaCursando = st.cursando.includes(id);
  sacarCursando(st, id);
  quitarEntradasVacias(st, id);
  if (semestre === null) {
    quitarConvalidacion(st, id);
    st.marcas[id] = null;
    if (estabaCursando && !st.rapidosDesdeCursando.includes(id)) st.rapidosDesdeCursando.push(id);
    return;
  }
  sacarRapido(st, id);
  st.marcas[id] = semestre;
  if (semestre === 0) {
    asegurarEntrada(obtenerPeriodo(st, "convalidaciones", 0, true)!, id);
    return;
  }
  const destino = obtenerPeriodo(st, "regular", semestre, true)!;
  const conv = obtenerPeriodo(st, "convalidaciones", 0);
  const entradaConv = conv?.ramos.find((e) => e.id === id);
  if (entradaConv && conv) {
    conv.ramos = conv.ramos.filter((e) => e !== entradaConv);
    if (conv.ramos.length === 0) st.periodos = st.periodos.filter((p) => p !== conv);
    destino.ramos.push(entradaConv);
  } else if (ctx.cur.map[id]) {
    asegurarEntrada(destino, id);
  }
}

/** Marcado rápido: un clic marca como cursado sin semestre; otro clic lo desmarca. */
export function alternarRapido(ctx: Ctx, id: string): "marcado" | "desmarcado" | "restaurado" | "bloqueado" {
  const { st } = ctx;
  if (st.marcas[id] === null) {
    const volver = st.rapidosDesdeCursando.includes(id);
    delete st.marcas[id];
    sacarRapido(st, id);
    if (volver && !st.cursando.includes(id)) st.cursando.push(id);
    return volver ? "restaurado" : "desmarcado";
  }
  if (aprobadosSet(ctx).has(id)) return "bloqueado";
  marcarAprobado(ctx, id, null);
  return "marcado";
}

export function marcableComoCompleto(ctx: Ctx, id: string): boolean {
  const r = ctx.cur.map[id];
  return !!r && r.semestre >= 1;
}

/** Marca como aprobados (sin semestre) todos los ramos entre dos semestres. */
export function marcarSemestres(ctx: Ctx, hasta: number, desde = 1): number {
  const apr = aprobadosSet(ctx);
  let n = 0;
  ctx.cur.ramos.forEach((r) => {
    if (r.semestre < desde || r.semestre > hasta || !marcableComoCompleto(ctx, r.id) || apr.has(r.id)) return;
    marcarAprobado(ctx, r.id, null);
    n++;
  });
  return n;
}

// ── Notas ──

export function agregarRamoAPeriodo(ctx: Ctx, p: Periodo, id: string): Entrada {
  const { st } = ctx;
  const e = asegurarEntrada(p, id);
  if (p.tipo === "convalidaciones") {
    st.marcas[id] = 0;
    sacarCursando(st, id);
    sacarRapido(st, id);
  } else if (esPeriodoActual(st, p) && !aprobadosSet(ctx).has(id) && ctx.cur.map[id]) {
    if (st.marcas[id] === null) delete st.marcas[id];
    if (!st.cursando.includes(id)) st.cursando.push(id);
  }
  return e;
}

export function cerrarEntrada(ctx: Ctx, p: Periodo, e: Entrada, nota: number) {
  const { st } = ctx;
  e.notaFinal = Math.round(nota * 10) / 10;
  sacarCursando(st, e.id);
  sacarRapido(st, e.id);
  if (e.notaFinal >= NOTA_APROB) {
    // La nota guardada en Notas pasa a ser la fuente del estado del ramo.
    if (p.tipo !== "convalidaciones") delete st.marcas[e.id];
    return;
  }
  const marca = st.marcas[e.id];
  // Un intento reprobado contradice una marca sin semestre o de un semestre anterior.
  if (marca === null || (typeof marca === "number" && marca > 0 && marca <= p.numero)) delete st.marcas[e.id];
}

export function reabrirEntrada(ctx: Ctx, p: Periodo, e: Entrada) {
  const { st } = ctx;
  const estabaAprobada = entradaAprobada(ctx, e);
  e.notaFinal = null;
  e.decimas = 0;
  if (p.tipo === "convalidaciones") {
    st.marcas[e.id] = 0;
    return;
  }
  const otraAprobacion = st.periodos.some((q) => q.ramos.some((x) => x !== e && x.id === e.id && entradaAprobada(ctx, x)));
  if (otraAprobacion) return;
  if (esPeriodoActual(st, p)) {
    if (!st.cursando.includes(e.id) && ctx.cur.map[e.id]) st.cursando.push(e.id);
  } else if (estabaAprobada) {
    // Mientras corriges una nota antigua, el ramo sigue aprobado en ese semestre.
    st.marcas[e.id] = p.numero;
  }
}

export function quitarEntrada(ctx: Ctx, p: Periodo, e: Entrada) {
  const { st } = ctx;
  p.ramos = p.ramos.filter((x) => x !== e);
  const otraAprobacion = st.periodos.some((q) => q.ramos.some((x) => x.id === e.id && entradaAprobada(ctx, x)));
  if (p.tipo === "convalidaciones" && st.marcas[e.id] === 0 && !otraAprobacion) delete st.marcas[e.id];
  if (typeof st.marcas[e.id] === "number" && st.marcas[e.id] === p.numero && p.tipo === "regular") delete st.marcas[e.id];
  if (esPeriodoActual(st, p)) sacarCursando(st, e.id);
  if (p.tipo === "convalidaciones" && p.ramos.length === 0) st.periodos = st.periodos.filter((x) => x !== p);
}

export function eliminarPeriodo(ctx: Ctx, p: Periodo) {
  const { st } = ctx;
  [...p.ramos].forEach((e) => quitarEntrada(ctx, p, e));
  st.periodos = st.periodos.filter((x) => x !== p);
}

export function avanzarSemestre(ctx: Ctx) {
  const { st } = ctx;
  const actual = obtenerPeriodo(st, "regular", st.semestreActual);
  const cerrados = new Set(actual?.ramos.filter((e) => e.notaFinal !== null).map((e) => e.id) ?? []);
  st.cursando = st.cursando.filter((id) => !cerrados.has(id));
  st.semestreActual += 1;
}
