import {
  BarChart3,
  CalendarRange,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Grid3x3,
  GraduationCap,
  Home,
  Laptop,
  Moon,
  NotebookPen,
  Search,
  Sun,
  Undo2,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useApp } from "../store/app";
import { useUI, toast, type Tema, type Vista } from "../store/ui";
import { Ayuda } from "../views/Ayuda";
import { Estadisticas } from "../views/Estadisticas";
import { Inicio } from "../views/Inicio";
import { Malla } from "../views/Malla";
import { Notas } from "../views/Notas";
import { Planificacion } from "../views/Planificacion";
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
  { vista: "inicio", titulo: "Inicio", corto: "Inicio", icono: Home, descripcion: "Tu avance, PPA y situación académica" },
  { vista: "malla", titulo: "Mi malla", corto: "Malla", icono: Grid3x3, descripcion: "Marca lo que aprobaste y lo que cursas" },
  { vista: "notas", titulo: "Notas", corto: "Notas", icono: NotebookPen, descripcion: "Evaluaciones, ponderaciones y simulador" },
  { vista: "planificacion", titulo: "Planificación", corto: "Plan", icono: CalendarRange, descripcion: "El resto de tu carrera, semestre a semestre" },
  { vista: "estadisticas", titulo: "Estadísticas", corto: "Stats", icono: BarChart3, descripcion: "Evolución del PPA y distribución de notas" },
  { vista: "ayuda", titulo: "Ayuda", corto: "Ayuda", icono: CircleHelp, descripcion: "Cómo funciona y reglas de tu carrera" },
];

const VISTAS: Record<Vista, ComponentType> = {
  inicio: Inicio,
  malla: Malla,
  notas: Notas,
  planificacion: Planificacion,
  estadisticas: Estadisticas,
  ayuda: Ayuda,
};

function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#b44bf0] text-white shadow-soft">
        <GraduationCap className="size-5" />
      </span>
      {!compacta && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight">Notas</span>
          <span className="block text-[11px] font-semibold text-fg-3">Planner académico</span>
        </span>
      )}
    </div>
  );
}

function BotonCuenta({ compacta }: { compacta: boolean }) {
  const setCuenta = useUI((s) => s.setCuenta);
  const sync = useSync();
  const usuario = sync.usuario;
  const estado = estadoSync(sync);
  return (
    <button
      type="button"
      onClick={() => setCuenta(true)}
      className={cx("flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface-2 p-2.5 text-left transition-colors hover:border-line-strong", compacta && "justify-center p-2")}
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
            <span className={cx("size-1.5 rounded-full", estado.tono === "ok" ? "bg-ok" : estado.tono === "warn" ? "bg-warn" : "bg-fg-3")} />
            {estado.texto}
          </span>
        </span>
      )}
    </button>
  );
}

