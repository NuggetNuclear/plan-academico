import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import {
  ArrowLeftRight,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  CalendarRange,
  Check,
  ChevronDown,
  FileDown,
  Flag,
  GripVertical,
  Minus,
  MoveRight,
  Plus,
  RotateCcw,
  Route,
  Snowflake,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { creditosCurriculares, nombreRamo, ramosSemestreActual, resumenCreditos, siglaRamo } from "../core/academic";
import { nombrePeriodoCalendario, rutaCritica } from "../core/curriculum";
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
import { Aviso, Boton, BotonIcono, Insignia, Tarjeta, cx } from "../ui/primitives";
import { fechaEgreso, usePlanes } from "./plan/usePlanes";

function Paso({ n, titulo, children, descripcion }: { n: number; titulo: string; descripcion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Tarjeta className="relative">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-extrabold text-accent-fg">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-[13px] text-fg-2">{descripcion}</p>}
        </div>
      </div>
      <div className="mt-3 sm:pl-12">{children}</div>
    </Tarjeta>
  );
}

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

// ── Ramo arrastrable ──
function RamoPlan({ ramo, idPlan, sem, editable, deuda, sobrecupo, onMover }: { ramo: Ramo; idPlan: number; sem: SemestrePlan; editable: boolean; deuda: string[]; sobrecupo: boolean; onMover?: (el: HTMLElement) => void }) {
  const ctx = useCtx();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: `${idPlan}|${ramo.id}|${sem.numero}`, disabled: !editable, data: { ramo, origen: sem.numero, idPlan } });
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        ref.current = el;
      }}
      className={cx(
        "group relative flex items-start gap-1.5 overflow-hidden rounded-lg border border-line bg-surface py-1.5 pr-1.5 pl-3 text-[12px] shadow-soft",
        isDragging && "opacity-30",

      )}
      title={ramo.reglaPractica ? "Práctica profesional: exige todo aprobado hasta su semestre" : editable ? "Arrastra para mover a otro semestre" : undefined}
    >
      {editable && <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-roledescription="ramo arrastrable" aria-label={`Arrastrar ${nombreRamo(ctx, ramo.id)}`} className="grid min-h-8 min-w-8 touch-none place-items-center rounded text-fg-2 hover:bg-surface-2"><GripVertical className="size-4" /></button>}
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: colorTipo(ctx.cur, ramo.tipo) }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-mono text-[10px] font-semibold text-fg-3">
          {siglaRamo(ctx, ramo.id)}
          {ramo.reglaPractica && <Briefcase className="size-3" />}
        </p>
        <p className="leading-snug font-semibold">{nombreRamo(ctx, ramo.id)}</p>
        {(deuda.length > 0 || sobrecupo) && (
          <p className="mt-0.5 text-[10.5px] font-semibold text-warn">
            {[sobrecupo && "Sobrecupo", deuda.length && `Debes ${deuda.map((id) => siglaRamo(ctx, id)).join(", ")}${sem.tipo === "verano" ? ": apruébalo el semestre siguiente" : ": si lo repruebas, repruebas la práctica"}`].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10.5px] font-semibold text-fg-3 tabular">{creditosCurriculares(ctx, ramo)}</span>
      {editable && onMover && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={() => ref.current && onMover(ref.current)}
          className="-mr-0.5 grid size-5 shrink-0 place-items-center rounded text-fg-3 opacity-60 hover:bg-surface-2 hover:text-accent group-hover:opacity-100"
          aria-label={`Mover ${nombreRamo(ctx, ramo.id)} a otro semestre`}
          title="Mover a otro semestre"
        >
          <MoveRight className="size-3.5" />
        </button>
      )}
      {editable && !onMover && <GripVertical className="size-3.5 shrink-0 text-fg-3" />}
    </div>
  );
}

