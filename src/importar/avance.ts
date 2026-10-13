// Lee el reporte «Avance curricular» de la UDP a partir de las líneas de texto del PDF.
import { ErrorImportacion, estadoDesdeTexto, type EstadoUDP } from "./udp";

export interface RamoAvance {
  codigo: string;
  nombre: string;
  estado: EstadoUDP;
  /** Semestre de la malla en que aparece (I = 1). No es cuándo lo cursaste. */
  semestreMalla: number;
  /** Cursos de formación general / electivos: sigla y nombre del curso real que cubre la casilla. */
  real?: { codigo: string; nombre: string };
}

export interface AvanceCurricular {
  /** Texto del plan: «10202878 ING. CIVIL INFORMÁTICA Y TELECOM». */
  plan: string | null;
  anioIngreso: number | null;
  /** AAAA-MM-DD */
  fechaConsulta: string | null;
  ramos: RamoAvance[];
  /** Líneas con pinta de ramo que no se pudieron interpretar. */
  ignoradas: string[];
}

const ROMANOS: Record<string, number> = { I: 1, V: 5, X: 10 };
export function romanoANumero(r: string): number {
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const v = ROMANOS[r[i]] ?? 0;
    total += v < (ROMANOS[r[i + 1]] ?? 0) ? -v : v;
  }
  return total;
}

const REGEX_ESTADO = /\b(NO\s+CURSADO|APROBADO|REPROBADO|INSCRITO|CONVALIDADO|HOMOLOGADO|EXIMIDO)\b/;
const REGEX_RAMO = /^([A-Z][A-Z0-9_]{3,})\s+(.+)$/;
const REGEX_SEMESTRE = /^([IVX]+)\s+Semestre$/i;
const REGEX_REAL = /^([A-Z]{3}\d{3,})\s*-\s*(.+)$/;
const REGEX_FIN = /^(Estado m[oó]dulos|APROBADOS\b|REPROBADOS\b|INSCRITOS\b|A considerar)/i;

const fechaISO = (dmy: string) => {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(dmy.trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

export function parsearAvance(lineas: string[]): AvanceCurricular {
  const out: AvanceCurricular = { plan: null, anioIngreso: null, fechaConsulta: null, ramos: [], ignoradas: [] };
  let semestre = 0;
  let ultimo: RamoAvance | null = null;
  let completandoNombre = false;

  for (const cruda of lineas) {
    const linea = cruda.replace(/\s+/g, " ").trim();
    if (!linea || /^\d{1,3}$/.test(linea)) continue; // número de página

    const plan = /^Plan de estudio\s*:\s*(.+)$/i.exec(linea);
    if (plan) {
      out.plan = plan[1].trim();
      continue;
    }
    const ingreso = /^A[ñn]o ingreso\s*:\s*(\d{4})/i.exec(linea);
    if (ingreso) {
      out.anioIngreso = Number(ingreso[1]);
      continue;
    }
    const fecha = /^Fecha consulta\s*:\s*(\S+)/i.exec(linea);
    if (fecha) {
      out.fechaConsulta = fechaISO(fecha[1]);
      continue;
    }
    const sem = REGEX_SEMESTRE.exec(linea);
    if (sem) {
      semestre = romanoANumero(sem[1].toUpperCase());
      ultimo = null;
      completandoNombre = false;
      continue;
    }
    if (REGEX_FIN.test(linea)) {
      ultimo = null;
      completandoNombre = false;
      continue;
    }
    if (semestre === 0) continue; // encabezado del reporte

    const ramo = REGEX_RAMO.exec(linea);
    const estado = ramo ? REGEX_ESTADO.exec(ramo[2]) : null;
    if (ramo && estado) {
      const nombre = ramo[2].slice(0, estado.index).trim();
      ultimo = { codigo: ramo[1], nombre, estado: estadoDesdeTexto(estado[1]), semestreMalla: semestre };
      out.ramos.push(ultimo);
      completandoNombre = false;
      continue;
    }

    // Línea de detalle bajo un curso de formación general: «CFG5095 - AI LANDSCAPES…» (puede seguir en otra línea).
    const real = REGEX_REAL.exec(linea);
    if (real && ultimo && !ultimo.real) {
      ultimo.real = { codigo: real[1], nombre: real[2].trim() };
      completandoNombre = true;
      continue;
    }
    if (completandoNombre && ultimo?.real) {
      ultimo.real.nombre += " " + linea;
      continue;
    }
    if (ramo) out.ignoradas.push(linea);
  }

  if (!out.ramos.length) throw new ErrorImportacion("No encontré ramos en el PDF. Sube el «Avance curricular» tal como lo descargas de la UDP.");
  return out;
}
