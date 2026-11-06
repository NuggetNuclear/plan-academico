import {
  ArrowRight,
  BellRing,
  Briefcase,
  ChevronRight,
  Clock,
  Check,
  CheckCircle2,
  EyeOff,
  Flag,
  Info,
  Minus,
  PenLine,
  Percent,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  aprobadosSet,
  calcularPPA,
  ppaConEnCurso,
  causalesEliminacionUDP,
  esPeriodoActual,
  estadoRamo,
  evaluacionesCausalC,
  evolucionPPA,
  idsInglesEximidos,
  incidentesUDP,
  listaNombres,
  nombreEntrada,
  nombreHistorial,
  nombreRamo,
  periodosUDP,
  ramosSemestreActual,
  resumenCreditos,
  semestreListoParaAvanzar,
  semestreProtegido,
  situacionSemestreUDP,
  type SituacionSemestreUDP,
} from "../core/academic";
import { diasHasta, evaluacionesConFecha, hoyISO } from "../core/calendar";
import { evaluarReglaPractica, fechaEgreso } from "../core/curriculum";
import { NOTA_APROB, fmtNota, fmtPct, plural } from "../core/format";
import type { Periodo } from "../core/state";
import { calcularRamo } from "../core/grades";
import { useApp, useCtx } from "../store/app";
import { avanzarSemestre } from "../store/mutaciones";
import { confirmar, toast, useUI } from "../store/ui";
import { colorTipo } from "../ui/comun";
import { Aviso, Boton, CabeceraTarjeta, Tarjeta, cx } from "../ui/primitives";
import { semestresRestantes, usePlanes } from "./plan/usePlanes";
import { letrasCausal, motivoCausal, textoRendimiento } from "./riesgoCausal";
import { RegistroNota, type SeleccionNota } from "./notas/RegistroNota";

function AvisoCierreSemestre() {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const n = ctx.st.semestreActual;
  if (!semestreListoParaAvanzar(ctx) || ctx.st.prefs.avanceDescartado === n) return null;
  return (
    <Tarjeta className="flex flex-col gap-4 border-accent-line bg-gradient-to-r from-accent-soft to-transparent sm:flex-row sm:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg">
        <Flag className="size-5" />
      </span>
      <div className="flex-1">
        <h2 className="font-bold">Cerraste el semestre {n} 🎉</h2>
        <p className="text-[13px] text-fg-2">Todos tus ramos tienen nota final. ¿Pasas al semestre {n + 1}? Tu plan se recalcula solo.</p>
      </div>
      <div className="flex gap-2">
        <Boton tamano="sm" variante="fantasma" onClick={() => mutar(null, ({ st }) => (st.prefs.avanceDescartado = n))}>
          Todavía no
        </Boton>
        <Boton
          tamano="sm"
          variante="primario"
          onClick={() => {
            mutar(`Pasar al semestre ${n + 1}`, avanzarSemestre);
            toast(`Ahora estás en el semestre ${n + 1}. Marca como Cursando los ramos que inscribiste.`);
          }}
        >
          Pasar al semestre {n + 1}
        </Boton>
      </div>
    </Tarjeta>
  );
}

