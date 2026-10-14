import { describe, expect, it } from "vitest";
import { MAX_MENSAJE, validarSugerencia } from "./validar";

describe("validarSugerencia", () => {
  const base = { tipo: "idea" as const, mensaje: "Sería útil poder ver el PPA por año", correo: "" };

  it("acepta un mensaje válido con correo vacío", () => {
    expect(validarSugerencia(base)).toEqual({});
  });

  it("exige un mensaje mínimo y respeta el máximo (ignorando espacios)", () => {
    expect(validarSugerencia({ ...base, mensaje: "   hola   " }).mensaje).toBeDefined();
    expect(validarSugerencia({ ...base, mensaje: "a".repeat(MAX_MENSAJE + 1) }).mensaje).toBeDefined();
    expect(validarSugerencia({ ...base, mensaje: "a".repeat(MAX_MENSAJE) }).mensaje).toBeUndefined();
  });

  it("el correo es opcional pero, si viene, debe parecer un correo", () => {
    expect(validarSugerencia({ ...base, correo: "yo@udp.cl" }).correo).toBeUndefined();
    expect(validarSugerencia({ ...base, correo: "no-es-correo" }).correo).toBeDefined();
  });
});
