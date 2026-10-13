import { create } from "zustand";

export type Vista = "inicio" | "malla" | "notas" | "planificacion" | "estadisticas" | "ayuda";
export const VISTAS: Vista[] = ["inicio", "malla", "notas", "planificacion", "estadisticas", "ayuda"];

export type TipoToast = "ok" | "error" | "info";

export interface Toast {
  id: number;
  mensaje: string;
  tipo: TipoToast;
  accion?: { etiqueta: string; fn: () => void };
}

export interface OpcionesDialogo {
  titulo: string;
  mensaje?: string;
  etiqueta?: string;
  aceptar?: string;
  cancelar?: string;
  peligro?: boolean;
  /** Si se define, el diálogo pide un texto. */
  campo?: { etiqueta: string; valor?: string; placeholder?: string; inputMode?: "decimal" | "numeric" | "text"; validar?: (v: string) => string | null };
}

interface DialogoActivo {
  opciones: OpcionesDialogo;
  resolver: (valor: string | null) => void;
}

export type Tema = "claro" | "oscuro" | "sistema";

interface UIStore {
  vista: Vista;
  toasts: Toast[];
  dialogo: DialogoActivo | null;
  paletaAbierta: boolean;
  cuentaAbierta: boolean;
  wizardAbierto: boolean;
  importarAbierto: boolean;
  tema: Tema;
  lateralCompacta: boolean;
  /** Ramo a enfocar al llegar a una vista (desde la paleta de comandos). */
  foco: { vista: Vista; id: string } | null;
  irA: (v: Vista, foco?: string) => void;
  toast: (mensaje: string, tipo?: TipoToast, accion?: Toast["accion"]) => void;
  cerrarToast: (id: number) => void;
  setPaleta: (v: boolean) => void;
  setCuenta: (v: boolean) => void;
  setWizard: (v: boolean) => void;
  setImportar: (v: boolean) => void;
  setTema: (t: Tema) => void;
  setLateralCompacta: (v: boolean) => void;
  limpiarFoco: () => void;
  _abrirDialogo: (d: DialogoActivo | null) => void;
}

const leer = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const escribir = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento disponible */
  }
};

export function vistaDesdeHash(): Vista {
  const h = location.hash.replace("#", "").split("/")[0] as Vista;
  return VISTAS.includes(h) ? h : "inicio";
}

let idToast = 0;

export const useUI = create<UIStore>((set, get) => ({
  vista: vistaDesdeHash(),
  toasts: [],
  dialogo: null,
  paletaAbierta: false,
  cuentaAbierta: false,
  wizardAbierto: false,
  importarAbierto: false,
  tema: (leer("notas.v1.tema") as Tema) || "sistema",
  lateralCompacta: leer("notas.v1.lateral") === "compacta",
  foco: null,

  irA(v, foco) {
    if (location.hash !== "#" + v) history.pushState(null, "", "#" + v);
    set({ vista: v, foco: foco ? { vista: v, id: foco } : null });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  toast(mensaje, tipo = "ok", accion) {
    const id = ++idToast;
    set({ toasts: [...get().toasts.slice(-3), { id, mensaje, tipo, accion }] });
    setTimeout(() => get().cerrarToast(id), accion ? 6500 : 4200);
  },
  cerrarToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  setPaleta: (v) => set({ paletaAbierta: v }),
  setCuenta: (v) => set({ cuentaAbierta: v }),
  setWizard: (v) => set({ wizardAbierto: v }),
  setImportar: (v) => set({ importarAbierto: v }),
  setTema(t) {
    escribir("notas.v1.tema", t);
    set({ tema: t });
  },
  setLateralCompacta(v) {
    escribir("notas.v1.lateral", v ? "compacta" : "normal");
    set({ lateralCompacta: v });
  },
  limpiarFoco: () => set({ foco: null }),
  _abrirDialogo: (d) => set({ dialogo: d }),
}));

/** Diálogo de confirmación con promesa: `if (await confirmar({...}))`. */
export function confirmar(opciones: Omit<OpcionesDialogo, "campo">): Promise<boolean> {
  return new Promise((resolve) =>
    useUI.getState()._abrirDialogo({ opciones, resolver: (v) => resolve(v !== null) }),
  );
}

/** Diálogo que pide un texto. Devuelve null si se cancela. */
export function pedirTexto(opciones: OpcionesDialogo & { campo: NonNullable<OpcionesDialogo["campo"]> }): Promise<string | null> {
  return new Promise((resolve) => useUI.getState()._abrirDialogo({ opciones, resolver: resolve }));
}

export const toast = (...args: Parameters<UIStore["toast"]>) => useUI.getState().toast(...args);
