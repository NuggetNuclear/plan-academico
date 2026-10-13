import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aprobadosSet,
  calcularPPA,
  causalesEliminacionUDP,
  estadoRamo,
  evolucionPPA,
  resumenCreditos,
  type Ctx,
} from "./academic";
import { construirCurriculum, evaluarReglaPractica, rutaCritica, semestreCalendario } from "./curriculum";
import { calcularRamo, notaDesdePuntaje, puntajeParaNota, statsCategoria } from "./grades";
import { generarICS } from "./calendar";
import { generarPlanes, idsPendientes, moverRamo, puedeMoverRamo } from "./planner";
import { estadoInicial, nuevoUid, normalizarEstado, type Entrada, type PlannerState } from "./state";
import type { MallaDef } from "./types";

const inf = JSON.parse(readFileSync("public/carreras/inf.json", "utf8")) as MallaDef;
const ds = JSON.parse(readFileSync("public/carreras/ds.json", "utf8")) as MallaDef;

function ctxCon(cambios: Partial<PlannerState> = {}, malla = inf): Ctx {
  const st = { ...estadoInicial(), ...cambios };
  return { cur: construirCurriculum(malla, { rutaId: st.rutaAcademica, gruposAltModo: st.gruposAltModo }), st };
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

  it("desplaza la oferta anual con congelaciones", () => {
    expect(semestreCalendario(3, [{ desde: 3, duracion: 1 }])).toBe(4);
    expect(semestreCalendario(2, [{ desde: 3, duracion: 1 }])).toBe(2);
  });

  it("resuelve rutas académicas y grupos alternativos (Ciencia de Datos)", () => {
    const lic = construirCurriculum(ds, { rutaId: "licenciatura" });
    expect(lic.semestresObjetivo).toBe(8);
    expect(lic.map["MAT2605"]).toBeUndefined();
    const est = construirCurriculum(ds, { rutaId: "estadistica" });
    expect(est.map["MAT2605"]).toBeDefined();
    expect(est.map["OPR8C"]).toBeUndefined();
    const unico = construirCurriculum(ds, { gruposAltModo: { ofg_salud: "unico" } });
    expect(unico.map["OFG7B"]).toBeUndefined();
    expect(unico.map["OFG7A"].creditos).toBe(10);
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

  it("separa créditos inscritos, aprobados, reprobados y de avance", () => {
    const r = resumenCreditos(ctxCon(st));
    expect(r.inscritos).toBe(21);
    expect(r.aprobados).toBe(14);
    expect(r.reprobados).toBe(7);
    expect(r.avance).toBe(14);
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
    expect(causalesEliminacionUDP(ctxCon({ periodos, excepcionesCausalC: [1] })).map((c) => c.tipo)).not.toContain("c");
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
    expect(st.periodos[0].ramos[0].categorias[0].notas[0]).toEqual({ n: 5, f: 1 });
    expect(st.periodos[0].ramos[0].notaFinal).toBeNull();
  });

  it("genera un .ics válido", () => {
    const ics = generarICS([{ fecha: "2026-11-03", ramo: "Redes de Datos", sigla: "CIT-2114", categoria: "Solemnes", etiqueta: "Solemne 2", peso: 20, rendida: false, uid: "a" }]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261103");
    expect(ics).toContain("DTEND;VALUE=DATE:20261104");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
});
