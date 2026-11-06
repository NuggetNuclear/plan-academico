import {
  ArrowLeftRight,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Check,
  ChevronDown,
  FileDown,
  Flag,
  Minus,
  MoveRight,
  PenLine,
  Plus,
  RotateCcw,
  Route,
  Settings2,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { nombreRamo, siglaRamo } from "../core/academic";
import { fechaEgreso, nombrePeriodoCalendario, rutaCritica } from "../core/curriculum";
import { plural } from "../core/format";
import {
  creditosSobrecupo,
  deudaPracticaEnPlan,
  esPracticaSobrecupo,
  guardarPlan,
  idsPendientes,
  intercambiar,
  maxCreditos,
  moverRamo,
  planCoincide,
  puedeMoverRamo,
  type Plan,
  type SemestrePlan,
} from "../core/planner";
import type { ModoPractica } from "../core/state";
import type { Ramo } from "../core/types";
import { escaparHTML, abrirImpresion } from "../lib/imprimir";
import { useApp, useCtx } from "../store/app";
import { confirmar, toast, useUI } from "../store/ui";
import { colorTipo } from "../ui/comun";
import { OpcionMenu, Popover } from "../ui/overlays";
import { Aviso, Boton, Tarjeta, cx } from "../ui/primitives";
import { usePlanes } from "./plan/usePlanes";

/** Qué plan se está mirando: el guardado o uno de los generados. Se conserva al cambiar de sección. */
type Viendo = "guardado" | number;
let viendoRecordado: Viendo | null = null;

function etiquetaSemestre(sem: SemestrePlan, verano: string) {
  if (sem.tipo === "cursando") return `Semestre ${sem.numero} · en curso`;
  if (sem.tipo === "overflow") return "Por definir";
  if (sem.tipo === "verano") return `${verano} ${sem.numero}`;
  return `Semestre ${sem.numero}`;
}

function exportarPlan(plan: Plan, titulo: string, carrera: string, verano: string, nombre: (id: string) => string, sigla: (id: string) => string) {
  const filas = plan.semestres
    .map(
      (s) =>
        `<tr><td style="white-space:nowrap;font-weight:700">${escaparHTML(etiquetaSemestre(s, verano))}</td><td>${s.ramos.map((r) => `<span class="mono">${escaparHTML(sigla(r.id))}</span> ${escaparHTML(nombre(r.id))}`).join("<br>")}</td><td class="num">${s.creditos} cr</td></tr>`,
    )
    .join("");
  abrirImpresion(titulo, carrera, `<table><tr><th style="width:150px">Periodo</th><th>Ramos</th><th style="width:70px">Créditos</th></tr>${filas}</table>`);
}

/** Último semestre con ramos por cursar (incluye los que aún no caben). */
function ultimoSemestre(plan: Plan): number | null {
  return plan.semestres.filter((s) => s.tipo === "futuro" || s.tipo === "overflow").at(-1)?.numero ?? null;
}

/** Un ramo del plan: nombre, créditos y avisos de práctica; en modo edición, el botón para moverlo. */
function FilaRamo({ ramo, sem, plan, editando, onMover }: { ramo: Ramo; sem: SemestrePlan; plan: Plan; editando: boolean; onMover: (ramo: Ramo, origen: number, el: HTMLElement) => void }) {
  const ctx = useCtx();
  const deuda = ramo.reglaPractica ? deudaPracticaEnPlan(ctx, plan, sem, ramo) : [];
  const sobrecupo = sem.tipo !== "verano" && esPracticaSobrecupo(ctx, ramo);
  const movible = editando && sem.tipo === "futuro";
  return (
    <li className="flex items-center gap-3 py-2">
      <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full" style={{ background: colorTipo(ctx.cur, ramo.tipo) }} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[14px] leading-snug font-semibold">
          {nombreRamo(ctx, ramo.id)}
          {ramo.reglaPractica && <Briefcase aria-label="Práctica profesional" className="size-3.5 shrink-0 text-fg-3" />}
        </p>
        <p className="text-[12px] text-fg-3">
          {ramo.creditos} créditos
          {sobrecupo && <span className="font-semibold text-warn"> · no cuenta en tu máximo (sobrecupo)</span>}
        </p>
        {deuda.length > 0 && (
          <p className="text-[12px] font-semibold text-warn">
            Llegas debiendo {deuda.map((id) => nombreRamo(ctx, id)).join(", ")}
            {sem.tipo === "verano" ? ": apruébalo el semestre siguiente." : ". Si lo repruebas, repruebas la práctica."}
          </p>
        )}
      </div>
      {movible && (
        <Boton tamano="sm" variante="suave" icono={<MoveRight className="size-4" />} onClick={(e) => onMover(ramo, sem.numero, e.currentTarget)} aria-label={`Mover ${nombreRamo(ctx, ramo.id)} a otro semestre`}>
          Mover
        </Boton>
      )}
    </li>
  );
}

function ListaRamos(props: { sem: SemestrePlan; plan: Plan; editando: boolean; onMover: (ramo: Ramo, origen: number, el: HTMLElement) => void }) {
  return (
    <ul className="divide-y divide-line">
      {props.sem.ramos.map((r) => (
        <FilaRamo key={r.id} ramo={r} {...props} />
      ))}
    </ul>
  );
}

/** Créditos del semestre y, si hay congelaciones, a qué mitad del año corresponde. */
function DetalleSemestre({ sem }: { sem: SemestrePlan }) {
  const ctx = useCtx();
  const sobre = sem.tipo === "verano" ? 0 : creditosSobrecupo(ctx, sem.ramos);
  return (
    <>
      {sem.creditos} créditos{sobre > 0 && ` + ${sobre} en sobrecupo`}
      {ctx.st.congelaciones.length > 0 && sem.tipo === "futuro" && ` · ${nombrePeriodoCalendario(sem.numero, ctx.st.congelaciones)}`}
    </>
  );
}

/** Un semestre de la línea de tiempo: cerrado muestra un adelanto; abierto, todos sus ramos. */
function SemestreLinea({ sem, plan, editando, onMover, verano }: { sem: SemestrePlan; plan: Plan; editando: boolean; onMover: (ramo: Ramo, origen: number, el: HTMLElement) => void; verano: string }) {
  const ctx = useCtx();
  const nombres = sem.ramos.map((r) => nombreRamo(ctx, r.id));
  const adelanto = nombres.slice(0, 3).join(", ") + (nombres.length > 3 ? ` y ${nombres.length - 3} más` : "");
  return (
    <li className="relative pl-7">
      <span aria-hidden="true" className={cx("absolute top-4 left-0 size-3 rounded-full border-2", sem.tipo === "overflow" ? "border-warn bg-warn-soft" : sem.tipo === "verano" ? "border-warn bg-surface" : "border-accent bg-surface")} />
      <details open={editando || undefined} className="group rounded-2xl transition-colors open:bg-surface-2">
        <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1.5 text-[14px] font-bold">
              {sem.tipo === "verano" && <Sun aria-hidden="true" className="size-4 text-warn" />}
              {sem.tipo === "overflow" && <TriangleAlert aria-hidden="true" className="size-4 text-warn" />}
              {etiquetaSemestre(sem, verano)}
              <span className="font-normal text-fg-3">
                · <DetalleSemestre sem={sem} />
              </span>
            </h3>
            <p className="truncate text-[12.5px] text-fg-2 group-open:hidden">{adelanto}</p>
          </div>
          <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-2">
          {sem.tipo === "overflow" && <p className="pb-1 text-[12.5px] text-warn">Estos ramos no caben con tu máximo de créditos. Súbelo o revisa tu malla.</p>}
          <ListaRamos sem={sem} plan={plan} editando={editando} onMover={onMover} />
        </div>
      </details>
    </li>
  );
}

export function Planificacion() {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const irA = useUI((s) => s.irA);
  const { planes, guardado, actualizarPlan, restaurar, editado } = usePlanes();
  const [viendoEstado, setViendoEstado] = useState<Viendo>(viendoRecordado ?? (guardado ? "guardado" : 0));
  const [editando, setEditando] = useState(false);
  const [mover, setMover] = useState<{ ramo: Ramo; origen: number } | null>(null);
  const anclaMover = useRef<HTMLElement | null>(null);
  const critica = useMemo(() => rutaCritica(ctx.cur, idsPendientes(ctx)), [ctx]);
  const practicas = ctx.cur.ramos.filter((r) => r.reglaPractica);
  const max = maxCreditos(ctx);
  const verano = ctx.cur.malla.periodoVerano ?? "Semestre de verano";

  // Si el plan que se miraba ya no existe (se quitó el guardado o hay menos opciones), vuelve al sugerido.
  const viendo: Viendo = viendoEstado === "guardado" ? (guardado ? "guardado" : 0) : viendoEstado < planes.length ? viendoEstado : 0;
  const ver = (v: Viendo) => {
    viendoRecordado = v;
    setViendoEstado(v);
    setEditando(false);
    setMover(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const plan = viendo === "guardado" ? guardado : planes[viendo];
  const esGuardado = viendo === "guardado";
  const setMax = (v: number) => mutar(null, ({ st }) => (st.maxCreditos = Math.max(5, Math.min(ctx.cur.maxCreditosSemestre, v))));

  if (!plan || (!esGuardado && planes.length === 0)) {
    return (
      <Tarjeta className="flex flex-col items-center gap-2 py-10 text-center">
        <Flag className="size-7 text-ok" />
        <h2 className="text-[17px] font-bold">No te quedan ramos por planificar</h2>
        <p className="text-[13.5px] text-fg-2">Completaste tu malla. Si algo no cuadra, revísalo en Mi malla.</p>
      </Tarjeta>
    );
  }

  const ultimo = ultimoSemestre(plan);
  const futuros = plan.semestres.filter((s) => s.tipo !== "cursando");
  const proximo = futuros[0];
  const despues = futuros.slice(1);
  const restantes = plan.semestres.filter((s) => s.tipo === "futuro" || s.tipo === "overflow").length;
  const yaGuardado = !esGuardado && planCoincide(plan, ctx.st.planFijado);
  const hayOverflow = plan.semestres.some((s) => s.tipo === "overflow");
  const nombrePlan = esGuardado ? "Tu plan guardado" : viendo === 0 ? "Plan sugerido" : `Otra opción · ${plan.etiqueta}`;

  const aplicar = (ramoId: string, origen: number, destino: number) => {
    if (esGuardado) return;
    if (puedeMoverRamo(ctx, plan, ramoId, origen, destino)) {
      actualizarPlan(viendo, moverRamo(ctx, plan, ramoId, origen, destino));
      toast(`${nombreRamo(ctx, ramoId)} pasó al semestre ${destino}`);
    } else toast("No se puede mover ahí: no cumple requisitos, créditos o reglas de práctica.", "error");
  };
  const abrirMover = (ramo: Ramo, origen: number, el: HTMLElement) => {
    anclaMover.current = el;
    setMover({ ramo, origen });
  };
  const destinos = mover ? plan.semestres.filter((s) => s.tipo === "futuro" && s.numero !== mover.origen && puedeMoverRamo(ctx, plan, mover.ramo.id, mover.origen, s.numero)) : [];

  // Otras formas de ordenar los ramos, distintas de la que se está mirando.
  const otras: { v: Viendo; titulo: string; detalle: string; fin: number | null }[] = [
    ...(guardado && !esGuardado ? [{ v: "guardado" as Viendo, titulo: "Tu plan guardado", detalle: `El que guardaste el ${new Date(ctx.st.planFijado!.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}.`, fin: ultimoSemestre(guardado) }] : []),
    ...planes.map((p, i) => ({ v: i as Viendo, titulo: i === 0 ? "Plan sugerido" : p.etiqueta, detalle: p.descripcion, fin: ultimoSemestre(p) })).filter((o) => o.v !== viendo),
  ];

  const boton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[13.5px] font-bold transition-colors";
  return (
    <div className="space-y-5">
      {/* 1. La respuesta: cuándo terminas y con cuántos créditos por semestre. */}
      <section aria-labelledby="plan-titulo" className="hero relative overflow-clip rounded-[1.75rem] p-5 sm:p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-3 py-1.5 text-[12px] font-bold">
          {esGuardado ? <BookmarkCheck aria-hidden="true" className="size-3.5" /> : <Flag aria-hidden="true" className="size-3.5" />} {nombrePlan}
        </span>
        <h2 id="plan-titulo" className="mt-3 text-[24px] leading-[1.15] font-extrabold tracking-[-0.03em] sm:text-[30px]">
          {ultimo !== null ? <>Terminas la carrera el {fechaEgreso(ctx.st.semestreActual, ultimo, ctx.st.congelaciones)}</> : "No te quedan ramos por planificar"}
        </h2>
        <p className="mt-1.5 max-w-2xl text-[14.5px] font-medium text-white/85">
          Te {restantes === 1 ? "queda" : "quedan"} {plural(restantes, "semestre")}, tomando unos {plan.creditosPorSemestre} créditos en cada uno.
          {!esGuardado && viendo === 0 && " Es el orden que te abre más ramos antes."}
        </p>
        {!esGuardado && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] font-semibold">
            <span id="plan-max">Máximo de créditos por semestre</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.14] p-1" role="group" aria-labelledby="plan-max">
              <button type="button" aria-label="Menos créditos" className="grid size-8 place-items-center rounded-full hover:bg-white/20" onClick={() => setMax(max - 1)}>
                <Minus className="size-4" />
              </button>
              <span aria-live="polite" className="w-8 text-center text-[16px] font-extrabold tabular">{max}</span>
              <button type="button" aria-label="Más créditos" className="grid size-8 place-items-center rounded-full hover:bg-white/20 disabled:opacity-40" disabled={max >= ctx.cur.maxCreditosSemestre} onClick={() => setMax(max + 1)}>
                <Plus className="size-4" />
              </button>
            </span>
            <span className="text-white/70">tope de tu carrera: {ctx.cur.maxCreditosSemestre}</span>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!esGuardado &&
            (yaGuardado ? (
              <span className={cx(boton, "bg-white/[0.16]")}>
                <Check className="size-4" /> Es tu plan guardado
              </span>
            ) : (
              <button
                type="button"
                className={cx(boton, "bg-white text-[#3a28c4] shadow-[0_6px_20px_-6px_rgb(0_0_0/0.35)] hover:-translate-y-px")}
                onClick={() => {
                  mutar("Guardar plan", (c) => (c.st.planFijado = guardarPlan(c, plan)));
                  viendoRecordado = "guardado";
                  setViendoEstado("guardado");
                  setEditando(false);
                  toast("Plan guardado. Lo verás aquí y en Inicio.");
                }}
              >
                <Bookmark className="size-4" /> Guardar este plan
              </button>
            ))}
          {!esGuardado && (
            <button type="button" aria-pressed={editando} className={cx(boton, editando ? "bg-white text-[#3a28c4]" : "bg-white/[0.16] hover:bg-white/25")} onClick={() => {
                setMover(null);
                setEditando((v) => !v);
              }}>
              {editando ? <Check className="size-4" /> : <PenLine className="size-4" />} {editando ? "Listo" : "Cambiar ramos de semestre"}
            </button>
          )}
          {!esGuardado && editado && viendo === 0 && (
            <button type="button" className={cx(boton, "bg-white/[0.16] hover:bg-white/25")} onClick={restaurar}>
              <RotateCcw className="size-4" /> Deshacer mis cambios
            </button>
          )}
          {esGuardado && (
            <button
              type="button"
              className={cx(boton, "bg-white/[0.16] hover:bg-white/25")}
              onClick={async () => {
                if (await confirmar({ titulo: "Dejar de usar tu plan guardado", mensaje: "Volverás a ver el plan sugerido. Puedes guardar otro cuando quieras.", aceptar: "Dejar de usarlo" }))
                  mutar("Quitar plan guardado", ({ st }) => (st.planFijado = null));
              }}
            >
              Dejar de usarlo
            </button>
          )}
          <button
            type="button"
            className={cx(boton, "bg-white/[0.16] hover:bg-white/25")}
            onClick={() => exportarPlan(plan, esGuardado ? "Mi plan de semestres" : "Planificación de semestres", ctx.cur.malla.carrera, verano, (id) => nombreRamo(ctx, id), (id) => siglaRamo(ctx, id))}
          >
            <FileDown className="size-4" /> PDF
          </button>
        </div>
      </section>

      {esGuardado && ctx.st.planFijado!.semestreBase !== ctx.st.semestreActual && (
        <Aviso tono="warn" icono={<TriangleAlert />}>
          Guardaste este plan cuando ibas en el semestre {ctx.st.planFijado!.semestreBase}. Si tu avance cambió, revisa el plan sugerido y guárdalo de nuevo.
        </Aviso>
      )}
      {hayOverflow && (
        <Aviso tono="warn" icono={<TriangleAlert />}>
          Algunos ramos no caben con tu máximo de créditos actual. Súbelo o revisa tu malla; los verás al final como «Por definir».
        </Aviso>
      )}
      {editando && (
        <Aviso tono="acento" icono={<PenLine />}>
          Toca <strong>Mover</strong> en un ramo para pasarlo a otro semestre. Solo aparecen los semestres donde cumple requisitos y cabe en tus créditos.
        </Aviso>
      )}

      {/* 2. Lo que hay que hacer ahora: qué inscribir el próximo semestre. */}
      {proximo && (
        <Tarjeta>
          <p className="text-[12.5px] font-semibold text-fg-2">Tu próximo semestre · {etiquetaSemestre(proximo, verano)}</p>
          <h2 className="mt-0.5 text-[18px] font-bold tracking-tight">
            Inscribe {plural(proximo.ramos.length, "ramo")} <span className="font-semibold text-fg-3">· <DetalleSemestre sem={proximo} /></span>
          </h2>
          <div className="mt-2">
            <ListaRamos sem={proximo} plan={plan} editando={editando} onMover={abrirMover} />
          </div>
        </Tarjeta>
      )}

      {/* 3. El resto de la carrera, en orden. */}
      {despues.length > 0 && (
        <section aria-labelledby="plan-despues">
          <h2 id="plan-despues" className="mb-2 px-1 text-[17px] font-bold tracking-tight">
            Después <span className="text-[13px] font-semibold text-fg-3">· toca un semestre para ver sus ramos</span>
          </h2>
          <ol className="card relative space-y-1 p-3 before:absolute before:top-8 before:bottom-8 before:left-[1.05rem] before:w-0.5 before:bg-line sm:p-4 sm:before:left-[1.3rem]">
            {despues.map((s) => (
              <SemestreLinea key={`${s.tipo}-${s.numero}`} sem={s} plan={plan} editando={editando} onMover={abrirMover} verano={verano} />
            ))}
          </ol>
        </section>
      )}

      {editando && plan.intercambios.length > 0 && (
        <section aria-labelledby="plan-cambios" className="card p-4">
          <h2 id="plan-cambios" className="flex items-center gap-2 text-[15px] font-bold">
            <ArrowLeftRight aria-hidden="true" className="size-4 text-accent" /> Cambios que no alargan tu carrera
          </h2>
          <p className="mt-0.5 text-[12.5px] text-fg-2">Intercambia dos ramos de semestre con un toque.</p>
          <div className="mt-3 grid gap-1.5 md:grid-cols-2">
            {plan.intercambios.slice(0, 6).map((sw) => (
              <button
                key={sw.ramo1 + sw.ramo2}
                type="button"
                onClick={() => {
                  actualizarPlan(viendo as number, intercambiar(ctx, plan, sw));
                  toast(`${nombreRamo(ctx, sw.ramo1)} y ${nombreRamo(ctx, sw.ramo2)} cambiaron de semestre`);
                }}
                className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-accent-soft"
              >
                <span className="min-w-0 flex-1 break-words font-semibold">
                  {nombreRamo(ctx, sw.ramo1)} <span className="font-normal text-fg-3">(sem. {sw.sem1})</span>
                </span>
                <ArrowLeftRight aria-hidden="true" className="size-3.5 shrink-0 text-fg-3" />
                <span className="min-w-0 flex-1 break-words text-right font-semibold">
                  {nombreRamo(ctx, sw.ramo2)} <span className="font-normal text-fg-3">(sem. {sw.sem2})</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 4. Otras formas de ordenar los ramos. */}
      {otras.length > 0 && (
        <section aria-labelledby="plan-otras">
          <h2 id="plan-otras" className="mb-2 px-1 text-[17px] font-bold tracking-tight">Otras formas de ordenar tus ramos</h2>
          <ul className="card divide-y divide-line">
            {otras.map((o) => (
              <li key={String(o.v)} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{o.titulo}</p>
                  <p className="text-[12.5px] text-fg-2">
                    {o.detalle}
                    {o.fin !== null && <> Terminas el {fechaEgreso(ctx.st.semestreActual, o.fin, ctx.st.congelaciones)}.</>}
                  </p>
                </div>
                <Boton tamano="sm" variante="suave" icono={<ArrowRight className="size-4" />} onClick={() => ver(o.v)}>
                  Ver
                </Boton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. Lo avanzado, plegado. */}
      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-[14px] font-bold [&::-webkit-details-marker]:hidden">
          <Settings2 aria-hidden="true" className="size-4 text-fg-3" /> Más opciones
          <ChevronDown aria-hidden="true" className="ml-auto size-4 text-fg-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 px-4 pb-4">
          {practicas.length > 0 && (
            <div className="max-w-sm">
              <label className="label" htmlFor="modo-practica">
                <Briefcase className="mr-1 inline size-3.5" /> ¿Cuándo hacer la práctica profesional?
              </label>
              <select id="modo-practica" className="input" value={ctx.st.modoPractica} onChange={(e) => mutar("Modo de práctica", ({ st }) => (st.modoPractica = e.target.value as ModoPractica))}>
                <option value="carga">Dentro de los créditos del semestre</option>
                <option value="sobrecupo">Aparte, sin contar en el máximo (sobrecupo)</option>
                <option value="verano">En {verano.toLowerCase()}</option>
                <option value="quitar">No planificarla</option>
              </select>
            </div>
          )}
          {critica.length > 1 && (
            <div className="rounded-2xl bg-surface-2 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-bold">
                <Route aria-hidden="true" className="size-4 text-danger" /> Necesitas al menos {plural(critica.length, "semestre")} más
              </p>
              <p className="mt-0.5 text-[12.5px] text-fg-2">Por esta cadena de requisitos, aunque tomes más créditos no puedes terminar antes:</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed font-semibold">{critica.map((id) => nombreRamo(ctx, id)).join(" → ")}</p>
            </div>
          )}
          <button type="button" onClick={() => irA("malla")} className="flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
            ¿Algo no cuadra? Corrígelo en Mi malla <ArrowRight className="size-4" />
          </button>
        </div>
      </details>

      <p className="px-1 text-[12px] text-fg-3">
        El plan respeta requisitos, tu máximo de créditos y las reglas de práctica. No puede garantizar horarios, cupos ni que un ramo se dicte: confírmalo con tu universidad antes de inscribir.
      </p>

      <Popover ancla={anclaMover} abierto={!!mover && editando && !esGuardado} onCerrar={() => setMover(null)} ancho={240}>
        <p className="px-2.5 py-1 text-[11.5px] font-bold text-fg-3">Mover a…</p>
        {destinos.length === 0 && <p className="px-2.5 py-2 text-[12.5px] text-fg-2">No hay otro semestre donde quepa y cumpla requisitos.</p>}
        {destinos.map((s) => (
          <OpcionMenu
            key={s.numero}
            onClick={() => {
              aplicar(mover!.ramo.id, mover!.origen, s.numero);
              setMover(null);
            }}
            descripcion={`Hoy tiene ${s.creditos} créditos`}
          >
            Semestre {s.numero}
          </OpcionMenu>
        ))}
      </Popover>
    </div>
  );
}