function Checklist() {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const irA = useUI((s) => s.irA);
  const setWizard = useUI((s) => s.setWizard);
  const { st } = ctx;
  const eximidos = idsInglesEximidos(ctx);
  const pasos = [
    { hecho: st.prefs.wizardHecho, titulo: "Completa tus datos", texto: "Semestre actual, inglés y congelaciones.", accion: "Abrir asistente", fn: () => setWizard(true) },
    {
      hecho: st.semestreActual <= 1 || Object.keys(st.marcas).some((id) => !eximidos.has(id)) || st.periodos.some((p) => p.ramos.some((e) => e.notaFinal !== null)),
      titulo: "Marca tu malla",
      texto: "Lo que ya aprobaste. Usa «Marcar semestres completos» para ir rápido.",
      accion: "Ir a Mi malla",
      fn: () => irA("malla"),
    },
    { hecho: st.cursando.length > 0 || ramosSemestreActual(ctx).length > 0, titulo: "Indica qué estás cursando", texto: "Márcalos como Cursando en la malla.", accion: "Ir a Mi malla", fn: () => irA("malla") },
    { hecho: !!st.planFijado, titulo: "Guarda tu planificación", texto: "Revisa el plan recomendado y quédate con uno.", accion: "Ir a Planificación", fn: () => irA("planificacion") },
    {
      hecho: st.periodos.some((p) => p.ramos.some((e) => e.notaFinal !== null || e.categorias.some((c) => c.notas.some((n) => n.n !== null)))),
      titulo: "Registra tus notas",
      texto: "Para tu PPA, estadísticas y situación académica.",
      accion: "Ir a Notas",
      fn: () => irA("notas"),
      opcional: true,
    },
  ];
  const obligatorios = pasos.filter((p) => !p.opcional);
  const listos = obligatorios.filter((p) => p.hecho).length;
  if (st.prefs.checklistOculto || listos === obligatorios.length) return null;
  const siguiente = pasos.findIndex((p) => !p.hecho);
  return (
    <Tarjeta>
      <CabeceraTarjeta
        icono={<Wand2 className="size-[18px]" />}
        titulo="Tus próximos pasos"
        descripcion={`${listos} de ${obligatorios.length} listos. Sigue el orden y tendrás tu plan en pocos minutos.`}
        acciones={
          <Boton tamano="sm" variante="fantasma" icono={<EyeOff className="size-4" />} onClick={() => mutar(null, ({ st }) => (st.prefs.checklistOculto = true))}>
            Ocultar
          </Boton>
        }
      />
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(listos / obligatorios.length) * 100}%` }} />
      </div>
      <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {pasos.map((p, i) => (
          <li
            key={p.titulo}
            className={cx(
              "flex flex-col gap-2 rounded-2xl border p-3.5",
              p.hecho ? "border-line bg-surface-2/60" : i === siguiente ? "border-accent-line bg-accent-soft" : "border-line",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold", p.hecho ? "bg-ok text-white" : i === siguiente ? "bg-accent text-accent-fg" : "bg-surface-3 text-fg-2")}>
                {p.hecho ? <Check className="size-3.5" /> : i + 1}
              </span>
              <strong className={cx("text-[13.5px]", p.hecho && "text-fg-2 line-through decoration-fg-3/50")}>{p.titulo}</strong>
            </div>
            <p className="flex-1 text-[12.5px] text-fg-2">
              {p.texto} {p.opcional && <em className="text-fg-3">(opcional)</em>}
            </p>
            {!p.hecho && (
              <Boton tamano="sm" variante={i === siguiente ? "primario" : "secundario"} onClick={p.fn} className="self-start">
                {p.accion}
              </Boton>
            )}
          </li>
        ))}
      </ol>
    </Tarjeta>
  );
}

/** Abre el registro de nota sin salir de Inicio: al guardar, se vuelve aquí con todo actualizado. */
type AbrirRegistro = (periodo: Periodo, seleccion: SeleccionNota) => void;

const FMT_FECHA = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" });
const fechaLocal = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const FMT_MES = new Intl.DateTimeFormat("es-CL", { month: "short" });
const FMT_DIA = new Intl.DateTimeFormat("es-CL", { weekday: "long" });

/** Cuadritos del fondo del bloque destacado: [x, y, opacidad], más tenues hacia la izquierda. */
const MALLA_FONDO: [number, number, number][] = [
  [170, 96, 0.03], [200, 96, 0.07], [230, 96, 0.12], [260, 96, 0.07], [290, 96, 0.14], [320, 96, 0.09],
  [170, 126, 0.04], [200, 126, 0.05], [230, 126, 0.09], [260, 126, 0.15], [290, 126, 0.08], [320, 126, 0.12],
  [260, 66, 0.05], [290, 66, 0.08], [320, 66, 0.06],
];

/** Lo primero que se ve: la próxima evaluación, o la acción que corresponde si aún no hay datos. */
function Destacada({ onRegistrar }: { onRegistrar: AbrirRegistro }) {
  const ctx = useCtx();
  const irA = useUI((s) => s.irA);
  const setImportar = useUI((s) => s.setImportar);
  const hoy = hoyISO();
  const proxima = evaluacionesConFecha(ctx).find((e) => e.fecha >= hoy && !e.rendida);
  const actual = ctx.st.periodos.find((p) => esPeriodoActual(ctx.st, p));
  const abiertos = actual?.ramos.filter((e) => e.notaFinal === null) ?? [];
  const pendientes = abiertos.reduce((n, e) => n + e.categorias.reduce((s, c) => s + c.notas.filter((x) => x.n === null).length, 0), 0);
  const periodoDe = (uid: string) => ctx.st.periodos.find((p) => p.ramos.some((e) => e.uid === uid));

  const boton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold text-[#3a28c4] shadow-[0_6px_20px_-6px_rgb(0_0_0/0.35)] transition-transform hover:-translate-y-px";
  const secundario = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/15 px-5 text-[14px] font-bold text-white hover:bg-white/25";
  const pastilla = "inline-flex items-center gap-1.5 rounded-full bg-white/[0.14] px-3 py-1.5 text-[12.5px] font-semibold";

  let etiqueta: React.ReactNode, titulo: React.ReactNode, subtitulo: React.ReactNode = null, pastillas: React.ReactNode = null, acciones: React.ReactNode, lateral: React.ReactNode = null;

  const periodo = proxima ? periodoDe(proxima.entrada) : undefined;
  if (proxima && periodo) {
    const d = diasHasta(proxima.fecha);
    const f = fechaLocal(proxima.fecha);
    const entrada = periodo.ramos.find((e) => e.uid === proxima.entrada)!;
    const r = calcularRamo(entrada);
    etiqueta = "Próxima evaluación";
    titulo = proxima.etiqueta;
    subtitulo = <>{proxima.ramo}<span className="sr-only">, {FMT_FECHA.format(f)}</span></>;
    pastillas = (
      <>
        {proxima.peso > 0 && (
          <span className={pastilla}>
            <Percent aria-hidden="true" className="size-3.5" /> {fmtPct(proxima.peso)}% del ramo
          </span>
        )}
        {r.necesaria !== null && r.necesaria > 1 && (
          <span className={pastilla}>
            <Target aria-hidden="true" className="size-3.5" />
            {r.necesaria > 7 ? "Ya no alcanza el 4,0 con lo que queda" : <>Para aprobar: {fmtNota(r.necesaria, 1)} en lo que queda</>}
          </span>
        )}
      </>
    );
    lateral = (
      <div aria-hidden="true" className="w-[5.5rem] shrink-0 overflow-clip rounded-[1.4rem] bg-white/[0.14] text-center ring-1 ring-white/20 backdrop-blur-sm sm:w-28">
        <p className="bg-white/[0.12] py-1.5 text-[11px] font-bold tracking-[0.12em] uppercase">{FMT_MES.format(f).replace(".", "")}</p>
        <p className="pt-1.5 text-[38px] leading-none font-extrabold tracking-[-0.04em] tabular sm:text-[46px]">{f.getDate()}</p>
        <p className="pt-1 pb-2.5 text-[11.5px] font-semibold text-white/80 first-letter:uppercase">{FMT_DIA.format(f)}</p>
      </div>
    );
    acciones = (
      <>
        <button type="button" className={boton} onClick={() => onRegistrar(periodo, { uid: proxima.entrada, categoria: proxima.categoriaId, nota: proxima.notaId })}>
          <PenLine className="size-4" /> Registrar nota
        </button>
        <span className={cx("inline-flex items-center gap-1.5 text-[13px] font-bold", d <= 2 ? "text-white" : "text-white/85")}>
          <Clock aria-hidden="true" className="size-4" />
          {d === 0 ? "Es hoy" : d === 1 ? "Es mañana" : `Faltan ${d} días`}
        </span>
      </>
    );
  } else if (actual && abiertos.length) {
    etiqueta = `Semestre ${ctx.st.semestreActual}`;
    titulo = pendientes ? "Mantén tus notas al día" : "Todo registrado por ahora";
    subtitulo = pendientes
      ? <>{plural(pendientes, "evaluación pendiente", "evaluaciones pendientes")} en {plural(abiertos.length, "ramo")}. Agrega fechas para verlas aquí a tiempo.</>
      : <>No tienes evaluaciones pendientes en tus {plural(abiertos.length, "ramo")} en curso.</>;
    acciones = (
      <button type="button" className={boton} onClick={() => onRegistrar(actual, {})}>
        <PenLine className="size-4" /> Registrar nota
      </button>
    );
  } else {
    etiqueta = "Para empezar";
    titulo = "Carga lo que ya cursaste";
    subtitulo = <>Importa tu avance desde la UDP o márcalo a mano en tu malla. No necesitas cuenta: todo queda en este navegador.</>;
    acciones = (
      <>
        <button type="button" className={boton} onClick={() => setImportar(true)}>
          <Upload className="size-4" /> Importar avance
        </button>
        <button type="button" className={secundario} onClick={() => irA("malla")}>
          Marcar a mano
        </button>
      </>
    );
  }

  return (
    <section aria-label="Lo que viene" className="hero relative overflow-clip rounded-[1.75rem] p-5 sm:p-7">
      {/* Mini malla de cuadritos, como el ícono de la app. */}
      <svg aria-hidden="true" width="360" height="170" viewBox="0 0 360 170" className="pointer-events-none absolute right-0 bottom-0">
        <g fill="#fff">
          {MALLA_FONDO.map(([x, y, o]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="22" height="22" rx="6" opacity={o} />
          ))}
        </g>
      </svg>
      <div className="relative flex items-start gap-4 sm:gap-6">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-3 py-1.5 text-[12px] font-bold">
            <Sparkles aria-hidden="true" className="size-3.5" /> {etiqueta}
          </span>
          <h2 className="mt-3 text-[26px] leading-[1.1] font-extrabold tracking-[-0.03em] break-words sm:text-[32px]">{titulo}</h2>
          {subtitulo && <p className="mt-1.5 max-w-xl text-[14.5px] font-medium text-white/85">{subtitulo}</p>}
        </div>
        {lateral}
      </div>
      {pastillas && <div className="relative mt-4 flex flex-wrap gap-2">{pastillas}</div>}
      <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">{acciones}</div>
    </section>
  );
}

/** Una cifra del resumen: los enlaces quedan alineados al pie de cada columna. */
function Cifra({ etiqueta, valor, detalle, enlace }: { etiqueta: string; valor: React.ReactNode; detalle: React.ReactNode; enlace?: { texto: string; fn: () => void } }) {
  return (
    <div className="flex min-w-0 flex-col px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-[12.5px] font-semibold text-fg-2">{etiqueta}</p>
      <p className="mt-1.5 flex h-8 items-baseline gap-1.5 text-[28px] leading-none font-extrabold tracking-[-0.03em] tabular">{valor}</p>
      <div className="mt-2 flex-1 text-[12px] leading-relaxed text-fg-3">{detalle}</div>
      {enlace && (
        <button type="button" className="mt-2 inline-flex min-h-9 items-center gap-1 self-start text-[12.5px] font-bold text-accent hover:underline" onClick={enlace.fn}>
          {enlace.texto} <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Avance, PPA y egreso en una sola franja; el detalle vive en Estadísticas y en Plan de carrera. */
function Resumen() {
  const ctx = useCtx();
  const irA = useUI((s) => s.irA);
  const cred = useMemo(() => resumenCreditos(ctx), [ctx]);
  const evo = useMemo(() => evolucionPPA(ctx), [ctx]);
  const { ppa } = calcularPPA(ctx);
  const actual = ppaConEnCurso(ctx);
  const { planes, guardado } = usePlanes();
  const restante = semestresRestantes(planes, guardado);
  const pct = cred.total > 0 ? Math.round((cred.avance / cred.total) * 100) : 0;
  const reales = evo.filter((p) => p.numero > 0);
  const delta = reales.length >= 2 ? reales.at(-1)!.acumulado - reales.at(-2)!.acumulado : null;
  const estimado = ppa === null && actual.ppa !== null;

  return (
    <section aria-label="Resumen de tu carrera" className="card grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Cifra
        etiqueta="Avance de la carrera"
        valor={<>{pct}%</>}
        detalle={
          <>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="hero h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
            {cred.avance} de {cred.total} créditos{cred.cursando > 0 && <> · {cred.cursando} cursando</>}
          </>
        }
        enlace={{ texto: "Ver malla", fn: () => irA("malla") }}
      />
      <Cifra
        etiqueta={estimado ? "PPA estimado" : "PPA acumulado"}
        valor={actual.ppa !== null ? fmtNota(actual.ppa, 2) : "—"}
        detalle={
          estimado ? (
            <>Según tus promedios en curso. Se confirma cuando cierres tus primeros ramos.</>
          ) : ppa === null ? (
            <>Registra tus notas para verlo.</>
          ) : (
            <>
              {delta !== null ? (
                <span className={cx("inline-flex items-center gap-1 font-semibold", delta > 0.005 ? "text-ok" : delta < -0.005 ? "text-danger" : "text-fg-3")}>
                  {delta > 0.005 ? <TrendingUp className="size-3.5" /> : delta < -0.005 ? <TrendingDown className="size-3.5" /> : <Minus className="size-3.5" />}
                  {delta > 0 ? "+" : ""}
                  {fmtNota(delta, 2)} vs. semestre anterior
                </span>
              ) : (
                <span className="block">Con dos semestres verás la tendencia.</span>
              )}
              {actual.ramos > 0 && <span className="block">Incluye ramos en curso · confirmado {fmtNota(ppa, 2)}</span>}
            </>
          )
        }
        enlace={{ texto: "Ver estadísticas", fn: () => irA("estadisticas") }}
      />
      <Cifra
        etiqueta="Para titularte"
        valor={restante.ultimo !== null ? <>{restante.n} <span className="text-[15px] font-semibold tracking-normal text-fg-3">{restante.n === 1 ? "semestre" : "semestres"}</span></> : "Listo"}
        detalle={
          restante.ultimo !== null ? (
            <>
              Egreso estimado: <strong className="font-semibold text-fg-2">{fechaEgreso(ctx.st.semestreActual, restante.ultimo, ctx.st.congelaciones)}</strong>, según tu plan {restante.fuente === "guardado" ? "guardado" : "recomendado"}.
            </>
          ) : (
            <>No te quedan ramos por planificar.</>
          )
        }
        enlace={{ texto: "Ver plan de carrera", fn: () => irA("planificacion") }}
      />
    </section>
  );
}

type TonoRiesgo = "neutro" | "info" | "ok" | "warn" | "danger";
const CLASE_TONO: Record<TonoRiesgo, string> = {
  neutro: "bg-surface-2",
  info: "bg-info-soft",
  ok: "bg-ok-soft",
  warn: "bg-warn-soft",
  danger: "bg-danger-soft",
};

function Contador({ causal, valor, detalle, tono }: { causal: string; valor: React.ReactNode; detalle: React.ReactNode; tono: TonoRiesgo }) {
  return (
    <div className={cx("rounded-2xl px-3.5 py-3", CLASE_TONO[tono])}>
      <p className="text-[12px] font-bold text-fg-2">Causal {causal}</p>
      <p className={cx("text-[20px] leading-tight font-extrabold tabular", tono === "danger" ? "text-danger" : tono === "info" ? "text-info" : "text-fg")}>{valor}</p>
      <p className="text-[12px] text-fg-2">{detalle}</p>
    </div>
  );
}

function FilaRiesgo({ tono, insignia, children }: { tono: TonoRiesgo; insignia?: string; children: React.ReactNode }) {
  return (
    <li className={cx("flex items-start gap-2.5 rounded-xl border px-3 py-2 text-[13px]", CLASE_TONO[tono])}>
      {insignia && (
        <span className={cx("grid h-5 min-w-5 shrink-0 place-items-center rounded-md px-1 text-[11px] font-bold text-white uppercase", tono === "danger" ? "bg-danger" : tono === "ok" ? "bg-ok" : "bg-warn")}>{insignia}</span>
      )}
      <div className="min-w-0 space-y-0.5">{children}</div>
    </li>
  );
}

function CausalesUDP() {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const incidentes = incidentesUDP(ctx);
  const activos = incidentes.filter((i) => !i.aceptado);
  const permanencias = [...ctx.st.permanenciasUDP].sort((a, b) => a - b);
  const periodos = periodosUDP(ctx);
  const reincidencia = incidentes.some((i) => i.aceptado);
  const ultimo = activos.at(-1);

  if (!activos.length && !permanencias.length)
    return (
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ok">
        <CheckCircle2 className="size-4" /> Sin causales de eliminación detectadas
      </p>
    );
  return (
    <div className="space-y-2">
      {activos.length > 0 && (
        <ul className="space-y-2">
          {activos.flatMap((i) =>
            i.causales.map((c, k) => (
              <FilaRiesgo key={`${i.semestre}-${k}`} tono="danger" insignia={c.causal}>
                <p>
                  {c.descripcion} <span className="text-fg-2">· tras S{i.semestre}</span>
                </p>
              </FilaRiesgo>
            )),
          )}
        </ul>
      )}
      {ultimo && (
        <div className="space-y-2 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
          <p>
            Puedes solicitar tu permanencia por escrito al Comité de Carrera (art. 39).
            {reincidencia ? " Ya tuviste una permanencia aceptada: si te la rechazan, la apelación a la Comisión Especial de Gracia es solo para la primera causal (art. 40)." : " Si la rechaza, puedes ir a la Comisión de Gracia de la Facultad y luego a la Comisión Especial de Gracia (art. 40)."}
          </p>
          <Boton tamano="sm" variante="suave" icono={<ShieldCheck className="size-3.5" />} onClick={() => mutar("Registrar permanencia", ({ st }) => st.permanenciasUDP.push(ultimo.semestre))}>
            Me aceptaron la permanencia tras S{ultimo.semestre}
          </Boton>
        </div>
      )}
      {permanencias.map((p) => {
        const cubiertas = [...new Set(incidentes.filter((i) => i.semestre <= p && !permanencias.some((q) => q < p && i.semestre <= q)).flatMap((i) => i.causales.map((c) => c.causal)))];
        const exento = cubiertas.includes("c") ? semestreProtegido(p, periodos) : null;
        return (
          <div key={p} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ok/25 bg-ok-soft px-3 py-2 text-[13px]">
            <span className="flex min-w-0 items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
              <span>
                Permanencia aceptada tras S{p}
                {cubiertas.length ? ` (${letrasCausal(cubiertas)})` : ""}.
                {cubiertas.includes("c") && (exento === null ? " El próximo semestre cursado no se evalúa la causal c." : ` S${exento} no se evaluó por la causal c.`)}
              </span>
            </span>
            <Boton
              tamano="sm"
              variante="fantasma"
              icono={<Trash2 className="size-3.5" />}
              onClick={async () => {
                if (await confirmar({ titulo: "Quitar permanencia", mensaje: `¿Quitar el registro de permanencia aceptada tras el semestre ${p}?`, aceptar: "Quitar", peligro: true }))
                  mutar("Quitar permanencia", ({ st }) => (st.permanenciasUDP = st.permanenciasUDP.filter((x) => x !== p)));
              }}
            >
              Quitar
            </Boton>
          </div>
        );
      })}
    </div>
  );
}

function SemestreUDP({ s }: { s: SituacionSemestreUDP }) {
  const ctx = useCtx();
  const irA = useUI((st) => st.irA);
  const enRiesgo = [...s.ramos.filter((r) => r.causales.length)].sort((a, b) => b.causales.length - a.causales.length || (b.causales.includes("b") ? 1 : 0) - (a.causales.includes("b") ? 1 : 0));
  const m = s.margenC;
  const filas: React.ReactNode[] = [];

  if (s.reincidencia && (enRiesgo.length || s.combinadaA))
    filas.push(
      <FilaRiesgo key="reincidencia" tono="danger">
        <p>Ya tuviste una permanencia aceptada: caer de nuevo en causal sería reincidir, y la apelación a la Comisión Especial de Gracia es solo para la primera vez (art. 40).</p>
      </FilaRiesgo>,
    );
  enRiesgo.forEach((r) => {
    const rend = textoRendimiento(r);
    filas.push(
      <FilaRiesgo key={r.entrada.uid} tono={rend.tono === "ok" ? "ok" : rend.tono === "danger" ? "danger" : "warn"} insignia={r.causales.join("+")}>
        <p className="font-semibold">
          {nombreEntrada(ctx, r.entrada)}: si lo repruebas, {letrasCausal(r.causales)}
        </p>
        <p className="text-fg-2">{motivoCausal(s, r)}</p>
        <p>{rend.texto}</p>
      </FilaRiesgo>,
    );
  });
  if (s.combinadaA) {
    const vanMal = s.ramos.filter((r) => s.combinadaA!.claves.includes(r.clave) && (r.rendimiento === "reprobando" || r.rendimiento === "perdido")).length;
    filas.push(
      <FilaRiesgo key="combinada" tono={vanMal >= s.combinadaA.necesarias ? "danger" : "warn"} insignia="a">
        <p>
          Si repruebas {s.combinadaA.necesarias} de estos ramos que ya reprobaste una vez ({listaNombres(ctx, s.combinadaA.claves)}), caes en causal a.
          {vanMal > 0 && ` Hoy vas reprobando ${vanMal}.`}
        </p>
      </FilaRiesgo>,
    );
  }
  if (m && !m.exento && m.permitidas < m.enCurso) {
    const tono: TonoRiesgo = m.proyectadas > m.permitidas ? "danger" : m.proyectadas === m.permitidas && m.permitidas > 0 ? "warn" : m.permitidas === 0 ? "danger" : "neutro";
    filas.push(
      <FilaRiesgo key="c" tono={tono} insignia="c">
        <p>
          {m.permitidas === 0
            ? `No puedes reprobar ningún ramo más este semestre: superarías el 50% en S${m.semestres[0]} y S${m.semestres[1]}.`
            : `Puedes reprobar como máximo ${m.permitidas} de tus ${m.enCurso} ramos en curso sin superar el 50% en S${m.semestres[0]} y S${m.semestres[1]}.`}
          {m.proyectadas > 0 && ` Hoy vas reprobando ${m.proyectadas}.`}
        </p>
      </FilaRiesgo>,
    );
  }
  if (m?.exento)
    filas.push(
      <FilaRiesgo key="c-exento" tono="ok" insignia="c">
        <p>Este semestre no se evalúa la causal c: aceptaron tu permanencia por esa causal.</p>
      </FilaRiesgo>,
    );
  s.pendientesB.forEach(({ clave, veces }) =>
    filas.push(
      <FilaRiesgo key={"pb" + clave} tono="warn" insignia="b">
        <p>
          {nombreHistorial(ctx, clave)}: la llevas reprobada {veces} veces y aún no la apruebas. Si la vuelves a inscribir y reprobar, caes {veces >= 3 ? "otra vez en" : "en"} causal b.
        </p>
      </FilaRiesgo>,
    ),
  );

  if (!s.ramos.length && !filas.length)
    return <p className="text-[13px] text-fg-2">No tienes ramos en curso. Cuando los inscribas te diré cuáles te dejarían en causal.</p>;
  if (!filas.length)
    return (
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ok">
        <CheckCircle2 className="size-4" /> Ningún ramo en curso te deja en causal si lo repruebas
      </p>
    );
  return (
    <div className="space-y-3">
      <ul className="space-y-2">{filas}</ul>
      {enRiesgo.some((r) => r.rendimiento === "sin-notas" || r.rendimiento === "reprobando") && (
        <Boton tamano="sm" variante="suave" onClick={() => irA("notas")}>
          Registrar notas <ArrowRight className="size-4" />
        </Boton>
      )}
    </div>
  );
}

function SituacionUDP() {
  const ctx = useCtx();
  const s = situacionSemestreUDP(ctx);
  const ultimaC = evaluacionesCausalC(ctx).at(-1);
  // El estado actual es informativo; solo una causal vigente (sin permanencia aceptada) se marca en rojo.
  const vigentes = new Set(causalesEliminacionUDP(ctx).map((c) => c.tipo));
  const tono = (causal: string): TonoRiesgo => (vigentes.has(causal) ? "danger" : "info");
  return (
    <>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Contador
          causal="a"
          valor={`${s.dosVeces.length} de 3`}
          tono={tono("a")}
          detalle={s.dosVeces.length ? `reprobadas dos veces: ${listaNombres(ctx, s.dosVeces)}` : "asignaturas reprobadas dos veces"}
        />
        <Contador
          causal="b"
          valor={`${s.masReprobada?.veces ?? 0} de 3`}
          tono={tono("b")}
          detalle={s.masReprobada ? `reprobaciones de ${nombreHistorial(ctx, s.masReprobada.clave)}` : "reprobaciones de un mismo ramo"}
        />
        <Contador
          causal="c"
          valor={ultimaC ? `${Math.round(ultimaC.porcentaje)}%` : "—"}
          tono={tono("c")}
          detalle={ultimaC ? `reprobado en ${ultimaC.considerados.map((x) => "S" + x).join(" y ")} (${ultimaC.reprobadas} de ${ultimaC.cursadas}; límite 50%)` : "se evalúa desde tu segundo semestre"}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="mb-3 flex items-center gap-2 text-[13.5px] font-bold">
            <Info className="size-4 text-info" /> Causales de eliminación
          </p>
          <CausalesUDP />
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="mb-3 flex items-center gap-2 text-[13.5px] font-bold">
            <ShieldAlert className="size-4 text-accent" /> Para no caer este semestre · S{s.semestre}
          </p>
          <SemestreUDP s={s} />
        </div>
      </div>
    </>
  );
}

function SituacionAcademica() {
  const irA = useUI((s) => s.irA);
  return (
    <Tarjeta>
      <CabeceraTarjeta
        icono={<ShieldCheck className="size-[18px]" />}
        titulo="Tu situación académica"
        descripcion="Se calcula con tus notas en Notas, incluidas las parciales de este semestre · Reglamento de Pregrado UDP, art. 38 a 40."
        acciones={
          <Boton tamano="sm" variante="fantasma" onClick={() => irA("ayuda")}>
            ¿Cómo se calcula?
          </Boton>
        }
      />
      <SituacionUDP />
    </Tarjeta>
  );
}

/** Iniciales para la insignia del ramo («Cálculo II» → «CII»). */
function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((p) => p && !/^(de|del|la|las|el|los|y|e|a|en|para|al)$/i.test(p));
  const romano = palabras.at(-1)?.match(/^[IVX]+$/)?.[0] ?? "";
  const base = (romano ? palabras.slice(0, -1) : palabras).slice(0, romano ? 1 : 2).map((p) => p[0]).join("");
  return (base + romano).toUpperCase().slice(0, 3) || "?";
}

function MisRamos({ onRegistrar }: { onRegistrar: AbrirRegistro }) {
  const ctx = useCtx();
  const irA = useUI((s) => s.irA);
  const p = ctx.st.periodos.find((x) => esPeriodoActual(ctx.st, x));
  const entradas = p?.ramos ?? [];
  return (
    <section aria-labelledby="titulo-mis-ramos" className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 id="titulo-mis-ramos" className="text-[17px] font-bold tracking-tight">Mis ramos · S{ctx.st.semestreActual}</h2>
        <button type="button" className="inline-flex min-h-9 items-center gap-1 text-[13px] font-bold text-accent hover:underline" onClick={() => irA("notas")}>
          Ver notas <ChevronRight className="size-4" />
        </button>
      </div>
      {entradas.length === 0 ? (
        <div className="card p-5 text-[13.5px] text-fg-2">
          No tienes ramos en el semestre {ctx.st.semestreActual}. Márcalos como <strong>Cursando</strong> en{" "}
          <button type="button" className="font-semibold text-accent hover:underline" onClick={() => irA("malla")}>
            Mi malla
          </button>
          .
        </div>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
          {entradas.map((e) => {
            const c = calcularRamo(e);
            const nota = c.nf !== null ? Math.min(7, c.nf + (c.decimas || 0)) : null;
            const pct = c.cerrado ? 100 : c.pesoEvaluado;
            const nombre = nombreEntrada(ctx, e);
            const ramo = ctx.cur.ramos.find((r) => r.id === e.id);
            const color = ramo ? colorTipo(ctx.cur, ramo.tipo) : "var(--accent)";
            const pendientes = e.categorias.reduce((s, cat) => s + cat.notas.filter((n) => n.n === null).length, 0);
            const cerrado = c.cerrado || e.notaFinal !== null;
            return (
              <li key={e.uid}>
                <button
                  type="button"
                  onClick={() => (cerrado ? irA("notas") : onRegistrar(p!, { uid: e.uid }))}
                  aria-label={cerrado ? `${nombre}: nota final ${fmtNota(nota)}. Ver en Notas` : `Registrar nota en ${nombre}`}
                  className="card group flex w-full items-center gap-3.5 p-3.5 text-left transition-transform hover:-translate-y-px sm:px-4"
                  style={{ ["--c" as string]: color }}
                >
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--c)_14%,transparent)] text-[12.5px] font-extrabold text-[var(--c)]">
                    {iniciales(nombre)}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1.5">
                    <span className="truncate text-[14.5px] font-bold">{nombre}</span>
                    <span aria-hidden="true" className="block h-1.5 max-w-64 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full bg-[var(--c)]" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-[12px] text-fg-3">
                      {cerrado ? "Ramo cerrado" : nota === null ? "Sin notas aún" : `${fmtNota(pct, 0)}% evaluado`}
                      {!cerrado && pendientes > 0 && <> · {plural(pendientes, "pendiente", "pendientes")}</>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cx("block text-[22px] leading-none font-extrabold tracking-[-0.03em] tabular", nota !== null && nota < NOTA_APROB && "text-danger")}>{nota !== null ? fmtNota(nota) : "—"}</span>
                    <span className="text-[11px] text-fg-3">{cerrado ? "final" : "parcial"}</span>
                  </span>
                  {!cerrado && (
                    <span aria-hidden="true" className="hidden size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-accent-fg sm:grid">
                      <PenLine className="size-4" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProximasEvaluaciones() {
  const ctx = useCtx();
  const irA = useUI((s) => s.irA);
  const hoy = hoyISO();
  const proximas = evaluacionesConFecha(ctx)
    .filter((e) => e.fecha >= hoy && !e.rendida)
    .slice(0, 6);
  return (
    <section aria-labelledby="titulo-proximas" className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 id="titulo-proximas" className="text-[17px] font-bold tracking-tight">Próximas evaluaciones</h2>
        <button type="button" className="inline-flex min-h-9 shrink-0 items-center gap-1 text-[13px] font-bold text-accent hover:underline" onClick={() => irA("agenda")}>
          Ver agenda <ChevronRight className="size-4" />
        </button>
      </div>
      {proximas.length === 0 ? (
        <div className="card p-5 text-[13.5px] text-fg-2">
          No tienes evaluaciones con fecha.{" "}
          <button type="button" className="font-semibold text-accent hover:underline" onClick={() => irA("notas")}>
            Agregar fechas
          </button>
        </div>
      ) : (
        <ul className="card grid grid-cols-[minmax(0,1fr)] divide-y divide-line overflow-clip">
          {proximas.map((e) => {
            const d = diasHasta(e.fecha);
            const f = fechaLocal(e.fecha);
            const tono = d <= 2 ? "bg-danger-soft text-danger" : d <= 7 ? "bg-warn-soft text-warn" : "bg-surface-2 text-fg-2";
            return (
              <li key={e.uid} className="flex items-center gap-3 px-4 py-3">
                <span className={cx("grid w-12 shrink-0 place-items-center rounded-2xl py-1.5 text-center", tono)}>
                  <span className="text-[18px] leading-none font-extrabold tabular">{f.getDate()}</span>
                  <span className="mt-0.5 text-[10.5px] leading-none font-bold uppercase">{FMT_MES.format(f).replace(".", "")}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{e.etiqueta}</p>
                  <p className="truncate text-[12px] text-fg-3">{e.ramo}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cx("text-[12.5px] font-bold", d <= 2 ? "text-danger" : d <= 7 ? "text-warn" : "text-fg-2")}>{d === 0 ? "Hoy" : d === 1 ? "Mañana" : `${d} días`}</p>
                  {e.peso > 0 && <p className="text-[11.5px] text-fg-3 tabular">{fmtPct(e.peso)}%</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AvisosParaTi() {
  const ctx = useCtx();
  const apr = aprobadosSet(ctx);
  const avisos: { icono: React.ReactNode; tono: "info" | "warn" | "ok"; texto: React.ReactNode }[] = [];
  ctx.cur.ramos
    .filter((r) => r.reglaPractica && estadoRamo(ctx, r.id, apr) === "disponible")
    .forEach((r) => {
      const deuda = evaluarReglaPractica(r, apr).deuda;
      avisos.push({
        icono: <Briefcase />,
        tono: deuda.length ? "warn" : "ok",
        texto: deuda.length ? (
          <>
            Ya puedes inscribir <strong>{nombreRamo(ctx, r.id)}</strong> debiendo {deuda.map((id) => nombreRamo(ctx, id)).join(", ")}. Si lo repruebas, también repruebas la práctica.
          </>
        ) : (
          <>
            Ya puedes inscribir <strong>{nombreRamo(ctx, r.id)}</strong>.
          </>
        ),
      });
    });
  ctx.cur.ramos
    .filter((r) => r.aviso && !r.reglaPractica && estadoRamo(ctx, r.id, apr) === "disponible")
    .forEach((r) => avisos.push({ icono: <Info />, tono: "info", texto: <><strong>{nombreRamo(ctx, r.id)}:</strong> {r.aviso}</> }));
  // Ramos en riesgo este semestre (proyección bajo 4,0).
  ctx.st.periodos
    .filter((p) => esPeriodoActual(ctx.st, p))
    .flatMap((p) => p.ramos)
    .forEach((e) => {
      const c = calcularRamo(e);
      if (c.cerrado) return;
      if (c.examen?.habilitacion === "no-habilitado") avisos.push({ icono: <TriangleAlert />, tono: "warn", texto: <><strong>{nombreEntrada(ctx, e)}:</strong> no cumples {c.examen.condicionesExamen.find((x) => x.estado === "falla")?.texto ?? "los mínimos"} para dar examen.</> });
      else if (c.reqFallidos.length) avisos.push({ icono: <TriangleAlert />, tono: "warn", texto: <><strong>{nombreEntrada(ctx, e)}:</strong> {c.reqFallidos.join(", ")} ya quedó bajo 4,0 y es requisito para aprobar.</> });
      else if (c.necesaria !== null && c.necesaria > 7) avisos.push({ icono: <TriangleAlert />, tono: "warn", texto: <><strong>{nombreEntrada(ctx, e)}:</strong> con lo que queda ya no alcanza el 4,0.</> });
      else if (c.necesaria !== null && c.necesaria > 5.5)
        avisos.push({ icono: <BellRing />, tono: "warn", texto: <><strong>{nombreEntrada(ctx, e)}:</strong> necesitas {fmtNota(c.necesaria, 1)} en el {fmtNota(c.restante, 0)}% restante para aprobar.</> });
    });

  return (
    <Tarjeta>
      <CabeceraTarjeta icono={<BellRing className="size-[18px]" />} titulo="Avisos para ti" descripcion="Prácticas, ramos en riesgo y otras reglas que te afectan." />
      {avisos.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] font-semibold text-ok">
          <CheckCircle2 className="size-4" /> No tienes avisos por ahora.
        </p>
      ) : (
        <div className="space-y-2">
          {avisos.map((a, i) => (
            <Aviso key={i} tono={a.tono} icono={a.icono}>
              {a.texto}
            </Aviso>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

export function Inicio() {
  const ctx = useCtx();
  const sinNotas = calcularPPA(ctx).ppa === null;
  const [registro, setRegistro] = useState<{ periodo: Periodo; seleccion: SeleccionNota } | null>(null);
  const abrir: AbrirRegistro = (periodo, seleccion) => setRegistro({ periodo, seleccion });
  // El periodo se vuelve a leer del estado: puede haber cambiado mientras el registro estaba abierto.
  const periodo = registro && ctx.st.periodos.find((p) => p.tipo === registro.periodo.tipo && p.numero === registro.periodo.numero);
  return (
    <div className="space-y-5">
      <AvisoCierreSemestre />
      <Checklist />
      <Destacada onRegistrar={abrir} />
      <Resumen />
      {!sinNotas && <SituacionAcademica />}
      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <MisRamos onRegistrar={abrir} />
        <ProximasEvaluaciones />
      </div>
      <AvisosParaTi />
      {sinNotas && <SituacionAcademica />}
      {registro && periodo && <RegistroNota ctx={ctx} periodo={periodo} seleccion={registro.seleccion} onCerrar={() => setRegistro(null)} />}
    </div>
  );
}
