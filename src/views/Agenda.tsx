import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, PenLine, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { evaluacionesConFecha, diasHasta, generarICS, hoyISO, type Evaluacion } from "../core/calendar";
import { fmtNota, fmtPct, plural } from "../core/format";
import type { Periodo } from "../core/state";
import { descargarArchivo } from "../store/respaldo";
import { useCtx } from "../store/app";
import { toast, useUI } from "../store/ui";
import { Boton, BotonIcono, Interruptor, Segmentado, Vacio, cx } from "../ui/primitives";
import { RegistroNota, type SeleccionNota } from "./notas/RegistroNota";

const fecha = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const FMT_DIA = new Intl.DateTimeFormat("es-CL", { weekday: "short" });
const FMT_MES = new Intl.DateTimeFormat("es-CL", { month: "short" });
const FMT_LARGO = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" });
const cuando = (d: number) => (d === 0 ? "Hoy" : d === 1 ? "Mañana" : d === -1 ? "Ayer" : d < 0 ? `Hace ${-d} días` : `En ${d} días`);

/** Filtro por ramo y si se muestran las ya registradas: se conservan al cambiar de sección. */
let recordado: { ramo: string; rendidas: boolean; vista: "lista" | "mes"; mes: string | null } = { ramo: "", rendidas: false, vista: "lista", mes: null };

const FMT_TITULO_MES = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const iso = (d: Date) => hoyISO(d);

