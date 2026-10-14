import { leerNumero } from "../../core/format";
import { pesoAsignado } from "../../core/grades";
import type { Entrada } from "../../core/state";

export interface Registro {
  categoria: number | null;
  evaluacion: number | null;
  nombre: string;
  nota: string;
  porcentaje: string;
  fecha: string;
}

export function validarRegistro(entrada: Entrada, datos: Registro): string | null {
  if (entrada.notaFinal !== null) return "Este ramo está cerrado. Reábrelo para editar sus evaluaciones.";
  const nota = leerNumero(datos.nota);
  if (!Number.isFinite(nota) || nota < 1 || nota > 7) return "Escribe una nota entre 1,0 y 7,0. Puedes usar coma o punto.";
  if (!datos.nombre.trim()) return "Escribe un nombre para reconocer la evaluación.";
  if (datos.categoria !== null && !entrada.categorias[datos.categoria]) return "La categoría ya no existe. Cierra y vuelve a abrir el registro.";
  if (datos.evaluacion !== null && (datos.categoria === null || !entrada.categorias[datos.categoria]?.notas[datos.evaluacion])) return "La evaluación ya no existe. Cierra y vuelve a abrir el registro.";
  if (datos.categoria === null && datos.porcentaje.trim()) {
    const peso = leerNumero(datos.porcentaje);
    if (!Number.isFinite(peso) || peso <= 0 || peso > 100) return "El porcentaje debe ser mayor que 0 y como máximo 100.";
    const total = pesoAsignado(entrada);
    if (total + peso > 100.05) return `Ya tienes ${total}% asignado. Queda ${Math.max(0, 100 - total)}% disponible.`;
  }
  if (datos.fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) || Number.isNaN(Date.parse(`${datos.fecha}T12:00:00`)))) return "Revisa la fecha de la evaluación.";
  return null;
}

/** Se valida antes de modificar: un error nunca deja una nota guardada a medias. */
export function guardarRegistro(entrada: Entrada, datos: Registro): string | null {
  const error = validarRegistro(entrada, datos);
  if (error) return error;
  const nota = { n: Math.round(leerNumero(datos.nota) * 100) / 100, etiqueta: datos.nombre.trim(), fecha: datos.fecha || null };
  if (datos.categoria === null) {
    entrada.categorias.push({ nombre: datos.nombre.trim(), peso: datos.porcentaje.trim() ? leerNumero(datos.porcentaje) : 0, notas: [{ ...nota, f: 1 }] });
  } else if (datos.evaluacion === null) {
    entrada.categorias[datos.categoria].notas.push({ ...nota, f: 1 });
  } else {
    Object.assign(entrada.categorias[datos.categoria].notas[datos.evaluacion], nota);
  }
  return null;
}
