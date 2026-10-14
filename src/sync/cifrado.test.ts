import { describe, expect, it } from "vitest";
import { cifrar, derivarClave, descifrar, esSobre, nuevaSal } from "./cifrado";

// Pocas iteraciones para que el test sea rápido; la app usa ITERACIONES.
const ITER = 1000;
const datos = { estados: { inf: { semestreActual: 3, notas: "ñandú 7,0" } }, actualizado: 1 };

describe("cifrado de la copia en la nube", () => {
  it("descifra con la misma contraseña y no deja nada legible en el sobre", async () => {
    const sal = nuevaSal();
    const sobre = await cifrar(await derivarClave("una contraseña larga", sal, ITER), sal, ITER, "uid-1", datos);
    expect(esSobre(sobre)).toBe(true);
    expect(JSON.stringify(sobre)).not.toContain("semestreActual");
    expect(await descifrar(await derivarClave("una contraseña larga", sal, ITER), "uid-1", sobre)).toEqual(datos);
  });

  it("rechaza otra contraseña, otra cuenta o un byte alterado", async () => {
    const sal = nuevaSal();
    const clave = await derivarClave("una contraseña larga", sal, ITER);
    const sobre = await cifrar(clave, sal, ITER, "uid-1", datos);
    await expect(descifrar(await derivarClave("otra contraseña larga", sal, ITER), "uid-1", sobre)).rejects.toThrow();
    await expect(descifrar(clave, "uid-2", sobre)).rejects.toThrow();
    const bytes = Uint8Array.from(atob(sobre.datos), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    await expect(descifrar(clave, "uid-1", { ...sobre, datos: btoa(String.fromCharCode(...bytes)) })).rejects.toThrow();
  });

  it("usa un IV nuevo en cada escritura y rellena a bloques de 4 KB", async () => {
    const sal = nuevaSal();
    const clave = await derivarClave("una contraseña larga", sal, ITER);
    const [a, b] = [await cifrar(clave, sal, ITER, "u", datos), await cifrar(clave, sal, ITER, "u", { ...datos, extra: "x".repeat(100) })];
    expect(a.iv).not.toBe(b.iv);
    expect(atob(a.datos).length).toBe(atob(b.datos).length); // 4096 + 16 de la etiqueta GCM
    expect(atob(a.datos).length).toBe(4096 + 16);
  });
});
