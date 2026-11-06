// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import malla from "../../public/carreras/inf.json";
import { estadoInicial } from "../core/state";
import { accionDeshacer, firmaPlanificacion, leerTodosLosEstados, useApp } from "./app";
import { useUI } from "./ui";

beforeEach(() => {
  localStorage.clear();
  useApp.setState({ carga: "cargando", cur: null, malla: null, st: estadoInicial(), pilaDeshacer: [], planesEditados: null });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("inicio y persistencia", () => {
  it("comparte la carga en curso y no reemplaza las ediciones al reiniciar", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => malla }));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([useApp.getState().iniciar(), useApp.getState().iniciar()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    useApp.getState().mutar("Cambiar semestre", ({ st }) => { st.semestreActual = 3; });
    await useApp.getState().iniciar();
    expect(useApp.getState().st.semestreActual).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("permite reintentar cuando falla la carga de la malla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Sin red")).mockResolvedValue({ ok: true, json: async () => malla }));
    await useApp.getState().iniciar();
    expect(useApp.getState().carga).toBe("error");
    await useApp.getState().iniciar();
    expect(useApp.getState().carga).toBe("listo");
  });

  it("exporta y sincroniza el progreso actual aunque falle localStorage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => malla })));
    await useApp.getState().iniciar();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Cuota llena"); });
    useApp.getState().mutar("Meta", ({ st }) => { st.prefs.metaPPA = 6; });
    expect(leerTodosLosEstados().inf.prefs.metaPPA).toBe(6);
    expect(useApp.getState().deshacer()).toBe("Meta");
    expect(leerTodosLosEstados().inf.prefs.metaPPA).toBeNull();
  });

  it("las congelaciones cambian las fechas sin descartar los ajustes del plan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => malla })));
    await useApp.getState().iniciar();
    const { cur, st } = useApp.getState();
    const firma = firmaPlanificacion({ cur: cur!, st });
    const cambiado = structuredClone(st);
    cambiado.congelaciones = [{ desde: 1, duracion: 2 }];
    expect(firmaPlanificacion({ cur: cur!, st: cambiado })).toBe(firma);
    cambiado.maxCreditos = 20;
    expect(firmaPlanificacion({ cur: cur!, st: cambiado })).not.toBe(firma);
  });

  it("el Deshacer de un aviso solo revierte el cambio que anunció", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => malla })));
    await useApp.getState().iniciar();
    useApp.getState().mutar("Nota A", ({ st }) => { st.prefs.metaPPA = 5; });
    const avisoA = accionDeshacer();
    useApp.getState().mutar("Nota B", ({ st }) => { st.maxCreditos = 20; });
    avisoA.fn();
    // B no se revierte por error y A sigue en la pila para el Deshacer general.
    expect(useApp.getState().st.maxCreditos).toBe(20);
    expect(useApp.getState().st.prefs.metaPPA).toBe(5);
    expect(useUI.getState().toasts.at(-1)?.mensaje).toContain("ya no es el último");
    const avisoB = accionDeshacer();
    avisoB.fn();
    expect(useApp.getState().st.maxCreditos).not.toBe(20);
    expect(useApp.getState().st.prefs.metaPPA).toBe(5);
  });
});
