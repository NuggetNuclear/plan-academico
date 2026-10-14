import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aprobadosSet,
  calcularPPA,
  ppaConEnCurso,
  causalesEliminacionUDP,
  evaluacionesCausalC,
  incidentesUDP,
  situacionSemestreUDP,
  estadoRamo,
  evolucionPPA,
  rendimientoPorArea,
  resumenCreditos,
  type Ctx,
} from "./academic";
import { construirCurriculum, evaluarReglaPractica, fechaEgreso, rutaCritica, semestreCalendario } from "./curriculum";
import { PLANTILLAS, aplicarPlantilla, calcularRamo, inferirEscala, notaDesdePuntaje, plantillaDesdeEntrada, puntajeParaNota, rendimientoRamo, statsCategoria } from "./grades";
import { evaluacionesConFecha, generarICS } from "./calendar";
import { generarPlanes, idsPendientes, moverRamo, puedeMoverRamo } from "./planner";
import { estadoInicial, nuevoUid, normalizarEstado, type Entrada, type Periodo, type PlannerState } from "./state";
import type { MallaDef } from "./types";

const inf = JSON.parse(readFileSync("public/carreras/inf.json", "utf8")) as MallaDef;

function ctxCon(cambios: Partial<PlannerState> = {}): Ctx {
  const st = { ...estadoInicial(), ...cambios };
  return { cur: construirCurriculum(inf), st };
}

const entrada = (id: string, notaFinal: number | null, extra: Partial<Entrada> = {}): Entrada => ({
  uid: nuevoUid(), id, categorias: [], notaFinal, ...extra,
});

describe("notas de un ramo", () => {
  it("promedia una categoría con factores y pendientes como 1,0", () => {
    const st = statsCategoria({ nombre: "Pruebas", peso: 60, notas: [{ n: 4.5, f: 1 }, { n: 5.8, f: 2 }, { n: null, f: 1 }] });
    expect(st.promRendido).toBeCloseTo((4.5 + 11.6) / 3, 5);
    expect(st.prom).toBeCloseTo((4.5 + 11.6 + 1) / 4, 5);
  });

  it("calcula actual, peor caso y nota necesaria con las unidades correctas", () => {
    const r = calcularRamo(entrada("X", null, {
      categorias: [{ nombre: "Solemnes", peso: 100, notas: [{ n: 5, f: 1 }, { n: null, f: 1 }] }],
    }));
    expect(r.nfActual).toBeCloseTo(5, 5);
    expect(r.nfPeor).toBeCloseTo(3, 5); // 5 y 1 → 3
    expect(r.restante).toBe(50);
    // necesita x en el 50% restante: 0,5·5 + 0,5·x ≥ 3,95 → x ≥ 2,9
    expect(r.necesaria).toBeCloseTo(2.9, 5);
  });

  it("cuenta como pendiente lo que aún no suma 100%", () => {
    const r = calcularRamo(entrada("X", null, {
      categorias: [{ nombre: "Tareas", peso: 40, notas: [{ n: 7, f: 1 }] }],
    }));
    expect(r.restante).toBe(60);
    // 0,4·7 = 2,8 asegurado; faltan 1,15 en el 60% → 1,9167
    expect(r.necesaria).toBeCloseTo((3.95 - 2.8) / 0.6, 5);
  });

  it("detecta requisitos aprobatorios perdidos y metas", () => {
    const r = calcularRamo(entrada("X", null, {
      categorias: [
        { nombre: "Lab", peso: 30, req: true, notas: [{ n: 2, f: 1 }, { n: 2, f: 1 }] },
        { nombre: "Solemnes", peso: 70, req: true, notas: [{ n: 3, f: 1 }, { n: null, f: 1 }] },
      ],
    }));
    expect(r.reqFallidos).toEqual(["Lab"]);
    expect(r.reqMetas[0].nombre).toBe("Solemnes");
    expect(r.reqMetas[0].nec).toBeCloseTo(4.9, 5);
  });

  it("calcula lo necesario para una meta personal", () => {
    const r = calcularRamo(entrada("X", null, {
      meta: 6,
      categorias: [{ nombre: "Pruebas", peso: 100, notas: [{ n: 6, f: 1 }, { n: null, f: 1 }] }],
    }));
    expect(r.necesariaMeta).toBeCloseTo(5.9, 5);
  });
});

