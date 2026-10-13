// Piezas comunes de la importación desde los reportes de la UDP (Avance curricular y
// Trabajo académico del estudiante). Todo es puro: no toca el estado ni el navegador.
import { normalizarTexto } from "../core/format";
import type { CarreraIndice, RamoDef } from "../core/types";
import type { Curriculum } from "../core/curriculum";

export class ErrorImportacion extends Error {}

export type EstadoUDP = "aprobado" | "reprobado" | "inscrito" | "convalidado" | "no-cursado" | "otro";

export function estadoDesdeTexto(texto: string): EstadoUDP {
  const t = normalizarTexto(texto).trim();
  if (/^no\s*cursad/.test(t)) return "no-cursado";
  if (/^aprob/.test(t)) return "aprobado";
  if (/^reprob/.test(t)) return "reprobado";
  if (/^inscrit/.test(t)) return "inscrito";
  if (/^(convalid|homolog|eximid|reconoc)/.test(t)) return "convalidado";
  return "otro";
}

/** "CBM1000" → "CBM1000"; "cbm-1000 " → "CBM1000". */
export const claveCodigo = (codigo: string) => codigo.toUpperCase().replace(/[\s-]+/g, "");

/** Los reportes de la UDP escriben los nombres en MAYÚSCULAS; esto los deja legibles. */
export function tituloCaso(texto: string): string {
  const minusculas = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "en", "a", "con", "para", "por", "al", "the", "of", "in", "and", "to", "on"]);
  const siglas = new Set(["AI", "IA", "TIC", "TICS", "TI", "UDP", "CFG", "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI"]);
  return texto
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((palabra, i) => {
      if (siglas.has(palabra)) return palabra;
      const bajo = palabra.toLowerCase();
      if (i > 0 && minusculas.has(bajo)) return bajo;
      return bajo.replace(/(^|[-("¿¡:])(\p{L})/gu, (_, pre: string, letra: string) => pre + letra.toUpperCase());
    })
    .join(" ");
}

// ── Cursos con nombre libre (Formación General y electivos profesionales) ──

export type GrupoLibre = "CFG" | "ELEC-INF" | "ELEC-TEL" | "ELEC";

const REGEX_FG = /^FG(\d)_\d+$/;
const REGEX_CFG = /^CFG\d{3,}$/;
const REGEX_ELECTIVO_PLACEHOLDER = /^CITOPT(INF|TEL)(\d)$/;

/**
 * Los electivos reales llevan códigos CIT33xx (informática) o CIT34xx (telecomunicaciones).
 * Si el código no lo dice, el campo «Tipo» del Excel («Electivo…») al menos separa los electivos del resto.
 */
export function grupoLibre(codigo: string, tipo = ""): GrupoLibre | null {
  const c = claveCodigo(codigo);
  if (REGEX_FG.test(c) || REGEX_CFG.test(c) || /formacion\s*general/.test(normalizarTexto(tipo))) return "CFG";
  const ph = REGEX_ELECTIVO_PLACEHOLDER.exec(c);
  if (ph) return ph[1] === "INF" ? "ELEC-INF" : "ELEC-TEL";
  if (/^CIT33\d{2}$/.test(c)) return "ELEC-INF";
  if (/^CIT34\d{2}$/.test(c)) return "ELEC-TEL";
  if (/electiv|optativ/.test(normalizarTexto(tipo))) return "ELEC";
  return null;
}

export interface MapaMalla {
  /** "CBM1000" → "CBM-1000" (solo ramos con código fijo). */
  porCodigo: Map<string, string>;
  /** Casillas a las que se asignan los cursos de nombre libre, en orden de semestre. */
  casillas: Record<GrupoLibre, string[]>;
}

const esElectivoProfesional = (r: RamoDef) => /electivo profesional/i.test(r.nombre);

export function mapaMalla(cur: Curriculum): MapaMalla {
  const todos = Object.values(cur.catalogo);
  const porCodigo = new Map<string, string>();
  todos.forEach((r) => {
    if (r.tipo === "CFG" || esElectivoProfesional(r)) return;
    porCodigo.set(claveCodigo(r.id), r.id);
    if (r.sigla) porCodigo.set(claveCodigo(r.sigla), r.id);
    r.equivalentes?.forEach((c) => porCodigo.set(claveCodigo(c), r.id));
  });
  const activos = new Set(cur.ramos.map((r) => r.id));
  const ordenadas = (f: (r: RamoDef) => boolean) =>
    todos
      .filter((r) => activos.has(r.id) && f(r))
      .sort((a, b) => a.semestre - b.semestre)
      .map((r) => r.id);
  const inf = ordenadas((r) => esElectivoProfesional(r) && r.tipo === "FI");
  const tel = ordenadas((r) => esElectivoProfesional(r) && r.tipo === "TIC");
  return {
    porCodigo,
    casillas: { CFG: ordenadas((r) => r.tipo === "CFG"), "ELEC-INF": inf, "ELEC-TEL": tel, ELEC: [...inf, ...tel].sort() },
  };
}

/** Casilla fija de un código placeholder del PDF ("FG2_4" → CFG-2; "CITOPTTEL3" → tercer electivo TEL). */
export function casillaFija(mapa: MapaMalla, codigo: string): string | null {
  const c = claveCodigo(codigo);
  const fg = REGEX_FG.exec(c);
  if (fg) return mapa.casillas.CFG[Number(fg[1]) - 1] ?? null;
  const ph = REGEX_ELECTIVO_PLACEHOLDER.exec(c);
  if (ph) return mapa.casillas[ph[1] === "INF" ? "ELEC-INF" : "ELEC-TEL"][Number(ph[2]) - 1] ?? null;
  return null;
}

// ── Detección de carrera ──

/** Carrera cuyo nombre aparece en el reporte («ING. CIVIL INFORMÁTICA Y TELECOM»). */
export function detectarCarrera(indice: CarreraIndice[], textoPlan: string | null): CarreraIndice | null {
  if (!textoPlan) return null;
  const t = normalizarTexto(textoPlan);
  return indice.find((c) => (c.planes ?? []).some((f) => t.includes(normalizarTexto(f)))) ?? null;
}
