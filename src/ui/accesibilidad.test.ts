// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mallaJSON from "../../public/carreras/inf.json";
import { construirCurriculum } from "../core/curriculum";
import { estadoInicial } from "../core/state";
import type { MallaDef } from "../core/types";
import { useApp } from "../store/app";
import { sincronizar } from "../store/mutaciones";
import { useUI, type Vista } from "../store/ui";
import { Shell } from "./Shell";
import { Modal } from "./overlays";
import { PaletaComandos } from "./PaletaComandos";
import { RegistroNota } from "../views/notas/RegistroNota";
import { EditorEvaluacion } from "../views/notas/EditorEvaluacion";
import { Wizard } from "../views/Wizard";
import { Notas } from "../views/Notas";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  window.scrollTo = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  document.documentElement.lang = "es";
  document.title = "Planner académico";
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const malla = mallaJSON as MallaDef;
  const cur = construirCurriculum(malla);
  const st = estadoInicial();
  st.prefs.wizardHecho = true;
  st.semestreActual = 2;
  st.cursando = [cur.ramos[1].id];
  st.periodos = [
    { tipo: "regular", numero: 1, ramos: [{ uid: "final", id: cur.ramos[0].id, notaFinal: 5.5, categorias: [] }] },
    { tipo: "regular", numero: 2, ramos: [{ uid: "actual", id: cur.ramos[1].id, notaFinal: null, categorias: [{ nombre: "Solemnes", peso: 100, notas: [{ n: 5, f: 1 }, { n: null, f: 2 }] }] }] },
  ];
  sincronizar({ cur, st });
  useApp.setState({ carga: "listo", malla, cur, st, pilaDeshacer: [], planesEditados: null });
  useUI.setState({ vista: "inicio", paletaAbierta: false, lateralCompacta: false, toasts: [], dialogo: null });
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

async function auditar() {
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(document.body.textContent).not.toContain("Cargando sección…");
  // jsdom no calcula geometría ni color. Contraste y reflow se verifican en navegador.
  const result = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map((v) => ({ regla: v.id, elementos: v.nodes.map((n) => n.html) }))).toEqual([]);
}