describe("examen y eximición", () => {
  const examen = (n: number | null) => ({ nombre: "Examen", peso: 30, examen: true, notas: [{ n, f: 1 }] });
  const conEximicion = { escala: "presentacion" as const, eximicion: 5, asistenciaMin: null, asistencia: null };

  it("con % sobre la presentación, la presentación vale 70% y el examen 30%", () => {
    const r = calcularRamo(entrada("X", null, {
      examen: { ...conEximicion, eximicion: null },
      categorias: [
        { nombre: "Solemnes", peso: 60, notas: [{ n: 4, f: 1 }] },
        { nombre: "Controles", peso: 40, notas: [{ n: 5, f: 1 }] },
        examen(3),
      ],
    }));
    // NP = 0,6·4 + 0,4·5 = 4,4; NF = 0,7·4,4 + 0,3·3 = 3,98
    expect(r.examen?.np).toBeCloseTo(4.4, 5);
    expect(r.nfActual).toBeCloseTo(3.98, 5);
    expect(r.examen?.pesoPresentacionEsperado).toBe(100);
  });

  it("con % crudos del ramo (suman 70%) normaliza la presentación", () => {
    const r = calcularRamo(entrada("X", null, {
      categorias: [
        { nombre: "Solemnes", peso: 42, notas: [{ n: 4, f: 1 }] },
        { nombre: "Controles", peso: 28, notas: [{ n: 5, f: 1 }] },
        examen(null),
      ],
    }));
    expect(r.examen?.np).toBeCloseTo(4.4, 5);
    expect(r.examen?.presentacionCompleta).toBe(true);
    // 0,7·4,4 = 3,08; faltan 0,87 en el 30% → 2,9
    expect(r.examen?.necesariaExamen).toBeCloseTo(2.9, 5);
  });

  it("se exime con presentación ≥ 5,0 (redondeada) y la nota final es la presentación", () => {
    const r = calcularRamo(entrada("X", null, {
      examen: conEximicion,
      categorias: [{ nombre: "Solemnes", peso: 100, notas: [{ n: 4.9, f: 1 }, { n: 5, f: 1 }] }, examen(null)],
    }));
    expect(r.examen?.estado).toBe("eximido");
    expect(r.nfActual).toBeCloseTo(4.95, 5);
    expect(r.nfPeor).toBeCloseTo(4.95, 5);
    expect(r.restante).toBe(0);
    expect(r.necesaria).toBeNull();
  });

  it("sin la asistencia exigida no se exime y el examen cuenta", () => {
    const r = calcularRamo(entrada("X", null, {
      examen: { ...conEximicion, asistenciaMin: 75, asistencia: 60 },
      categorias: [{ nombre: "Solemnes", peso: 100, notas: [{ n: 6, f: 1 }] }, examen(2)],
    }));
    expect(r.examen?.estado).toBe("no-eximido");
    expect(r.examen?.motivo).toBe("asistencia");
    expect(r.nfActual).toBeCloseTo(0.7 * 6 + 0.3 * 2, 5);
  });

  it("dice cuánto falta para eximirse y cuándo la eximición está asegurada", () => {
    const posible = calcularRamo(entrada("X", null, {
      examen: conEximicion,
      categorias: [{ nombre: "Solemnes", peso: 100, notas: [{ n: 5, f: 1 }, { n: null, f: 1 }] }, examen(null)],
    }));
    expect(posible.examen?.estado).toBe("posible");
    expect(posible.examen?.necesariaEximir).toBeCloseTo(4.9, 5); // (4,95·2 − 5)
    const asegurada = calcularRamo(entrada("X", null, {
      examen: { ...conEximicion, eximicion: 4 },
      categorias: [{ nombre: "Solemnes", peso: 100, notas: [{ n: 7, f: 3 }, { n: null, f: 1 }] }, examen(null)],
    }));
    expect(asegurada.examen?.estado).toBe("asegurada");
    expect(asegurada.nfPeor).toBeCloseTo(5.5, 5);
  });

  describe("mínimos por categoría (NP = 0,3·S1 + 0,3·S2 + 0,2·NT + 0,2·NC)", () => {
    // Eximición: NP ≥ 5,0, NT ≥ 5,5 y cada tarea ≥ 4,0. Para dar examen: NT ≥ 4,0 y NP ≥ 3,5.
    const ramo = (tareas: (number | null)[], s = 5) => entrada("X", null, {
      examen: { escala: "presentacion", eximicion: 5, asistenciaMin: null, asistencia: null, minPresentacion: 3.5 },
      categorias: [
        { nombre: "S1", peso: 30, notas: [{ n: s, f: 1 }] },
        { nombre: "S2", peso: 30, notas: [{ n: s, f: 1 }] },
        { nombre: "Tareas", peso: 20, minimos: { eximir: 5.5, eximirCada: 4, examen: 4 }, notas: tareas.map((n) => ({ n, f: 1 })) },
        { nombre: "Controles", peso: 20, notas: [{ n: 5, f: 1 }] },
        examen(null),
      ],
    });

    it("se exime si cumple la presentación y los mínimos de tareas", () => {
      const r = calcularRamo(ramo([6, 6, 5], 5.5));
      expect(r.examen?.np).toBeCloseTo(0.6 * 5.5 + 0.2 * (17 / 3) + 0.2 * 5, 5);
      expect(r.examen?.estado).toBe("eximido");
    });

    it("una tarea bajo 4,0 impide la eximición aunque NP y NT alcancen", () => {
      const r = calcularRamo(ramo([7, 7, 3.5], 5.5));
      expect(r.examen?.estado).toBe("no-eximido");
      expect(r.examen?.motivo).toBe("condicion");
      expect(r.examen?.condicionesEximir.find((c) => c.estado === "falla")?.texto).toBe("cada nota de Tareas ≥ 4,0");
      expect(r.examen?.habilitacion).toBe("habilitado");
    });

    it("con NT bajo 4,0 no hay derecho a examen y el ramo queda perdido", () => {
      const r = calcularRamo(ramo([3, 3, 4]));
      expect(r.examen?.habilitacion).toBe("no-habilitado");
      expect(r.examen?.necesariaExamen).toBeNull();
      expect(rendimientoRamo(r)).toBe("perdido");
    });

    it("con presentación bajo 3,5 no hay derecho a examen", () => {
      const r = calcularRamo(ramo([6, 6, 6], 2));
      expect(r.examen?.np).toBeCloseTo(0.6 * 2 + 0.2 * 6 + 0.2 * 5, 5); // 3,4
      expect(r.examen?.condicionesExamen.find((c) => c.estado === "falla")?.texto).toBe("nota de presentación ≥ 3,5");
      expect(r.examen?.habilitacion).toBe("no-habilitado");
    });

    it("con tareas pendientes dice cuánto falta para eximirse", () => {
      const r = calcularRamo(ramo([6, 6, null], 6));
      expect(r.examen?.estado).toBe("posible");
      const tareas = r.examen?.condicionesEximir.find((c) => c.texto === "Tareas ≥ 5,5");
      expect(tareas?.nec).toBeCloseTo(5.45 * 3 - 12, 5);
      expect(r.examen?.condicionesEximir.find((c) => c.cada)?.estado).toBe("pendiente");
      // NT peor caso (6+6+1)/3 = 4,33 ≥ 4,0 y NP peor caso ≥ 3,5: ya tiene derecho a examen
      expect(r.examen?.habilitacion).toBe("habilitado");
    });
  });
});

