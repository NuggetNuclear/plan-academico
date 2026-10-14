import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCheck,
  CircleSlash,
  FileUp,
  Lightbulb,
  Loader,
  ListChecks,
  Lock,
  Route,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  aprobadosSet,
  esEximido,
  estadoRamo,
  ETIQUETA_ESTADO,
  infoAprobacion,
  nombreRamo,
  notaRamo,
  prerrequisitosPendientes,
  siglaRamo,
  tieneConvalidacion,
  type Ctx,
  type EstadoRamo,
} from "../core/academic";
import { evaluarReglaPractica, rutaCritica } from "../core/curriculum";
import { normalizarTexto, plural } from "../core/format";
import { idsPendientes } from "../core/planner";
import type { Ramo } from "../core/types";
import { useApp, useCtx } from "../store/app";
import { alternarRapido, desmarcar, marcableComoCompleto, marcarAprobado, marcarCursando, marcarSemestres } from "../store/mutaciones";
import { confirmar, pedirTexto, toast, useUI } from "../store/ui";
import { colorTipo, etiquetaTipo, NotaChip } from "../ui/comun";
import { CabeceraModal, Modal, OpcionMenu, PieModal, Popover } from "../ui/overlays";
import { Boton, BotonIcono, Interruptor, Segmentado, Tarjeta, cx } from "../ui/primitives";
import { TusDatos } from "./malla/TusDatos";

type Filtro = "todos" | "disponible" | "aprobado" | "cursando" | "pendientes";

interface Relaciones {
  origen: string;
  prereq: Set<string>;
  unlock: Set<string>;
  parcial: Set<string>;
}

// ── Diálogo: ¿en qué semestre lo aprobaste? ──
interface PeticionSemestre {
  ramo: Ramo;
  resolver: (v: { semestre: number | null } | null) => void;
}

function DialogoSemestre({ peticion, onCerrar }: { peticion: PeticionSemestre | null; onCerrar: () => void }) {
  const ctx = useCtx();
  const [valor, setValor] = useState("");
  const [rapido, setRapido] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!peticion) return;
    const marca = ctx.st.marcas[peticion.ramo.id];
    setValor(String(tieneConvalidacion(ctx, peticion.ramo.id) ? 0 : typeof marca === "number" && marca > 0 ? marca : Math.max(1, ctx.st.semestreActual - (ctx.st.cursando.includes(peticion.ramo.id) ? 0 : 1))));
    setRapido(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peticion]);
  if (!peticion) return null;
  const cerrar = (v: { semestre: number | null } | null) => {
    peticion.resolver(v);
    onCerrar();
  };
  return (
    <Modal abierto onCerrar={() => cerrar(null)} etiqueta="Semestre de aprobación" ancho="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (rapido) return cerrar({ semestre: null });
          const n = /^\d+$/.test(valor.trim()) ? Number(valor) : NaN;
          if (!Number.isInteger(n) || n < 0 || n > 30) return setError("Escribe 0 para una convalidación o un semestre entre 1 y 30.");
          cerrar({ semestre: n });
        }}
      >
        <CabeceraModal icono={<Check className="size-5" />} sobretitulo="Ramo aprobado" titulo="¿En qué semestre lo aprobaste?">
          {nombreRamo(ctx, peticion.ramo.id)}
        </CabeceraModal>
        <div className="space-y-3 px-6 pt-4">
          <p className="text-[12.5px] text-fg-2">Se agrega automáticamente a la carpeta de ese semestre en Notas, donde podrás registrar la nota para tu PPA.</p>
          <div>
            <label className="label" htmlFor="sem-aprob">
              Semestre
            </label>
            <input id="sem-aprob" data-autofocus className={cx("input", error && "border-danger")} inputMode="numeric" value={valor} disabled={rapido} onChange={(e) => (setValor(e.target.value), setError(null))} />
            <p className="mt-1 text-[11.5px] text-fg-3">
              ¿Fue convalidado? Escribe <strong>0</strong> y quedará en Convalidaciones.
            </p>
            {error && <p className="mt-1 text-[12px] font-medium text-danger">{error}</p>}
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={rapido} onChange={(e) => setRapido(e.target.checked)} />
            <span className="text-[13px]">
              <strong>Marcar sin semestre (marcado rápido)</strong>
              <span className="block text-[12px] text-fg-2">Ideal si solo quieres planificar. Activa el marcado rápido para los próximos ramos.</span>
            </span>
          </label>
        </div>
        <PieModal>
          <Boton variante="fantasma" onClick={() => cerrar(null)}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario">
            {rapido ? "Marcar sin semestre" : "Guardar"}
          </Boton>
        </PieModal>
      </form>
    </Modal>
  );
}

