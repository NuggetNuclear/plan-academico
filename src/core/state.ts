// ── Progreso de una persona en una carrera (se guarda en localStorage) ──

export interface Nota {
  /** Identidad estable (no cambia al borrar o reordenar). La asigna asignarIds. */
  id?: string;
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
  /** Identidad estable (no cambia al borrar o reordenar). La asigna asignarIds. */
  id?: string;
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
const numeroEnRango = (v: unknown, min: number, max = Infinity): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
const esObjeto = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
const idsValidos = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];

function planValido(p: PlanGuardado | null | undefined): p is PlanGuardado {
  return !!p && typeof p.etiqueta === "string" && typeof p.fecha === "string" && Number.isFinite(Date.parse(p.fecha))
    && Number.isInteger(p.semestreBase) && p.semestreBase >= 1 && Array.isArray(p.semestres)
    && p.semestres.every((s) => s && Number.isInteger(s.numero) && s.numero >= 1
      && ["cursando", "futuro", "verano", "overflow"].includes(s.tipo)
      && Array.isArray(s.ids) && s.ids.every((id) => typeof id === "string" && id.length > 0));
}

/** Repara datos guardados (o importados) para que siempre cumplan el modelo. */
export function normalizarEstado(raw: unknown): PlannerState {
  const base = estadoInicial();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlannerState>;
  const periodos = Array.isArray(r.periodos) ? r.periodos : [];
  const st: PlannerState = {
    ...base,
    semestreActual: Math.max(1, Math.trunc(num(r.semestreActual, 1))),
    inglesEximido: Math.max(0, Math.trunc(num(r.inglesEximido, 0))),
    maxCreditos: numeroEnRango(r.maxCreditos, 1),
    congelaciones: (Array.isArray(r.congelaciones) ? r.congelaciones : [])
      .map((c) => ({ desde: Math.trunc(num(c?.desde, 0)), duracion: Math.trunc(num(c?.duracion, 0)) }))
      .filter((c) => c.desde >= 1 && c.duracion >= 1),
    marcas: esObjeto(r.marcas) ? Object.fromEntries(Object.entries(r.marcas!).filter(([id, sem]) =>
      id.length > 0 && (sem === null || (Number.isInteger(sem) && sem! >= 0)))) : {},
    rapidosDesdeCursando: idsValidos(r.rapidosDesdeCursando),
    cursando: idsValidos(r.cursando),
    periodos: periodos
      .filter((p) => p && typeof p === "object")
      .map((p) => ({
        tipo: p.tipo === "verano" || p.tipo === "convalidaciones" ? p.tipo : "regular",
        numero: p.tipo === "convalidaciones" ? 0 : Math.max(1, Math.trunc(num(p.numero, 1))),
        ventana: typeof p.ventana === "string" ? p.ventana : undefined,
        ramos: (Array.isArray(p.ramos) ? p.ramos : []).filter((e) => typeof e?.id === "string").map((e) => ({
          ...e,
          uid: typeof e.uid === "string" && e.uid ? e.uid : nuevoUid(),
          siglaReal: typeof e.siglaReal === "string" ? e.siglaReal : undefined,
          nombreReal: typeof e.nombreReal === "string" ? e.nombreReal : undefined,
          creditos: e.creditos === undefined ? undefined : numeroEnRango(e.creditos, 0),
          decimas: e.decimas === undefined ? undefined : numeroEnRango(e.decimas, 0, 1) ?? 0,
          meta: e.meta === undefined ? undefined : numeroEnRango(e.meta, 1, 7),
          modo: e.modo === undefined ? undefined : e.modo === "peor" ? "peor" : "actual",
          categorias: (Array.isArray(e.categorias) ? e.categorias : []).filter((c) => c && typeof c === "object").map((c) => ({
            ...c,
            id: typeof c.id === "string" && c.id ? c.id : undefined,
            nombre: typeof c.nombre === "string" ? c.nombre : "",
            peso: Math.max(0, num(c.peso, 0)),
            req: c.req === undefined ? undefined : c.req === true,
            examen: c.examen === undefined ? undefined : c.examen === true,
            minimos: esObjeto(c.minimos) ? {
              eximir: c.minimos?.eximir === undefined ? undefined : numeroEnRango(c.minimos.eximir, 1, 7),
              eximirCada: c.minimos?.eximirCada === undefined ? undefined : numeroEnRango(c.minimos.eximirCada, 1, 7),
              examen: c.minimos?.examen === undefined ? undefined : numeroEnRango(c.minimos.examen, 1, 7),
            } : undefined,
            notas: (Array.isArray(c.notas) ? c.notas : []).map((n) => ({
              ...n,
              id: typeof n?.id === "string" && n.id ? n.id : undefined,
              n: numeroEnRango(typeof n === "number" ? n : n?.n, 1, 7),
              f: numeroEnRango(n?.f, 0) ?? 1,
              fecha: n?.fecha === undefined ? undefined : typeof n.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(n.fecha)
                && Number.isFinite(Date.parse(n.fecha)) && new Date(n.fecha).toISOString().startsWith(n.fecha) ? n.fecha : null,
              etiqueta: typeof n?.etiqueta === "string" ? n.etiqueta : undefined,
            })),
          })),
          notaFinal: numeroEnRango(e.notaFinal, 1, 7),
        })),
      })),
    alias: esObjeto(r.alias) ? Object.fromEntries(Object.entries(r.alias!).filter(([, a]) => esObjeto(a)).map(([id, a]) =>
      [id, { sigla: typeof a.sigla === "string" ? a.sigla : undefined, nombre: typeof a.nombre === "string" ? a.nombre : undefined }])) : {},
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
    planFijado: planValido(r.planFijado) ? r.planFijado : null,
    prefs: {
      marcadoRapido: typeof r.prefs?.marcadoRapido === "boolean" ? r.prefs.marcadoRapido : base.prefs.marcadoRapido,
      mostrarNotas: typeof r.prefs?.mostrarNotas === "boolean" ? r.prefs.mostrarNotas : base.prefs.mostrarNotas,
      checklistOculto: typeof r.prefs?.checklistOculto === "boolean" ? r.prefs.checklistOculto : base.prefs.checklistOculto,
      avanceDescartado: Math.max(0, Math.trunc(num(r.prefs?.avanceDescartado, 0))),
      metaPPA: numeroEnRango(r.prefs?.metaPPA, 1, 7),
      wizardHecho: r.prefs?.wizardHecho === true,
    },
  };
  asignarIds(st, true);
  return st;
}

/**
 * Da id a las categorías y notas que no lo tienen. Al migrar datos guardados se deriva de la
 * posición: así dos equipos con el mismo progreso obtienen los mismos ids (la sync no ve un
 * conflicto) y el .ics conserva los UID que ya usaba. Lo nuevo recibe un id aleatorio.
 */
export function asignarIds(st: PlannerState, migrar = false) {
  st.periodos.forEach((p) =>
    p.ramos.forEach((e) =>
      e.categorias.forEach((c, ci) => {
        c.id ??= migrar ? `${e.uid}-${ci}` : nuevoUid();
        c.notas.forEach((n, ni) => (n.id ??= migrar ? `${e.uid}-${ci}-${ni}` : nuevoUid()));
      }),
    ),
  );
}

let contadorUid = 0;
export function nuevoUid(): string {
  contadorUid = (contadorUid + 1) % 1e6;
  return Date.now().toString(36) + "-" + contadorUid.toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}
