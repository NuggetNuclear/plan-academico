// Exportar e importar respaldos de la app.
import { normalizarEstado, type PlannerState } from "../core/state";

const FORMATO = "notas-planner";
export const VERSION = 1;
const MAX_BYTES = 3 * 1024 * 1024;

export interface Respaldo {
  formato: typeof FORMATO;
  version: number;
  exportado: string;
  carreraActual: string | null;
  estados: Record<string, PlannerState>;
}

export function crearRespaldo(estados: Record<string, PlannerState>, carreraActual: string | null): Respaldo {
  return { formato: FORMATO, version: VERSION, exportado: new Date().toISOString(), carreraActual, estados };
}

export function descargarArchivo(nombre: string, contenido: string, tipo = "application/json") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Importado {
  estados: Record<string, PlannerState>;
  carreraActual: string | null;
  exportado: string | null;
}

/** Lee un respaldo exportado por esta app. */
export async function leerRespaldo(archivo: File): Promise<Importado> {
  if (archivo.size > MAX_BYTES) throw new Error("El archivo es demasiado grande para ser un respaldo.");
  let data: unknown;
  try {
    data = JSON.parse(await archivo.text());
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const d = data as Record<string, unknown>;
  if (d?.formato === FORMATO && d.estados && typeof d.estados === "object") {
    if (Number(d.version) > VERSION) throw new Error("El respaldo viene de una versión más nueva de la app.");
    const estados: Record<string, PlannerState> = {};
    Object.entries(d.estados as Record<string, unknown>).forEach(([id, st]) => (estados[id] = normalizarEstado(st)));
    return { estados, carreraActual: (d.carreraActual as string) ?? null, exportado: (d.exportado as string) ?? null };
  }
  throw new Error("Este archivo no es un respaldo reconocido.");
}
