// Convierte lo leído de la UDP en un plan de importación y lo aplica al progreso.
// construirPlan* no toca nada; aplicarPlan modifica un borrador (como store/mutaciones.ts).
import { aprobadosSet, calcularPPA, clavePeriodo, ordenPeriodo, type Ctx } from "../core/academic";
import type { Curriculum } from "../core/curriculum";
import { NOTA_APROB } from "../core/format";
import type { Congelacion, Entrada, Periodo, PlannerState, TipoPeriodo } from "../core/state";
import { desmarcar, marcarAprobado, marcarCursando, nuevaEntrada, quitarEntradasVacias, sincronizar } from "../store/mutaciones";
import type { AvanceCurricular } from "./avance";
import type { RegistroTrabajo } from "./trabajo";
import { casillaFija, claveCodigo, grupoLibre, mapaMalla, tituloCaso, type GrupoLibre, type MapaMalla } from "./udp";

export interface EntradaPlan {
  id: string;
  nota: number | null;
  sigla?: string;
  nombre?: string;
  creditos?: number;
}

export interface PeriodoPlan {
  tipo: TipoPeriodo;
  numero: number;
  /** «2023 · 2.º semestre» */
  etiqueta: string;
  entradas: EntradaPlan[];
}

export interface PlanImportacion {
  /** avance = PDF (aprobados sin semestre, no toca notas); trabajo = Excel (reemplaza el historial). */
  fuente: "avance" | "trabajo";
  periodos: PeriodoPlan[];
  /** Aprobados sin semestre ni nota. */
  aprobadosRapidos: string[];
  convalidados: string[];
  cursando: string[];
  alias: Record<string, { sigla?: string; nombre?: string }>;
  semestreActual: number;
  inglesEximido: number | null;
  congelaciones: Congelacion[] | null;
  /** Cosas a revisar (datos que no cuadran o que se omitieron). */
  advertencias: string[];
  /** Cómo se interpretó algo no obvio (eximidos, congelaciones…). */
  notas: string[];
  noReconocidos: string[];
}

const planVacio = (fuente: PlanImportacion["fuente"]): PlanImportacion => ({
  fuente,
  periodos: [],
  aprobadosRapidos: [],
  convalidados: [],
  cursando: [],
  alias: {},
  semestreActual: 1,
  inglesEximido: null,
  congelaciones: null,
  advertencias: [],
  notas: [],
  noReconocidos: [],
});

const unicos = (xs: string[]) => [...new Set(xs)];

function resolverFijo(cur: Curriculum, mapa: MapaMalla, codigo: string): string | null {
  const id = casillaFija(mapa, codigo) ?? mapa.porCodigo.get(claveCodigo(codigo)) ?? null;
  return id && cur.map[id] ? id : null;
}

// ── Avance curricular (PDF) ──

/** Semestre académico que corresponde a la fecha de consulta (el 2.º semestre parte en agosto). */
export function semestreSugerido(avance: Pick<AvanceCurricular, "fechaConsulta" | "anioIngreso">): number | null {
  if (!avance.fechaConsulta || !avance.anioIngreso) return null;
  const [anio, mes] = avance.fechaConsulta.split("-").map(Number);
  const [anioAc, sem] = mes <= 2 ? [anio - 1, 2] : mes <= 7 ? [anio, 1] : [anio, 2];
  return Math.max(1, (anioAc - avance.anioIngreso) * 2 + sem);
}

export function construirPlanAvance(cur: Curriculum, avance: AvanceCurricular): PlanImportacion {
  const mapa = mapaMalla(cur);
  const plan = planVacio("avance");
  avance.ramos.forEach((r) => {
    if (r.estado !== "aprobado" && r.estado !== "convalidado" && r.estado !== "inscrito") return;
    const id = resolverFijo(cur, mapa, r.codigo);
    if (!id) return void plan.noReconocidos.push(`${r.codigo} ${tituloCaso(r.nombre)}`);
    if (r.real) plan.alias[id] = { sigla: r.real.codigo, nombre: tituloCaso(r.real.nombre) };
    (r.estado === "aprobado" ? plan.aprobadosRapidos : r.estado === "convalidado" ? plan.convalidados : plan.cursando).push(id);
  });
  plan.semestreActual = semestreSugerido(avance) ?? 1;
  if (avance.ignoradas.length) plan.advertencias.push(`No pude interpretar ${avance.ignoradas.length} línea(s) del PDF.`);
  return plan;
}

