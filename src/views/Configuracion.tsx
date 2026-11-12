import { CheckCircle2, DatabaseBackup, Download, IdCard, Laptop, Moon, Palette, Share, SquarePlus, Sun } from "lucide-react";
import { useState } from "react";
import { INICIOS_AL_ABRIR, useUI, type InicioAlAbrir, type Tema } from "../store/ui";
import { formaInstalar, instalar, usePWA } from "../pwa";
import { Boton, Interruptor, PanelPestana, Pestanas, Tarjeta, cx } from "../ui/primitives";
import { DatosDelDispositivo } from "./Cuenta";
import { TusDatos } from "./malla/TusDatos";

type Pestana = "datos" | "respaldo" | "apariencia";
/** La pestaña elegida se conserva al cambiar de sección durante la sesión. */
let recordada: Pestana = "datos";

/** Instalar como app: botón propio donde el navegador lo permite, pasos para iPhone y el resto. */
function InstalarApp() {
  const forma = usePWA(formaInstalar);
  return (
    <Tarjeta>
      <h2 className="text-[15px] font-bold">Instalar la app</h2>
      {forma === "instalada" ? (
        <p className="mt-2 flex items-center gap-2 text-[13.5px] text-fg-2">
          <CheckCircle2 aria-hidden="true" className="size-5 text-ok" />
          Ya la estás usando como app. Funciona sin conexión y se actualiza sola.
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-[13px] text-fg-2">Ábrela desde tu pantalla de inicio como cualquier app, a pantalla completa y sin conexión.</p>
          {forma === "boton" ? (
            <Boton className="mt-3" variante="primario" icono={<Download className="size-4" />} onClick={() => void instalar()}>
              Instalar
            </Boton>
          ) : forma === "ios" ? (
            <ol className="mt-3 space-y-2 text-[13.5px]">
              <li className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">1</span>
                Abre esta página en Safari y toca <Share aria-label="Compartir" className="inline size-4" /> Compartir.
              </li>
              <li className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">2</span>
                Elige <SquarePlus aria-hidden="true" className="inline size-4" /> «Agregar a inicio».
              </li>
            </ol>
          ) : (
            <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-fg-2">
              Busca «Instalar app» o «Agregar a la pantalla de inicio» en el menú de tu navegador. En Firefox de escritorio no está disponible.
            </p>
          )}
        </>
      )}
    </Tarjeta>
  );
}

const NOMBRE_INICIO: Record<InicioAlAbrir, string> = { inicio: "Inicio", notas: "Notas", agenda: "Agenda" };

/** Pantalla con la que se abre la app cuando la URL no indica una. */
function AlAbrir() {
  const inicio = useUI((s) => s.inicioAlAbrir);
  const setInicio = useUI((s) => s.setInicioAlAbrir);
  return (
    <fieldset>
      <legend className="text-[15px] font-bold">Pantalla al abrir la app</legend>
      <p className="mt-0.5 text-[13px] text-fg-2">Elige con qué pantalla empieza la app cuando la abres desde su ícono o desde el navegador.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {INICIOS_AL_ABRIR.map((v) => (
          <label
            key={v}
            className={cx(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
              inicio === v ? "bg-accent text-accent-fg" : "bg-surface-2 hover:bg-surface-3",
            )}
          >
            <input type="radio" name="inicio-al-abrir" className="sr-only" checked={inicio === v} onChange={() => setInicio(v)} />
            {NOMBRE_INICIO[v]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

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
      <AlAbrir />
      <div className="border-t border-line pt-5">
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
      </div>
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
          <div className="space-y-4">
            <InstalarApp />
            <Apariencia />
          </div>
        )}
      </PanelPestana>
    </div>
  );
}
