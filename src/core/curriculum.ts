import type { Congelacion } from "./state";
import type { MallaDef, Ramo, RamoDef, RutaAcademica } from "./types";

export interface Curriculum {
  malla: MallaDef;
  ruta: RutaAcademica | null;
  ramos: Ramo[];
  map: Record<string, Ramo>;
  /** Todos los ramos de la carrera (incluye los de otras rutas, para el historial). */
  catalogo: Record<string, RamoDef>;
  desbloquea: Record<string, string[]>;
  prereqs: Record<string, string[]>;
  /** Cuántos ramos dependen (directa o indirectamente) de cada ramo. */
  peso: Record<string, number>;
  semestresObjetivo: number;
  maxCreditosSemestre: number;
  tipos: Record<string, string>;
}

export interface OpcionesCurriculum {
  rutaId?: string | null;
  gruposAltModo?: Record<string, "dividido" | "unico">;
}

export function rutaActiva(malla: MallaDef, rutaId?: string | null): RutaAcademica | null {
  const rutas = malla.rutasAcademicas ?? [];
  if (rutas.length === 0) return null;
  return rutas.find((r) => r.id === rutaId) ?? rutas.find((r) => r.id === malla.rutaDefault) ?? rutas[0];
}

/** Ramos que no se planifican (pruebas institucionales, requisitos sin créditos). */
export function esSoloMalla(r: RamoDef | undefined): boolean {
  return !!r && (r.soloMalla === true || r.excluirPlanner === true || r.tipo === "REQUERIDO");
}

/** Cursos flexibles cuyo nombre real lo define la persona (OFG, OPR, electivos con alternativas). */
export function esPersonalizable(r: RamoDef | undefined): boolean {
  return !!r && (r.tipo === "OFG" || r.tipo === "OPR" || r.tipo === "ELECCION" || /electivo/i.test(r.nombre));
}

export function construirCurriculum(malla: MallaDef, opts: OpcionesCurriculum = {}): Curriculum {
  const ruta = rutaActiva(malla, opts.rutaId);
  const todos = [...malla.ramos, ...(malla.ramosRutas ?? [])];
  const catalogo: Record<string, RamoDef> = {};
  todos.forEach((r) => (catalogo[r.id] = r));

  // 1. Filtrar por ruta académica y ajustar semestres propios de la ruta.
  const excluidos = new Set(ruta?.excluir ?? []);
  const fuente = todos
    .filter((r) => !excluidos.has(r.id))
    .filter((r) => !Array.isArray(r.rutas) || (ruta && r.rutas.includes(ruta.id)))
    .map((r) => {
      const semestre = (ruta && r.semestrePorRuta?.[ruta.id]) ?? r.semestre;
      // Los cursos propios de una articulación se habilitan desde su semestre oficial.
      return { ...r, semestre, semestreMinimo: r.rutas ? semestre : r.semestreMinimo };
    });

  // 2. Grupos alternativos: un OFG puede dictarse como varios cursos o uno solo más grande.
  const modos = opts.gruposAltModo ?? {};
  const vistos = new Set<string>();
  const resueltos: RamoDef[] = [];
  fuente.forEach((r) => {
    if (!r.grupoAlt || (modos[r.grupoAlt] ?? "dividido") === "dividido") {
      resueltos.push(r);
      return;
    }
    if (vistos.has(r.grupoAlt)) return;
    vistos.add(r.grupoAlt);
    resueltos.push({ ...r, creditos: r.grupoAltCreditosUnico ?? r.creditos });
  });

  const ramos: Ramo[] = resueltos.map((r) => ({
    ...r,
    req: [...(r.req ?? [])],
    coreq: [...(r.coreq ?? [])],
    tipo: r.tipo ?? "ESP",
    reqPractica: [],
  }));

  // 3. Las prácticas con regla exigen todo lo de la malla hasta cierto semestre.
  ramos.forEach((r) => {
    if (!r.reglaPractica) return;
    const hasta = r.reglaPractica.hastaSemestre;
    r.reqPractica = ramos
      .filter((x) => x.id !== r.id && x.semestre >= 1 && x.semestre <= hasta && !esSoloMalla(x))
      .map((x) => x.id);
  });

  const map: Record<string, Ramo> = {};
  const desbloquea: Record<string, string[]> = {};
  const prereqs: Record<string, string[]> = {};
  ramos.forEach((r) => {
    map[r.id] = r;
    desbloquea[r.id] = [];
  });
  ramos.forEach((r) => {
    prereqs[r.id] = [...r.req, ...r.coreq, ...r.reqPractica];
    [...r.req, ...r.reqPractica].forEach((id) => desbloquea[id]?.push(r.id));
  });

  const peso: Record<string, number> = {};
  const calcularPeso = (id: string, visitados: Set<string>): number => {
    if (visitados.has(id)) return 0;
    visitados.add(id);
    return (desbloquea[id] ?? []).reduce((s, hijo) => s + 1 + calcularPeso(hijo, visitados), 0);
  };
  ramos.forEach((r) => (peso[r.id] = calcularPeso(r.id, new Set())));

  return {
    malla,
    ruta,
    ramos,
    map,
    catalogo,
    desbloquea,
    prereqs,
    peso,
    semestresObjetivo: ruta?.semestresObjetivo ?? malla.semestresObjetivo,
    maxCreditosSemestre: ruta?.maxCreditosSemestre ?? malla.maxCreditosSemestre,
    tipos: malla.tipos ?? {},
  };
}

