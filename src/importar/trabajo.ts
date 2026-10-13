// Lee el Excel «Trabajo académico del estudiante» de la UDP. Sin librerías: un .xlsx es un ZIP de XML.
import { leerNumero, normalizarTexto } from "../core/format";
import { claveCodigo, ErrorImportacion, estadoDesdeTexto, type EstadoUDP } from "./udp";

export type PeriodoAnio = "1" | "2" | "E";

export interface RegistroTrabajo {
  fila: number;
  codigo: string;
  nombre: string;
  /** null = sin período (año 0000): eximidos y convalidados. */
  anio: number | null;
  /** "E" = semestre especial (verano). */
  periodo: PeriodoAnio | null;
  creditos: number | null;
  nota: number | null;
  tipo: string;
  estado: EstadoUDP;
}

export interface TablaTrabajo {
  registros: RegistroTrabajo[];
  advertencias: string[];
}

const MAX_ARCHIVO = 8 * 1024 * 1024;
const MAX_DESCOMPRIMIDO = 40 * 1024 * 1024;

// ── ZIP mínimo ──

interface EntradaZip {
  metodo: number;
  comprimido: number;
  descomprimido: number;
  offset: number;
}

async function inflar(datos: Uint8Array, maximo: number): Promise<Uint8Array> {
  const lector = new Blob([new Uint8Array(datos)]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.length;
    if (total > maximo) {
      void lector.cancel();
      throw new ErrorImportacion("El archivo descomprimido es demasiado grande.");
    }
    trozos.push(value);
  }
  const out = new Uint8Array(total);
  let pos = 0;
  trozos.forEach((t) => {
    out.set(t, pos);
    pos += t.length;
  });
  return out;
}

export function abrirZip(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const vista = new DataView(buffer);
  const invalido = () => new ErrorImportacion("El archivo no es un Excel (.xlsx) válido.");

  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (vista.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw invalido();
  const total = vista.getUint16(eocd + 10, true);
  let pos = vista.getUint32(eocd + 16, true);
  const entradas = new Map<string, EntradaZip>();
  const utf8 = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (pos + 46 > bytes.length || vista.getUint32(pos, true) !== 0x02014b50) throw invalido();
    const largoNombre = vista.getUint16(pos + 28, true);
    const nombre = utf8.decode(bytes.subarray(pos + 46, pos + 46 + largoNombre));
    entradas.set(nombre, {
      metodo: vista.getUint16(pos + 10, true),
      comprimido: vista.getUint32(pos + 20, true),
      descomprimido: vista.getUint32(pos + 24, true),
      offset: vista.getUint32(pos + 42, true),
    });
    pos += 46 + largoNombre + vista.getUint16(pos + 30, true) + vista.getUint16(pos + 32, true);
  }

  return {
    nombres: [...entradas.keys()],
    async leer(nombre: string): Promise<string | null> {
      const e = entradas.get(nombre);
      if (!e) return null;
      if (e.descomprimido > MAX_DESCOMPRIMIDO) throw new ErrorImportacion("El archivo descomprimido es demasiado grande.");
      if (vista.getUint32(e.offset, true) !== 0x04034b50) throw invalido();
      const inicio = e.offset + 30 + vista.getUint16(e.offset + 26, true) + vista.getUint16(e.offset + 28, true);
      const crudo = bytes.subarray(inicio, inicio + e.comprimido);
      if (e.metodo === 0) return utf8.decode(crudo);
      if (e.metodo !== 8) throw invalido();
      return utf8.decode(await inflar(crudo, MAX_DESCOMPRIMIDO));
    },
  };
}

// ── XML de una hoja ──

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const desescapar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTIDADES[e.toLowerCase()];
    const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });

function textos(xml: string): string {
  const limpio = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  return [...limpio.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)].map((m) => desescapar(m[1] ?? "")).join("");
}

export function textosCompartidos(xml: string): string[] {
  return [...xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) => textos(m[1] ?? ""));
}

const columnaANumero = (letras: string) => [...letras].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

