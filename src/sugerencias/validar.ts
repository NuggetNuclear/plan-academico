// Validación del formulario de sugerencias. Es solo la primera barrera (ahorra viajes y da mensajes claros):
// quien reciba los datos DEBE volver a validar todo, porque el navegador se puede saltar. Ver docs/plan-formulario-sugerencias.md.

export type TipoSugerencia = "idea" | "error" | "duda";

export const TIPOS: { valor: TipoSugerencia; etiqueta: string }[] = [
  { valor: "idea", etiqueta: "Idea" },
  { valor: "error", etiqueta: "Error" },
  { valor: "duda", etiqueta: "Duda" },
];

export const MIN_MENSAJE = 10;
export const MAX_MENSAJE = 2000;
export const MAX_CORREO = 120;
export const MAX_ADJUNTO = 2 * 1024 * 1024; // 2 MB

// Solo imágenes rasterizadas. Nada de SVG (puede traer scripts), PDF, ZIP ni ejecutables.
export const ADJUNTO_TIPOS = ["image/png", "image/jpeg", "image/webp"] as const;
type TipoAdjunto = (typeof ADJUNTO_TIPOS)[number];

export const fmtMB = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;

const empieza = (b: Uint8Array, firma: number[], desde = 0) => firma.every((v, i) => b[desde + i] === v);

// Los primeros bytes de un archivo dicen qué es de verdad, sin importar su extensión ni el tipo que declare el navegador.
function tipoReal(b: Uint8Array): TipoAdjunto | null {
  if (empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (empieza(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empieza(b, [0x52, 0x49, 0x46, 0x46]) && empieza(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Devuelve el motivo del rechazo, o null si el archivo es una imagen aceptable. */
export async function validarAdjunto(archivo: File): Promise<string | null> {
  if (archivo.size === 0) return "El archivo está vacío.";
  if (archivo.size > MAX_ADJUNTO) return `Pesa ${fmtMB(archivo.size)}; el máximo es ${fmtMB(MAX_ADJUNTO)}.`;
  if (!(ADJUNTO_TIPOS as readonly string[]).includes(archivo.type)) return "Solo se aceptan imágenes PNG, JPG o WebP.";
  const cabecera = new Uint8Array(await archivo.slice(0, 12).arrayBuffer());
  if (tipoReal(cabecera) !== archivo.type) return "El contenido no coincide con el tipo de imagen del archivo.";
  return null;
}

export interface DatosSugerencia {
  tipo: TipoSugerencia;
  mensaje: string;
  correo: string;
}

export type ErroresSugerencia = Partial<Record<"mensaje" | "correo", string>>;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarSugerencia({ mensaje, correo }: DatosSugerencia): ErroresSugerencia {
  const e: ErroresSugerencia = {};
  const m = mensaje.trim();
  if (m.length < MIN_MENSAJE) e.mensaje = `Cuéntanos un poco más (mínimo ${MIN_MENSAJE} caracteres).`;
  else if (m.length > MAX_MENSAJE) e.mensaje = `Máximo ${MAX_MENSAJE} caracteres.`;
  const c = correo.trim();
  if (c && (c.length > MAX_CORREO || !CORREO.test(c))) e.correo = "Ese correo no parece válido.";
  return e;
}
