import {
  ArrowRight,
  BellRing,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  EyeOff,
  Flag,
  Info,
  Minus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { useMemo } from "react";
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
  siglaEntrada,
  situacionSemestreUDP,
  type SituacionSemestreUDP,
} from "../core/academic";
import { diasHasta, evaluacionesConFecha, hoyISO } from "../core/calendar";
import { evaluarReglaPractica, fechaEgreso } from "../core/curriculum";
import { fmtNota, fmtPct, plural } from "../core/format";
import { calcularRamo } from "../core/grades";
import { useApp, useCtx } from "../store/app";
import { avanzarSemestre } from "../store/mutaciones";
import { confirmar, toast, useUI } from "../store/ui";
import { Anillo, NotaChip, Sparkline } from "../ui/comun";
import { Aviso, Boton, CabeceraTarjeta, Insignia, Tarjeta, cx } from "../ui/primitives";
import { semestresRestantes, usePlanes } from "./plan/usePlanes";
import { letrasCausal, motivoCausal, textoRendimiento } from "./riesgoCausal";

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
  const apr = aprobadosSet(ctx);
  const ramosAprobados = ctx.cur.ramos.filter((r) => apr.has(r.id)).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.25fr_1.25fr_1fr]">
      <Tarjeta className="flex items-center gap-5">
        <Anillo porcentaje={pct} tamano={112}>
          <div>
            <p className="text-2xl font-extrabold tracking-tight tabular">{pct}%</p>
            <p className="text-[11px] font-semibold text-fg-3">avance</p>
          </div>
        </Anillo>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-fg-2">Avance de la carrera</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight tabular">
            {cred.avance} <span className="text-[14px] font-semibold text-fg-3">/ {cred.total} créditos</span>
          </p>
          <p className="mt-1 text-[12.5px] text-fg-2">
            {plural(ramosAprobados, "ramo aprobado", "ramos aprobados")} de {ctx.cur.ramos.length}
            {cred.cursando > 0 && <> · {cred.cursando} cr cursando</>}
          </p>
        </div>
      </Tarjeta>

      <Tarjeta className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-fg-2">PPA acumulado</p>
          <p className="mt-1 text-[40px] leading-none font-extrabold tracking-tight tabular">{actual.ppa !== null ? fmtNota(actual.ppa, 2) : "—"}</p>
          {actual.ramos > 0 && (
            <p className="mt-1.5 text-[12px] text-fg-3">
              Con tus promedios en curso · confirmado <strong className="tabular font-semibold text-fg-2">{ppa !== null ? fmtNota(ppa, 2) : "—"}</strong>
            </p>
          )}
          {delta !== null ? (
            <p className={cx("mt-2 flex items-center gap-1 text-[12.5px] font-semibold", delta > 0.005 ? "text-ok" : delta < -0.005 ? "text-danger" : "text-fg-3")}>
              {delta > 0.005 ? <TrendingUp className="size-4" /> : delta < -0.005 ? <TrendingDown className="size-4" /> : <Minus className="size-4" />}
              {delta > 0 ? "+" : ""}
              {fmtNota(delta, 2)} vs. semestre anterior
            </p>
          ) : (
            <p className="mt-2 text-[12.5px] text-fg-3">{ppa === null ? "Registra notas finales para verlo" : "Necesitas dos semestres para ver la tendencia"}</p>
          )}
        </div>
        <Sparkline valores={reales.map((p) => p.acumulado)} />
      </Tarjeta>

      <Tarjeta className="flex flex-col md:col-span-2 xl:col-span-1">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-fg-2">
          <Flag className="size-4 text-accent" /> Para titularte
        </p>
        {restante.ultimo !== null ? (
          <>
            <p className="mt-1 text-[40px] leading-none font-extrabold tracking-tight tabular">
              {restante.n} <span className="text-[15px] font-semibold text-fg-3">{restante.n === 1 ? "semestre" : "semestres"}</span>
            </p>
            <p className="mt-2 text-[12.5px] text-fg-2">
              Egreso estimado: <strong className="text-fg">{fechaEgreso(ctx.st.semestreActual, restante.ultimo, ctx.st.congelaciones)}</strong>
              <br />
              <span className="text-fg-3">Según tu plan {restante.fuente === "guardado" ? "guardado" : "recomendado"}.</span>
            </p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-fg-2">¡No te quedan ramos por planificar!</p>
        )}
        <Boton tamano="sm" variante="suave" className="mt-auto self-start" onClick={() => irA("planificacion")}>
          Ver planificación <ArrowRight className="size-4" />
        </Boton>
      </Tarjeta>
    </div>
  );
}

type TonoRiesgo = "neutro" | "info" | "ok" | "warn" | "danger";
const CLASE_TONO: Record<TonoRiesgo, string> = {
  neutro: "border-line",
  info: "border-info/25 bg-info-soft",
  ok: "border-ok/25 bg-ok-soft",
  warn: "border-warn/25 bg-warn-soft",
  danger: "border-danger/25 bg-danger-soft",
};

