import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  FlaskConical,
  Grid3x3,
  GraduationCap,
  Home,
  Laptop,
  Menu,
  Moon,
  NotebookPen,
  Search,
  Settings,
  Sun,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { useApp } from "../store/app";
import { useUI, toast, type Tema, type Vista } from "../store/ui";
import { Inicio } from "../views/Inicio";
import { estadoSync, useSync } from "../sync/useSync";
import { OpcionMenu, Popover } from "./overlays";
import { BotonIcono, cx } from "./primitives";

interface ItemNav {
  vista: Vista;
  titulo: string;
  corto: string;
  icono: ComponentType<{ className?: string }>;
  descripcion: string;
}

export const NAV: ItemNav[] = [
  { vista: "inicio", titulo: "Inicio", corto: "Inicio", icono: Home, descripcion: "Lo que viene, tu avance y tu situación académica" },
  { vista: "notas", titulo: "Notas", corto: "Notas", icono: NotebookPen, descripcion: "Registra notas y configura las evaluaciones de cada ramo" },
  { vista: "agenda", titulo: "Agenda", corto: "Agenda", icono: CalendarDays, descripcion: "Tus evaluaciones por fecha y exportación al calendario" },
  { vista: "malla", titulo: "Mi malla", corto: "Malla", icono: Grid3x3, descripcion: "Marca lo que aprobaste y lo que cursas" },
  { vista: "planificacion", titulo: "Plan de carrera", corto: "Plan", icono: CalendarRange, descripcion: "El resto de tu carrera, semestre a semestre" },
  { vista: "simulaciones", titulo: "Simulaciones", corto: "Simular", icono: FlaskConical, descripcion: "Prueba notas y PPA sin tocar tus registros" },
  { vista: "estadisticas", titulo: "Estadísticas", corto: "Stats", icono: BarChart3, descripcion: "Evolución del PPA y distribución de notas" },
  { vista: "configuracion", titulo: "Configuración", corto: "Ajustes", icono: Settings, descripcion: "Datos académicos, importar y respaldar, apariencia" },
  { vista: "ayuda", titulo: "Ayuda", corto: "Ayuda", icono: CircleHelp, descripcion: "Cómo funciona y reglas de tu carrera" },
];

/** Grupos de la navegación: sirven para ubicarse, sin submenús. */
const GRUPOS: { titulo: string; vistas: Vista[] }[] = [
  { titulo: "Día a día", vistas: ["inicio", "notas", "agenda"] },
  { titulo: "Mi carrera", vistas: ["malla", "planificacion", "simulaciones", "estadisticas"] },
  { titulo: "Utilidades", vistas: ["configuracion", "ayuda"] },
];
/** Accesos de la barra inferior del celular; el resto vive en Menú. */
const EN_BARRA: Vista[] = ["inicio", "notas", "agenda"];
const itemDe = (v: Vista) => NAV.find((n) => n.vista === v)!;

const VISTAS: Record<Vista, ComponentType> = {
  inicio: Inicio,
  malla: lazy(() => import("../views/Malla").then((m) => ({ default: m.Malla }))),
  notas: lazy(() => import("../views/Notas").then((m) => ({ default: m.Notas }))),
  agenda: lazy(() => import("../views/Agenda").then((m) => ({ default: m.Agenda }))),
  simulaciones: lazy(() => import("../views/Simulaciones").then((m) => ({ default: m.Simulaciones }))),
  configuracion: lazy(() => import("../views/Configuracion").then((m) => ({ default: m.Configuracion }))),
  planificacion: lazy(() => import("../views/Planificacion").then((m) => ({ default: m.Planificacion }))),
  estadisticas: lazy(() => import("../views/Estadisticas").then((m) => ({ default: m.Estadisticas }))),
  ayuda: lazy(() => import("../views/Ayuda").then((m) => ({ default: m.Ayuda }))),
};

function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="hero grid size-9 shrink-0 place-items-center rounded-xl shadow-soft">
        <GraduationCap className="size-5" />
      </span>
      {!compacta && (
        <span className="leading-tight">
          <span className="block text-[16px] font-extrabold tracking-tight">Notas</span>
          <span className="block text-[11px] font-semibold text-fg-3">Planner académico</span>
        </span>
      )}
    </div>
  );
}