describe("escala de notas", () => {
  const esc = { puntajeMax: 60, exigencia: 0.6 };
  it("convierte puntaje a nota con 60% de exigencia", () => {
    expect(notaDesdePuntaje(36, esc)).toBe(4);
    expect(notaDesdePuntaje(60, esc)).toBe(7);
    expect(notaDesdePuntaje(0, esc)).toBe(1);
    expect(notaDesdePuntaje(48, esc)).toBe(5.5);
  });
  it("invierte la escala", () => {
    expect(puntajeParaNota(4, esc)).toBeCloseTo(36);
    expect(puntajeParaNota(7, esc)).toBeCloseTo(60);
  });
});

describe("malla", () => {
  it("bloquea según prerrequisitos y desbloquea al aprobar", () => {
    const ctx = ctxCon();
    expect(estadoRamo(ctx, "CBM-1001")).toBe("disponible");
    expect(estadoRamo(ctx, "CBM-1003")).toBe("bloqueado");
    const ctx2 = ctxCon({ marcas: { "CBM-1001": 1 } });
    expect(estadoRamo(ctx2, "CBM-1003")).toBe("disponible");
  });

  it("una nota final ≥ 3,95 aprueba el ramo y < 3,95 no", () => {
    const apr = ctxCon({ periodos: [{ tipo: "regular", numero: 1, ramos: [entrada("CBM-1001", 3.95)] }] });
    expect(estadoRamo(apr, "CBM-1001")).toBe("aprobado");
    const rep = ctxCon({ periodos: [{ tipo: "regular", numero: 1, ramos: [entrada("CBM-1001", 3.9)] }] });
    expect(estadoRamo(rep, "CBM-1001")).toBe("disponible");
  });

  it("aplica la regla de la Práctica Profesional I (deuda máxima de un ramo)", () => {
    const cur = construirCurriculum(inf);
    const practica = cur.map["CIT-4000"];
    const hasta4 = cur.ramos.filter((r) => r.semestre <= 4).map((r) => r.id);
    expect(evaluarReglaPractica(practica, new Set(hasta4)).ok).toBe(true);
    const debeUno = new Set(hasta4.filter((id) => id !== "CIT-2008"));
    const ev = evaluarReglaPractica(practica, debeUno);
    expect(ev.ok).toBe(true);
    expect(ev.deuda).toEqual(["CIT-2008"]);
    const debeDos = new Set(hasta4.filter((id) => id !== "CIT-2008" && id !== "CIG-1012"));
    expect(evaluarReglaPractica(practica, debeDos).ok).toBe(false);
  });

  it("los niveles de inglés eximidos cuentan como aprobados pero no suman créditos", () => {
    const ctx = ctxCon({ inglesEximido: 2 });
    expect(aprobadosSet(ctx).has("CIG-1013")).toBe(true);
    expect(estadoRamo(ctx, "CIG-1014")).toBe("disponible");
    expect(resumenCreditos(ctx).avance).toBe(0);
  });

  it("las congelaciones desplazan el semestre calendario", () => {
    expect(semestreCalendario(3, [{ desde: 3, duracion: 1 }])).toBe(4);
    expect(semestreCalendario(2, [{ desde: 3, duracion: 1 }])).toBe(2);
  });

  it("una congelación futura atrasa el egreso; una pasada no", () => {
    const marzo = new Date(2026, 2, 1);
    expect(fechaEgreso(3, 5, [], marzo)).toBe("1.er semestre 2027");
    expect(fechaEgreso(3, 5, [{ desde: 2, duracion: 1 }], marzo)).toBe("1.er semestre 2027");
    expect(fechaEgreso(3, 5, [{ desde: 4, duracion: 1 }], marzo)).toBe("2.º semestre 2027");
  });

});

