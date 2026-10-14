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
import { useUI, type Vista } from "../store/ui";
import { Shell } from "./Shell";
import { Modal } from "./overlays";
import { PaletaComandos } from "./PaletaComandos";
import { RegistroNota } from "../views/notas/RegistroNota";
import { EditorEvaluacion } from "../views/notas/EditorEvaluacion";
import { Wizard } from "../views/Wizard";

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
  useApp.setState({ carga: "listo", malla, cur, st, pilaDeshacer: [], planesEditados: null });
  useUI.setState({ vista: "inicio", paletaAbierta: false, lateralCompacta: false, toasts: [], dialogo: null });
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

async function auditar() {
  // jsdom no calcula geometría ni color. Contraste y reflow se verifican en navegador.
  const result = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map((v) => ({ regla: v.id, elementos: v.nodes.map((n) => n.html) }))).toEqual([]);
}

describe("accesibilidad de las vistas", () => {
  it.each<Vista>(["inicio", "malla", "notas", "planificacion", "estadisticas", "ayuda"])("%s tiene controles identificables y estructura accesible", async (vista) => {
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
    await act(async () => root.render(createElement(RegistroNota, { ctx: { cur: cur!, st }, periodo: st.periodos[1], seleccion: { uid: "actual", ci: 0, ni: 1 }, onCerrar() {} })));
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

  it("sin ramos pendientes el botón principal de Notas invita a agregar un ramo", async () => {
    const { st } = useApp.getState();
    useApp.setState({ st: { ...st, periodos: [{ tipo: "regular", numero: 2, ramos: [] }] } });
    useUI.setState({ vista: "notas" });
    await act(async () => root.render(createElement(Shell)));
    const botones = [...document.querySelectorAll("button")].map((b) => b.textContent);
    expect(botones).toContain("Agregar tu primer ramo");
    expect(botones).not.toContain("Registrar nota");
  });
});