export function filasDeHoja(xml: string, compartidos: string[]): string[][] {
  const filas: string[][] = [];
  for (const fila of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const celdas: string[] = [];
    for (const c of (fila[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(c[1]);
      if (!ref) continue;
      const tipo = /\bt="([^"]+)"/.exec(c[1])?.[1];
      const cuerpo = c[2] ?? "";
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
      let valor = "";
      if (tipo === "inlineStr") valor = textos(cuerpo);
      else if (v !== undefined) valor = tipo === "s" ? (compartidos[Number(v)] ?? "") : desescapar(v);
      celdas[columnaANumero(ref[1])] = valor;
    }
    filas.push(Array.from(celdas, (x) => x ?? ""));
  }
  return filas;
}

async function hojas(zip: ReturnType<typeof abrirZip>): Promise<string[]> {
  const libro = (await zip.leer("xl/workbook.xml")) ?? "";
  const rels = (await zip.leer("xl/_rels/workbook.xml.rels")) ?? "";
  const destinos = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const destino = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && destino) destinos.set(id, destino.startsWith("/") ? destino.slice(1) : "xl/" + destino);
  }
  const rutas = [...libro.matchAll(/<sheet\b[^>]*?\br:id="([^"]+)"/g)].map((m) => destinos.get(m[1])).filter((x): x is string => !!x);
  return rutas.length ? rutas : zip.nombres.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
}

// ── Tabla → registros ──

type Rol = "codigo" | "nombre" | "anio" | "periodo" | "creditos" | "nota" | "tipo" | "estado";

/** Columnas del reporte: la ayuda de la app las muestra tal cual y el lector exige las obligatorias. */
export const COLUMNAS_TRABAJO: { rol: Rol; nombre: string; para: string; obligatoria: boolean }[] = [
  { rol: "codigo", nombre: "Trbj acad. (Abrev)", para: "Código del ramo (CIT2006). Así se ubica en tu malla.", obligatoria: true },
  { rol: "anio", nombre: "Año acad.", para: "Año en que lo cursaste. «0000» = eximido o convalidado.", obligatoria: true },
  { rol: "periodo", nombre: "Periodo acad.", para: "1er/2do semestre o semestre especial (verano). Sirve la columna con 001/002/003 o la de texto.", obligatoria: true },
  { rol: "nota", nombre: "Nota", para: "Nota final del ramo.", obligatoria: true },
  { rol: "estado", nombre: "Estado Trbj acad.", para: "Aprobado, Reprobado o Inscrito.", obligatoria: true },
  { rol: "nombre", nombre: "Trbj acad. (Den)", para: "Nombre del ramo. Se usa en Formación General y electivos, que tú eliges.", obligatoria: false },
  { rol: "creditos", nombre: "Créd.inscr.", para: "Créditos reales; cuentan para el PPA si difieren de la malla.", obligatoria: false },
  { rol: "tipo", nombre: "Tipo Trbj acad.", para: "Obligatorio, Formación General o Electivo; ayuda a ubicar los de nombre libre.", obligatoria: false },
];
const NOMBRE_COLUMNA = Object.fromEntries(COLUMNAS_TRABAJO.map((c) => [c.rol, c.nombre])) as Record<Rol, string>;
const OBLIGATORIAS = COLUMNAS_TRABAJO.filter((c) => c.obligatoria).map((c) => c.rol);

function rolDeEncabezado(texto: string): Rol | null {
  const h = normalizarTexto(texto).replace(/[^a-z0-9]/g, "");
  if (!h) return null;
  if (h.startsWith("estado")) return "estado";
  if (h.startsWith("tipo")) return "tipo";
  if (/abrev|sigla|codigo/.test(h)) return "codigo";
  if (/den$|denom|nombre|asignatura|descripcion/.test(h)) return "nombre";
  if (/^ano/.test(h)) return "anio";
  if (h.includes("periodo")) return "periodo";
  if (h.includes("cred")) return "creditos";
  if (h.startsWith("nota")) return "nota";
  return null;
}

function periodoDeCelda(valor: string): PeriodoAnio | "?" | null {
  const v = valor.trim();
  if (!v) return null;
  if (/^\d{3}$/.test(v)) return v === "001" ? "1" : v === "002" ? "2" : v === "003" ? "E" : "?";
  const t = normalizarTexto(v);
  if (/especial|verano|invierno/.test(t)) return "E";
  if (/\b1\W*(er|ro)?\b|primer/.test(t)) return "1";
  if (/\b2\W*(do|o)?\b|segundo/.test(t)) return "2";
  return "?";
}

