import { describe, expect, it } from "vitest";
import type { Entrada } from "../../core/state";
import { calcularRamo } from "../../core/grades";
import { guardarRegistro, type Registro } from "./registro";

const entrada = (): Entrada => ({ uid: "ramo-1", id: "calculo", notaFinal: null, categorias: [] });
const registro = (cambio: Partial<Registro> = {}): Registro => ({ categoria: null, evaluacion: null, nombre: "Solemne 1", nota: "5,5", porcentaje: "30", fecha: "", ...cambio });

describe("registro rápido de notas", () => {
  it("guarda una nota con coma y calcula su aporte sin cerrar el ramo", () => {
    const ramo = entrada();
    expect(guardarRegistro(ramo, registro())).toBeNull();
    expect(ramo.notaFinal).toBeNull();
    expect(calcularRamo(ramo).nfActual).toBeCloseTo(5.5);
    expect(calcularRamo(ramo).pesoEvaluado).toBe(30);
  });

  it("conserva notas sin porcentaje, sin atribuirles un peso inventado", () => {
    const ramo = entrada();
    guardarRegistro(ramo, registro({ porcentaje: "", nota: "6.2" }));
    expect(ramo.categorias[0].notas[0].n).toBe(6.2);
    expect(ramo.categorias[0].peso).toBe(0);
    expect(calcularRamo(ramo).nfActual).toBeNull();
  });

  it("edita una evaluación pendiente y conserva su factor y requisito", () => {
    const ramo = entrada();
    ramo.categorias = [{ nombre: "Solemnes", peso: 100, req: true, notas: [{ n: 4, f: 1 }, { n: null, f: 2, fecha: "2026-10-13" }] }];
    guardarRegistro(ramo, registro({ categoria: 0, evaluacion: 1, nota: "7", fecha: "2026-10-14" }));
    expect(ramo.categorias[0].notas).toHaveLength(2);
    expect(ramo.categorias[0].notas[1]).toEqual({ n: 7, f: 2, etiqueta: "Solemne 1", fecha: "2026-10-14" });
    expect(ramo.categorias[0].req).toBe(true);
    expect(calcularRamo(ramo).nfActual).toBe(6);
  });

  it.each(["", "8", "0", "-5", "abc", "5,5,5"])("rechaza %j sin modificar la entrada", (nota) => {
    const ramo = entrada();
    const anterior = structuredClone(ramo);
    expect(guardarRegistro(ramo, registro({ nota }))).not.toBeNull();
    expect(ramo).toEqual(anterior);
  });

  it("rechaza porcentajes que exceden el total, pero permite agregar a un grupo existente", () => {
    const ramo = entrada();
    guardarRegistro(ramo, registro({ porcentaje: "100" }));
    const anterior = structuredClone(ramo);
    expect(guardarRegistro(ramo, registro())).not.toBeNull();
    expect(ramo).toEqual(anterior);
    expect(guardarRegistro(ramo, registro({ categoria: 0, nota: "4.5" }))).toBeNull();
    expect(ramo.categorias[0].notas).toHaveLength(2);
    expect(calcularRamo(ramo).nfActual).toBe(5);
  });

  it("con % sobre la presentación, el examen no cuenta para el total disponible", () => {
    const ramo = entrada();
    ramo.examen = { escala: "presentacion", eximicion: 5, asistenciaMin: null, asistencia: null };
    ramo.categorias = [
      { nombre: "Solemnes", peso: 60, notas: [{ n: 5, f: 1 }] },
      { nombre: "Examen", peso: 30, examen: true, notas: [{ n: null, f: 1 }] },
    ];
    expect(guardarRegistro(ramo, registro({ porcentaje: "40" }))).toBeNull();
    expect(guardarRegistro(ramo, registro({ porcentaje: "1" }))).not.toBeNull();
  });

  it("no modifica ramos cerrados ni evaluaciones eliminadas", () => {
    const ramo = entrada();
    expect(guardarRegistro(ramo, registro({ categoria: 0, evaluacion: 0 }))).not.toBeNull();
    ramo.notaFinal = 6;
    expect(guardarRegistro(ramo, registro())).not.toBeNull();
    expect(ramo.categorias).toEqual([]);
  });

  it("cambia cuánto vale una evaluación dentro de su categoría", () => {
    const ramo = entrada();
    ramo.categorias = [{ nombre: "Controles", peso: 100, notas: [{ n: 4, f: 1 }, { n: null, f: 1 }] }];
    expect(guardarRegistro(ramo, registro({ categoria: 0, evaluacion: 1, nota: "7", factor: "2" }))).toBeNull();
    expect(ramo.categorias[0].notas[1]).toMatchObject({ n: 7, f: 2 });
    expect(calcularRamo(ramo).nfActual).toBeCloseTo(6);
    expect(guardarRegistro(ramo, registro({ categoria: 0, evaluacion: 1, factor: "-1" }))).not.toBeNull();
  });

  it("rechaza días que no existen en vez de pasarlos al mes siguiente", () => {
    expect(guardarRegistro(entrada(), registro({ fecha: "2026-02-31" }))).not.toBeNull();
    expect(guardarRegistro(entrada(), registro({ fecha: "2026-2-3" }))).not.toBeNull();
    expect(guardarRegistro(entrada(), registro({ fecha: "2028-02-29" }))).toBeNull();
  });
});