function ColumnaSemestre({ sem, plan, idPlan, editable, arrastrando, onMover }: { sem: SemestrePlan; plan: Plan; idPlan: number; editable: boolean; arrastrando: { ramo: Ramo; origen: number } | null; onMover: (ramo: Ramo, origen: number, el: HTMLElement) => void }) {
  const ctx = useCtx();
  const droppable = editable && sem.tipo === "futuro";
  const { setNodeRef, isOver } = useDroppable({ id: `${idPlan}|${sem.numero}`, disabled: !droppable, data: { numero: sem.numero } });
  const max = maxCreditos(ctx);
  const valido = arrastrando && droppable && arrastrando.origen !== sem.numero ? puedeMoverRamo(ctx, plan, arrastrando.ramo.id, arrastrando.origen, sem.numero) : null;
  const sobrecupo = sem.tipo === "verano" ? 0 : creditosSobrecupo(ctx, sem.ramos);
  const verano = ctx.cur.malla.periodoVerano ?? "Verano";
  const pct = Math.min(100, (sem.creditos / max) * 100);
  return (
    <section
      ref={setNodeRef}
      aria-label={etiquetaSemestre(sem, verano)}
      className={cx(
        "flex w-[208px] shrink-0 flex-col gap-1.5 rounded-2xl border p-2.5 transition-colors",
        sem.tipo === "cursando" ? "border-info/30 bg-info-soft" : sem.tipo === "verano" ? "border-warn/30 bg-warn-soft" : sem.tipo === "overflow" ? "border-danger/30 bg-danger-soft" : "border-line bg-surface-2/60",
        valido === true && "border-ok bg-ok-soft",
        valido === true && isOver && "ring-2 ring-ok",
        valido === false && "opacity-50",
      )}
    >
      <header className="px-0.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1 text-[12.5px] font-bold">
            {sem.tipo === "verano" && <Sun className="size-3.5" />}
            {etiquetaSemestre(sem, verano)}
          </h3>
          <span className="text-[11px] font-bold tabular text-fg-2">
            {sem.creditos} cr{sobrecupo ? <span className="text-warn"> +{sobrecupo}</span> : null}
          </span>
        </div>
        {sem.tipo === "futuro" && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3" title={`${sem.creditos} de ${max} créditos`}>
            <div className={cx("h-full rounded-full", pct > 99 ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} />
          </div>
        )}
        {ctx.st.congelaciones.length > 0 && sem.tipo !== "overflow" && sem.tipo !== "verano" && (
          <p className="mt-1 flex items-center gap-1 text-[10.5px] text-info">
            <Snowflake className="size-3" /> {nombrePeriodoCalendario(sem.numero, ctx.st.congelaciones)}
          </p>
        )}
      </header>
      {sem.ramos.map((r) => (
        <RamoPlan
          key={r.id}
          ramo={r}
          idPlan={idPlan}
          sem={sem}
          editable={droppable}
          deuda={r.reglaPractica ? deudaPracticaEnPlan(ctx, plan, sem, r) : []}
          sobrecupo={sem.tipo !== "verano" && esPracticaSobrecupo(ctx, r)}
          onMover={droppable ? (el) => onMover(r, sem.numero, el) : undefined}
        />
      ))}
    </section>
  );
}