// ── Tarjeta de un ramo ──
function TarjetaRamo({
  ramo,
  estado,
  ctx,
  relaciones,
  critico,
  onHover,
  onElegir,
}: {
  ramo: Ramo;
  estado: EstadoRamo;
  ctx: Ctx;
  relaciones: Relaciones | null;
  critico: number;
  onHover: (id: string | null) => void;
  onElegir: (ramo: Ramo, el: HTMLButtonElement) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const info = estado === "aprobado" ? infoAprobacion(ctx, ramo.id) : null;
  const nota = ctx.st.prefs.mostrarNotas ? notaRamo(ctx, ramo.id) : null;
  const apr = aprobadosSet(ctx);
  const deuda = ramo.reglaPractica && estado === "disponible" ? evaluarReglaPractica(ramo, apr).deuda : [];
  const pendientes = estado === "bloqueado" ? prerrequisitosPendientes(ctx, ramo, apr) : [];
  const ultimoReprobado = estado !== "aprobado" && nota !== null && nota < 3.95;

  const rel = relaciones
    ? relaciones.origen === ramo.id
      ? "origen"
      : relaciones.prereq.has(ramo.id)
        ? "prereq"
        : relaciones.unlock.has(ramo.id)
          ? "unlock"
          : relaciones.parcial.has(ramo.id)
            ? "parcial"
            : "atenuado"
    : null;

  const estilos: Record<EstadoRamo, string> = {
    aprobado: "bg-ok-soft border-ok/30",
    cursando: "bg-info-soft border-info/35",
    disponible: "bg-surface border-accent-line hover:border-accent",
    bloqueado: "bg-surface-2/70 border-line text-fg-2",
  };
  const iconoEstado = {
    aprobado: <Check className="size-3.5 text-ok" />,
    cursando: <Loader className="size-3.5 text-info" />,
    disponible: <span className="size-2 rounded-full bg-accent" />,
    bloqueado: <Lock className="size-3 text-fg-3" />,
  }[estado];

  const titulo = pendientes.length
    ? `Bloqueado: requiere ${pendientes.map((id) => nombreRamo(ctx, id)).join(", ")}`
    : deuda.length
      ? `Disponible debiendo ${deuda.map((id) => nombreRamo(ctx, id)).join(", ")}. Si lo repruebas, la práctica también se reprueba.`
      : `${nombreRamo(ctx, ramo.id)} · ${ETIQUETA_ESTADO[estado]}`;

  return (
    <button
      ref={ref}
      type="button"
      data-ramo={ramo.id}
      title={titulo}
      aria-label={`${nombreRamo(ctx, ramo.id)}, ${ramo.creditos} créditos, ${ETIQUETA_ESTADO[estado]}`}
      onMouseEnter={() => onHover(ramo.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(ramo.id)}
      onBlur={() => onHover(null)}
      onClick={() => onElegir(ramo, ref.current!)}
      className={cx(
        "group relative flex min-h-[104px] w-full flex-col gap-1.5 overflow-hidden rounded-xl border p-2.5 pl-3.5 text-left transition-all duration-150",
        estilos[estado],
        rel === "origen" && "ring-2 ring-accent",
        rel === "prereq" && "ring-2 ring-[var(--rel-prereq)]",
        rel === "unlock" && "ring-2 ring-[var(--rel-unlock)]",
        rel === "parcial" && "ring-2 ring-[var(--rel-partial)] ring-offset-1 ring-offset-surface",
        rel === "atenuado" && "border-line",
        critico > 0 && !rel && "ring-2 ring-danger/70",
      )}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: colorTipo(ctx.cur, ramo.tipo) }} />
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[10.5px] font-semibold text-fg-3">{siglaRamo(ctx, ramo.id)}</span>
        <span className="ml-auto flex items-center gap-1">
          {critico > 0 && (
            <span className="grid size-4.5 place-items-center rounded-full bg-danger text-[9.5px] font-bold text-white dark:text-bg" title={`Paso ${critico} de la ruta crítica`}>
              {critico}
            </span>
          )}
          {ramo.reglaPractica && <Briefcase className="size-3 text-fg-3" aria-label="Práctica profesional" />}
          {info && <span className={cx("rounded px-1 text-[9.5px] font-bold", info.tipo === "rapido" ? "bg-surface-3 text-fg-2" : "bg-ok/15 text-ok")}>{info.etiqueta}</span>}
          {ultimoReprobado && <span className="rounded bg-danger-soft px-1 text-[9.5px] font-bold text-danger">Rep.</span>}
          {iconoEstado}
        </span>
      </span>
      <span className="line-clamp-3 text-[12.5px] leading-snug font-semibold text-fg">{nombreRamo(ctx, ramo.id)}</span>
      <span className="mt-auto flex items-center gap-1.5 text-[11px] text-fg-3">
        <span className="tabular">{ramo.creditos} cr</span>
        <span className="truncate">· {ramo.tipo}</span>
        {nota !== null && <NotaChip nota={nota} className="ml-auto !min-w-0 !px-1 !text-[10.5px]" />}
      </span>
      {deuda.length > 0 && (
        <span className="flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-warn">
          <TriangleAlert className="size-3" /> Condicional: debes {deuda.map((id) => siglaRamo(ctx, id)).join(", ")}
        </span>
      )}
    </button>
  );
}