// ── Trabajo académico (Excel) ──

const etiquetaSemestre = (anio: number, sem: number) => `${anio} · ${sem === 1 ? "1.er" : "2.º"} semestre`;
/** Índice de semestre calendario: 2023-1 → 4046, 2023-2 → 4047. */
const indiceCalendario = (anio: number, periodo: "1" | "2") => anio * 2 + (periodo === "2" ? 1 : 0);
/** Orden cronológico; el semestre especial de un año ocurre después de su 2.º semestre (ene-feb siguiente). */
const ordenCronologico = (r: RegistroTrabajo) => (r.anio ?? 0) * 10 + (r.periodo === "E" ? 3 : Number(r.periodo ?? 0));

interface Clasificado {
  reg: RegistroTrabajo;
  id: string | null;
  grupo: GrupoLibre | null;
}

export function construirPlanTrabajo(cur: Curriculum, registros: RegistroTrabajo[], avance?: AvanceCurricular | null): PlanImportacion {
  const mapa = mapaMalla(cur);
  const plan = planVacio("trabajo");

  // Casillas que el PDF ya fijó para los cursos de nombre libre (FG1_4 → CFG5095…).
  const preasignado = new Map<string, string>();
  const nombrePDF = new Map<string, string>();
  avance?.ramos.forEach((r) => {
    const id = r.real ? casillaFija(mapa, r.codigo) : null;
    if (!r.real || !id) return;
    preasignado.set(claveCodigo(r.real.codigo), id);
    nombrePDF.set(claveCodigo(r.real.codigo), r.real.nombre);
  });

  const relevantes: Clasificado[] = [];
  registros.forEach((reg) => {
    if (reg.estado === "no-cursado") return;
    if (reg.estado === "otro") return void plan.advertencias.push(`Fila ${reg.fila} (${reg.codigo}): estado desconocido, se omitió.`);
    const clave = claveCodigo(reg.codigo);
    const grupo = grupoLibre(reg.codigo, reg.tipo);
    const id = preasignado.get(clave) ?? (grupo === "CFG" ? null : resolverFijo(cur, mapa, reg.codigo));
    relevantes.push({ reg, id, grupo: id ? null : grupo });
  });

  // Asignación de casillas a cursos de nombre libre, en el orden en que se cursaron.
  (["CFG", "ELEC-INF", "ELEC-TEL", "ELEC"] as const).forEach((g) => {
    const pendientes = relevantes.filter((c) => c.grupo === g);
    if (!pendientes.length) return;
    const ocupadas = new Set([...preasignado.values(), ...relevantes.map((c) => c.id).filter((x): x is string => !!x)]);
    const libres = mapa.casillas[g].filter((id) => !ocupadas.has(id));
    const codigos = unicos(pendientes.sort((a, b) => ordenCronologico(a.reg) - ordenCronologico(b.reg)).map((c) => claveCodigo(c.reg.codigo)));
    const vivos = (codigo: string) => pendientes.some((c) => claveCodigo(c.reg.codigo) === codigo && c.reg.estado !== "reprobado");
    // Los cursos que se reprobaron y no tienen otro intento vivo se acomodan al final, si sobra casilla.
    const orden = [...codigos.filter(vivos), ...codigos.filter((c) => !vivos(c))];
    const asignado = new Map<string, string>();
    orden.forEach((codigo) => {
      const id = libres.shift();
      if (id) asignado.set(codigo, id);
    });
    pendientes.forEach((c) => (c.id = asignado.get(claveCodigo(c.reg.codigo)) ?? null));
  });

  const utiles = relevantes.filter((c) => c.id);
  relevantes
    .filter((c) => !c.id)
    .forEach((c) => {
      const txt = `${c.reg.codigo} ${tituloCaso(c.reg.nombre)}`.trim();
      if (!plan.noReconocidos.includes(txt)) plan.noReconocidos.push(txt);
    });

  // Semestres: se numeran los que tienen ramos; los huecos entre medio son congelaciones.
  const indices = unicos(
    utiles
      .filter(({ reg }) => reg.anio !== null && (reg.periodo === "1" || reg.periodo === "2") && ["aprobado", "reprobado", "inscrito"].includes(reg.estado))
      .map(({ reg }) => String(indiceCalendario(reg.anio!, reg.periodo as "1" | "2"))),
  )
    .map(Number)
    .sort((a, b) => a - b);
  const numeroDe = new Map(indices.map((c, i) => [c, i + 1]));
  const congelaciones: Congelacion[] = [];
  indices.forEach((c, i) => {
    if (i > 0 && c - indices[i - 1] > 1) congelaciones.push({ desde: i + 1, duracion: c - indices[i - 1] - 1 });
  });
  const etiquetaDe = (numero: number) => {
    const c = indices[numero - 1];
    return etiquetaSemestre(Math.floor(c / 2), (c % 2) + 1);
  };
  const numeroVerano = (anio: number) => {
    const cEspecial = indiceCalendario(anio, "2");
    const previo = [...indices].reverse().find((c) => c <= cEspecial);
    return previo !== undefined ? numeroDe.get(previo)! : 1;
  };

  // Entradas por período.
  const periodos = new Map<string, PeriodoPlan>();
  const periodo = (tipo: TipoPeriodo, numero: number, etiqueta: string) => {
    const clave = clavePeriodo({ tipo, numero });
    if (!periodos.has(clave)) periodos.set(clave, { tipo, numero, etiqueta, entradas: [] });
    return periodos.get(clave)!;
  };
  const poner = (p: PeriodoPlan, e: EntradaPlan) => {
    const i = p.entradas.findIndex((x) => x.id === e.id);
    if (i >= 0) {
      plan.advertencias.push(`${e.sigla ?? e.id} aparece dos veces en ${p.etiqueta}; me quedé con la última fila.`);
      p.entradas[i] = e;
    } else p.entradas.push(e);
  };

  const niveles = nivelesIngles(cur);
  const exentos = new Map<string, RegistroTrabajo>();
  const inscritos: { id: string; numero: number }[] = [];
  const sinNota: string[] = [];

  utiles
    .sort((a, b) => ordenCronologico(a.reg) - ordenCronologico(b.reg))
    .forEach(({ reg, id }) => {
      if (!id) return;
      const ramo = cur.catalogo[id];
      const libre = grupoLibre(reg.codigo, reg.tipo) !== null || preasignado.has(claveCodigo(reg.codigo));
      const entrada: EntradaPlan = { id, nota: reg.nota };
      if (libre) {
        entrada.sigla = reg.codigo;
        entrada.nombre = tituloCaso(nombrePDF.get(claveCodigo(reg.codigo)) ?? reg.nombre);
        if (reg.estado === "aprobado" || reg.estado === "inscrito") plan.alias[id] = { sigla: entrada.sigla, nombre: entrada.nombre };
      }
      if (reg.creditos !== null && ramo && reg.creditos !== ramo.creditos) entrada.creditos = reg.creditos;

      if (reg.anio === null || reg.estado === "convalidado") {
        if (reg.estado === "aprobado" && niveles.includes(id) && reg.anio === null) return void exentos.set(id, reg);
        if (reg.estado === "reprobado" || reg.estado === "inscrito") return void plan.advertencias.push(`${reg.codigo}: figura ${reg.estado} sin período; se omitió.`);
        return void poner(periodo("convalidaciones", 0, "Convalidaciones"), entrada);
      }
      if (reg.estado === "reprobado" && reg.nota === null) return void plan.advertencias.push(`${reg.codigo} (${reg.anio}): reprobado sin nota; se omitió.`);
      if (reg.estado === "aprobado" && reg.nota === null) return void sinNota.push(id);

      if (reg.periodo === "E") {
        if (reg.estado === "inscrito") return void plan.advertencias.push(`${reg.codigo}: inscrito en semestre especial ${reg.anio}; agrégalo cuando tengas la nota.`);
        return void poner(periodo("verano", numeroVerano(reg.anio), `Semestre especial ${reg.anio}`), entrada);
      }
      const numero = numeroDe.get(indiceCalendario(reg.anio, reg.periodo as "1" | "2"))!;
      if (reg.estado === "inscrito") inscritos.push({ id, numero });
      poner(periodo("regular", numero, etiquetaDe(numero)), entrada);
    });

  // Inglés eximido: los primeros niveles consecutivos que figuran sin período.
  let k = 0;
  while (k < niveles.length && exentos.has(niveles[k])) k++;
  plan.inglesEximido = k;
  exentos.forEach((reg, id) => {
    if (niveles.indexOf(id) >= k) poner(periodo("convalidaciones", 0, "Convalidaciones"), { id, nota: reg.nota });
  });
  if (k > 0) {
    const eximidos = niveles.slice(0, k).map((id) => cur.catalogo[id].nombre).join(" y ");
    plan.notas.push(`${eximidos}: figuran sin período (año 0000), así que los tomé como eximidos. No cuentan en el PPA.`);
  }

  // Semestre en curso: el último con ramos inscritos.
  const actual = inscritos.length ? Math.max(...inscritos.map((i) => i.numero)) : indices.length + 1;
  inscritos.forEach(({ id, numero }) => {
    if (numero === actual) plan.cursando.push(id);
    else plan.advertencias.push(`${cur.catalogo[id]?.nombre ?? id}: inscrito en un semestre anterior al actual; lo omití.`);
  });
  plan.cursando = unicos(plan.cursando);
  // Un inscrito de períodos viejos no puede quedar como entrada sin nota.
  periodos.forEach((p) => {
    if (p.tipo === "regular" && p.numero !== actual) p.entradas = p.entradas.filter((e) => e.nota !== null);
  });
  plan.semestreActual = actual;
  plan.congelaciones = congelaciones;
  if (congelaciones.length)
    plan.notas.push(`Detecté ${congelaciones.length} congelación(es): ${congelaciones.map((c) => `${c.duracion} semestre(s) antes del S${c.desde}`).join(", ")}.`);

  plan.periodos = [...periodos.values()].filter((p) => p.entradas.length).sort((a, b) => ordenPeriodo(a) - ordenPeriodo(b));
  plan.aprobadosRapidos = unicos(sinNota);
  if (sinNota.length) plan.advertencias.push(`${sinNota.length} ramo(s) aprobados no traen nota; quedaron aprobados sin semestre.`);

  if (avance) cruzarConAvance(cur, mapa, plan, avance, preasignado);
  return plan;
}

