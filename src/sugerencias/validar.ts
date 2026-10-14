// Validación del formulario de ayuda. Es solo la primera barrera (ahorra viajes y da mensajes claros):
// las mismas reglas se repiten en firestore.rules, porque el navegador se puede saltar.

export type TipoSugerencia = "duda" | "idea" | "otro";

export const TIPOS: { valor: TipoSugerencia; etiqueta: string }[] = [
  { valor: "duda", etiqueta: "Duda" },
  { valor: "idea", etiqueta: "Idea" },
  { valor: "otro", etiqueta: "Otro" },
];

export const MIN_MENSAJE = 10;
export const MAX_MENSAJE = 2000;
export const MAX_CORREO = 120;

export interface DatosSugerencia {
  tipo: TipoSugerencia;
  mensaje: string;
  correo: string;
}

type ErroresSugerencia = Partial<Record<"mensaje" | "correo", string>>;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarSugerencia({ mensaje, correo }: DatosSugerencia): ErroresSugerencia {
  const e: ErroresSugerencia = {};
  const m = mensaje.trim();
  if (m.length < MIN_MENSAJE) e.mensaje = `Cuéntame un poco más (mínimo ${MIN_MENSAJE} caracteres).`;
  else if (m.length > MAX_MENSAJE) e.mensaje = `Máximo ${MAX_MENSAJE} caracteres.`;
  const c = correo.trim();
  if (c && (c.length > MAX_CORREO || !CORREO.test(c))) e.correo = "Ese correo no parece válido.";
  return e;
}
