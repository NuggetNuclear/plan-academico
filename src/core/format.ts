// Umbral real de aprobación: en Chile un 3,95 se redondea a 4,0.
export const NOTA_APROB = 3.95;

/** Lee "5,5", "5.5" o " 6 " como número. Devuelve NaN si no es un número. */
export function leerNumero(valor: unknown): number {
  const texto = String(valor ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  if (texto === "") return NaN;
  return /^-?\d*\.?\d*$/.test(texto) ? parseFloat(texto) : NaN;
}

export function fmtNota(n: number | null | undefined, dec = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(dec).replace(".", ",");
}

export function numeroConComa(n: number | null | undefined | ""): string {
  return n === null || n === undefined || n === "" ? "" : String(n).replace(".", ",");
}

/** Minúsculas y sin tildes: "calculo" encuentra "Cálculo". */
export function normalizarTexto(str: string | undefined | null): string {
  return (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export const plural = (n: number, singular: string, pluralForm = singular + "s") =>
  `${n} ${n === 1 ? singular : pluralForm}`;

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