export function registrosDesdeFilas(filas: string[][]): TablaTrabajo {
  let idx = -1;
  let columnas = new Map<number, Rol>();
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const cand = new Map<number, Rol>();
    filas[i].forEach((c, j) => {
      const rol = rolDeEncabezado(c);
      if (rol) cand.set(j, rol);
    });
    if (cand.size >= 3) {
      idx = i;
      columnas = cand;
      break;
    }
  }
  if (idx < 0) throw new ErrorImportacion("No encontré la fila de encabezados. ¿Es el Excel «Trabajo académico del estudiante»?");

  const col = (rol: Rol) => [...columnas.entries()].filter(([, r]) => r === rol).map(([j]) => j);
  const faltan = OBLIGATORIAS.filter((r) => !col(r).length).map((r) => NOMBRE_COLUMNA[r]);
  if (faltan.length) throw new ErrorImportacion(`Al Excel le faltan columnas: ${faltan.join(", ")}.`);

  const [cCodigo] = col("codigo");
  const [cAnio] = col("anio");
  const [cNota] = col("nota");
  const [cEstado] = col("estado");
  const cNombre = col("nombre")[0] ?? -1;
  const cCred = col("creditos")[0] ?? -1;
  const cTipo = col("tipo")[0] ?? -1;
  const cPeriodos = col("periodo");
  const celda = (f: string[], j: number) => (j >= 0 ? (f[j] ?? "").trim() : "");

  const registros: RegistroTrabajo[] = [];
  const advertencias: string[] = [];
  for (let i = idx + 1; i < filas.length; i++) {
    const f = filas[i];
    const codigo = claveCodigo(celda(f, cCodigo));
    if (!codigo) continue;
    const donde = `Fila ${i + 1} (${codigo})`;

    const anioNum = parseInt(celda(f, cAnio), 10);
    const anio = Number.isFinite(anioNum) && anioNum > 0 ? anioNum : null;

    const lecturas = cPeriodos.map((j) => celda(f, j));
    const porCodigo = lecturas.find((v) => /^\d{3}$/.test(v));
    const periodoLeido = periodoDeCelda(porCodigo ?? lecturas.find((v) => periodoDeCelda(v) && periodoDeCelda(v) !== "?") ?? "");
    const periodo = periodoLeido === "?" ? null : periodoLeido;
    if (anio !== null && !periodo) advertencias.push(`${donde}: período no reconocido, se omitió.`);

    let nota: number | null = null;
    const textoNota = celda(f, cNota);
    if (textoNota) {
      const n = leerNumero(textoNota);
      if (Number.isNaN(n) || n < 1 || n > 7) advertencias.push(`${donde}: nota «${textoNota}» fuera de rango, se ignoró.`);
      else nota = Math.round(n * 10) / 10;
    }
    const cred = cCred >= 0 ? leerNumero(celda(f, cCred)) : NaN;

    registros.push({
      fila: i + 1,
      codigo,
      nombre: celda(f, cNombre).replace(/\s+/g, " "),
      anio,
      periodo: anio !== null ? periodo : null,
      creditos: Number.isFinite(cred) && cred > 0 ? cred : null,
      nota,
      tipo: celda(f, cTipo),
      estado: estadoDesdeTexto(celda(f, cEstado)),
    });
  }
  if (!registros.length) throw new ErrorImportacion("El Excel no tiene ramos. Exporta el reporte con todo tu historial.");
  return { registros, advertencias };
}

export async function leerTrabajoAcademico(buffer: ArrayBuffer): Promise<TablaTrabajo> {
  if (buffer.byteLength > MAX_ARCHIVO) throw new ErrorImportacion("El archivo es demasiado grande para ser el reporte de la UDP.");
  const zip = abrirZip(buffer);
  const compartidos = textosCompartidos((await zip.leer("xl/sharedStrings.xml")) ?? "");
  let primerError: unknown = null;
  for (const ruta of await hojas(zip)) {
    const xml = await zip.leer(ruta);
    if (!xml) continue;
    try {
      return registrosDesdeFilas(filasDeHoja(xml, compartidos));
    } catch (e) {
      primerError ??= e;
    }
  }
  throw primerError ?? new ErrorImportacion("El Excel no tiene hojas con datos.");
}