/** Revisa que el PDF y el Excel cuenten la misma historia; el PDF rellena lo que el Excel no trae. */
function cruzarConAvance(cur: Curriculum, mapa: MapaMalla, plan: PlanImportacion, avance: AvanceCurricular, preasignado: Map<string, string>) {
  const aprobadoEnPlan = new Set<string>([...plan.aprobadosRapidos, ...plan.periodos.filter((p) => p.tipo === "convalidaciones").flatMap((p) => p.entradas.map((e) => e.id))]);
  plan.periodos.forEach((p) => p.entradas.forEach((e) => e.nota !== null && e.nota >= NOTA_APROB && aprobadoEnPlan.add(e.id)));
  nivelesIngles(cur).slice(0, plan.inglesEximido ?? 0).forEach((id) => aprobadoEnPlan.add(id));

  avance.ramos.forEach((r) => {
    const id = (r.real && preasignado.get(claveCodigo(r.real.codigo))) || resolverFijo(cur, mapa, r.codigo);
    if (!id) return;
    const nombre = cur.catalogo[id]?.nombre ?? r.codigo;
    if (r.estado === "aprobado" && !aprobadoEnPlan.has(id)) {
      plan.aprobadosRapidos.push(id);
      plan.advertencias.push(`${nombre}: el PDF lo da por aprobado y el Excel no. Lo marqué aprobado sin semestre.`);
    } else if (r.estado === "inscrito" && !plan.cursando.includes(id) && !aprobadoEnPlan.has(id)) {
      plan.advertencias.push(`${nombre}: el PDF lo muestra inscrito y el Excel no.`);
    } else if (r.estado !== "aprobado" && r.estado !== "convalidado" && aprobadoEnPlan.has(id)) {
      plan.advertencias.push(`${nombre}: el Excel lo da por aprobado y el PDF no.`);
    }
  });
}

