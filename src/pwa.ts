import { create } from "zustand";
import { useUI } from "./store/ui";

/** Evento de Chrome/Edge/Android que permite mostrar el diálogo de instalación propio. */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type FormaInstalar = "instalada" | "boton" | "ios" | "manual";

interface EstadoPWA {
  evento: EventoInstalar | null;
  instalada: boolean;
}

const enModoApp = () =>
  typeof window !== "undefined" &&
  (matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const usePWA = create<EstadoPWA>(() => ({ evento: null, instalada: enModoApp() }));

export const esIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

export function formaInstalar(s: EstadoPWA): FormaInstalar {
  if (s.instalada) return "instalada";
  if (s.evento) return "boton";
  return esIOS() ? "ios" : "manual";
}

export async function instalar() {
  const { evento } = usePWA.getState();
  if (!evento) return;
  // El evento sirve una sola vez: si falla, se descarta para no dejar un botón muerto.
  try {
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") usePWA.setState({ instalada: true });
  } finally {
    usePWA.setState({ evento: null });
  }
}

export type ResultadoBusqueda = "nueva" | "al-dia" | "error" | "sin-sw";

/** Se define cuando el service worker queda registrado (solo en la app publicada). */
let revisar: (() => Promise<ResultadoBusqueda>) | null = null;

/** Pide al navegador que busque una versión nueva del service worker ahora mismo. */
export async function buscarActualizacion(): Promise<ResultadoBusqueda> {
  return revisar ? revisar() : "sin-sw";
}

const MENSAJE_VERSION = "Hay una versión nueva de la app.";

/** Registra el service worker, ofrece instalar y avisa cuando hay una versión nueva. */
export function iniciarPWA() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    usePWA.setState({ evento: e as EventoInstalar });
  });
  window.addEventListener("appinstalled", () => usePWA.setState({ evento: null, instalada: true }));
  matchMedia("(display-mode: standalone)").addEventListener("change", (e) => e.matches && usePWA.setState({ instalada: true }));

  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", async () => {
    // Si ya había una versión controlando la página, un cambio de versión (pedido aquí o en otra pestaña)
    // recarga para no quedar con código viejo cuyo caché ya se borró. En la primera instalación no recarga.
    const habiaVersion = !!navigator.serviceWorker.controller;
    const reg = await navigator.serviceWorker.register("./sw.js").catch(() => null);
    if (!reg) return;
    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!habiaVersion || recargando) return;
      recargando = true;
      location.reload();
    });
    // Un solo aviso aunque lleguen varias versiones; activa siempre la más reciente.
    let pendiente: ServiceWorker | null = null;
    const avisar = (sw: ServiceWorker) => {
      // Si el aviso ya está en pantalla basta con recordar la versión más reciente; si se cerró, vuelve a mostrarse.
      const visible = useUI.getState().toasts.some((t) => t.fijo && t.mensaje === MENSAJE_VERSION);
      const yaAvisado = pendiente !== null && visible;
      pendiente = sw;
      if (yaAvisado) return;
      useUI.getState().toast(MENSAJE_VERSION, "info", {
        etiqueta: "Actualizar",
        fn: () => (reg.waiting ?? pendiente)?.postMessage("activar"),
      }, true);
    };
    // Solo es una actualización si ya había una versión controlando la página.
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener("statechange", () => {
        if (nuevo.state === "installed" && navigator.serviceWorker.controller) avisar(nuevo);
      });
    });
    revisar = async () => {
      try {
        await reg.update();
      } catch {
        return "error";
      }
      if (!navigator.serviceWorker.controller) return "al-dia";
      // Si ya hay una versión esperando se avisa ahora; si se está instalando, avisará el statechange de arriba.
      if (reg.waiting) {
        avisar(reg.waiting);
        return "nueva";
      }
      return reg.installing ? "nueva" : "al-dia";
    };
    // Una app instalada puede quedar abierta días: revisa al volver a primer plano.
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update().catch(() => {}));
  });
}
