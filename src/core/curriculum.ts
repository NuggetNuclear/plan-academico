import type { Congelacion } from "./state";
import type { MallaDef, Ramo, RamoDef } from "./types";

export interface Curriculum {
  malla: MallaDef;
  ramos: Ramo[];
  map: Record<string, Ramo>;
  /** Todos los ramos de la carrera (para el historial). */
  catalogo: Record<string, RamoDef>;
  desbloquea: Record<string, string[]>;
  prereqs: Record<string, string[]>;
  /** Cuántos ramos dependen (directa o indirectamente) de cada ramo. */
  peso: Record<string, number>;
  semestresObjetivo: number;
  maxCreditosSemestre: number;
  tipos: Record<string, string>;
  areas: Record<string, string>;
}

/** Electivos cuyo nombre real lo define la persona. */
export function esPersonalizable(r: RamoDef | undefined): boolean {
  return !!r && /electivo/i.test(r.nombre);
}

export function construirCurriculum(malla: MallaDef): Curriculum {
  const catalogo: Record<string, RamoDef> = {};
  malla.ramos.forEach((r) => (catalogo[r.id] = r));

  const ramos: Ramo[] = malla.ramos.map((r) => ({
    ...r,
    req: [...(r.req ?? [])],
    tipo: r.tipo ?? "ESP",
    reqPractica: [],
  }));

  // Las prácticas con regla exigen todo lo de la malla hasta cierto semestre.
  ramos.forEach((r) => {
    if (!r.reglaPractica) return;
    const hasta = r.reglaPractica.hastaSemestre;
    r.reqPractica = ramos
      .filter((x) => x.id !== r.id && x.semestre >= 1 && x.semestre <= hasta)
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
    prereqs[r.id] = [...r.req, ...r.reqPractica];
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
    ramos,
    map,
    catalogo,
    desbloquea,
    prereqs,
    peso,
    semestresObjetivo: malla.semestresObjetivo,
    maxCreditosSemestre: malla.maxCreditosSemestre,
    tipos: malla.tipos ?? {},
    areas: malla.areas ?? {},
  };
}

/** Los prerrequisitos deben estar aprobados antes; la deuda de una práctica se cursa en paralelo. */
export function cumpleRequisitos(ramo: Ramo, completados: Set<string>, mismoSemestre: Set<string> = new Set()): boolean {
  if (!ramo.req.every((id) => completados.has(id))) return false;
  if (!ramo.reglaPractica) return true;
  const ev = evaluarReglaPractica(ramo, completados);
  return ev.ok && ev.deuda.every((id) => mismoSemestre.has(id));
}

interface EvaluacionPractica {
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

// ── Congelaciones ──

/** Convierte el semestre académico en semestre calendario considerando las pausas. */
export function semestreCalendario(semestreAcademico: number, congelaciones: Congelacion[]): number {
  const s = Math.max(1, Math.trunc(semestreAcademico || 1));
  return s + congelaciones.filter((c) => c.desde <= s).reduce((t, c) => t + c.duracion, 0);
}

/** Convierte un semestre académico futuro en semestre calendario aproximado (marzo y agosto); las congelaciones lo atrasan. */
export function fechaEgreso(semestreActual: number, ultimoSemestre: number, congelaciones: Congelacion[], hoy = new Date()): string {
  const mitad = hoy.getMonth() >= 6 ? 2 : 1; // julio en adelante: segundo semestre
  const indiceHoy = hoy.getFullYear() * 2 + (mitad - 1);
  const indice = indiceHoy + semestreCalendario(ultimoSemestre, congelaciones) - semestreCalendario(semestreActual, congelaciones);
  const anio = Math.floor(indice / 2);
  return `${indice % 2 === 0 ? "1.er" : "2.º"} semestre ${anio}`;
}

export function nombrePeriodoCalendario(semestreAcademico: number, congelaciones: Congelacion[]): string {
  return semestreCalendario(semestreAcademico, congelaciones) % 2 === 1 ? "1.er semestre del año" : "2.º semestre del año";
}

/** Largo de la cadena de prerrequisitos pendientes que parte en cada ramo (1 = no desbloquea nada pendiente). */
export function profundidades(cur: Curriculum, pendientes: Set<string>): Record<string, number> {
  const memo: Record<string, number> = {};
  const prof = (id: string): number => {
    if (memo[id] !== undefined) return memo[id];
    memo[id] = 1;
    let max = 0;
    (cur.desbloquea[id] ?? []).forEach((h) => pendientes.has(h) && (max = Math.max(max, prof(h))));
    return (memo[id] = 1 + max);
  };
  pendientes.forEach(prof);
  return memo;
}

/**
 * Ruta crítica (como en el método CPM): la cadena más larga de prerrequisitos entre
 * los ramos pendientes. Su largo es el mínimo de semestres que te quedan.
 */
export function rutaCritica(cur: Curriculum, pendientes: Set<string>): string[] {
  const p = profundidades(cur, pendientes);
  const prof = (id: string) => p[id] ?? 1;
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
