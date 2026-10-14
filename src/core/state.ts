// ── Progreso de una persona en una carrera (se guarda en localStorage) ──

export interface Nota {
  /** Nota obtenida (1,0 a 7,0) o null si aún no se rinde. */
  n: number | null;
  /** Peso relativo dentro de la categoría (×1 por defecto, 0 = no cuenta). */
  f: number;
  /** Fecha de la evaluación (AAAA-MM-DD) para el calendario. */
  fecha?: string | null;
  /** Nombre opcional de la evaluación ("Control 2"). */
  etiqueta?: string;
}

export interface Categoria {
  nombre: string;
  /** Porcentaje del ramo (0-100). */
  peso: number;
  /** Requisito aprobatorio: debe promediar 4,0 por sí sola. */
  req?: boolean;
  /** Es el examen: las demás categorías forman la nota de presentación. */
  examen?: boolean;
  /** Mínimos de esta categoría para eximirse o para tener derecho a examen. */
  minimos?: MinimosCategoria;
  notas: Nota[];
}

export interface MinimosCategoria {
  /** Promedio mínimo para eximirse (ej. tareas ≥ 5,5). */
  eximir?: number | null;
  /** Nota mínima de cada evaluación para eximirse (ej. cada tarea ≥ 4,0). */
  eximirCada?: number | null;
  /** Promedio mínimo para tener derecho a examen (ej. tareas ≥ 4,0). */
  examen?: number | null;
}

/**
 * Cómo se escriben los % de las categorías previas al examen:
 * "presentacion" = suman 100% de la nota de presentación (ej. 40% + 60%, y esa nota vale 70% del ramo);
 * "ramo" = son % del ramo y suman lo que no vale el examen (ej. 28% + 42% = 70%).
 */
export type EscalaPresentacion = "presentacion" | "ramo";

export interface ConfigExamen {
  escala: EscalaPresentacion;
  /** Nota de presentación con la que te eximes del examen (null = el ramo no exime). */
  eximicion: number | null;
  /** % de asistencia exigido para eximirse (null = no se exige). */
  asistenciaMin: number | null;
  /** Tu % de asistencia (null = aún no lo sabes). */
  asistencia: number | null;
  /** Nota de presentación mínima para tener derecho a examen (null = sin mínimo). Sin derecho, se reprueba. */
  minPresentacion?: number | null;
}

export type ModoPromedio = "actual" | "peor";

export interface Entrada {
  uid: string;
  id: string;
  categorias: Categoria[];
  notaFinal: number | null;
  decimas?: number;
  modo?: ModoPromedio;
  colapsado?: boolean;
  /** Créditos con que se inscribió, si difieren de la malla (los trae la importación). */
  creditos?: number | null;
  siglaReal?: string;
  nombreReal?: string;
  /** Nota que te gustaría sacar en el ramo (calcula lo que necesitas). */
  meta?: number | null;
  /** Nota de presentación y eximición (solo cuenta si una categoría está marcada como examen). */
  examen?: ConfigExamen;
}

export type TipoPeriodo = "regular" | "verano" | "convalidaciones";

export interface Periodo {
  tipo: TipoPeriodo;
  /** Semestre académico (0 para convalidaciones; el verano usa el semestre que lo precede). */
  numero: number;
  ramos: Entrada[];
  /** Ventana de toma de ramos (ej. A5). */
  ventana?: string;
}

export interface Congelacion {
  /** Semestre académico que quedó pendiente. */
  desde: number;
  /** Cantidad de semestres calendario que duró la pausa. */
  duracion: number;
}

export type ModoPractica = "carga" | "sobrecupo" | "verano" | "quitar";
export type TipoSemestrePlan = "cursando" | "futuro" | "verano" | "overflow";

export interface PlanGuardado {
  fecha: string;
  etiqueta: string;
  semestreBase: number;
  semestres: { numero: number; tipo: TipoSemestrePlan; ids: string[] }[];
}

interface Preferencias {
  marcadoRapido: boolean;
  mostrarNotas: boolean;
  checklistOculto: boolean;
  /** Semestre cuyo aviso de "pasar al siguiente" ya se descartó. */
  avanceDescartado: number;
  /** PPA que quieres alcanzar al titularte. */
  metaPPA: number | null;
  wizardHecho: boolean;
}