describe("PPA y créditos", () => {
  const st: Partial<PlannerState> = {
    semestreActual: 3,
    periodos: [
      { tipo: "regular", numero: 1, ramos: [entrada("CBM-1000", 5), entrada("CBM-1001", 3)] },
      { tipo: "regular", numero: 2, ramos: [entrada("CBM-1001", 6)] },
    ],
  };

  it("pondera por créditos e incluye reprobados", () => {
    const ctx = ctxCon(st);
    // (5·7 + 3·7 + 6·7) / 21
    expect(calcularPPA(ctx).ppa).toBeCloseTo((35 + 21 + 42) / 21, 6);
    const evo = evolucionPPA(ctx);
    expect(evo.map((p) => p.etiqueta)).toEqual(["S1", "S2"]);
    expect(evo[0].ppa).toBeCloseTo(4, 6);
    expect(evo[1].acumulado).toBeCloseTo(98 / 21, 6);
  });

  it("el PPA actual suma los ramos en curso con su promedio, sin tocar el confirmado", () => {
    const enCurso = entrada("CBM-1002", null, { categorias: [{ nombre: "Pruebas", peso: 100, notas: [{ n: 7, f: 1 }, { n: null, f: 1 }] }] });
    const sinNotas = entrada("CBM-1003", null);
    const ctx = ctxCon({ ...st, periodos: [...st.periodos!, { tipo: "regular", numero: 3, ramos: [enCurso, sinNotas] }] });
    const cred = ctx.cur.map["CBM-1002"].creditos;
    expect(calcularPPA(ctx).ppa).toBeCloseTo(98 / 21, 6);
    expect(ppaConEnCurso(ctx)).toEqual({ ppa: expect.closeTo((98 + 7 * cred) / (21 + cred), 6), ramos: 1 });
    expect(ppaConEnCurso(ctxCon(st))).toEqual({ ppa: expect.closeTo(98 / 21, 6), ramos: 0 });
  });

  it("separa créditos inscritos, aprobados, reprobados y de avance", () => {
    const r = resumenCreditos(ctxCon(st));
    expect(r.inscritos).toBe(21);
    expect(r.aprobados).toBe(14);
    expect(r.reprobados).toBe(7);
    expect(r.avance).toBe(14);
  });

  it("agrupa por área ponderando por créditos y deja fuera prácticas", () => {
    const ctx = ctxCon({
      periodos: [
        // Química (6 cr) y Mecánica (7 cr) son Ciencias básicas; Programación (6 cr) es PRG; la práctica no tiene área.
        { tipo: "regular", numero: 1, ramos: [entrada("CBQ-1000", 4), entrada("CBF-1000", 6), entrada("CIT-1000", 6.5), entrada("CIT-4000", 7)] },
        { tipo: "regular", numero: 2, ramos: [entrada("CIT-1000", 3)] },
      ],
    });
    const r = rendimientoPorArea(ctx);
    expect(r.map((a) => a.area)).toEqual(["CIE", "PRG"]);
    expect(r[0].prom).toBeCloseTo((4 * 6 + 6 * 7) / 13, 6);
    expect(r[1]).toMatchObject({ n: 2, aprobados: 1 });
    expect(r[1].prom).toBeCloseTo(4.75, 6);
  });

  it("todos los ramos de la malla tienen un área definida, salvo prácticas y titulación", () => {
    const sinArea = inf.ramos.filter((r) => !r.area).map((r) => r.id);
    expect(sinArea).toEqual(["CIT-4000", "CIT-4001", "CIT-4002"]);
    inf.ramos.forEach((r) => r.area && expect(inf.areas).toHaveProperty(r.area));
  });
});

