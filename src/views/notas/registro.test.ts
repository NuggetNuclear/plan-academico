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

  it("no modifica ramos cerrados ni evaluaciones eliminadas", () => {
    const ramo = entrada();
    expect(guardarRegistro(ramo, registro({ categoria: 0, evaluacion: 0 }))).not.toBeNull();
    ramo.notaFinal = 6;
    expect(guardarRegistro(ramo, registro())).not.toBeNull();
    expect(ramo.categorias).toEqual([]);
  });
});
