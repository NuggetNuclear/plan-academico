import { GraduationCap, Loader2, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "./store/app";
import { useUI, vistaDesdeHash, toast } from "./store/ui";
import { HostDialogos, Toaster } from "./ui/overlays";
import { Boton } from "./ui/primitives";
import { Shell } from "./ui/Shell";
import { PaletaComandos } from "./ui/PaletaComandos";
import { Wizard, wizardSaltado } from "./views/Wizard";
import { Cuenta } from "./views/Cuenta";
import { ImportarUDP } from "./views/ImportarUDP";

function useTema() {
  const tema = useUI((s) => s.tema);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const aplicar = () => {
      const oscuro = tema === "oscuro" || (tema === "sistema" && mq.matches);
      document.documentElement.classList.toggle("dark", oscuro);
    };
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [tema]);
}

function useAtajos() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const enCampo = (e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]");
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUI.getState().setPaleta(!useUI.getState().paletaAbierta);
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey && !enCampo) {
        e.preventDefault();
        const etiqueta = useApp.getState().deshacer();
        toast(etiqueta ? `Deshecho: ${etiqueta}` : "No hay nada que deshacer", etiqueta ? "info" : "error");
      }
    };
    const onHash = () => useUI.setState({ vista: vistaDesdeHash() });
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onHash);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onHash);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
}

export default function App() {
  const carga = useApp((s) => s.carga);
  const error = useApp((s) => s.error);
  const iniciar = useApp((s) => s.iniciar);
  const wizardHecho = useApp((s) => s.st.prefs.wizardHecho);
  useTema();
  useAtajos();

  useEffect(() => {
    iniciar();
  }, [iniciar]);

  useEffect(() => {
    if (carga === "listo" && !wizardHecho && !wizardSaltado()) useUI.getState().setWizard(true);
  }, [carga, wizardHecho]);

  if (carga === "cargando")
    return (
      <div className="grid min-h-dvh place-items-center">
        <div role="status" className="flex flex-col items-center gap-3 text-fg-2">
          <span className="sr-only">Cargando tu planner académico…</span>
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-fg shadow-card">
            <GraduationCap className="size-6" />
          </span>
          <Loader2 className="size-5 animate-spin" />
        </div>
      </div>
    );

  if (carga === "error")
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="card max-w-md p-6 text-center">
          <p className="text-lg font-bold">No se pudo cargar la malla</p>
          <p className="mt-1 text-sm text-fg-2">{error}</p>
          <Boton className="mt-4" variante="primario" icono={<RefreshCw className="size-4" />} onClick={() => location.reload()}>
            Reintentar
          </Boton>
        </div>
      </div>
    );

  return (
    <>
      <Shell />
      <Wizard />
      <Cuenta />
      <ImportarUDP />
      <PaletaComandos />
      <HostDialogos />
      <Toaster />
    </>
  );
}
