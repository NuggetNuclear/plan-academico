import { describe, expect, it } from "vitest";
import { aplicarPlantilla, calcularRamo, PLANTILLAS } from "../../core/grades";
import type { Entrada } from "../../core/state";
import { crearSimulacion } from "./planificacion";

describe("pruebas de notas", () => {
  it("permite simular un ramo cerrado sin modificar sus notas o reglas originales", () => {
    const original: Entrada = { uid: "ramo", id: "CBM-1000", notaFinal: 6, decimas: 0.2,
      categorias: [{ id: "cat", nombre: "Pruebas", peso: 100, minimos: { examen: 4 }, notas: [{ id: "nota", n: 5, f: 1, fecha: "2026-11-06" }, { n: null, f: 2 }] }],
    };
    const antes = structuredClone(original);
    const copia = crearSimulacion(original);
    expect(copia.notaFinal).toBeNull();
    expect(copia.decimas).toBe(0);
    copia.categorias[0].notas[1].n = 7;
    expect(calcularRamo(copia).nfActual).toBeCloseTo(19 / 3);
    copia.categorias[0].minimos!.examen = 3;
    expect(original).toEqual(antes);
  });

  it("calcula promedios ponderados, pendientes y valores excluidos", () => {
    const copia = crearSimulacion();
    copia.categorias = [
      { nombre: "Pruebas", peso: 60, notas: [{ n: 6, f: 1 }, { n: null, f: 1 }, { n: 1, f: 0 }] },
      { nombre: "Tareas", peso: 40, notas: [{ n: 4, f: 1 }] },
    ];
    const calculo = calcularRamo(copia);
    expect(calculo.nfActual).toBeCloseTo(3.4 / 0.7);
    expect(calculo.nfPeor).toBeCloseTo(3.7);
    expect(calculo.necesaria).toBeCloseTo((3.95 - 3.4) / 0.3);
  });

  it("reutiliza el cálculo de examen y eximición", () => {
    const original = crearSimulacion();
    aplicarPlantilla(original, PLANTILLAS[0]);
    original.categorias.forEach((c) => c.notas.forEach((n) => { n.n = c.examen ? null : 6; }));
    const copia = crearSimulacion(original);
    const calculo = calcularRamo(copia);
    expect(calculo.examen?.estado).toBe("eximido");
    expect(calculo.nfActual).toBeCloseTo(6);
    expect(original.categorias.every((c) => c.id === undefined)).toBe(true);
    expect(copia.categorias.every((c) => c.id && c.notas.every((n) => n.id))).toBe(true);
  });
});
