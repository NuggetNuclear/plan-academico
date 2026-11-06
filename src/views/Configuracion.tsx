import { DatabaseBackup, IdCard, Laptop, Moon, Palette, Sun } from "lucide-react";
import { useState } from "react";
import { useUI, type Tema } from "../store/ui";
import { Interruptor, PanelPestana, Pestanas, Tarjeta, cx } from "../ui/primitives";
import { DatosDelDispositivo } from "./Cuenta";
import { TusDatos } from "./malla/TusDatos";

type Pestana = "datos" | "respaldo" | "apariencia";
/** La pestaña elegida se conserva al cambiar de sección durante la sesión. */
let recordada: Pestana = "datos";

function Apariencia() {
  const tema = useUI((s) => s.tema);
  const setTema = useUI((s) => s.setTema);
  const compacta = useUI((s) => s.lateralCompacta);
  const setCompacta = useUI((s) => s.setLateralCompacta);
  const opciones: { valor: Tema; texto: string; icono: React.ReactNode }[] = [
    { valor: "claro", texto: "Claro", icono: <Sun className="size-5" /> },
    { valor: "oscuro", texto: "Oscuro", icono: <Moon className="size-5" /> },
    { valor: "sistema", texto: "Según el sistema", icono: <Laptop className="size-5" /> },
  ];
  return (
    <Tarjeta className="space-y-6">
      <fieldset>
        <legend className="text-[15px] font-bold">Tema</legend>
        <p className="mt-0.5 text-[13px] text-fg-2">«Según el sistema» cambia solo cuando tu dispositivo pasa a modo oscuro.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {opciones.map((o) => (
            <label
              key={o.valor}
              className={cx(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                tema === o.valor ? "bg-accent text-accent-fg" : "bg-surface-2 hover:bg-surface-3",
              )}
            >
              <input type="radio" name="tema" className="sr-only" checked={tema === o.valor} onChange={() => setTema(o.valor)} />
              {o.icono}
              {o.texto}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="hidden border-t border-line pt-5 lg:block">
        <p className="text-[15px] font-bold">Barra lateral</p>
        <p className="mt-0.5 mb-3 text-[13px] text-fg-2">Muestra solo los íconos para dejar más espacio al contenido.</p>
        <Interruptor checked={compacta} onChange={setCompacta} etiqueta="Barra lateral compacta" />
      </div>
    </Tarjeta>
  );
}

export function Configuracion() {
  const [pestana, setPestanaEstado] = useState<Pestana>(recordada);
  const setPestana = (p: Pestana) => {
    recordada = p;
    setPestanaEstado(p);
  };
  return (
    <div className="space-y-5">
      <Pestanas
        base="configuracion"
        etiqueta="Secciones de configuración"
        valor={pestana}
        onChange={setPestana}
        opciones={[
          { valor: "datos", etiqueta: "Datos académicos", icono: <IdCard /> },
          { valor: "respaldo", etiqueta: "Importar y respaldar", icono: <DatabaseBackup /> },
          { valor: "apariencia", etiqueta: "Apariencia", icono: <Palette /> },
        ]}
      />
      <PanelPestana base="configuracion" valor={pestana} className="max-w-3xl">
        {pestana === "datos" ? (
          <TusDatos fijo />
        ) : pestana === "respaldo" ? (
          <Tarjeta>
            <p className="mb-4 text-[13.5px] text-fg-2">Tus datos viven en este navegador. Respáldalos para no perderlos o para llevarlos a otro dispositivo. La sincronización con tu cuenta está en Mi cuenta.</p>
            <DatosDelDispositivo />
          </Tarjeta>
        ) : (
          <Apariencia />
        )}
      </PanelPestana>
    </div>
  );
}