/** Cuadrícula del mes (semanas de lunes a domingo). Tocar un día muestra sus evaluaciones debajo. */
function Mes({ evs, mes, onMes, onAbrir }: { evs: Evaluacion[]; mes: Date; onMes: (d: Date) => void; onAbrir: (ev: Evaluacion) => void }) {
  const [dia, setDia] = useState<string | null>(null);
  const hoy = hoyISO();
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const desfase = (primero.getDay() + 6) % 7;
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas = Math.ceil((desfase + diasMes) / 7) * 7;
  const porDia = new Map<string, Evaluacion[]>();
  evs.forEach((e) => porDia.set(e.fecha, [...(porDia.get(e.fecha) ?? []), e]));
  const prefijo = iso(primero).slice(0, 7);
  const delMes = evs.filter((e) => e.fecha.startsWith(prefijo));
  const elegidas = dia && dia.startsWith(prefijo) ? porDia.get(dia) ?? [] : delMes;
  const mover = (n: number) => {
    setDia(null);
    onMes(new Date(mes.getFullYear(), mes.getMonth() + n, 1));
  };
  return (
    <div className="space-y-5">
      <section aria-label={`Calendario de ${FMT_TITULO_MES.format(primero)}`} className="card p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <BotonIcono etiqueta="Mes anterior" onClick={() => mover(-1)}>
            <ChevronLeft className="size-5" />
          </BotonIcono>
          <h2 aria-live="polite" className="text-[16px] font-bold first-letter:uppercase">{FMT_TITULO_MES.format(primero)}</h2>
          <BotonIcono etiqueta="Mes siguiente" onClick={() => mover(1)}>
            <ChevronRight className="size-5" />
          </BotonIcono>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DIAS.map((d) => (
            <span key={d} aria-hidden="true" className="pb-1 text-[11.5px] font-semibold text-fg-3">{d}</span>
          ))}
          {Array.from({ length: celdas }, (_, i) => {
            const n = i - desfase + 1;
            if (n < 1 || n > diasMes) return <span key={i} aria-hidden="true" />;
            const f = new Date(mes.getFullYear(), mes.getMonth(), n);
            const clave = iso(f);
            const lista = porDia.get(clave) ?? [];
            const pendientes = lista.filter((e) => !e.rendida).length;
            const elegido = dia === clave;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={elegido}
                aria-label={`${FMT_LARGO.format(f)}${lista.length ? `, ${plural(lista.length, "evaluación", "evaluaciones")}` : ""}${clave === hoy ? ", hoy" : ""}`}
                onClick={() => setDia(elegido ? null : clave)}
                className={cx(
                  "flex aspect-square min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl text-[13.5px] font-semibold tabular transition-colors sm:aspect-auto sm:h-14",
                  elegido ? "bg-accent text-accent-fg" : lista.length ? "bg-accent-soft text-fg hover:bg-accent/20" : "text-fg-2 hover:bg-surface-2",
                  clave === hoy && !elegido && "ring-2 ring-accent ring-inset",
                )}
              >
                {n}
                {lista.length > 0 && (
                  <span aria-hidden="true" className="flex gap-0.5">
                    {lista.slice(0, 3).map((e) => (
                      <span key={e.uid} className={cx("size-1.5 rounded-full", elegido ? "bg-accent-fg" : e.rendida ? "bg-fg-3" : pendientes && e.fecha < hoy ? "bg-warn" : "bg-accent")} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
      <section aria-labelledby="agenda-dia">
        <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
          <h2 id="agenda-dia" className="text-[16px] font-bold tracking-tight first-letter:uppercase">
            {dia && dia.startsWith(prefijo) ? FMT_LARGO.format(fecha(dia)) : `Todo ${FMT_TITULO_MES.format(primero).replace(/ de \d+$/, "")}`}
          </h2>
          <span className="text-[12px] text-fg-3">{plural(elegidas.length, "evaluación", "evaluaciones")}</span>
        </div>
        {elegidas.length ? (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">{elegidas.map((ev) => <Fila key={ev.uid} ev={ev} onAbrir={onAbrir} />)}</ul>
        ) : (
          <p className="card p-5 text-center text-[13.5px] text-fg-2">{dia ? "No hay evaluaciones este día." : "No hay evaluaciones con fecha este mes."}</p>
        )}
      </section>
    </div>
  );
}

function Fila({ ev, onAbrir }: { ev: Evaluacion; onAbrir: (ev: Evaluacion) => void }) {
  const d = diasHasta(ev.fecha);
  const f = fecha(ev.fecha);
  const atrasada = d < 0 && !ev.rendida;
  return (
    <li>
      <button
        type="button"
        onClick={() => onAbrir(ev)}
        aria-label={`${ev.etiqueta}, ${ev.ramo}, ${FMT_LARGO.format(f)}. ${ev.rendida ? `Nota ${fmtNota(ev.nota ?? null)}. Editar` : "Registrar nota"}`}
        className="card group flex w-full items-center gap-3.5 p-3 text-left transition-transform hover:-translate-y-px sm:px-4"
      >
        <span
          aria-hidden="true"
          className={cx(
            "grid w-14 shrink-0 place-items-center rounded-2xl py-1.5 text-center",
            ev.rendida ? "bg-surface-2 text-fg-3" : atrasada ? "bg-warn-soft text-warn" : d <= 2 ? "bg-danger-soft text-danger" : d <= 7 ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-2",
          )}
        >
          <span className="text-[11px] font-bold uppercase">{FMT_DIA.format(f).replace(".", "")}</span>
          <span className="text-[22px] leading-none font-extrabold tabular">{f.getDate()}</span>
          <span className="text-[10.5px] font-semibold">{FMT_MES.format(f).replace(".", "")}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-bold">{ev.etiqueta}</span>
          <span className="block truncate text-[12.5px] text-fg-2">
            {ev.ramo}
            {ev.peso > 0 && <> · {fmtPct(ev.peso)}% del ramo</>}
          </span>
          <span className={cx("mt-0.5 flex items-center gap-1 text-[12px] font-semibold", atrasada ? "text-warn" : "text-fg-3")}>
            {atrasada && <TriangleAlert aria-hidden="true" className="size-3.5" />}
            {ev.rendida ? "Registrada" : atrasada ? `${cuando(d)} · sin nota` : cuando(d)}
          </span>
        </span>
        {ev.rendida ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[20px] font-extrabold tabular">
            <Check aria-hidden="true" className="size-4 text-ok" />
            {fmtNota(ev.nota ?? null)}
          </span>
        ) : (
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-accent-fg">
            <PenLine className="size-4" />
          </span>
        )}
      </button>
    </li>
  );
}

function Grupo({ titulo, descripcion, evs, onAbrir }: { titulo: string; descripcion?: string; evs: Evaluacion[]; onAbrir: (ev: Evaluacion) => void }) {
  if (!evs.length) return null;
  const id = `agenda-${titulo.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 id={id} className="text-[16px] font-bold tracking-tight">{titulo}</h2>
        <span className="text-[12px] text-fg-3">{descripcion ?? plural(evs.length, "evaluación", "evaluaciones")}</span>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
        {evs.map((ev) => <Fila key={ev.uid} ev={ev} onAbrir={onAbrir} />)}
      </ul>
    </section>
  );
}

/** Las evaluaciones de Notas ordenadas por fecha. Es la misma evaluación: registrarla aquí la registra en Notas. */
export function Agenda() {
  const ctx = useCtx();
  const irA = useUI((s) => s.irA);
  const [ramo, setRamoEstado] = useState(recordado.ramo);
  const [rendidas, setRendidasEstado] = useState(recordado.rendidas);
  const [vista, setVistaEstado] = useState(recordado.vista);
  const [mes, setMesEstado] = useState(() => (recordado.mes ? fecha(recordado.mes) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const setVista = (v: "lista" | "mes") => { recordado = { ...recordado, vista: v }; setVistaEstado(v); };
  const setMes = (d: Date) => { recordado = { ...recordado, mes: hoyISO(d) }; setMesEstado(d); };
  const setRamo = (v: string) => { recordado = { ...recordado, ramo: v }; setRamoEstado(v); };
  const setRendidas = (v: boolean) => { recordado = { ...recordado, rendidas: v }; setRendidasEstado(v); };
  const [registro, setRegistro] = useState<{ periodo: Periodo; seleccion: SeleccionNota } | null>(null);

  const todas = evaluacionesConFecha(ctx);
  const ramos = [...new Map(todas.map((e) => [e.entrada, e.ramo])).entries()];
  const filtroValido = ramos.some(([uid]) => uid === ramo) ? ramo : "";
  const visibles = todas.filter((e) => !filtroValido || e.entrada === filtroValido);
  const hoy = hoyISO();
  const atrasadas = visibles.filter((e) => e.fecha < hoy && !e.rendida);
  const proximas = visibles.filter((e) => e.fecha >= hoy && !e.rendida);
  const semana = proximas.filter((e) => diasHasta(e.fecha) <= 7);
  const despues = proximas.filter((e) => diasHasta(e.fecha) > 7);
  const registradas = rendidas ? visibles.filter((e) => e.rendida).reverse() : [];
  const sinFecha = ctx.st.periodos
    .filter((p) => p.tipo !== "convalidaciones")
    .flatMap((p) => p.ramos.filter((e) => e.notaFinal === null))
    .reduce((n, e) => n + e.categorias.reduce((s, c) => s + c.notas.filter((x) => x.n === null && !x.fecha).length, 0), 0);

  const abrir = (ev: Evaluacion) => {
    const periodo = ctx.st.periodos.find((p) => p.ramos.some((e) => e.uid === ev.entrada));
    if (periodo) setRegistro({ periodo, seleccion: { uid: ev.entrada, categoria: ev.categoriaId, nota: ev.notaId } });
  };
  const periodo = registro && ctx.st.periodos.find((p) => p.tipo === registro.periodo.tipo && p.numero === registro.periodo.numero);

  const exportar = () => {
    if (!todas.length) return toast("Primero agrega una fecha al registrar o editar una evaluación.", "info");
    descargarArchivo(`evaluaciones-s${ctx.st.semestreActual}.ics`, generarICS(todas, `Evaluaciones · ${ctx.cur.malla.carrera}`), "text/calendar");
    toast(`${plural(todas.length, "evaluación exportada", "evaluaciones exportadas")}. Ábrelo con Google Calendar o tu app de calendario.`);
  };

  if (!todas.length)
    return (
      <div className="card p-5 sm:p-6">
        <Vacio
          icono={<CalendarDays className="size-5" />}
          titulo="Agrega fechas a tus evaluaciones"
          accion={<Boton variante="primario" onClick={() => irA("notas")}>Ir a Notas</Boton>}
        >
          Al registrar o editar una evaluación, abre «Fecha y más opciones». Aparecerá aquí ordenada por fecha y podrás exportarla a tu calendario.
          {sinFecha > 0 && ` Tienes ${plural(sinFecha, "evaluación pendiente", "evaluaciones pendientes")} sin fecha.`}
        </Vacio>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmentado etiqueta="Vista de la agenda" valor={vista} onChange={setVista} opciones={[{ valor: "lista", etiqueta: "Lista" }, { valor: "mes", etiqueta: "Mes" }]} />
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="agenda-ramo" className="sr-only">Filtrar por ramo</label>
          <select id="agenda-ramo" className="input !w-auto max-w-full !rounded-full !border-transparent !bg-surface font-semibold shadow-soft" value={filtroValido} onChange={(e) => setRamo(e.target.value)}>
            <option value="">Todos los ramos</option>
            {ramos.map(([uid, nombre]) => <option key={uid} value={uid}>{nombre}</option>)}
          </select>
        </div>
        {vista === "lista" && <Interruptor checked={rendidas} onChange={setRendidas} etiqueta="Mostrar registradas" />}
        <Boton icono={<CalendarPlus className="size-4" />} onClick={exportar}>Exportar al calendario</Boton>
      </div>

      {vista === "mes" && <Mes evs={visibles} mes={mes} onMes={setMes} onAbrir={abrir} />}
      {vista === "lista" && atrasadas.length + proximas.length + registradas.length === 0 && (
        <p role="status" className="card p-6 text-center text-[14px] text-fg-2">
          {filtroValido ? "Este ramo no tiene evaluaciones pendientes con fecha." : "No tienes evaluaciones pendientes con fecha."}
          {!rendidas && " Activa «Mostrar registradas» para ver las anteriores."}
        </p>
      )}
      {vista === "lista" && (
        <>
          <Grupo titulo="Sin nota todavía" descripcion="Ya pasó la fecha" evs={atrasadas} onAbrir={abrir} />
          <Grupo titulo="Próximos 7 días" evs={semana} onAbrir={abrir} />
          <Grupo titulo="Más adelante" evs={despues} onAbrir={abrir} />
          <Grupo titulo="Registradas" evs={registradas} onAbrir={abrir} />
        </>
      )}

      {sinFecha > 0 && (
        <p className="px-1 text-[13px] text-fg-2">
          Tienes {plural(sinFecha, "evaluación pendiente", "evaluaciones pendientes")} sin fecha.{" "}
          <button type="button" className="font-semibold text-accent hover:underline" onClick={() => irA("notas")}>
            Agrégalas en Notas
          </button>
          .
        </p>
      )}
      {registro && periodo && <RegistroNota ctx={ctx} periodo={periodo} seleccion={registro.seleccion} onCerrar={() => setRegistro(null)} />}
    </div>
  );
}