/** Un prerrequisito debe estar aprobado antes; un correquisito puede cursarse en paralelo. */
export function cumpleRequisitos(ramo: Ramo, completados: Set<string>, mismoSemestre: Set<string> = new Set()): boolean {
  if (!ramo.req.every((id) => completados.has(id))) return false;
  if (!ramo.coreq.every((id) => completados.has(id) || mismoSemestre.has(id))) return false;
  if (!ramo.reglaPractica) return true;
  const ev = evaluarReglaPractica(ramo, completados);
  return ev.ok && ev.deuda.every((id) => mismoSemestre.has(id));
}

export interface EvaluacionPractica {
  ok: boolean;
  faltan: string[];
  deuda: string[];
  bloqueanPorSinDeuda: string[];
}

/**
 * Prácticas UDP: todo aprobado hasta "hastaSemestre"; se puede deber como máximo
 * "maxDeuda" ramos (que no estén en "sinDeuda") cursándolos en paralelo.
 */
export function evaluarReglaPractica(ramo: Ramo, completados: Set<string>): EvaluacionPractica {
  const regla = ramo.reglaPractica;
  if (!regla) return { ok: true, faltan: [], deuda: [], bloqueanPorSinDeuda: [] };
  const faltan = ramo.reqPractica.filter((id) => !completados.has(id));
  const sinDeuda = new Set(regla.sinDeuda ?? []);
  const ok = faltan.length <= (regla.maxDeuda ?? 1) && !faltan.some((id) => sinDeuda.has(id));
  return { ok, faltan, deuda: ok ? faltan : [], bloqueanPorSinDeuda: faltan.filter((id) => sinDeuda.has(id)) };
}

// ── Ramos anuales y congelaciones ──

/** Convierte el semestre académico en semestre calendario considerando las pausas. */
export function semestreCalendario(semestreAcademico: number, congelaciones: Congelacion[]): number {
  const s = Math.max(1, Math.trunc(semestreAcademico || 1));
  return s + congelaciones.filter((c) => c.desde <= s).reduce((t, c) => t + c.duracion, 0);
}

export function anualDisponibleEn(ramo: RamoDef, semestreAcademico: number, congelaciones: Congelacion[]): boolean {
  if (!ramo.anual) return true;
  return ramo.semestre % 2 === semestreCalendario(semestreAcademico, congelaciones) % 2;
}

export function nombrePeriodoCalendario(semestreAcademico: number, congelaciones: Congelacion[]): string {
  return semestreCalendario(semestreAcademico, congelaciones) % 2 === 1 ? "1.er semestre del año" : "2.º semestre del año";
}

/**
 * Ruta crítica (como en el método CPM): la cadena más larga de prerrequisitos entre
 * los ramos pendientes. Su largo es el mínimo de semestres que te quedan.
 */
export function rutaCritica(cur: Curriculum, pendientes: Set<string>): string[] {
  const memo = new Map<string, number>();
  const prof = (id: string): number => {
    const m = memo.get(id);
    if (m !== undefined) return m;
    memo.set(id, 1);
    let max = 0;
    (cur.desbloquea[id] ?? []).forEach((h) => {
      if (pendientes.has(h)) max = Math.max(max, prof(h));
    });
    memo.set(id, 1 + max);
    return 1 + max;
  };
  let inicio: string | null = null;
  // La cadena parte de un ramo cuyos prerrequisitos pendientes ya no existen.
  pendientes.forEach((id) => {
    const ramo = cur.map[id];
    if (!ramo) return;
    const tienePadrePendiente = [...ramo.req, ...ramo.reqPractica].some((p) => pendientes.has(p));
    if (tienePadrePendiente) return;
    if (
      inicio === null ||
      prof(id) > prof(inicio) ||
      (prof(id) === prof(inicio) && ramo.semestre < (cur.map[inicio]?.semestre ?? 99))
    )
      inicio = id;
  });
  const cadena: string[] = [];
  let actual: string | null = inicio;
  while (actual) {
    cadena.push(actual);
    const hijos: string[] = (cur.desbloquea[actual] ?? []).filter((h) => pendientes.has(h) && !cadena.includes(h));
    if (hijos.length === 0) break;
    hijos.sort((a, b) => prof(b) - prof(a) || (cur.map[a]?.semestre ?? 0) - (cur.map[b]?.semestre ?? 0));
    actual = hijos[0];
  }
  return cadena;
}
