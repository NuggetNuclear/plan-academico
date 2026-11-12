import { create } from "zustand";

export type Vista = "inicio" | "notas" | "agenda" | "malla" | "planificacion" | "simulaciones" | "estadisticas" | "configuracion" | "ayuda";
export const VISTAS: Vista[] = ["inicio", "notas", "agenda", "malla", "planificacion", "simulaciones", "estadisticas", "configuracion", "ayuda"];

type TipoToast = "ok" | "error" | "info";

interface Toast {
  id: number;
  mensaje: string;
  tipo: TipoToast;
  accion?: { etiqueta: string; fn: () => void };
  /** No se cierra solo ni lo desplazan los avisos nuevos. */
  fijo?: boolean;
}

interface OpcionesDialogo {
  titulo: string;
  mensaje?: string;
  etiqueta?: string;
  aceptar?: string;
  cancelar?: string;
  peligro?: boolean;
  /** Si se define, el diálogo pide un texto. */
  campo?: {
    etiqueta: string;
    valor?: string;
    placeholder?: string;
    inputMode?: "decimal" | "numeric" | "text";
    tipo?: "text" | "password";
    autoComplete?: string;
    validar?: (v: string) => string | null;
  };
}

interface DialogoActivo {
  opciones: OpcionesDialogo;
  resolver: (valor: string | null) => void;
}

export type Tema = "claro" | "oscuro" | "sistema";

/** Pantallas que el usuario puede elegir para abrir la app. */
export type InicioAlAbrir = Extract<Vista, "inicio" | "notas" | "agenda">;
export const INICIOS_AL_ABRIR: InicioAlAbrir[] = ["inicio", "notas", "agenda"];

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
  inicioAlAbrir: InicioAlAbrir;
  /** Ramo a enfocar al llegar a una vista (desde la paleta de comandos). */
  foco: { vista: Vista; id: string } | null;
  irA: (v: Vista, foco?: string) => void;
  /** `fijo`: no se cierra solo (por ejemplo, el aviso de versión nueva). */
  toast: (mensaje: string, tipo?: TipoToast, accion?: Toast["accion"], fijo?: boolean) => void;
  cerrarToast: (id: number) => void;
  setPaleta: (v: boolean) => void;
  setCuenta: (v: boolean) => void;
  setWizard: (v: boolean) => void;
  setImportar: (v: boolean) => void;
  setTema: (t: Tema) => void;
  setLateralCompacta: (v: boolean) => void;
  setInicioAlAbrir: (v: InicioAlAbrir) => void;
  limpiarFoco: () => void;
  _abrirDialogo: (d: DialogoActivo | null) => void;
}

export function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function escribirLocal(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* modo privado o almacenamiento lleno: la app sigue funcionando en memoria */
  }
}

function inicioPreferido(): InicioAlAbrir {
  const v = leerLocal("notas.v1.inicio");
  return INICIOS_AL_ABRIR.includes(v as InicioAlAbrir) ? (v as InicioAlAbrir) : "inicio";
}

/** Sin hash en la URL, la app abre en la pantalla elegida en Ajustes. */
export function vistaDesdeHash(): Vista {
  const h = location.hash.replace("#", "").split("/")[0] as Vista;
  if (!h) return inicioPreferido();
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
  tema: (leerLocal("notas.v1.tema") as Tema) || "sistema",
  lateralCompacta: leerLocal("notas.v1.lateral") === "compacta",
  inicioAlAbrir: inicioPreferido(),
  foco: null,

  irA(v, foco) {
    if (location.hash !== "#" + v) history.pushState(null, "", "#" + v);
    set({ vista: v, foco: foco ? { vista: v, id: foco } : null });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  toast(mensaje, tipo = "ok", accion, fijo = false) {
    const id = ++idToast;
    const previos = get().toasts;
    // Se muestran a lo más cuatro avisos normales; los fijos siempre quedan.
    set({ toasts: [...previos.filter((t) => t.fijo), ...previos.filter((t) => !t.fijo).slice(fijo ? -4 : -3), { id, mensaje, tipo, accion, fijo }] });
    if (!fijo) setTimeout(() => get().cerrarToast(id), accion ? 6500 : 4200);
  },
  cerrarToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  setPaleta: (v) => set({ paletaAbierta: v }),
  setCuenta: (v) => set({ cuentaAbierta: v }),
  setWizard: (v) => set({ wizardAbierto: v }),
  setImportar: (v) => set({ importarAbierto: v }),
  setTema(t) {
    escribirLocal("notas.v1.tema", t);
    set({ tema: t });
  },
  setLateralCompacta(v) {
    escribirLocal("notas.v1.lateral", v ? "compacta" : "normal");
    set({ lateralCompacta: v });
  },
  setInicioAlAbrir(v) {
    escribirLocal("notas.v1.inicio", v);
    set({ inicioAlAbrir: v });
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