function Contador({ causal, valor, detalle, tono }: { causal: string; valor: React.ReactNode; detalle: React.ReactNode; tono: TonoRiesgo }) {
  return (
    <div className={cx("rounded-xl border px-3 py-2.5", CLASE_TONO[tono])}>
      <p className="text-[11.5px] font-bold tracking-wide text-fg-3 uppercase">Causal {causal}</p>
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
        <div className="space-y-2 rounded-xl border border-line px-3 py-2 text-[13px]">
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
        <div className="rounded-2xl border border-line p-4">
          <p className="mb-3 flex items-center gap-2 text-[13.5px] font-bold">
            <Info className="size-4 text-info" /> Causales de eliminación
          </p>
          <CausalesUDP />
        </div>
        <div className="rounded-2xl border border-line p-4">
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

function EsteSemestre() {
  const ctx = useCtx();
  const irA = useUI((s) => s.irA);
  const p = ctx.st.periodos.find((x) => esPeriodoActual(ctx.st, x));
  const entradas = p?.ramos ?? [];
  return (
    <Tarjeta>
      <CabeceraTarjeta
        icono={<CalendarDays className="size-[18px]" />}
        titulo={`Este semestre · S${ctx.st.semestreActual}`}
        descripcion="Ramos que estás cursando y cómo vas en cada uno."
        acciones={
          <Boton tamano="sm" variante="fantasma" onClick={() => irA("notas")}>
            Ir a Notas
          </Boton>
        }
      />
      {entradas.length === 0 ? (
        <p className="text-[13px] text-fg-2">
          No tienes ramos en el semestre {ctx.st.semestreActual}. Márcalos como <strong>Cursando</strong> en{" "}
          <button className="font-semibold text-accent hover:underline" onClick={() => irA("malla")}>
            Mi malla
          </button>
          .
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {entradas.map((e) => {
            const c = calcularRamo(e);
            const nota = c.nf !== null ? Math.min(7, c.nf + (c.decimas || 0)) : null;
            const pct = c.cerrado ? 100 : c.pesoEvaluado;
            return (
              <li key={e.uid} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{nombreEntrada(ctx, e)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[11px] text-fg-3">{siglaEntrada(ctx, e)}</span>
                    <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-3" title={`${fmtNota(pct, 0)}% evaluado`}>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-fg-3">{c.cerrado ? "final" : nota !== null ? `${fmtNota(pct, 0)}% evaluado` : "sin notas"}</span>
                  </div>
                </div>
                <NotaChip nota={nota} titulo={c.cerrado ? "Nota final" : "Promedio actual"} />
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

function ProximasEvaluaciones() {
  const ctx = useCtx();
  const irA = useUI((s) => s.irA);
  const hoy = hoyISO();
  const proximas = evaluacionesConFecha(ctx)
    .filter((e) => e.fecha >= hoy && !e.rendida)
    .slice(0, 6);
  const fmt = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" });
  return (
    <Tarjeta>
      <CabeceraTarjeta icono={<CalendarClock className="size-[18px]" />} titulo="Próximas evaluaciones" descripcion="Agrega fechas a tus evaluaciones en Notas y aparecerán aquí." />
      {proximas.length === 0 ? (
        <p className="text-[13px] text-fg-2">
          No tienes evaluaciones con fecha.{" "}
          <button className="font-semibold text-accent hover:underline" onClick={() => irA("notas")}>
            Agregar fechas
          </button>
        </p>
      ) : (
        <ul className="space-y-2">
          {proximas.map((e) => {
            const d = diasHasta(e.fecha);
            const [y, m, dia] = e.fecha.split("-").map(Number);
            return (
              <li key={e.uid} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <span className={cx("grid w-14 shrink-0 place-items-center rounded-lg py-1 text-center", d <= 2 ? "bg-danger-soft text-danger" : d <= 7 ? "bg-warn-soft text-warn" : "bg-surface-2 text-fg-2")}>
                  <span className="text-[11px] leading-tight font-bold">{d === 0 ? "Hoy" : d === 1 ? "Mañana" : `${d} días`}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{e.etiqueta}</p>
                  <p className="truncate text-[12px] text-fg-3">
                    {e.ramo} · {fmt.format(new Date(y, m - 1, dia))}
                  </p>
                </div>
                {e.peso > 0 && <Insignia>{fmtPct(e.peso)}%</Insignia>}
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
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
  return (
    <div className="space-y-4">
      <AvisoCierreSemestre />
      <Checklist />
      <Resumen />
      {!sinNotas && <SituacionAcademica />}
      <div className="grid gap-4 lg:grid-cols-2">
        <EsteSemestre />
        <ProximasEvaluaciones />
      </div>
      <AvisosParaTi />
      {sinNotas && <SituacionAcademica />}
    </div>
  );
}
