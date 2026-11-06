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
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  usePWA.setState({ evento: null, instalada: outcome === "accepted" });
}

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
    const reg = await navigator.serviceWorker.register("./sw.js").catch(() => null);
    if (!reg) return;
    // Recarga solo cuando el usuario pidió actualizar (no en la primera instalación).
    let pedido = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!pedido) return;
      pedido = false;
      location.reload();
    });
    // Un solo aviso aunque lleguen varias versiones; activa siempre la más reciente.
    let pendiente: ServiceWorker | null = null;
    const avisar = (sw: ServiceWorker) => {
      const yaAvisado = pendiente !== null;
      pendiente = sw;
      if (yaAvisado) return;
      useUI.getState().toast("Hay una versión nueva de la app.", "info", {
        etiqueta: "Actualizar",
        fn: () => {
          pedido = true;
          (reg.waiting ?? pendiente)?.postMessage("activar");
        },
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
    // Una app instalada puede quedar abierta días: revisa al volver a primer plano.
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update().catch(() => {}));
  });
}