describe("causales de eliminación UDP (art. 38)", () => {
  it("causal b: misma asignatura reprobada tres veces", () => {
    const ctx = ctxCon({
      periodos: [1, 2, 3].map((n) => ({ tipo: "regular" as const, numero: n, ramos: [entrada("CBM-1001", 2.5)] })),
    });
    expect(causalesEliminacionUDP(ctx).map((c) => c.tipo)).toContain("b");
  });

  it("causal c: más del 50% reprobado en los dos últimos semestres, con excepción", () => {
    const periodos = [
      { tipo: "regular" as const, numero: 1, ramos: [entrada("CBM-1000", 2), entrada("CBM-1001", 2), entrada("CBQ-1000", 5)] },
      { tipo: "regular" as const, numero: 2, ramos: [entrada("CBM-1000", 3), entrada("CBM-1001", 6)] },
    ];
    expect(causalesEliminacionUDP(ctxCon({ periodos })).map((c) => c.tipo)).toContain("c");
    expect(causalesEliminacionUDP(ctxCon({ periodos, permanenciasUDP: [2] })).map((c) => c.tipo)).not.toContain("c");
  });

  it("la causal c no se evalúa con el semestre en curso a medio cerrar", () => {
    const periodos: Periodo[] = [
      { tipo: "regular", numero: 1, ramos: [entrada("CBM-1000", 2), entrada("CBM-1001", 2), entrada("CBQ-1000", 5), entrada("CIT-1000", 5)] },
      { tipo: "regular", numero: 2, ramos: [entrada("CBM-1002", 3), entrada("CIT-1010", null), entrada("CBF-1000", null)] },
    ];
    expect(causalesEliminacionUDP(ctxCon({ periodos, semestreActual: 2 }))).toEqual([]);
    const cerrado = periodos.map((p) => (p.numero === 2 ? { ...p, ramos: [entrada("CBM-1002", 3), entrada("CIT-1010", 5), entrada("CBF-1000", 5)] } : p));
    expect(causalesEliminacionUDP(ctxCon({ periodos: cerrado, semestreActual: 2 }))).toEqual([]);
    const malo = periodos.map((p) => (p.numero === 2 ? { ...p, ramos: [entrada("CBM-1002", 3), entrada("CIT-1010", 3), entrada("CBF-1000", 5)] } : p));
    expect(causalesEliminacionUDP(ctxCon({ periodos: malo, semestreActual: 2 })).map((c) => c.tipo)).toEqual(["c"]);
  });

  it("la permanencia por la c exime solo el semestre siguiente efectivamente cursado", () => {
    const mal = (n: number) => ({ tipo: "regular" as const, numero: n, ramos: [entrada("CBM-1000", 2), entrada("CBM-1001", 2), entrada("CBQ-1000", 5)] });
    const ctx = ctxCon({ periodos: [mal(1), mal(2), mal(3), mal(4)], permanenciasUDP: [2] });
    const ev = evaluacionesCausalC(ctx);
    expect(ev.map((e) => [e.semestre, e.exenta])).toEqual([[2, false], [3, true], [4, false]]);
  });

  // Historial real: Optimización y Señales reprobadas dos veces, Sistemas Distribuidos una.
  const historialRiesgo = (): Periodo[] => [
    { tipo: "regular", numero: 5, ramos: [entrada("CII-2750", 3.4), entrada("CIT-2107", 4.3), entrada("CBF-1002", 4.4), entrada("CIT-2009", 4.6), entrada("CIT-2108", 5.1)] },
    { tipo: "regular", numero: 6, ramos: [entrada("CII-2750", 2.9), entrada("CIT-2110", 3.7), entrada("CIT-2010", 5.2), entrada("CIT-2205", 6.6), entrada("CIT-2109", 5.1)] },
    { tipo: "regular", numero: 7, ramos: [entrada("CII-2750", 4.2), entrada("CIT-2110", 2.8), entrada("CIT-2011", 2.5), entrada("CIT-2012", 5.8), entrada("CII-2100", 4.1)] },
    {
      tipo: "regular",
      numero: 8,
      ramos: [
        entrada("CIT-2110", null, { categorias: [{ nombre: "Solemnes", peso: 100, notas: [{ n: 3.2, f: 1 }, { n: null, f: 1 }] }] }),
        entrada("CIT-2011", null),
        entrada("CIT-2013", null),
      ],
    },
  ];

  it("advierte antes de caer: qué ramo en curso te deja en causal a o b", () => {
    const ctx = ctxCon({ periodos: historialRiesgo(), semestreActual: 8, cursando: ["CIT-2110", "CIT-2011", "CIT-2013"] });
    expect(causalesEliminacionUDP(ctx)).toEqual([]);
    const s = situacionSemestreUDP(ctx);
    expect(s.dosVeces.sort()).toEqual(["CII-2750", "CIT-2110"]);
    // Empate a dos: muestra la que aún no apruebas.
    expect(s.masReprobada).toEqual({ clave: "CIT-2110", veces: 2 });
    const porRamo = Object.fromEntries(s.ramos.map((r) => [r.clave, r.causales]));
    expect(porRamo).toEqual({ "CIT-2110": ["b"], "CIT-2011": ["a"], "CIT-2013": [] });
    const senales = s.ramos.find((r) => r.clave === "CIT-2110")!;
    expect(senales.rendimiento).toBe("reprobando");
    expect(senales.calculo.necesaria).toBeCloseTo(4.7, 6);
    // S7 + S8: 5 + 3 asignaturas, 2 reprobadas → puedes reprobar 2 más sin pasar del 50%.
    expect(s.margenC).toMatchObject({ semestres: [7, 8], cursadas: 8, reprobadas: 2, permitidas: 2, enCurso: 3, proyectadas: 1, exento: false });
  });

  it("reprobar varios ramos por segunda vez a la vez también suma la causal a", () => {
    const periodos: Periodo[] = [
      { tipo: "regular", numero: 1, ramos: [entrada("CBM-1000", 2), entrada("CBM-1001", 2), entrada("CBQ-1000", 6), entrada("CIT-1000", 6)] },
      { tipo: "regular", numero: 2, ramos: [entrada("CBM-1000", null), entrada("CBM-1001", null), entrada("FIC-1000", null)] },
    ];
    const s = situacionSemestreUDP(ctxCon({ periodos, semestreActual: 2 }));
    expect(s.ramos.every((r) => r.causales.length === 0)).toBe(true);
    expect(s.combinadaA).toBeNull();
    const conUna = ctxCon({ periodos: [{ ...periodos[0], ramos: [...periodos[0].ramos, entrada("CBM-1003", 2)] }, { ...periodos[1], ramos: [...periodos[1].ramos, entrada("CBM-1003", null)] }], semestreActual: 2 });
    expect(situacionSemestreUDP(conUna).combinadaA).toEqual({ necesarias: 3, claves: ["CBM-1000", "CBM-1001", "CBM-1003"] });
  });

  it("tras una permanencia aceptada, volver a reprobar te deja de nuevo en causal", () => {
    const periodos: Periodo[] = [
      { tipo: "regular", numero: 1, ramos: [entrada("CBM-1000", 2), entrada("CBM-1001", 2), entrada("CBQ-1000", 2), entrada("CIT-1000", 3), entrada("FIC-1000", 6), entrada("CBM-1003", 6), entrada("CBF-1000", 6)] },
      { tipo: "regular", numero: 2, ramos: [entrada("CBM-1000", 3), entrada("CBM-1001", 3), entrada("CBQ-1000", 3), entrada("CBM-1002", 6), entrada("CIT-1010", 6), entrada("CBM-1005", 6), entrada("CBM-1006", 6)] },
    ];
    const sin = ctxCon({ periodos });
    expect(incidentesUDP(sin)).toMatchObject([{ semestre: 2, causales: [{ causal: "a" }], aceptado: false }]);

    const aceptada = ctxCon({ periodos, permanenciasUDP: [2] });
    expect(causalesEliminacionUDP(aceptada)).toEqual([]);
    // Con la a ya cumplida, cualquier segunda reprobación vuelve a gatillarla.
    const s = situacionSemestreUDP(ctxCon({ periodos: [...periodos, { tipo: "regular", numero: 3, ramos: [entrada("CIT-1000", null), entrada("CBM-1000", null)] }], permanenciasUDP: [2], semestreActual: 3 }));
    expect(s.reincidencia).toBe(true);
    expect(Object.fromEntries(s.ramos.map((r) => [r.clave, r.causales]))).toEqual({ "CIT-1000": ["a"], "CBM-1000": ["b"] });

    const reincide = ctxCon({ periodos: [...periodos, { tipo: "regular", numero: 3, ramos: [entrada("CIT-1000", 3.1)] }], permanenciasUDP: [2] });
    expect(causalesEliminacionUDP(reincide).map((c) => c.tipo)).toEqual(["a"]);
    expect(incidentesUDP(reincide).map((i) => [i.semestre, i.aceptado])).toEqual([[2, true], [3, false]]);
  });

  it("migra las excepciones antiguas de la causal c a permanencias", () => {
    expect(normalizarEstado({ excepcionesCausalC: [3, 1, 3], permanenciasUDP: [5] }).permanenciasUDP).toEqual([1, 3, 5]);
  });

  it("descarta un plan guardado o marcas corruptas de un respaldo", () => {
    expect(normalizarEstado({ planFijado: { etiqueta: "x" } }).planFijado).toBeNull();
    expect(normalizarEstado({ planFijado: { etiqueta: "x", semestres: [{ numero: 2 }] } }).planFijado).toBeNull();
    expect(normalizarEstado({ marcas: ["CIT-1000"] }).marcas).toEqual({});
    const st = normalizarEstado({ periodos: [{ tipo: "regular", numero: 1, ramos: [null, { uid: "x" }, { id: "CBM-1000", categorias: [null, { nombre: "P", peso: 50, notas: [null] }] }] }] });
    expect(st.periodos[0].ramos.map((e) => e.id)).toEqual(["CBM-1000"]);
    expect(st.periodos[0].ramos[0].categorias).toMatchObject([{ nombre: "P", notas: [{ n: null, f: 1 }] }]);
  });
});