function PuntoSync({ tono }: { tono: string }) {
  return <span aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", tono === "ok" ? "bg-ok" : tono === "warn" ? "bg-warn" : "bg-fg-3")} />;
}

function BotonCuenta({ compacta, onAbrir }: { compacta: boolean; onAbrir?: () => void }) {
  const setCuenta = useUI((s) => s.setCuenta);
  const sync = useSync();
  const usuario = sync.usuario;
  const estado = estadoSync(sync);
  return (
    <button
      type="button"
      onClick={() => {
        onAbrir?.();
        setCuenta(true);
      }}
      className={cx("flex w-full items-center gap-2.5 rounded-2xl bg-surface-2 p-2.5 text-left transition-colors hover:bg-surface-3", compacta && "justify-center p-2")}
      title="Mi cuenta y mis datos"
      aria-label={compacta ? "Mi cuenta y mis datos" : undefined}
    >
      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft text-accent">
        {usuario?.foto ? <img src={usuario.foto} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : <UserRound className="size-4" />}
      </span>
      {!compacta && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{usuario?.nombre ?? "Mi cuenta"}</span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-3">
            <PuntoSync tono={estado.tono} />
            {estado.texto}
          </span>
        </span>
      )}
    </button>
  );
}

/** Destinos agrupados: los usan el lateral de escritorio y el menú del celular. */
function ListaNav({ compacta = false, onElegir }: { compacta?: boolean; onElegir?: () => void }) {
  const vista = useUI((s) => s.vista);
  const irA = useUI((s) => s.irA);
  return (
    <>
      {GRUPOS.map((g) => (
        <div key={g.titulo} role="group" aria-label={g.titulo} className="flex flex-col gap-0.5">
          {!compacta && <p aria-hidden="true" className="px-3 pt-3 pb-1 text-[12px] font-semibold text-fg-3">{g.titulo}</p>}
          {g.vistas.map(itemDe).map((it) => {
            const activo = vista === it.vista;
            const Icono = it.icono;
            return (
              <a
                key={it.vista}
                href={"#" + it.vista}
                onClick={(e) => {
                  e.preventDefault();
                  onElegir?.();
                  irA(it.vista);
                }}
                aria-current={activo ? "page" : undefined}
                aria-label={compacta ? it.titulo : undefined}
                title={compacta ? it.titulo : it.descripcion}
                className={cx(
                  "group flex min-h-11 items-center gap-3 rounded-2xl px-1.5 py-1.5 text-[14px] font-semibold transition-colors",
                  compacta && "justify-center px-0",
                  activo ? "bg-accent-soft text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                )}
              >
                <span className={cx("grid size-8 shrink-0 place-items-center rounded-xl transition-colors", activo ? "bg-accent text-accent-fg" : "text-fg-3 group-hover:text-fg")}>
                  <Icono className="size-[18px]" />
                </span>
                {!compacta && <span>{it.titulo}</span>}
              </a>
            );
          })}
        </div>
      ))}
    </>
  );
}

function EnlaceGitHub({ compacta }: { compacta?: boolean }) {
  return (
    <a
      href="https://github.com/NuggetNuclear/plan-academico"
      target="_blank"
      rel="noopener noreferrer"
      title="Código fuente en GitHub"
      aria-label={compacta ? "Código fuente en GitHub" : undefined}
      className={cx("flex items-center gap-3 rounded-2xl px-3 py-2 text-[13px] font-semibold text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg", compacta && "justify-center px-0")}
    >
      {/* Logo de GitHub (lucide ya no trae marcas). */}
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-[18px] shrink-0 fill-current">
        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
      </svg>
      {!compacta && <span>Código en GitHub</span>}
    </a>
  );
}

function Lateral() {
  const compacta = useUI((s) => s.lateralCompacta);
  const setCompacta = useUI((s) => s.setLateralCompacta);
  return (
    <aside
      className={cx(
        "sticky top-3 m-3 mr-0 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col gap-3 overflow-y-auto rounded-[1.6rem] bg-surface px-3 py-4 shadow-soft transition-[width] duration-200 lg:flex",
        compacta ? "w-[76px]" : "w-[244px]",
      )}
      aria-label="Navegación principal"
    >
      <div className={cx("flex items-center", compacta ? "flex-col gap-3" : "justify-between")}>
        <Marca compacta={compacta} />
        <BotonIcono tamano="sm" etiqueta={compacta ? "Expandir barra lateral" : "Contraer barra lateral"} onClick={() => setCompacta(!compacta)}>
          {compacta ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </BotonIcono>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Navegación lateral">
        <ListaNav compacta={compacta} />
      </nav>
      <EnlaceGitHub compacta={compacta} />
      <BotonCuenta compacta={compacta} />
    </aside>
  );
}

/** Menú del celular: los mismos grupos que el lateral, en un cajón modal (fondo inerte, Escape cierra). */
function Cajon({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal?.();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      aria-label="Menú"
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
      className="m-0 h-dvh max-h-none w-[min(320px,88vw)] max-w-none border-0 bg-transparent p-0 text-fg backdrop:bg-black/50 backdrop:backdrop-blur-[3px]"
    >
      {abierto && (
        <div className="animar-entrada flex h-full flex-col gap-3 overflow-y-auto rounded-r-[1.75rem] bg-surface px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <Marca />
            <BotonIcono etiqueta="Cerrar menú" onClick={onCerrar}>
              <X className="size-5" />
            </BotonIcono>
          </div>
          <nav className="flex flex-1 flex-col gap-1" aria-label="Menú de navegación">
            <ListaNav onElegir={onCerrar} />
          </nav>
          <EnlaceGitHub />
          <BotonCuenta compacta={false} onAbrir={onCerrar} />
        </div>
      )}
    </dialog>
  );
}

function SelectorTema() {
  const tema = useUI((s) => s.tema);
  const setTema = useUI((s) => s.setTema);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const oscuro = tema === "oscuro" || (tema === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
  const opciones: { valor: Tema; texto: string; icono: React.ReactNode }[] = [
    { valor: "claro", texto: "Claro", icono: <Sun /> },
    { valor: "oscuro", texto: "Oscuro", icono: <Moon /> },
    { valor: "sistema", texto: "Según el sistema", icono: <Laptop /> },
  ];
  return (
    <>
      <BotonIcono ref={ref} etiqueta="Cambiar tema" onClick={() => setAbierto((v) => !v)} aria-haspopup="dialog" aria-expanded={abierto}>
        {oscuro ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
      </BotonIcono>
      <Popover ancla={ref} abierto={abierto} onCerrar={() => setAbierto(false)} ancho={200}>
        {opciones.map((o) => (
          <OpcionMenu
            key={o.valor}
            icono={o.icono}
            activo={tema === o.valor}
            onClick={() => {
              setTema(o.valor);
              setAbierto(false);
            }}
          >
            {o.texto}
          </OpcionMenu>
        ))}
      </Popover>
    </>
  );
}

const PILDORA = "inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-fg-2 shadow-soft";

function Encabezado() {
  const vista = useUI((s) => s.vista);
  const setPaleta = useUI((s) => s.setPaleta);
  const malla = useApp((s) => s.malla);
  const sem = useApp((s) => s.st.semestreActual);
  const puedeDeshacer = useApp((s) => s.pilaDeshacer.length > 0);
  const ultimo = useApp((s) => s.pilaDeshacer.at(-1)?.etiqueta);
  const estado = estadoSync(useSync());
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:gap-3 sm:px-6 lg:px-8 lg:pt-5">
        <div className="lg:hidden">
          <Marca compacta />
        </div>
        <div className="min-w-0 flex-1 pl-1.5 lg:pl-0">
          <h1 className="break-words text-lg leading-tight font-extrabold tracking-tight sm:text-2xl">{itemDe(vista).titulo}</h1>
          <div className="mt-1.5 hidden flex-wrap items-center gap-2 md:flex">
            {malla && (
              <span className={PILDORA}>
                {malla.siglaUniversidad ?? malla.universidad} · Semestre {sem}
              </span>
            )}
            <span className={PILDORA}>
              <PuntoSync tono={estado.tono} />
              {estado.texto}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaleta(true)}
          className="hidden h-10 items-center gap-2 rounded-full bg-surface px-4 text-[13px] font-medium text-fg-3 shadow-soft transition-colors hover:text-fg-2 md:flex"
        >
          <Search className="size-4" />
          <span>Buscar ramo o acción</span>
          <kbd className="ml-4 rounded-md bg-surface-2 px-1.5 font-mono text-[10.5px]">{mac ? "⌘" : "Ctrl"} K</kbd>
        </button>
        <BotonIcono etiqueta="Buscar" className="md:hidden" onClick={() => setPaleta(true)}>
          <Search className="size-[18px]" />
        </BotonIcono>
        <BotonIcono
          etiqueta={puedeDeshacer ? `Deshacer: ${ultimo}` : "Nada que deshacer"}
          disabled={!puedeDeshacer}
          onClick={() => {
            const e = useApp.getState().deshacer();
            if (e) toast(`Deshecho: ${e}`, "info");
          }}
        >
          <Undo2 className="size-[18px]" />
        </BotonIcono>
        <SelectorTema />
      </div>
    </header>
  );
}

/** Barra inferior flotante del celular: tres accesos frecuentes y Menú. */
function NavMovil() {
  const vista = useUI((s) => s.vista);
  const irA = useUI((s) => s.irA);
  const [menu, setMenu] = useState(false);
  const fueraDeBarra = !EN_BARRA.includes(vista);
  return (
    <>
      <nav
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-4 gap-1 rounded-[1.6rem] bg-surface/90 p-1.5 shadow-pop backdrop-blur-xl lg:hidden"
        aria-label="Navegación móvil"
      >
        {EN_BARRA.map(itemDe).map((it) => {
          const Icono = it.icono;
          const activo = vista === it.vista;
          return (
            <a
              key={it.vista}
              href={"#" + it.vista}
              onClick={(e) => {
                e.preventDefault();
                irA(it.vista);
              }}
              aria-current={activo ? "page" : undefined}
              className={cx("flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-[1.2rem] text-[11px] font-semibold transition-colors", activo ? "bg-accent-soft text-accent" : "text-fg-3")}
            >
              <Icono className="size-5" />
              {it.corto}
            </a>
          );
        })}
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-haspopup="dialog"
          aria-expanded={menu}
          aria-label={fueraDeBarra ? `Menú, estás en ${itemDe(vista).titulo}` : "Menú"}
          className={cx("flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-[1.2rem] text-[11px] font-semibold", fueraDeBarra ? "text-accent" : "text-fg-3")}
        >
          <Menu className="size-5" />
          Menú
        </button>
      </nav>
      <Cajon abierto={menu} onCerrar={() => setMenu(false)} />
    </>
  );
}

function Pie() {
  const irA = useUI((s) => s.irA);
  const enlace = "rounded-full px-2 py-1 font-semibold hover:bg-surface hover:text-fg";
  return (
    <footer className="mx-auto mt-12 flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 pt-6 pb-32 text-[12.5px] text-fg-3 sm:px-6 lg:px-8 lg:pb-8">
      <p className="max-w-xl">Herramienta de orientación: confirma siempre la oferta y las reglas vigentes con tu universidad. Tus datos se guardan en este navegador.</p>
      <nav aria-label="Enlaces del pie" className="-mx-2 flex flex-wrap items-center">
        <button type="button" className={enlace} onClick={() => irA("ayuda")}>
          Cómo se calcula todo
        </button>
        <a className={enlace} href="./privacidad.html">
          Privacidad
        </a>
        <a className={enlace} href="./terminos.html">
          Términos de uso
        </a>
      </nav>
    </footer>
  );
}

export function Shell() {
  const vista = useUI((s) => s.vista);
  const Vista = VISTAS[vista];
  const main = useRef<HTMLElement>(null);
  const anterior = useRef(vista);
  useEffect(() => {
    document.title = `${itemDe(vista).titulo} · Planner académico`;
    if (anterior.current !== vista) {
      main.current?.focus();
      window.scrollTo(0, 0);
      anterior.current = vista;
    }
  }, [vista]);
  return (
    <div className="flex min-h-dvh">
      <a href="#contenido" className="skip-link" onClick={(e) => { e.preventDefault(); main.current?.focus(); main.current?.scrollIntoView(); }}>Saltar al contenido</a>
      <Lateral />
      <div className="min-w-0 flex-1">
        <Encabezado />
        <main ref={main} id="contenido" tabIndex={-1} aria-label={itemDe(vista).titulo} key={vista} className="animar-fundido mx-auto max-w-[1400px] px-4 pt-4 focus-visible:!outline-none sm:px-6 lg:px-8 lg:pt-5">
          <Suspense fallback={<p role="status" className="py-8 text-center text-fg-2">Cargando sección…</p>}>
            <Vista />
          </Suspense>
        </main>
        <Pie />
      </div>
      <NavMovil />
    </div>
  );
}
