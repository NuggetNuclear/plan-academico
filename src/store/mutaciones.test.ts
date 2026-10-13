import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estadoRamo, infoAprobacion, resumenCreditos, type Ctx } from "../core/academic";
import { construirCurriculum } from "../core/curriculum";
import { estadoInicial } from "../core/state";
import type { MallaDef } from "../core/types";
import {
  agregarRamoAPeriodo,
  alternarRapido,
  cerrarEntrada,
  desmarcar,
  marcarAprobado,
  marcarCursando,
  marcarSemestres,
  obtenerPeriodo,
  reabrirEntrada,
  sincronizar,
} from "./mutaciones";

const inf = JSON.parse(readFileSync("public/carreras/inf.json", "utf8")) as MallaDef;
const nuevoCtx = (): Ctx => {
  const ctx = { cur: construirCurriculum(inf), st: estadoInicial() };
  sincronizar(ctx);
  return ctx;
};

describe("flujo malla ↔ notas", () => {
  it("marcar cursando crea la entrada en el semestre actual y desmarcar la quita", () => {
    const ctx = nuevoCtx();
    marcarCursando(ctx, "CBM-1001");
    sincronizar(ctx);
    expect(obtenerPeriodo(ctx.st, "regular", 1)!.ramos.map((e) => e.id)).toEqual(["CBM-1001"]);
    expect(estadoRamo(ctx, "CBM-1001")).toBe("cursando");
    desmarcar(ctx, "CBM-1001");
    sincronizar(ctx);
    expect(obtenerPeriodo(ctx.st, "regular", 1)!.ramos).toHaveLength(0);
  });

  it("cerrar con nota aprobatoria aprueba y reprobar vuelve a dejarlo disponible", () => {
    const ctx = nuevoCtx();
    marcarCursando(ctx, "CBM-1001");
    sincronizar(ctx);
    const p = obtenerPeriodo(ctx.st, "regular", 1)!;
    cerrarEntrada(ctx, p, p.ramos[0], 5.4);
    expect(estadoRamo(ctx, "CBM-1001")).toBe("aprobado");
    expect(infoAprobacion(ctx, "CBM-1001")?.etiqueta).toBe("S1");
    reabrirEntrada(ctx, p, p.ramos[0]);
    expect(estadoRamo(ctx, "CBM-1001")).toBe("cursando");
    cerrarEntrada(ctx, p, p.ramos[0], 3.2);
    expect(estadoRamo(ctx, "CBM-1001")).toBe("disponible");
    expect(resumenCreditos(ctx).reprobados).toBe(7);
  });

  it("aprobar con semestre crea la carpeta de ese semestre; 0 la guarda en convalidaciones", () => {
    const ctx = nuevoCtx();
    marcarAprobado(ctx, "CBM-1000", 1);
    marcarAprobado(ctx, "CBQ-1000", 0);
    expect(obtenerPeriodo(ctx.st, "regular", 1)!.ramos.some((e) => e.id === "CBM-1000")).toBe(true);
    expect(obtenerPeriodo(ctx.st, "convalidaciones", 0)!.ramos[0].id).toBe("CBQ-1000");
    expect(infoAprobacion(ctx, "CBQ-1000")?.tipo).toBe("convalidado");
    // Pasar la convalidación a un semestre mueve la entrada con sus datos.
    marcarAprobado(ctx, "CBQ-1000", 1);
    expect(obtenerPeriodo(ctx.st, "convalidaciones", 0)).toBeUndefined();
    expect(obtenerPeriodo(ctx.st, "regular", 1)!.ramos.some((e) => e.id === "CBQ-1000")).toBe(true);
  });

  it("el marcado rápido recuerda si el ramo estaba en Cursando", () => {
    const ctx = nuevoCtx();
    marcarCursando(ctx, "CIT-1000");
    expect(alternarRapido(ctx, "CIT-1000")).toBe("marcado");
    expect(estadoRamo(ctx, "CIT-1000")).toBe("aprobado");
    expect(alternarRapido(ctx, "CIT-1000")).toBe("restaurado");
    expect(estadoRamo(ctx, "CIT-1000")).toBe("cursando");
  });

  it("marca semestres completos sin pisar lo que ya tiene información", () => {
    const ctx = nuevoCtx();
    marcarAprobado(ctx, "CBM-1000", 1);
    const n = marcarSemestres(ctx, 2);
    expect(n).toBe(9); // 10 ramos en S1-S2 menos el que ya estaba
    expect(ctx.st.marcas["CBM-1000"]).toBe(1);
  });

  it("agregar un ramo en Notas al semestre actual lo deja en Cursando", () => {
    const ctx = nuevoCtx();
    const p = obtenerPeriodo(ctx.st, "regular", 1)!;
    agregarRamoAPeriodo(ctx, p, "FIC-1000");
    expect(ctx.st.cursando).toContain("FIC-1000");
  });
});