const nivelesIngles = (cur: Curriculum) => (cur.malla.nivelesIngles ?? []).filter((id) => cur.catalogo[id]);

// ── Aplicación ──

function aplicarAvance(ctx: Ctx, plan: PlanImportacion) {
  const { st } = ctx;
  const respaldados = new Set([...plan.aprobadosRapidos, ...plan.convalidados]);
  // Las marcas hechas a mano que el reporte no respalda se quitan; las notas registradas no se tocan.
  Object.keys(st.marcas).forEach((id) => {
    if (!respaldados.has(id)) desmarcar(ctx, id);
  });
  plan.convalidados.forEach((id) => aprobadosSet(ctx).has(id) || marcarAprobado(ctx, id, 0));
  plan.aprobadosRapidos.forEach((id) => aprobadosSet(ctx).has(id) || marcarAprobado(ctx, id, null));

  const nuevos = new Set(plan.cursando);
  st.cursando
    .filter((id) => !nuevos.has(id))
    .forEach((id) => {
      st.cursando = st.cursando.filter((x) => x !== id);
      quitarEntradasVacias(st, id);
    });
  plan.cursando.forEach((id) => aprobadosSet(ctx).has(id) || marcarCursando(ctx, id));
}

function aplicarTrabajo(ctx: Ctx, plan: PlanImportacion) {
  const { st } = ctx;
  // Se conservan las evaluaciones ya cargadas de los ramos que siguen en el mismo período.
  const previos = new Map<string, Entrada>();
  const ventanas = new Map<string, string>();
  st.periodos.forEach((p) => {
    if (p.ventana) ventanas.set(clavePeriodo(p), p.ventana);
    p.ramos.forEach((e) => previos.set(clavePeriodo(p) + "|" + e.id, e));
  });

  const periodos: Periodo[] = plan.periodos.map((pp) => {
    const clave = clavePeriodo(pp);
    const ramos = pp.entradas.map((ep) => {
      const prev = previos.get(clave + "|" + ep.id);
      const e: Entrada = prev ? structuredClone(prev) : nuevaEntrada(ep.id);
      if (ep.nota !== null) {
        e.notaFinal = ep.nota;
        e.decimas = 0;
      }
      if (ep.sigla) e.siglaReal = ep.sigla;
      if (ep.nombre) e.nombreReal = ep.nombre;
      if (ep.creditos !== undefined) e.creditos = ep.creditos;
      return e;
    });
    const p: Periodo = { tipo: pp.tipo, numero: pp.numero, ramos };
    if (ventanas.has(clave)) p.ventana = ventanas.get(clave);
    return p;
  });

  st.marcas = {};
  plan.aprobadosRapidos.forEach((id) => (st.marcas[id] = null));
  periodos.filter((p) => p.tipo === "convalidaciones").forEach((p) => p.ramos.forEach((e) => (st.marcas[e.id] = 0)));
  st.rapidosDesdeCursando = [];
  st.cursando = [...plan.cursando];
  st.periodos = periodos.sort((a, b) => ordenPeriodo(a) - ordenPeriodo(b));
  if (plan.inglesEximido !== null) st.inglesEximido = plan.inglesEximido;
  if (plan.congelaciones) st.congelaciones = plan.congelaciones.map((c) => ({ ...c }));
}