export interface PlannerState {
  version: 1;
  semestreActual: number;
  /** Cantidad de niveles de inglés eximidos (desde el primero). */
  inglesEximido: number;
  /** null usa el máximo de la carrera. */
  maxCreditos: number | null;
  congelaciones: Congelacion[];
  /**
   * Aprobaciones marcadas a mano en la malla:
   * número = semestre en que se aprobó (0 = convalidado), null = marcado rápido.
   */
  marcas: Record<string, number | null>;
  /** Ramos que estaban en Cursando antes de un marcado rápido (para restaurarlos). */
  rapidosDesdeCursando: string[];
  cursando: string[];
  periodos: Periodo[];
  /** Nombre y sigla reales de los electivos. */
  alias: Record<string, { sigla?: string; nombre?: string }>;
  /** Semestres tras los cuales la UDP aceptó tu permanencia estando en causal de eliminación. */
  permanenciasUDP: number[];
  modoPractica: ModoPractica;
  planFijado: PlanGuardado | null;
  prefs: Preferencias;
}

export function estadoInicial(): PlannerState {
  return {
    version: 1,
    semestreActual: 1,
    inglesEximido: 0,
    maxCreditos: null,
    congelaciones: [],
    marcas: {},
    rapidosDesdeCursando: [],
    cursando: [],
    periodos: [],
    alias: {},
    permanenciasUDP: [],
    modoPractica: "carga",
    planFijado: null,
    prefs: {
      marcadoRapido: false,
      mostrarNotas: true,
      checklistOculto: false,
      avanceDescartado: 0,
      metaPPA: null,
      wizardHecho: false,
    },
  };
}

const num = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? v : def);

/** Repara datos guardados (o importados) para que siempre cumplan el modelo. */
export function normalizarEstado(raw: unknown): PlannerState {
  const base = estadoInicial();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlannerState>;
  const periodos = Array.isArray(r.periodos) ? r.periodos : [];
  return {
    ...base,
    semestreActual: Math.max(1, Math.trunc(num(r.semestreActual, 1))),
    inglesEximido: Math.max(0, Math.trunc(num(r.inglesEximido, 0))),
    maxCreditos: typeof r.maxCreditos === "number" ? r.maxCreditos : null,
    congelaciones: (Array.isArray(r.congelaciones) ? r.congelaciones : [])
      .map((c) => ({ desde: Math.trunc(num(c?.desde, 0)), duracion: Math.trunc(num(c?.duracion, 0)) }))
      .filter((c) => c.desde >= 1 && c.duracion >= 1),
    marcas: r.marcas && typeof r.marcas === "object" && !Array.isArray(r.marcas) ? r.marcas : {},
    rapidosDesdeCursando: Array.isArray(r.rapidosDesdeCursando) ? r.rapidosDesdeCursando : [],
    cursando: Array.isArray(r.cursando) ? [...new Set(r.cursando)] : [],
    periodos: periodos
      .filter((p) => p && typeof p === "object")
      .map((p) => ({
        tipo: p.tipo === "verano" || p.tipo === "convalidaciones" ? p.tipo : "regular",
        numero: p.tipo === "convalidaciones" ? 0 : Math.max(1, Math.trunc(num(p.numero, 1))),
        ventana: typeof p.ventana === "string" ? p.ventana : undefined,
        ramos: (Array.isArray(p.ramos) ? p.ramos : []).filter((e) => typeof e?.id === "string").map((e) => ({
          ...e,
          uid: e.uid || nuevoUid(),
          categorias: (Array.isArray(e.categorias) ? e.categorias : []).filter((c) => c && typeof c === "object").map((c) => ({
            ...c,
            nombre: c.nombre ?? "",
            peso: num(c.peso, 0),
            notas: (Array.isArray(c.notas) ? c.notas : []).map((n) =>
              typeof n === "number" ? { n, f: 1 } : { ...n, n: n?.n ?? null, f: num(n?.f, 1) },
            ),
          })),
          notaFinal: typeof e.notaFinal === "number" ? e.notaFinal : null,
        })),
      })),
    alias: r.alias && typeof r.alias === "object" ? r.alias : {},
    // Antes solo se registraba la causal c (excepcionesCausalC).
    permanenciasUDP: [
      ...new Set(
        [r.permanenciasUDP, (r as { excepcionesCausalC?: unknown }).excepcionesCausalC]
          .flatMap((v) => (Array.isArray(v) ? v : []))
          .filter((x): x is number => Number.isInteger(x) && x >= 1),
      ),
    ].sort((a, b) => a - b),
    modoPractica: (["carga", "sobrecupo", "verano", "quitar"] as const).includes(r.modoPractica as never)
      ? (r.modoPractica as PlannerState["modoPractica"])
      : "carga",
    // Sin ErrorBoundary: un plan corrupto en un respaldo rompería Inicio y Planificación en cada carga.
    planFijado: Array.isArray(r.planFijado?.semestres) && r.planFijado.semestres.every((s) => Array.isArray(s?.ids)) ? r.planFijado : null,
    prefs: { ...base.prefs, ...(r.prefs ?? {}) },
  };
}

let contadorUid = 0;
export function nuevoUid(): string {
  contadorUid = (contadorUid + 1) % 1e6;
  return Date.now().toString(36) + "-" + contadorUid.toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}