describe("accesibilidad de las vistas", () => {
  it.each<Vista>(["inicio", "notas", "agenda", "malla", "planificacion", "simulaciones", "estadisticas", "configuracion", "ayuda"])("%s tiene controles identificables y estructura accesible", async (vista) => {
    useUI.setState({ vista });
    await act(async () => root.render(createElement(Shell)));
    await auditar();
  });

  it("la navegación compacta conserva los nombres", async () => {
    useUI.setState({ lateralCompacta: true });
    await act(async () => root.render(createElement(Shell)));
    await auditar();
  });

  it("el registro rápido etiqueta todos los campos", async () => {
    const { cur, st } = useApp.getState();
    const cat = st.periodos[1].ramos.find((e) => e.uid === "actual")!.categorias[0];
    await act(async () => root.render(createElement(RegistroNota, { ctx: { cur: cur!, st }, periodo: st.periodos[1], seleccion: { uid: "actual", categoria: cat.id, nota: cat.notas[1].id }, onCerrar() {} })));
    await auditar();
  });

  it("el editor de evaluaciones etiqueta todos los campos", async () => {
    const { cur, st } = useApp.getState();
    const periodo = st.periodos[1];
    periodo.ramos[0].categorias.push({ nombre: "Examen", peso: 30, examen: true, notas: [{ n: null, f: 1 }] });
    await act(async () => root.render(createElement(EditorEvaluacion, { ctx: { cur: cur!, st }, periodo, entrada: periodo.ramos[0], onCerrar() {} })));
    await auditar();
  });

  it("el editor de un ramo sin configurar ofrece plantillas", async () => {
    const { cur, st } = useApp.getState();
    const periodo = st.periodos[1];
    const entrada = { ...periodo.ramos[0], categorias: [] };
    await act(async () => root.render(createElement(EditorEvaluacion, { ctx: { cur: cur!, st }, periodo, entrada, onCerrar() {} })));
    expect(document.body.textContent).toContain("Plantillas comunes");
    await auditar();
  });

  it("la búsqueda anuncia la opción activa", async () => {
    useUI.setState({ paletaAbierta: true });
    await act(async () => root.render(createElement(PaletaComandos)));
    await auditar();
  });

  it("un cambio de callback no reinicia el foco dentro del diálogo", async () => {
    const render = () => root.render(createElement(Modal, { abierto: true, etiqueta: "Prueba de foco", onCerrar: () => {}, children: [createElement("input", { key: "a", id: "primero", "aria-label": "Primero" }), createElement("input", { key: "b", id: "segundo", "aria-label": "Segundo" })] }));
    await act(async () => render());
    const segundo = document.getElementById("segundo")!;
    segundo.focus();
    await act(async () => render());
    expect(document.activeElement).toBe(segundo);
  });
  it.each([1, 2])("el asistente de inicio paso %i es accesible", async (paso) => {
    useUI.setState({ wizardAbierto: true });
    await act(async () => root.render(createElement(Wizard)));
    for (let i = 1; i < paso; i++) {
      await act(async () => (document.querySelector('button[type="submit"]') as HTMLButtonElement).click());
    }
    await auditar();
  });

  it("repetir el asistente conserva todas las congelaciones registradas", async () => {
    const congelaciones = [{ desde: 1, duracion: 1 }, { desde: 2, duracion: 2 }];
    useApp.setState({ st: { ...useApp.getState().st, congelaciones } });
    useUI.setState({ wizardAbierto: true });
    await act(async () => root.render(createElement(Wizard)));
    await act(async () => (document.querySelector('button[type="submit"]') as HTMLButtonElement).click());
    await act(async () => (document.querySelector('button[type="submit"]') as HTMLButtonElement).click());
    expect(useApp.getState().st.congelaciones).toEqual(congelaciones);
  });

  it("sin ramos pendientes el botón principal de Notas invita a agregar un ramo", async () => {
    const { st } = useApp.getState();
    useApp.setState({ st: { ...st, periodos: [{ tipo: "regular", numero: 2, ramos: [] }] } });
    useUI.setState({ vista: "notas" });
    await act(async () => root.render(createElement(Shell)));
    await act(async () => { await vi.dynamicImportSettled(); });
    const botones = [...document.querySelectorAll("button")].map((b) => b.textContent);
    expect(botones).toContain("Agregar tu primer ramo");
    expect(botones).not.toContain("Registrar nota");
  });

  it("quitar valor desde la tarjeta deja la evaluación pendiente y permite deshacer", async () => {
    const antes = structuredClone(useApp.getState().st);
    await act(async () => root.render(createElement(Notas)));
    const quitar = document.querySelector<HTMLButtonElement>('[aria-label="Quitar valor de Solemnes 1"]')!;
    await act(async () => quitar.click());
    const notas = useApp.getState().st.periodos[1].ramos[0].categorias[0].notas;
    expect(notas).toHaveLength(2);
    expect(notas[0]).toEqual({ ...antes.periodos[1].ramos[0].categorias[0].notas[0], n: null });
    await act(async () => { useApp.getState().deshacer(); });
    expect(useApp.getState().st).toEqual(antes);
  });

  it("Simulaciones es accesible y conserva el borrador al cambiar de sección", async () => {
    const antes = structuredClone(useApp.getState().st);
    const guardado = localStorage.getItem("notas.v1.estado.inf");
    useUI.setState({ vista: "simulaciones" });
    await act(async () => root.render(createElement(Shell)));
    await act(async () => { await vi.dynamicImportSettled(); });
    const ir = async (vista: Vista) => {
      await act(async () => useUI.getState().irA(vista));
      await act(async () => { await vi.dynamicImportSettled(); });
    };
    const pulsar = async (texto: string) => {
      const boton = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === texto)!;
      expect(boton).toBeDefined();
      await act(async () => boton.click());
    };
    const base = document.querySelector<HTMLSelectElement>('select')!;
    await act(async () => { base.value = "ramo:actual"; base.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(document.querySelector('[role="status"]')!.textContent).toContain("5,00");
    const pendiente = document.querySelector<HTMLInputElement>('[aria-label="Nota de prueba: Solemnes 2"]')!;
    await act(async () => pendiente.focus());
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(pendiente, "7");
      pendiente.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => pendiente.blur());
    expect(document.querySelector('[role="status"]')!.textContent).toContain("6,33");
    // Ir a Notas muestra la nota real; al volver, el borrador sigue ahí.
    await ir("notas");
    expect(document.body.textContent).toContain("5,0");
    await ir("simulaciones");
    expect(document.querySelector('[role="status"]')!.textContent).toContain("6,33");
    await pulsar("Vaciar notas de prueba");
    expect(document.querySelector('[role="status"]')!.textContent).toContain("—");
    expect(useApp.getState().st).toEqual(antes);
    expect(useApp.getState().pilaDeshacer).toHaveLength(0);
    expect(localStorage.getItem("notas.v1.estado.inf")).toBe(guardado);
    await auditar();
  });

  it("Agenda lista una evaluación con fecha y abre su registro", async () => {
    const st = structuredClone(useApp.getState().st);
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const z = (n: number) => String(n).padStart(2, "0");
    st.periodos[1].ramos[0].categorias[0].notas[1].fecha = `${manana.getFullYear()}-${z(manana.getMonth() + 1)}-${z(manana.getDate())}`;
    useApp.setState({ st });
    useUI.setState({ vista: "agenda" });
    await act(async () => root.render(createElement(Shell)));
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(document.body.textContent).toContain("Próximos 7 días");
    const fila = document.querySelector<HTMLButtonElement>('button[aria-label^="Solemnes 2"]')!;
    expect(fila.getAttribute("aria-label")).toContain("Registrar nota");
    await auditar();
    await act(async () => fila.click());
    expect(document.querySelector("dialog[open]")?.getAttribute("aria-label")).toBe("Registrar nota");
    const elegidos = [...document.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent);
    expect(elegidos.some((t) => t?.includes("Solemnes 2"))).toBe(true);
  });

  it("las pestañas del ramo muestran reglas y guardan la meta", async () => {
    useUI.setState({ vista: "notas" });
    await act(async () => root.render(createElement(Shell)));
    await act(async () => { await vi.dynamicImportSettled(); });
    const pestana = (texto: string) => [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent?.startsWith(texto))!;
    await act(async () => pestana("Reglas").click());
    expect(document.body.textContent).toContain("Editar reglas");
    await auditar();
    await act(async () => pestana("Meta").click());
    const campo = document.querySelector<HTMLInputElement>('input[id$="-meta"]')!;
    await act(async () => campo.focus());
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, "6");
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => campo.blur());
    expect(useApp.getState().st.periodos[1].ramos[0].meta).toBe(6);
    expect(document.body.textContent).toContain("Para llegar a 6,0");
    await auditar();
  });

  it("la vista Mes de Agenda y el plan de carrera son accesibles", async () => {
    const st = structuredClone(useApp.getState().st);
    st.periodos[1].ramos[0].categorias[0].notas[1].fecha = "2026-11-20";
    useApp.setState({ st });
    useUI.setState({ vista: "agenda" });
    await act(async () => root.render(createElement(Shell)));
    await act(async () => { await vi.dynamicImportSettled(); });
    const mes = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Mes")!;
    await act(async () => mes.click());
    expect(document.querySelector('[aria-label^="Calendario de"]')).not.toBeNull();
    await auditar();
    await act(async () => useUI.getState().irA("planificacion"));
    await act(async () => { await vi.dynamicImportSettled(); });
    // Lo primero que se lee responde cuándo terminas y qué inscribir.
    expect(document.querySelector("#plan-titulo")!.textContent).toMatch(/^Terminas la carrera el /);
    expect(document.body.textContent).toContain("Tu próximo semestre");
    const editar = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes("Cambiar ramos de semestre"))!;
    await act(async () => editar.click());
    expect(editar.getAttribute("aria-pressed")).toBe("true");
    for (const d of document.querySelectorAll("details")) d.open = true;
    await auditar();
  });

  it("el editor ofrece quitar solo el valor de una nota existente", async () => {
    const { cur, st } = useApp.getState();
    const periodo = st.periodos[1];
    const categoria = periodo.ramos[0].categorias[0];
    const anterior = structuredClone(categoria.notas[0]);
    const cerrar = vi.fn();
    await act(async () => root.render(createElement(RegistroNota, { ctx: { cur: cur!, st }, periodo,
      seleccion: { uid: "actual", categoria: categoria.id, nota: categoria.notas[0].id }, onCerrar: cerrar })));
    const quitar = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Quitar valor")!;
    await act(async () => quitar.click());
    expect(useApp.getState().st.periodos[1].ramos[0].categorias[0].notas[0]).toEqual({ ...anterior, n: null });
    expect(cerrar).toHaveBeenCalledTimes(1);
  });
});