function Lateral() {
  const vista = useUI((s) => s.vista);
  const irA = useUI((s) => s.irA);
  const compacta = useUI((s) => s.lateralCompacta);
  const setCompacta = useUI((s) => s.setLateralCompacta);
  return (
    <aside
      className={cx(
        "sticky top-0 hidden h-dvh shrink-0 flex-col gap-5 border-r border-line bg-surface px-3 py-4 transition-[width] duration-200 lg:flex",
        compacta ? "w-[76px]" : "w-[248px]",
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
        {!compacta && <p className="px-3 pb-1 text-[11px] font-bold tracking-wider text-fg-3 uppercase">Tu carrera</p>}
        {NAV.map((it, i) => {
          const activo = vista === it.vista;
          const Icono = it.icono;
          return (
            <a
              key={it.vista}
              href={"#" + it.vista}
              onClick={(e) => {
                e.preventDefault();
                irA(it.vista);
              }}
              aria-current={activo ? "page" : undefined}
              aria-label={it.titulo}
              title={compacta ? it.titulo : it.descripcion}
              className={cx(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors",
                i === NAV.length - 1 && "mt-auto",
                compacta && "justify-center px-0",
                activo ? "bg-accent-soft text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icono className="size-[18px] shrink-0" />
              {!compacta && <span>{it.titulo}</span>}
            </a>
          );
        })}
      </nav>
      <a
        href="https://github.com/NuggetNuclear/plan-academico"
        target="_blank"
        rel="noopener noreferrer"
        title="Código fuente en GitHub"
        aria-label={compacta ? "Código fuente en GitHub" : undefined}
        className={cx("-mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg", compacta && "justify-center px-0")}
      >
        {/* Logo de GitHub (lucide ya no trae marcas). */}
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-[18px] shrink-0 fill-current">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
        {!compacta && <span>Código en GitHub</span>}
      </a>
      <BotonCuenta compacta={compacta} />
    </aside>
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

function Encabezado() {
  const vista = useUI((s) => s.vista);
  const setPaleta = useUI((s) => s.setPaleta);
  const setCuenta = useUI((s) => s.setCuenta);
  const malla = useApp((s) => s.malla);
  const sem = useApp((s) => s.st.semestreActual);
  const puedeDeshacer = useApp((s) => s.pilaDeshacer.length > 0);
  const ultimo = useApp((s) => s.pilaDeshacer.at(-1)?.etiqueta);
  const item = NAV.find((n) => n.vista === vista)!;
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center gap-1 px-3 py-3 sm:gap-3 sm:px-6 lg:px-8">
        <div className="hidden sm:block lg:hidden">
          <Marca compacta />
        </div>
        <div className="min-w-0 flex-1">
          <p className="hidden text-[12px] font-semibold text-fg-3 sm:block">
            Planner <span className="mx-1 text-line-strong">/</span> {item.titulo}
          </p>
          <h1 className="break-words text-base min-[360px]:text-lg leading-tight font-extrabold tracking-tight sm:text-xl">{item.titulo}</h1>
          {malla && (
            <p className="hidden truncate text-[12.5px] font-medium text-fg-2 md:block">
              {malla.carrera} · {malla.siglaUniversidad ?? malla.universidad} · Semestre {sem}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPaleta(true)}
          className="hidden h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2 md:flex"
        >
          <Search className="size-4" />
          <span>Buscar ramo o acción</span>
          <kbd className="ml-4 rounded-md border border-line bg-surface-2 px-1.5 font-mono text-[10.5px]">{mac ? "⌘" : "Ctrl"} K</kbd>
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
        <BotonIcono etiqueta="Mi cuenta" className="lg:hidden" onClick={() => setCuenta(true)}>
          <UserRound className="size-[18px]" />
        </BotonIcono>
      </div>
    </header>
  );
}

function NavMovil() {
  const vista = useUI((s) => s.vista);
  const irA = useUI((s) => s.irA);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Navegación móvil"
    >
      {NAV.map((it) => {
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
            className={cx("flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold", activo ? "text-accent" : "text-fg-3")}
          >
            <span className={cx("grid h-7 w-12 place-items-center rounded-full transition-colors", activo && "bg-accent-soft")}>
              <Icono className="size-[18px]" />
            </span>
            {it.corto}
          </a>
        );
      })}
    </nav>
  );
}

function Pie() {
  const irA = useUI((s) => s.irA);
  const setCuenta = useUI((s) => s.setCuenta);
  return (
    <footer className="mx-auto mt-10 max-w-[1400px] border-t border-line px-4 pt-8 pb-28 text-[13px] text-fg-2 sm:px-6 lg:px-8 lg:pb-10">
      <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-md">
          <Marca />
          <p className="mt-3 leading-relaxed">
            Organiza tu carrera en un solo lugar: qué ramos tomar y en qué orden, tus notas con sus ponderaciones y cómo se mueve tu PPA. Todo se guarda en tu navegador.
          </p>
        </div>
        <div>
          <p className="mb-2 font-bold text-fg">Secciones</p>
          <ul className="space-y-1.5">
            {NAV.slice(1, 5).map((n) => (
              <li key={n.vista}>
                <button type="button" className="hover:text-accent" onClick={() => irA(n.vista)}>
                  {n.titulo}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 font-bold text-fg">Tus datos</p>
          <ul className="space-y-1.5">
            <li>
              <button type="button" className="hover:text-accent" onClick={() => setCuenta(true)}>
                Exportar o importar
              </button>
            </li>
            <li>
              <button type="button" className="hover:text-accent" onClick={() => irA("ayuda")}>
                Cómo se calcula todo
              </button>
            </li>
            <li>
              <a className="hover:text-accent" href="./privacidad.html">
                Privacidad
              </a>
            </li>
            <li>
              <a className="hover:text-accent" href="./terminos.html">
                Términos de uso
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-8 text-[12px] text-fg-3">
        Herramienta de orientación: confirma siempre la oferta y las reglas vigentes con tu universidad.
      </p>
    </footer>
  );
}

export function Shell() {
  const vista = useUI((s) => s.vista);
  const Vista = VISTAS[vista];
  const main = useRef<HTMLElement>(null);
  const anterior = useRef(vista);
  useEffect(() => {
    document.title = `${NAV.find((n) => n.vista === vista)?.titulo} · Planner académico`;
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
        <main ref={main} id="contenido" tabIndex={-1} aria-label={NAV.find((n) => n.vista === vista)?.titulo} key={vista} className="animar-fundido mx-auto max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-7">
          <Vista />
        </main>
        <Pie />
      </div>
      <NavMovil />
    </div>
  );
}