function GrillaPlan({ plan, idPlan, editable, onCambiar }: { plan: Plan; idPlan: number; editable: boolean; onCambiar?: (p: Plan) => void }) {
  const ctx = useCtx();
  const [arrastrando, setArrastrando] = useState<{ ramo: Ramo; origen: number } | null>(null);
  const [mover, setMover] = useState<{ ramo: Ramo; origen: number } | null>(null);
  const anclaMover = useRef<HTMLElement | null>(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const aplicar = (ramoId: string, origen: number, destino: number) => {
    if (!onCambiar) return;
    if (puedeMoverRamo(ctx, plan, ramoId, origen, destino)) {
      onCambiar(moverRamo(ctx, plan, ramoId, origen, destino));
      toast(`${siglaRamo(ctx, ramoId)} movido al semestre ${destino}`);
    } else toast("No se puede mover ahí (requisitos, créditos u oferta anual).", "error");
  };
  const onStart = (e: DragStartEvent) => setArrastrando({ ramo: e.active.data.current!.ramo, origen: e.active.data.current!.origen });
  const onEnd = (e: DragEndEvent) => {
    setArrastrando(null);
    const destino = e.over?.data.current?.numero as number | undefined;
    const d = e.active.data.current;
    if (destino === undefined || !d || destino === d.origen) return;
    aplicar(d.ramo.id, d.origen, destino);
  };
  const destinosValidos = mover ? plan.semestres.filter((s) => s.tipo === "futuro" && s.numero !== mover.origen && puedeMoverRamo(ctx, plan, mover.ramo.id, mover.origen, s.numero)) : [];

  return (
    <DndContext sensors={sensores} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setArrastrando(null)}>
      <div className="scroll-x -mx-1 px-1 pb-2">
        <div className="flex items-start gap-2.5">
          {plan.semestres.map((s) => (
            <ColumnaSemestre
              key={`${s.tipo}-${s.numero}`}
              sem={s}
              plan={plan}
              idPlan={idPlan}
              editable={editable}
              arrastrando={arrastrando}
              onMover={(ramo, origen, el) => {
                anclaMover.current = el;
                setMover({ ramo, origen });
              }}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {arrastrando && (
          <div className="w-[188px] rotate-2 rounded-lg border border-accent bg-surface px-3 py-2 text-[12px] font-semibold shadow-pop">
            <p className="font-mono text-[10px] text-fg-3">{siglaRamo(ctx, arrastrando.ramo.id)}</p>
            {nombreRamo(ctx, arrastrando.ramo.id)}
          </div>
        )}
      </DragOverlay>
      <Popover ancla={anclaMover} abierto={!!mover} onCerrar={() => setMover(null)} ancho={220}>
        <p className="px-2.5 py-1 text-[11.5px] font-bold text-fg-3">Mover a…</p>
        {destinosValidos.length === 0 && <p className="px-2.5 py-2 text-[12.5px] text-fg-2">No hay otro semestre válido (requisitos, créditos u oferta anual).</p>}
        {destinosValidos.map((s) => (
          <OpcionMenu
            key={s.numero}
            onClick={() => {
              aplicar(mover!.ramo.id, mover!.origen, s.numero);
              setMover(null);
            }}
            descripcion={`${s.creditos} cr actualmente`}
          >
            Semestre {s.numero}
          </OpcionMenu>
        ))}
      </Popover>
    </DndContext>
  );
}

function TarjetaPlan({ plan, idx, recomendado, onCambiar, editado, onRestaurar }: { plan: Plan; idx: number; recomendado?: boolean; onCambiar: (p: Plan) => void; editado?: boolean; onRestaurar?: () => void }) {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const [abierto, setAbierto] = useState(!!recomendado);
  const guardado = planCoincide(plan, ctx.st.planFijado);
  const verano = ctx.cur.malla.periodoVerano ?? "Verano";
  const ultimo = plan.semestres.filter((s) => s.tipo === "futuro").at(-1)?.numero;
  return (
    <article className={cx("overflow-hidden rounded-2xl border", recomendado ? "border-accent-line" : "border-line")}>
      <header className={cx("flex flex-wrap items-center gap-3 px-4 py-3", recomendado && "bg-accent-soft")}>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
          <ChevronDown className={cx("size-4 shrink-0 text-fg-3 transition-transform", !abierto && "-rotate-90")} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              {recomendado && <Insignia tono="acento">Recomendado</Insignia>}
              <strong className="text-[14px]">{plan.etiqueta}</strong>
              {editado && <Insignia tono="warn">Editado</Insignia>}
            </span>
            {plan.descripcion && <span className="block text-[12px] text-fg-2">{plan.descripcion}</span>}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          <Insignia icono={<CalendarRange className="size-3" />}>{plural(plan.semestresRestantes, "semestre")}</Insignia>
          <Insignia>~{plan.creditosPorSemestre} cr/sem</Insignia>
          <Insignia>máx {plan.creditosMaximos} cr</Insignia>
          {ultimo && <Insignia tono="ok" icono={<Flag className="size-3" />}>{fechaEgreso(ctx.st.semestreActual, ultimo)}</Insignia>}
        </div>
        <div className="flex items-center gap-1.5">
          {editado && onRestaurar && (
            <BotonIcono etiqueta="Volver al plan original" onClick={onRestaurar}>
              <RotateCcw className="size-4" />
            </BotonIcono>
          )}
          <BotonIcono etiqueta="Exportar este plan a PDF" onClick={() => exportarPlan(plan, "Planificación de semestres", ctx.cur.malla.carrera, verano, (id) => nombreRamo(ctx, id), (id) => siglaRamo(ctx, id))}>
            <FileDown className="size-4" />
          </BotonIcono>
          <Boton
            tamano="sm"
            variante={guardado ? "secundario" : "primario"}
            disabled={guardado}
            icono={guardado ? <Check className="size-4" /> : <Bookmark className="size-4" />}
            onClick={() => {
              mutar("Guardar plan", (c) => (c.st.planFijado = guardarPlan(c, plan)));
              toast("Plan guardado. Lo verás aquí y en Inicio.");
            }}
          >
            {guardado ? "Es tu plan guardado" : "Quedarme con este plan"}
          </Boton>
        </div>
      </header>
      {abierto && (
        <div className="space-y-3 p-4">
          <GrillaPlan plan={plan} idPlan={idx} editable onCambiar={onCambiar} />
          {plan.intercambios.length > 0 && (
            <details className="group rounded-xl border border-line">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-bold">
                <ArrowLeftRight className="size-4 text-accent" /> Ajustes sugeridos ({Math.min(6, plan.intercambios.length)})
                <ChevronDown className="ml-auto size-4 text-fg-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-1.5 px-3 pb-3 md:grid-cols-2">
                {plan.intercambios.slice(0, 6).map((sw) => (
                  <button
                    key={sw.ramo1 + sw.ramo2}
                    type="button"
                    onClick={() => {
                      onCambiar(intercambiar(ctx, plan, sw));
                      toast(`${siglaRamo(ctx, sw.ramo1)} ↔ ${siglaRamo(ctx, sw.ramo2)} intercambiados`);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-[12px] transition-colors hover:border-accent hover:bg-accent-soft"
                  >
                    <span className="rounded bg-surface-3 px-1.5 font-bold tabular">S{sw.sem1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{nombreRamo(ctx, sw.ramo1)}</span>
                    <ArrowLeftRight className="size-3.5 shrink-0 text-fg-3" />
                    <span className="min-w-0 flex-1 truncate text-right font-semibold">{nombreRamo(ctx, sw.ramo2)}</span>
                    <span className="rounded bg-surface-3 px-1.5 font-bold tabular">S{sw.sem2}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

export function Planificacion() {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const irA = useUI((s) => s.irA);
  const { planes, guardado, actualizarPlan, restaurar, editado } = usePlanes();
  const [alternativas, setAlternativas] = useState(false);
  const cred = useMemo(() => resumenCreditos(ctx), [ctx]);
  const cursando = ramosSemestreActual(ctx).length;
  const faltan = Math.max(0, cred.total - cred.avance - cred.cursando);
  const critica = useMemo(() => rutaCritica(ctx.cur, idsPendientes(ctx)), [ctx]);
  const practicas = ctx.cur.ramos.filter((r) => r.reglaPractica);
  const max = maxCreditos(ctx);
  const verano = ctx.cur.malla.periodoVerano ?? "Semestre de verano";

  const setMax = (v: number) => mutar(null, ({ st }) => (st.maxCreditos = Math.max(5, Math.min(ctx.cur.maxCreditosSemestre, v))));

  return (
    <div className="space-y-4">
      <Paso n={1} titulo="Tu punto de partida">
        <p className="text-[13.5px] leading-relaxed">
          Vas en el <strong>semestre {ctx.st.semestreActual}</strong> · <strong>{cred.avance}</strong> de {cred.total} créditos aprobados ·{" "}
          {cursando > 0 ? <>cursando <strong>{plural(cursando, "ramo")}</strong> · </> : "sin ramos en curso · "}
          te faltan <strong>{faltan} créditos</strong>.
        </p>
        {critica.length > 1 && (
          <div className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3">
            <p className="flex items-center gap-2 text-[13px] font-bold">
              <Route className="size-4 text-danger" /> Ruta crítica: mínimo {plural(critica.length, "semestre")} más
            </p>
            <ol className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px]">
              {critica.map((id, i) => (
                <li key={id} className="flex items-center gap-1">
                  <span className="rounded-md bg-surface px-1.5 py-0.5 font-semibold" title={nombreRamo(ctx, id)}>
                    {siglaRamo(ctx, id)}
                  </span>
                  {i < critica.length - 1 && <ArrowRight className="size-3 text-fg-3" />}
                </li>
              ))}
            </ol>
          </div>
        )}
        <button type="button" onClick={() => irA("malla")} className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
          ¿Algo no cuadra? Corrígelo en Mi malla <ArrowRight className="size-4" />
        </button>
      </Paso>

      <Paso n={2} titulo="Tus preferencias" descripcion="El plan se actualiza solo cada vez que cambias algo.">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="label">Máximo de créditos por semestre</p>
            <div className="flex flex-wrap items-center gap-2">
              <BotonIcono etiqueta="Menos créditos" className="border border-line" onClick={() => setMax(max - 1)}>
                <Minus className="size-4" />
              </BotonIcono>
              <span className="w-12 text-center text-xl font-extrabold tabular">{max}</span>
              <BotonIcono etiqueta="Más créditos" className="border border-line" onClick={() => setMax(max + 1)} disabled={max >= ctx.cur.maxCreditosSemestre}>
                <Plus className="size-4" />
              </BotonIcono>
              <input
                type="range"
                className="rango ml-2 w-40"
                min={Math.min(10, ctx.cur.maxCreditosSemestre)}
                max={ctx.cur.maxCreditosSemestre}
                value={max}
                style={{ ["--avance" as string]: `${((max - 10) / (ctx.cur.maxCreditosSemestre - 10)) * 100}%` }}
                onChange={(e) => setMax(Number(e.target.value))}
                aria-label="Máximo de créditos por semestre"
              />
            </div>
            <p className="mt-1 text-[11.5px] text-fg-3">Tope de tu carrera: {ctx.cur.maxCreditosSemestre} créditos.</p>
          </div>
          {practicas.length > 0 && (
            <div className="min-w-[220px]">
              <label className="label" htmlFor="modo-practica">
                <Briefcase className="mr-1 inline size-3.5" /> Práctica profesional
              </label>
              <select
                id="modo-practica"
                className="input"
                value={ctx.st.modoPractica}
                onChange={(e) => mutar("Modo de práctica", ({ st }) => (st.modoPractica = e.target.value as ModoPractica))}
              >
                <option value="carga">Dentro de la carga</option>
                <option value="sobrecupo">En sobrecupo (no cuenta en el máximo)</option>
                <option value="verano">En {verano.toLowerCase()}</option>
                <option value="quitar">No planificarla</option>
              </select>
            </div>
          )}
        </div>
      </Paso>

      <Paso n={3} titulo="Tu plan" descripcion="Te recomendamos uno. Arrástralo a tu gusto (o usa la flecha de cada ramo en el celular) y guárdalo.">
        <div className="space-y-3">
          {guardado && (
            <article className="overflow-hidden rounded-2xl border border-ok/35">
              <header className="flex flex-wrap items-center gap-3 bg-ok-soft px-4 py-3">
                <BookmarkCheck className="size-5 text-ok" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">Tu plan guardado · {guardado.etiqueta}</p>
                  <p className="text-[12px] text-fg-2">
                    Guardado el {new Date(ctx.st.planFijado!.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "long" })} · {plural(guardado.semestresRestantes, "semestre")} restantes
                  </p>
                </div>
                <BotonIcono etiqueta="Exportar plan guardado a PDF" onClick={() => exportarPlan(guardado, "Mi plan de semestres", ctx.cur.malla.carrera, verano, (id) => nombreRamo(ctx, id), (id) => siglaRamo(ctx, id))}>
                  <FileDown className="size-4" />
                </BotonIcono>
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  onClick={async () => {
                    if (await confirmar({ titulo: "Dejar de usar tu plan guardado", mensaje: "Volverás a ver solo el plan recomendado. Puedes guardar otro cuando quieras.", aceptar: "Dejar de usarlo" }))
                      mutar("Quitar plan guardado", ({ st }) => (st.planFijado = null));
                  }}
                >
                  Dejar de usarlo
                </Boton>
              </header>
              <div className="space-y-3 p-4">
                {ctx.st.planFijado!.semestreBase !== ctx.st.semestreActual && (
                  <Aviso tono="warn" icono={<TriangleAlert />}>
                    Lo guardaste cuando ibas en el semestre {ctx.st.planFijado!.semestreBase}. Si tu avance cambió, guarda de nuevo el plan recomendado.
                  </Aviso>
                )}
                <GrillaPlan plan={guardado} idPlan={-1} editable={false} />
              </div>
            </article>
          )}

          {planes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong py-10 text-center">
              <Flag className="size-6 text-ok" />
              <p className="font-bold">No te quedan ramos por planificar. ¡Completaste la malla!</p>
            </div>
          ) : (
            <>
              {planes[0].semestres.some((s) => s.tipo === "overflow") && (
                <Aviso tono="warn" icono={<TriangleAlert />}>
                  Algunos ramos no caben con tu configuración actual (créditos, requisitos u oferta). Prueba subir el máximo de créditos o revisa la malla.
                </Aviso>
              )}
              <TarjetaPlan plan={planes[0]} idx={0} recomendado onCambiar={(p) => actualizarPlan(0, p)} editado={editado} onRestaurar={restaurar} />
              {planes.length > 1 && (
                <Boton tamano="sm" variante="fantasma" icono={<ChevronDown className={cx("size-4 transition-transform", alternativas && "rotate-180")} />} onClick={() => setAlternativas((v) => !v)}>
                  {alternativas ? "Ocultar alternativas" : `Ver ${plural(planes.length - 1, "alternativa")} con la misma duración`}
                </Boton>
              )}
              {alternativas && planes.slice(1).map((p, i) => <TarjetaPlan key={p.etiqueta} plan={p} idx={i + 1} onCambiar={(np) => actualizarPlan(i + 1, np)} />)}
            </>
          )}
          <p className="text-[12px] text-fg-3">
            El plan respeta prerrequisitos, tu máximo de créditos, ramos anuales y las reglas de práctica. No puede garantizar horarios, cupos ni que un ramo se dicte: confírmalo con tu universidad antes de inscribir.
          </p>
        </div>
      </Paso>
    </div>
  );
}