describe("planificación", () => {
  it("planifica toda la malla respetando el tope de créditos y los prerrequisitos", () => {
    const ctx = ctxCon();
    const planes = generarPlanes(ctx);
    expect(planes.length).toBeGreaterThan(0);
    const plan = planes[0];
    expect(plan.semestres.some((s) => s.tipo === "overflow")).toBe(false);
    const visto = new Set<string>();
    plan.semestres.forEach((s) => {
      expect(s.creditos).toBeLessThanOrEqual(36);
      s.ramos.forEach((r) => r.req.forEach((req) => expect(visto.has(req)).toBe(true)));
      s.ramos.forEach((r) => visto.add(r.id));
    });
    expect(visto.size).toBe(idsPendientes(ctx).size);
    // 11 semestres en la malla oficial: el plan no debería necesitar más.
    expect(plan.semestresRestantes).toBeLessThanOrEqual(11);
  });

  it("un ramo reprobado este semestre no hace que el plan reuse el semestre en curso", () => {
    const id = inf.ramos.find((r) => r.semestre === 1)!.id;
    const ctx = ctxCon({ periodos: [{ tipo: "regular", numero: 1, ramos: [entrada(id, 2.5)] }] });
    const semestres = generarPlanes(ctx)[0].semestres;
    expect(semestres[0]).toMatchObject({ numero: 1, tipo: "cursando" });
    expect(semestres.filter((s) => s.tipo === "futuro")[0].numero).toBe(2);
  });

  it("valida mover un ramo entre semestres", () => {
    const ctx = ctxCon();
    const plan = generarPlanes(ctx)[0];
    const s1 = plan.semestres[0];
    const calculo = s1.ramos.find((r) => r.id === "CBM-1001");
    expect(calculo).toBeDefined();
    // Cálculo I no puede quedar después de Cálculo II.
    const semCalc2 = plan.semestres.find((s) => s.ramos.some((r) => r.id === "CBM-1003"))!;
    expect(puedeMoverRamo(ctx, plan, "CBM-1001", s1.numero, semCalc2.numero)).toBe(false);
    const ultimo = plan.semestres.at(-1)!;
    const libre = plan.semestres.find((s) => s.ramos.some((r) => r.id === "CFG-1"))!;
    if (puedeMoverRamo(ctx, plan, "CFG-1", libre.numero, ultimo.numero)) {
      const movido = moverRamo(ctx, plan, "CFG-1", libre.numero, ultimo.numero);
      expect(movido.semestres.find((s) => s.numero === ultimo.numero)!.ramos.some((r) => r.id === "CFG-1")).toBe(true);
    }
  });

  it("encuentra la ruta crítica de la carrera", () => {
    const ctx = ctxCon();
    const cadena = rutaCritica(ctx.cur, idsPendientes(ctx));
    expect(cadena.length).toBeGreaterThanOrEqual(7);
    expect(cadena.at(-1)).toBe("CIT-4002");
  });
});