// ── Vista ──
export function Malla() {
  const ctx = useCtx();
  const { cur, st } = ctx;
  const mutar = useApp((s) => s.mutar);
  const irA = useUI((s) => s.irA);
  const foco = useUI((s) => s.foco);
  const limpiarFoco = useUI((s) => s.limpiarFoco);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [hover, setHover] = useState<string | null>(null);
  const [verCritica, setVerCritica] = useState(false);
  const [menu, setMenu] = useState<{ ramo: Ramo; ancla: HTMLButtonElement } | null>(null);
  const [peticion, setPeticion] = useState<PeticionSemestre | null>(null);
  const anclaMenu = useRef<HTMLElement | null>(null);

  const apr = useMemo(() => aprobadosSet(ctx), [ctx]);
  const estados = useMemo(() => {
    const m: Record<string, EstadoRamo> = {};
    cur.ramos.forEach((r) => (m[r.id] = estadoRamo(ctx, r.id, apr)));
    return m;
  }, [ctx, cur, apr]);
  const critica = useMemo(() => (verCritica ? rutaCritica(cur, idsPendientes(ctx)) : []), [verCritica, cur, ctx]);

  const relaciones = useMemo<Relaciones | null>(() => {
    if (!hover) return null;
    const unlock = new Set<string>();
    const parcial = new Set<string>();
    (cur.desbloquea[hover] ?? []).forEach((id) => ((cur.map[id]?.req.length ?? 0) > 1 || cur.map[id]?.reglaPractica ? parcial : unlock).add(id));
    return { origen: hover, prereq: new Set(cur.prereqs[hover] ?? []), unlock, parcial };
  }, [hover, cur]);

  // Llegar desde la paleta de comandos: resalta el ramo buscado.
  useEffect(() => {
    if (foco?.vista !== "malla") return;
    const el = document.querySelector<HTMLElement>(`[data-ramo="${CSS.escape(foco.id)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    el?.focus();
    limpiarFoco();
  }, [foco, limpiarFoco]);

  const q = normalizarTexto(busqueda.trim());
  const visible = (r: Ramo) => {
    const e = estados[r.id];
    const okFiltro =
      filtro === "todos" ||
      (filtro === "pendientes" ? e === "disponible" || e === "bloqueado" : filtro === "aprobado" ? e === "aprobado" && !esEximido(ctx, r.id) : e === filtro);
    if (!okFiltro) return false;
    if (!q) return true;
    return normalizarTexto(`${r.id} ${r.sigla ?? ""} ${r.nombre} ${siglaRamo(ctx, r.id)} ${nombreRamo(ctx, r.id)}`).includes(q);
  };

  const columnas = useMemo(() => {
    const cols: { titulo: string; semestre: number; ramos: Ramo[] }[] = [];
    for (let s = 1; s <= cur.semestresObjetivo; s++) cols.push({ titulo: `Semestre ${s}`, semestre: s, ramos: cur.ramos.filter((r) => r.semestre === s) });
    const extra = cur.ramos.filter((r) => r.semestre === 0 || r.semestre > cur.semestresObjetivo);
    if (extra.length) cols.push({ titulo: "Requisitos", semestre: 0, ramos: extra });
    return cols;
  }, [cur]);

  const visibles = cur.ramos.filter(visible);
  const puedeTomar = cur.ramos.filter((r) => estados[r.id] === "disponible").length;

  const elegir = async (ramo: Ramo, el: HTMLButtonElement) => {
    const estado = estados[ramo.id];
    const pendientes = estado === "bloqueado" ? prerrequisitosPendientes(ctx, ramo, apr) : [];
    if (pendientes.length) {
      const nombres = pendientes.map((id) => nombreRamo(ctx, id));
      toast(`${ramo.nombre} está bloqueado. Primero aprueba: ${nombres.length > 2 ? `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más` : nombres.join(" y ")}.`, "error");
      return;
    }
    if (esEximido(ctx, ramo.id)) return toast("Este nivel está eximido. Cámbialo en Tus datos › Inglés eximido.", "info");
    if (st.prefs.marcadoRapido) {
      let r = "";
      mutar(`Marcado rápido de ${ramo.nombre}`, (c) => (r = alternarRapido(c, ramo.id)));
      if (r === "bloqueado") toast("Este ramo ya tiene información registrada. Puedes cambiarla desde el menú con el marcado rápido desactivado.", "info");
      else toast(r === "marcado" ? `${ramo.nombre} marcado como cursado` : r === "restaurado" ? `${ramo.nombre} volvió a Cursando` : `${ramo.nombre} desmarcado`);
      return;
    }
    anclaMenu.current = el;
    setMenu({ ramo, ancla: el });
  };

  const accion = async (ramo: Ramo, op: "aprobado" | "cursando" | "desmarcar") => {
    setMenu(null);
    if (op !== "aprobado" && tieneConvalidacion(ctx, ramo.id)) {
      const ok = await confirmar({ titulo: "Quitar convalidación", mensaje: "Este ramo está en Convalidaciones. Al continuar se quitará esa entrada y su nota reconocida.", aceptar: "Continuar", peligro: true });
      if (!ok) return;
    }
    if (op === "cursando") return mutar(`Cursando ${ramo.nombre}`, (c) => marcarCursando(c, ramo.id));
    if (op === "desmarcar") return mutar(`Desmarcar ${ramo.nombre}`, (c) => desmarcar(c, ramo.id));
    const r = await new Promise<{ semestre: number | null } | null>((resolver) => setPeticion({ ramo, resolver }));
    if (!r) return;
    mutar(`Aprobado ${ramo.nombre}`, (c) => {
      marcarAprobado(c, ramo.id, r.semestre);
      if (r.semestre === null) c.st.prefs.marcadoRapido = true;
    });
    if (r.semestre === null) toast(`${ramo.nombre} marcado sin semestre. El marcado rápido quedó activado.`);
    else if (r.semestre === 0) toast(`${ramo.nombre} guardado en Convalidaciones.`);
  };

  const marcarHasta = async () => {
    const v = await pedirTexto({
      titulo: "Marcar semestres completos",
      mensaje: "Se marcan como aprobados todos los ramos desde el semestre 1 hasta el que indiques. Después solo desmarcas los que debes.",
      etiqueta: "Mi malla",
      aceptar: "Marcar",
      campo: {
        etiqueta: "Hasta el semestre",
        valor: String(Math.max(1, st.semestreActual - 1)),
        inputMode: "numeric",
        validar: (x) => {
          const n = Number(x);
          return Number.isInteger(n) && n >= 1 && n <= cur.semestresObjetivo ? null : `Escribe un semestre entre 1 y ${cur.semestresObjetivo}.`;
        },
      },
    });
    if (v === null) return;
    let n = 0;
    mutar(`Marcar hasta S${v}`, (c) => (n = marcarSemestres(c, Number(v))));
    toast(n ? `${plural(n, "ramo marcado", "ramos marcados")}. Ahora desmarca los que debes.` : "Esos semestres ya estaban marcados.", n ? "ok" : "info", n ? { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() } : undefined);
  };

  const ramoMenu = menu?.ramo;
  const estadoMenu = ramoMenu ? estados[ramoMenu.id] : null;

  return (
    <div className="space-y-4">
      <TusDatos />

      <Tarjeta className="!p-0">
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold">Malla curricular</h2>
              <p className="text-[13px] text-fg-2">Toca un ramo para marcarlo. Pasa el mouse para ver sus prerrequisitos y lo que desbloquea.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Boton tamano="sm" variante={verCritica ? "suave" : "secundario"} icono={<Route className="size-4" />} onClick={() => setVerCritica((v) => !v)} aria-pressed={verCritica}>
                Ruta crítica
              </Boton>
              <Boton tamano="sm" icono={<CheckCheck className="size-4" />} onClick={marcarHasta}>
                Marcar semestres completos
              </Boton>
              <Boton tamano="sm" variante="suave" icono={<FileUp className="size-4" />} onClick={() => useUI.getState().setImportar(true)}>
                Importar desde la UDP
              </Boton>
            </div>
          </div>

          {puedeTomar > 0 && (
            <button
              type="button"
              onClick={() => irA("planificacion")}
              className="flex w-full items-center gap-3 rounded-2xl border border-accent-line bg-accent-soft px-4 py-2.5 text-left text-[13.5px] transition-colors hover:bg-accent-soft/70"
            >
              <Lightbulb className="size-4.5 shrink-0 text-accent" />
              <span className="flex-1">
                Puedes tomar <strong>{plural(puedeTomar, "ramo")}</strong> el próximo semestre.
              </span>
              <span className="flex items-center gap-1 font-semibold text-accent">
                Ver planificación <ArrowRight className="size-4" />
              </span>
            </button>
          )}

          {verCritica && critica.length > 0 && (
            <div className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px]">
              <p className="font-bold">
                Tu ruta crítica: {critica.length} semestres como mínimo para titularte
              </p>
              <p className="mt-0.5 text-fg-2">Es la cadena de prerrequisitos más larga que te queda (como en el método CPM). Si atrasas uno de estos ramos, se atrasa tu egreso.</p>
              <ol className="mt-2 flex flex-wrap items-center gap-1.5">
                {critica.map((id, i) => (
                  <li key={id} className="flex items-center gap-1.5">
                    <span className="rounded-lg bg-surface px-2 py-0.5 text-[12px] font-semibold">
                      {i + 1}. {nombreRamo(ctx, id)}
                    </span>
                    {i < critica.length - 1 && <ArrowRight className="size-3.5 text-fg-3" />}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" />
              <input className="input !pl-9" type="search" placeholder="Buscar por nombre o sigla" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar ramo" />
              {busqueda && (
                <BotonIcono tamano="sm" etiqueta="Limpiar búsqueda" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setBusqueda("")}>
                  <X className="size-4" />
                </BotonIcono>
              )}
            </div>
            <div className="scroll-x max-w-full">
              <Segmentado<Filtro>
                etiqueta="Filtrar por estado"
                valor={filtro}
                onChange={setFiltro}
                opciones={[
                  { valor: "todos", etiqueta: "Todos" },
                  { valor: "disponible", etiqueta: "Puedo tomar" },
                  { valor: "cursando", etiqueta: "Cursando" },
                  { valor: "aprobado", etiqueta: "Aprobados" },
                  { valor: "pendientes", etiqueta: "Pendientes" },
                ]}
              />
            </div>
            <span className="text-[12.5px] text-fg-3" aria-live="polite">
              {plural(visibles.length, "ramo")}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold text-fg-2" aria-label="Leyenda">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-ok/40 bg-ok-soft" />Aprobado</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-info/40 bg-info-soft" />Cursando</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-accent bg-surface" />Puedo tomar</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-line bg-surface-2" />Bloqueado</span>
              <span className="hidden items-center gap-1.5 md:flex"><span className="size-3 rounded-sm ring-2 ring-[var(--rel-prereq)]" />Prerrequisito</span>
              <span className="hidden items-center gap-1.5 md:flex"><span className="size-3 rounded-sm ring-2 ring-[var(--rel-unlock)]" />Desbloquea</span>
              <span className="hidden items-center gap-1.5 md:flex"><span className="size-3 rounded-sm ring-2 ring-[var(--rel-partial)]" />Desbloquea con otros</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Interruptor
                checked={st.prefs.marcadoRapido}
                onChange={(v) => mutar(null, ({ st }) => (st.prefs.marcadoRapido = v))}
                etiqueta="Marcado rápido"
                descripcion="Un clic marca el ramo como cursado sin pedir el semestre. Ideal para armar tu plan rápido; las notas las completas después."
              />
              <Interruptor checked={st.prefs.mostrarNotas} onChange={(v) => mutar(null, ({ st }) => (st.prefs.mostrarNotas = v))} etiqueta="Mostrar notas" />
            </div>
          </div>
          {Object.keys(cur.tipos).length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-fg-3" aria-label="Tipos de ramo">
              {Object.keys(cur.tipos).map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="h-3 w-1 rounded-full" style={{ background: colorTipo(cur, t) }} />
                  <strong className="font-semibold text-fg-2">{t}</strong> {etiquetaTipo(cur, t)}
                </span>
              ))}
            </div>
          )}
        </div>

        {visibles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 pb-10 text-center text-fg-2">
            <CircleSlash className="size-6 text-fg-3" />
            <p className="text-[13.5px]">No se encontraron ramos con estos filtros.</p>
          </div>
        ) : (
          <div className="scroll-x border-t border-line bg-surface-2/40 p-4 sm:p-5">
            <div className="flex flex-col gap-5 md:flex-row md:gap-3">
              {columnas.map((col) => {
                const ramos = col.ramos.filter(visible);
                if (!ramos.length) return null;
                const porMarcar = col.semestre > 0 ? col.ramos.filter((r) => marcableComoCompleto(ctx, r.id) && !apr.has(r.id)).length : 0;
                const creditos = col.ramos.reduce((s, r) => s + r.creditos, 0);
                return (
                  <section key={col.titulo} className="md:w-[176px] md:shrink-0" aria-label={col.titulo}>
                    <header className="mb-2 flex items-center justify-between gap-2 px-0.5">
                      <div>
                        <h3 className={cx("text-[13px] font-bold", col.semestre === st.semestreActual && "text-accent")}>
                          {col.titulo}
                          {col.semestre === st.semestreActual && <span className="ml-1.5 text-[10.5px] font-semibold">· actual</span>}
                        </h3>
                        <p className="text-[11px] text-fg-3 tabular">{creditos} créditos</p>
                      </div>
                      {porMarcar > 0 && (
                        <BotonIcono
                          tamano="sm"
                          etiqueta={`Marcar todo el ${col.titulo.toLowerCase()} como aprobado`}
                          onClick={() => {
                            let n = 0;
                            mutar(`Marcar ${col.titulo}`, (c) => (n = marcarSemestres(c, col.semestre, col.semestre)));
                            toast(`${col.titulo}: ${plural(n, "ramo marcado", "ramos marcados")}.`, "ok", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
                          }}
                        >
                          <ListChecks className="size-4" />
                        </BotonIcono>
                      )}
                    </header>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1">
                      {ramos.map((r) => (
                        <TarjetaRamo
                          key={r.id}
                          ramo={r}
                          estado={estados[r.id]}
                          ctx={ctx}
                          relaciones={relaciones}
                          critico={critica.indexOf(r.id) + 1}
                          onHover={setHover}
                          onElegir={elegir}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </Tarjeta>

      <Popover ancla={anclaMenu} abierto={!!menu} onCerrar={() => setMenu(null)} ancho={210}>
        {ramoMenu && (
          <>
            <p className="truncate px-2.5 pt-1.5 pb-1 text-[11.5px] font-bold text-fg-3">{nombreRamo(ctx, ramoMenu.id)}</p>
            <OpcionMenu icono={<Check className="text-ok" />} activo={estadoMenu === "aprobado"} onClick={() => accion(ramoMenu, "aprobado")} descripcion="Te preguntamos en qué semestre">
              Aprobado
            </OpcionMenu>
            <OpcionMenu icono={<Loader className="text-info" />} activo={estadoMenu === "cursando"} onClick={() => accion(ramoMenu, "cursando")} descripcion={`Se agrega a Notas · S${st.semestreActual}`}>
              Cursando
            </OpcionMenu>
            <OpcionMenu icono={<X className="text-fg-3" />} activo={estadoMenu === "disponible" || estadoMenu === "bloqueado"} onClick={() => accion(ramoMenu, "desmarcar")}>
              Desmarcar
            </OpcionMenu>
          </>
        )}
      </Popover>
      <DialogoSemestre peticion={peticion} onCerrar={() => setPeticion(null)} />
    </div>
  );
}