export function aplicarPlan(ctx: Ctx, plan: PlanImportacion) {
  ctx.st.semestreActual = plan.semestreActual;
  if (plan.fuente === "avance") aplicarAvance(ctx, plan);
  else aplicarTrabajo(ctx, plan);
  Object.entries(plan.alias).forEach(([id, a]) => (ctx.st.alias[id] = { ...ctx.st.alias[id], ...a }));
  ctx.st.prefs.wizardHecho = true;
}

// ── Vista previa ──

export interface ResumenImportacion {
  ramosAprobados: number;
  ramosMalla: number;
  cursando: number;
  intentosReprobados: number;
  semestres: number;
  ppa: number | null;
  semestreActual: number;
  inglesEximido: number;
  congelaciones: number;
}

/** Aplica el plan sobre una copia y mide el resultado con las mismas funciones que usa la app. */
export function previsualizar(cur: Curriculum, st: PlannerState, plan: PlanImportacion): ResumenImportacion {
  const borrador = structuredClone(st);
  const ctx: Ctx = { cur, st: borrador };
  aplicarPlan(ctx, plan);
  sincronizar(ctx);
  const apr = aprobadosSet(ctx);
  const contables = cur.ramos;
  const regulares = borrador.periodos.filter((p) => p.tipo === "regular" && p.ramos.some((e) => e.notaFinal !== null));
  return {
    ramosAprobados: contables.filter((r) => apr.has(r.id)).length,
    ramosMalla: contables.length,
    cursando: borrador.cursando.length,
    intentosReprobados: borrador.periodos.reduce((n, p) => n + p.ramos.filter((e) => e.notaFinal !== null && e.notaFinal < NOTA_APROB).length, 0),
    semestres: regulares.length,
    ppa: calcularPPA(ctx).ppa,
    semestreActual: borrador.semestreActual,
    inglesEximido: borrador.inglesEximido,
    congelaciones: borrador.congelaciones.length,
  };
}