describe("persistencia y calendario", () => {
  it("normaliza estados dañados o antiguos", () => {
    const st = normalizarEstado({ semestreActual: "x", periodos: [{ tipo: "regular", numero: 2, ramos: [{ id: "A", categorias: [{ peso: 50, notas: [5] }] }] }] });
    expect(st.semestreActual).toBe(1);
    expect(st.periodos[0].ramos[0].categorias[0].notas[0]).toMatchObject({ n: 5, f: 1 });
    expect(st.periodos[0].ramos[0].notaFinal).toBeNull();
  });

  it("migra ids desde la posición: iguales en cada equipo y con el UID que ya usaba el .ics", () => {
    const guardado = { semestreActual: 1, periodos: [{ tipo: "regular", numero: 1, ramos: [{ uid: "r", id: "CBM-1000", categorias: [{ nombre: "S", peso: 100, notas: [{ n: null, f: 1, fecha: "2026-04-01" }, { n: null, f: 1, fecha: "2026-05-01" }] }] }] }] };
    const a = normalizarEstado(structuredClone(guardado));
    expect(a).toEqual(normalizarEstado(structuredClone(guardado)));
    expect(a.periodos[0].ramos[0].categorias[0].notas.map((n) => n.id)).toEqual(["r-0-0", "r-0-1"]);
    // Borrar una evaluación del medio no cambia el UID de las demás en el calendario.
    const ctx = ctxCon(a);
    const antes = evaluacionesConFecha(ctx).map((e) => e.uid);
    ctx.st.periodos[0].ramos[0].categorias[0].notas.splice(0, 1);
    expect(evaluacionesConFecha(ctx).map((e) => e.uid)).toEqual([antes[1]]);
  });

  it("genera un .ics válido", () => {
    const ics = generarICS([{ fecha: "2026-11-03", ramo: "Redes de Datos", sigla: "CIT-2114", categoria: "Solemnes", etiqueta: "Solemne 2", peso: 20, rendida: false, uid: "a" }]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261103");
    expect(ics).toContain("DTEND;VALUE=DATE:20261104");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
});

describe("plantillas de evaluación", () => {
  it("deduce si los % de la presentación son de la presentación o del ramo", () => {
    const ex = { peso: 30, examen: true };
    expect(inferirEscala([{ peso: 50 }, { peso: 50 }, ex])).toBe("presentacion");
    expect(inferirEscala([{ peso: 50 }, { peso: 20 }, ex])).toBe("ramo");
    expect(inferirEscala([{ peso: 50 }, { peso: 10 }, ex])).toBeNull();
    expect(inferirEscala([{ peso: 100 }])).toBeNull();
  });

  it("las plantillas con examen suman bien y calculan presentación", () => {
    PLANTILLAS.forEach((p) => {
      const tieneExamen = p.categorias.some((c) => c.examen);
      if (tieneExamen) expect(inferirEscala(p.categorias)).toBe(p.examen?.escala);
      else expect(p.categorias.reduce((s, c) => s + c.peso, 0)).toBe(100);
    });
    const e: Entrada = { uid: "x", id: "x", notaFinal: null, categorias: [] };
    aplicarPlantilla(e, PLANTILLAS.find((p) => p.categorias.some((c) => c.minimos))!);
    expect(e.categorias.find((c) => c.minimos)?.minimos?.examen).toBe(4);
    expect(calcularRamo(e).examen?.pesoPresentacionEsperado).toBe(100);
  });

  it("copia la estructura de otro ramo sin sus notas", () => {
    const origen: Entrada = {
      uid: "a", id: "a", notaFinal: null,
      categorias: [
        { nombre: "Solemne", peso: 70, notas: [{ n: 5, f: 1 }, { n: null, f: 1 }] },
        { nombre: "Tarea", peso: 30, req: true, minimos: { examen: 4 }, notas: [{ n: 6, f: 1 }] },
        { nombre: "Examen", peso: 30, examen: true, notas: [{ n: null, f: 1 }] },
      ],
      examen: { escala: "presentacion", eximicion: 5, asistenciaMin: 75, asistencia: 80, minPresentacion: 3.5 },
    };
    const destino: Entrada = { uid: "b", id: "b", notaFinal: null, categorias: [] };
    aplicarPlantilla(destino, plantillaDesdeEntrada("Origen", origen));
    expect(destino.categorias.map((c) => [c.nombre, c.peso, c.notas.length])).toEqual([["Solemne", 70, 2], ["Tarea", 30, 1], ["Examen", 30, 1]]);
    expect(destino.categorias.every((c) => c.notas.every((n) => n.n === null))).toBe(true);
    expect(destino.categorias[1]).toMatchObject({ req: true, minimos: { examen: 4 } });
    expect(destino.examen).toMatchObject({ eximicion: 5, minPresentacion: 3.5, asistenciaMin: 75, asistencia: null });
  });
});
