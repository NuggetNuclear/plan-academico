import { describe, expect, it } from "vitest";
import { MAX_ADJUNTO, MAX_MENSAJE, validarAdjunto, validarSugerencia } from "./validar";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const archivo = (bytes: number[], nombre: string, type: string) => new File([new Uint8Array(bytes)], nombre, { type });

describe("validarAdjunto", () => {
  it("acepta PNG, JPG y WebP reales", async () => {
    expect(await validarAdjunto(archivo(PNG, "a.png", "image/png"))).toBeNull();
    expect(await validarAdjunto(archivo(JPG, "a.jpg", "image/jpeg"))).toBeNull();
    expect(await validarAdjunto(archivo(WEBP, "a.webp", "image/webp"))).toBeNull();
  });

  it("rechaza lo que pesa más del límite", async () => {
    const grande = new File([new Uint8Array(MAX_ADJUNTO + 1)], "a.png", { type: "image/png" });
    expect(await validarAdjunto(grande)).toMatch(/máximo/);
  });

  it("rechaza archivos vacíos y tipos no permitidos (SVG, PDF, ejecutables)", async () => {
    expect(await validarAdjunto(archivo([], "a.png", "image/png"))).toMatch(/vacío/);
    expect(await validarAdjunto(archivo(PNG, "a.svg", "image/svg+xml"))).toMatch(/PNG, JPG o WebP/);
    expect(await validarAdjunto(archivo(PNG, "a.pdf", "application/pdf"))).toMatch(/PNG, JPG o WebP/);
    expect(await validarAdjunto(archivo(PNG, "a.exe", "application/x-msdownload"))).toMatch(/PNG, JPG o WebP/);
  });

  it("rechaza un ejecutable disfrazado de imagen (extensión y tipo falsos)", async () => {
    const exe = [0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]; // cabecera «MZ» de Windows
    expect(await validarAdjunto(archivo(exe, "captura.png", "image/png"))).toMatch(/no coincide/);
  });

  it("rechaza una imagen cuyo contenido es de otro formato que el declarado", async () => {
    expect(await validarAdjunto(archivo(JPG, "a.png", "image/png"))).toMatch(/no coincide/);
  });
});

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
