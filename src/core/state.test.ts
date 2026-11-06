import { describe, expect, it } from "vitest";
import malla from "../../public/carreras/inf.json";
import { calcularPPA, resumenCreditos, situacionSemestreUDP } from "./academic";
import { evaluacionesConFecha } from "./calendar";
import { construirCurriculum } from "./curriculum";
import { calcularRamo } from "./grades";
import { generarPlanes } from "./planner";
import { estadoInicial, normalizarEstado, type Entrada } from "./state";

describe("datos guardados y respaldos", () => {
  it("limpia los valores malformados sin perder los intentos válidos", () => {
    const st = normalizarEstado({
      maxCreditos: -20,
      marcas: { valido: null, semestre: 2, negativo: -1, texto: "2", objeto: {} },
      cursando: ["CBM-1001", null, 4, "CBM-1001"],
      alias: { "CBM-1001": { nombre: {}, sigla: 3 }, invalido: null },
      periodos: [{ numero: 1, ramos: [{ id: "CBM-1001", siglaReal: 9, nombreReal: {}, notaFinal: "6",
        categorias: [{ nombre: 42, peso: -2, notas: [5.5, null, { n: "7", f: -1, fecha: 2 }, { n: 6, f: 0 }] }],
      }] }],
      prefs: { metaPPA: "6", mostrarNotas: "no", avanceDescartado: -1, wizardHecho: "sí" },
    });
    expect(st.maxCreditos).toBeNull();
    expect(st.marcas).toEqual({ valido: null, semestre: 2 });
    expect(st.cursando).toEqual(["CBM-1001"]);
    expect(st.prefs).toEqual(estadoInicial().prefs);
    const entrada = st.periodos[0].ramos[0];
    expect(entrada.notaFinal).toBeNull();
    expect(entrada.categorias[0]).toMatchObject({ nombre: "", peso: 0, notas: [{ n: 5.5, f: 1 }, { n: null, f: 1 }, { n: null, f: 1, fecha: null }, { n: 6, f: 0 }] });
    const ctx = { cur: construirCurriculum(malla), st };
    expect(() => [calcularPPA(ctx), resumenCreditos(ctx), situacionSemestreUDP(ctx), generarPlanes(ctx), evaluacionesConFecha(ctx)]).not.toThrow();
    expect(calcularRamo(entrada).nf).toBeNull();
  });

  it.each([0, -1, NaN, Infinity, "30"])("repara el límite de créditos inválido %s", (maxCreditos) => {
    expect(normalizarEstado({ maxCreditos }).maxCreditos).toBeNull();
  });

  it("conserva notas, ponderaciones, mínimos y fechas válidas al restaurar", () => {
    const st = estadoInicial();
    const entrada: Entrada = { uid: "ramo", id: "CBM-1001", notaFinal: null, creditos: 0, meta: 6, decimas: 0.2,
      examen: { escala: "presentacion", eximicion: 5, asistencia: 80, asistenciaMin: 75 },
      categorias: [{ id: "categoria", nombre: "Solemnes", peso: 100, req: true, minimos: { examen: 4 },
        notas: [{ id: "nota", n: 5.5, f: 0, fecha: "2026-11-06", etiqueta: "Solemne 1" }] }],
    };
    st.periodos = [{ tipo: "regular", numero: 1, ramos: [entrada] }];
    st.planFijado = { fecha: "2026-11-06T12:00:00Z", etiqueta: "Mi plan", semestreBase: 1, semestres: [{ numero: 2, tipo: "futuro", ids: ["CBM-1003"] }] };
    expect(normalizarEstado(JSON.parse(JSON.stringify(st)))).toEqual(st);
  });

  it.each([
    { numero: 2, tipo: "desconocido", ids: ["CBM-1001"] },
    { numero: -1, tipo: "futuro", ids: ["CBM-1001"] },
    { numero: 2, tipo: "futuro", ids: [null] },
  ])("descarta semestres corruptos del plan guardado: %j", (semestre) => {
    expect(normalizarEstado({ planFijado: { etiqueta: "Plan", fecha: "2026-11-06", semestreBase: 1, semestres: [semestre] } }).planFijado).toBeNull();
  });

  it("descarta fechas imposibles y mínimos malformados de las evaluaciones", () => {
    const st = normalizarEstado({ periodos: [{ numero: 1, ramos: [{ id: "CBM-1001", categorias: [{ nombre: "Solemnes", peso: 100,
      minimos: { examen: "4", eximir: 5, eximirCada: {} }, notas: [{ n: 5, f: 1, fecha: "2026-02-31" }],
    }] }] }] });
    const c = st.periodos[0].ramos[0].categorias[0];
    expect(c.minimos).toEqual({ examen: null, eximir: 5, eximirCada: null });
    expect(c.notas[0].fecha).toBeNull();
  });
});
