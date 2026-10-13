import { ArrowRight, BarChart3, BookOpen, CircleCheck, CircleX, Clock, Layers, LineChart, Percent, Route, Star, Table2, TrendingDown, TrendingUp, ArrowLeftRight, PenSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { calcularPPA, evolucionPPA, notaEntrada, ramoCatalogo, resumenCreditos, resumenPeriodos } from "../core/academic";
import { NOTA_APROB, fmtNota } from "../core/format";
import { useCtx } from "../store/app";
import { useUI } from "../store/ui";
import { colorTipo, etiquetaTipo } from "../ui/comun";
import { Boton, CabeceraTarjeta, Segmentado, Tarjeta, Vacio, cx } from "../ui/primitives";
import { GraficoPPA, Histograma, LeyendaPPA } from "./estadisticas/Graficos";

function Tile({ icono, etiqueta, valor, tono, ayuda }: { icono: React.ReactNode; etiqueta: string; valor: React.ReactNode; tono?: "acento" | "ok" | "danger" | "info"; ayuda?: string }) {
  const t = { acento: "bg-accent-soft text-accent", ok: "bg-ok-soft text-ok", danger: "bg-danger-soft text-danger", info: "bg-info-soft text-info" }[tono ?? "acento"];
  return (
    <div className="card flex items-center gap-3.5 p-4" title={ayuda}>
      <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-[18px]", t)}>{icono}</span>
      <div className="min-w-0">
        <p className="text-[24px] leading-tight font-extrabold tracking-tight tabular">{valor}</p>
        <p className="truncate text-[12.5px] font-semibold text-fg-2">{etiqueta}</p>
      </div>
    </div>
  );
}

export function Estadisticas() {
  const ctx = useCtx();
  const irA = useUI((s) => s.irA);
  const [tabla, setTabla] = useState(false);
  const [modo, setModo] = useState<"ramo" | "evaluacion">("ramo");
  const cred = useMemo(() => resumenCreditos(ctx), [ctx]);
  const evo = useMemo(() => evolucionPPA(ctx), [ctx]);
  const periodos = useMemo(() => resumenPeriodos(ctx, { incluirVerano: true }), [ctx]);
  const { ppa } = calcularPPA(ctx);
  const posicion = ctx.cur.malla.posicionToma === "banner" ? "Banner" : "Ventana";

  const finales = useMemo(() => {
    const out: { id: string; nota: number }[] = [];
    ctx.st.periodos.forEach((p) =>
      p.ramos.forEach((e) => {
        const n = notaEntrada(ctx, e);
        if (n !== null) out.push({ id: e.id, nota: n });
      }),
    );
    return out;
  }, [ctx]);
  const evaluaciones = useMemo(
    () => ctx.st.periodos.flatMap((p) => p.ramos.flatMap((e) => e.categorias.flatMap((c) => c.notas.map((n) => n.n).filter((n): n is number => n !== null)))),
    [ctx],
  );

  if (finales.length === 0)
    return (
      <Tarjeta>
        <Vacio
          icono={<LineChart className="size-5" />}
          titulo="Todavía no hay notas finales"
          accion={
            <Boton variante="primario" onClick={() => irA("notas")}>
              Ir a Notas <ArrowRight className="size-4" />
            </Boton>
          }
        >
          Registra la nota final de tus ramos en Notas para ver la evolución de tu PPA, tu aprobación por semestre y la distribución de tus notas.
        </Vacio>
      </Tarjeta>
    );

  const aprobadas = finales.filter((f) => f.nota >= NOTA_APROB).length;
  const tasa = Math.round((aprobadas / finales.length) * 100);
  const promSimple = finales.reduce((s, f) => s + f.nota, 0) / finales.length;
  const ordenadas = [...finales].sort((a, b) => b.nota - a.nota);
  const reales = evo.filter((p) => p.numero > 0);
  const tendencia = reales.length >= 2 ? reales.at(-1)!.ppa - reales.at(-2)!.ppa : null;

  const porTipo = Object.entries(
    finales.reduce<Record<string, number[]>>((acc, f) => {
      const t = ramoCatalogo(ctx, f.id)?.tipo ?? "ESP";
      (acc[t] ??= []).push(f.nota);
      return acc;
    }, {}),
  )
    .map(([tipo, notas]) => ({ tipo, prom: notas.reduce((a, b) => a + b, 0) / notas.length, n: notas.length }))
    .sort((a, b) => b.prom - a.prom);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icono={<Star />} etiqueta="PPA acumulado" valor={fmtNota(ppa, 3)} ayuda="Promedio ponderado por créditos de todas tus notas finales" />
        <Tile icono={<CircleCheck />} tono="ok" etiqueta="Créditos aprobados" valor={cred.aprobados} ayuda="Incluye los marcados como cursados en la malla" />
        <Tile icono={<CircleX />} tono="danger" etiqueta="Créditos reprobados" valor={cred.reprobados} ayuda="Cada intento cerrado con nota bajo 4,0" />
        <Tile icono={<Percent />} tono="info" etiqueta="Tasa de aprobación" valor={`${tasa}%`} ayuda="Ramos con nota final que aprobaste" />
      </div>

      <details className="card group overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-[14px] font-bold">
          <Layers className="size-4 text-accent" /> Detalle de créditos
          <ArrowRight className="ml-auto size-4 text-fg-3 transition-transform group-open:rotate-90" />
        </summary>
        <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile icono={<PenSquare />} etiqueta="Créditos inscritos" valor={cred.inscritos} ayuda="Cada intento registrado: aprobado, reprobado o en curso" />
          <Tile icono={<Route />} etiqueta="Créditos de avance" valor={cred.avance} ayuda="Aprobados que avanzan tu malla, sin repetir ramos" />
          <Tile icono={<Clock />} tono="info" etiqueta="Créditos cursando" valor={cred.cursando} />
          <Tile icono={<BookOpen />} tono="info" etiqueta="Ramos cursando" valor={cred.ramosCursando} />
        </div>
      </details>

      <Tarjeta>
        <CabeceraTarjeta
          icono={<LineChart className="size-[18px]" />}
          titulo="Evolución del PPA"
          descripcion={
            tendencia === null ? (
              "Necesitas al menos dos semestres con notas para ver la tendencia."
            ) : (
              <span className={cx("inline-flex items-center gap-1.5 font-semibold", tendencia > 0.2 ? "text-ok" : tendencia < -0.2 ? "text-danger" : "text-fg-2")}>
                {tendencia > 0.2 ? <TrendingUp className="size-4" /> : tendencia < -0.2 ? <TrendingDown className="size-4" /> : <ArrowLeftRight className="size-4" />}
                {tendencia > 0.2 ? "Vas en alza" : tendencia < -0.2 ? "Bajaste" : "Te mantienes estable"}: de {fmtNota(reales.at(-2)!.ppa)} en {reales.at(-2)!.etiqueta} a {fmtNota(reales.at(-1)!.ppa)} en {reales.at(-1)!.etiqueta}.
              </span>
            )
          }
          acciones={
            <Boton tamano="sm" variante="fantasma" icono={tabla ? <LineChart className="size-4" /> : <Table2 className="size-4" />} onClick={() => setTabla((v) => !v)} aria-pressed={tabla}>
              {tabla ? "Ver gráfico" : "Ver como tabla"}
            </Boton>
          }
        />
        {tabla ? (
          <div className="scroll-x">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-fg-2">
                  <th className="py-2 font-semibold">Periodo</th>
                  <th className="py-2 text-right font-semibold">Promedio</th>
                  <th className="py-2 text-right font-semibold">PPA acumulado</th>
                  <th className="py-2 text-right font-semibold">Créditos</th>
                  <th className="py-2 text-right font-semibold">{posicion}</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {evo.map((p) => (
                  <tr key={p.numero} className="border-b border-line last:border-0">
                    <td className="py-2 font-semibold">{p.etiqueta === "Conv." ? "Convalidaciones" : `Semestre ${p.numero}`}</td>
                    <td className={cx("py-2 text-right font-mono", p.ppa < NOTA_APROB && "text-danger")}>{fmtNota(p.ppa, 2)}</td>
                    <td className={cx("py-2 text-right font-mono font-bold", p.acumulado < NOTA_APROB && "text-danger")}>{fmtNota(p.acumulado, 3)}</td>
                    <td className="py-2 text-right">{p.creditos}</td>
                    <td className="py-2 text-right">{p.ventana ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <LeyendaPPA />
            <div className="mt-3">
              <GraficoPPA datos={evo} posicion={posicion} />
            </div>
          </>
        )}
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <CabeceraTarjeta icono={<BarChart3 className="size-[18px]" />} titulo="Aprobación de créditos por semestre" descripcion="Cuánto de tu carga aprobaste en cada periodo." />
          <ul className="space-y-3">
            {periodos.map((p) => {
              const pct = Math.round(p.porcentajeAprobado);
              return (
                <li key={p.numero} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-[13px]">
                  <span>
                    <strong>Semestre {p.numero}</strong>
                    <span className="block text-[11.5px] text-fg-3 tabular">
                      {p.credAprobados}/{p.credTotal} cr
                    </span>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${pct}% aprobado`}>
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? "var(--s3)" : pct >= 50 ? "var(--s4)" : "var(--s8)" }} />
                  </span>
                  <span className="w-11 text-right font-bold tabular">
                    {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11.5px] text-fg-3">Verde: 80% o más · Amarillo: 50–79% · Rojo: menos del 50%.</p>
        </Tarjeta>

        <Tarjeta>
          <CabeceraTarjeta icono={<Layers className="size-[18px]" />} titulo="Rendimiento por tipo de ramo" descripcion="Tu promedio simple en cada tipo de ramo de la malla." />
          <ul className="space-y-3">
            {porTipo.map((t) => (
              <li key={t.tipo} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-[13px]">
                <span className="min-w-0">
                  <strong className="block truncate">{etiquetaTipo(ctx.cur, t.tipo)}</strong>
                  <span className="text-[11.5px] text-fg-3">
                    {t.n} {t.n === 1 ? "ramo" : "ramos"}
                  </span>
                </span>
                <span className="relative h-2.5 rounded-full bg-surface-3">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${((t.prom - 1) / 6) * 100}%`, background: colorTipo(ctx.cur, t.tipo) }} />
                  <span className="absolute -inset-y-1 w-px bg-fg-3" style={{ left: "50%" }} title="4,0" />
                </span>
                <span className={cx("w-9 text-right font-mono font-bold", t.prom < NOTA_APROB && "text-danger")}>{fmtNota(t.prom)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-fg-3">La línea vertical marca el 4,0.</p>
        </Tarjeta>
      </div>

      <Tarjeta>
        <CabeceraTarjeta
          icono={<BarChart3 className="size-[18px]" />}
          titulo="Distribución de notas"
          descripcion="Cuántas notas tienes en cada rango."
          acciones={
            <Segmentado
              etiqueta="Contar notas por"
              valor={modo}
              onChange={setModo}
              opciones={[
                { valor: "ramo", etiqueta: "Por ramo" },
                { valor: "evaluacion", etiqueta: "Por evaluación" },
              ]}
            />
          }
        />
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Ramos con nota final", finales.length],
              ["Aprobados", aprobadas],
              ["Promedio simple", fmtNota(promSimple)],
              ["Evaluaciones registradas", evaluaciones.length],
              ["Mejor nota", `${fmtNota(ordenadas[0].nota)}`],
              ["Nota más baja", `${fmtNota(ordenadas.at(-1)!.nota)}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-2 p-3">
                <p className="text-xl font-extrabold tabular">{v}</p>
                <p className="text-[12px] text-fg-2">{k}</p>
              </div>
            ))}
          </div>
          <div>
            {(modo === "ramo" ? finales.map((f) => f.nota) : evaluaciones).length === 0 ? (
              <p className="text-[13px] text-fg-3">Aún no registras evaluaciones con nota.</p>
            ) : (
              <>
                <Histograma notas={modo === "ramo" ? finales.map((f) => f.nota) : evaluaciones} />
                <div className="mt-2 flex gap-4 text-[12px] font-semibold text-fg-2">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: "var(--s8)" }} />
                    Bajo 4,0
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: "var(--s1)" }} />
                    4,0 o más
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}
