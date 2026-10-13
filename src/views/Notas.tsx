import { Calculator, CalendarPlus, FileDown, FolderOpen, FolderPlus, Search, Sun, Target, Trash2, FileCheck2, Gauge } from "lucide-react";
import { useMemo, useState } from "react";
import {
  calcularPPA,
  clavePeriodo,
  creditosCurriculares,
  esPeriodoActual,
  nombreEntrada,
  nombrePeriodo,
  notaEntrada,
  periodosOrdenados,
  resumenCreditos,
  siglaEntrada,
} from "../core/academic";
import { evaluacionesConFecha, generarICS } from "../core/calendar";
import { esSoloMalla } from "../core/curriculum";
import { NOTA_APROB, fmtNota, normalizarTexto, plural } from "../core/format";
import { notaDesdePuntaje, puntajeParaNota } from "../core/grades";
import type { Periodo, TipoPeriodo } from "../core/state";
import { escaparHTML, abrirImpresion } from "../lib/imprimir";
import { descargarArchivo } from "../store/respaldo";
import { useApp, useCtx } from "../store/app";
import { agregarRamoAPeriodo, eliminarPeriodo, obtenerPeriodo, periodoPorClave } from "../store/mutaciones";
import { confirmar, toast } from "../store/ui";
import { CampoNumero } from "../ui/CampoNumero";
import { CabeceraModal, Modal, PieModal } from "../ui/overlays";
import { Boton, BotonIcono, CabeceraTarjeta, Tarjeta, cx } from "../ui/primitives";
import { RamoCard, RamoEjemplo } from "./notas/RamoCard";

function Simulador() {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const [nota, setNota] = useState(5);
  const { ppa, creditos } = calcularPPA(ctx);
  const cred = resumenCreditos(ctx);
  const enCurso = cred.cursando;
  const suma = ppa !== null ? ppa * creditos : 0;
  const total = creditos + enCurso;
  const simulado = total > 0 && enCurso > 0 ? (suma + nota * enCurso) / total : ppa;
  const necesaria4 = enCurso > 0 ? (NOTA_APROB * total - suma) / enCurso : null;
  const meta = ctx.st.prefs.metaPPA;
  // Créditos que faltan por cursar hasta titularte (pendientes + en curso).
  const porCursar = Math.max(0, cred.total - cred.avance);
  const necesariaMeta = meta !== null && porCursar > 0 ? ((meta - 0.0005) * (creditos + porCursar) - suma) / porCursar : null;

  return (
    <Tarjeta className="lg:col-span-2">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-fg-2">
            <Gauge className="size-4 text-accent" /> Simulador de PPA
          </p>
          <p className="mt-1 text-[13.5px]">
            Si cierras el semestre con <strong className="text-accent tabular">{fmtNota(nota)}</strong> en tus {enCurso} créditos en curso, tu PPA queda en{" "}
            <strong className={cx("tabular", simulado !== null && simulado < NOTA_APROB ? "text-danger" : "text-fg")}>{fmtNota(simulado, 3)}</strong>
          </p>
          <input
            type="range"
            className="rango mt-3 w-full"
            min={1}
            max={7}
            step={0.1}
            value={nota}
            disabled={enCurso === 0}
            style={{ ["--avance" as string]: `${((nota - 1) / 6) * 100}%` }}
            onChange={(e) => setNota(Number(e.target.value))}
            aria-label="Nota promedio simulada para el semestre"
          />
          <div className="mt-1 flex justify-between text-[10.5px] text-fg-3 tabular">
            <span>1,0</span>
            <span>4,0</span>
            <span>7,0</span>
          </div>
          <p className="mt-2 text-[12.5px] text-fg-2">
            {enCurso === 0
              ? "Marca ramos como Cursando para simular."
              : necesaria4 === null
                ? ""
                : necesaria4 <= 1
                  ? "✓ Con cualquier nota quedas sobre 4,0 de PPA."
                  : necesaria4 > 7
                    ? "Este semestre no alcanza para llegar a 4,0 de PPA."
                    : `Necesitas al menos ${fmtNota(necesaria4)} este semestre para quedar con PPA 4,0.`}
          </p>
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-fg-2">
            <Target className="size-4 text-accent" /> Meta de PPA al titularte
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[13px] text-fg-2">Quiero egresar con</span>
            <CampoNumero
              className="input w-20 text-center font-bold"
              valor={meta}
              min={1}
              max={7}
              placeholder="5,5"
              decimales={2}
              aria-label="PPA objetivo"
              onGuardar={(v) => mutar("Meta de PPA", ({ st }) => (st.prefs.metaPPA = v))}
            />
          </div>
          <p className="mt-3 text-[13px]">
            {meta === null ? (
              <span className="text-fg-3">Escribe un PPA objetivo y te diremos qué promedio necesitas en lo que te queda.</span>
            ) : porCursar === 0 ? (
              <span className="text-fg-2">No te quedan créditos por cursar.</span>
            ) : necesariaMeta === null ? null : necesariaMeta > 7 ? (
              <span className="font-semibold text-danger">Con {porCursar} créditos por delante ya no alcanza: el máximo posible es {fmtNota((suma + 7 * porCursar) / (creditos + porCursar), 2)}.</span>
            ) : necesariaMeta <= 1 ? (
              <span className="font-semibold text-ok">¡Meta asegurada pase lo que pase!</span>
            ) : (
              <>
                Necesitas promediar <strong className="text-accent tabular">{fmtNota(necesariaMeta, 2)}</strong> en los {porCursar} créditos que te quedan.
              </>
            )}
          </p>
        </div>
      </div>
    </Tarjeta>
  );
}

function ModalPeriodo({ abierto, onCerrar, onCrear }: { abierto: boolean; onCerrar: () => void; onCrear: (tipo: TipoPeriodo, n: number) => void }) {
  const ctx = useCtx();
  const verano = ctx.cur.malla.periodoVerano ?? "Semestre de verano";
  const [tipo, setTipo] = useState<TipoPeriodo>("regular");
  const ocupados = new Set(ctx.st.periodos.filter((p) => p.tipo === tipo).map((p) => p.numero));
  const opciones = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => !ocupados.has(n));
  const [numero, setNumero] = useState<number | null>(null);
  const n = numero !== null && opciones.includes(numero) ? numero : (opciones.find((x) => x <= ctx.st.semestreActual && !ocupados.has(x)) ?? opciones[0]);
  const yaConv = ctx.st.periodos.some((p) => p.tipo === "convalidaciones");
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} etiqueta="Crear periodo">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCrear(tipo, tipo === "convalidaciones" ? 0 : n);
        }}
      >
        <CabeceraModal icono={<FolderPlus className="size-5" />} sobretitulo="Notas" titulo="¿Qué periodo quieres crear?" />
        <div className="space-y-2 px-6 pt-4" role="radiogroup">
          {(
            [
              ["regular", "Semestre regular", "Un semestre normal de tu carrera."],
              ["verano", verano, "Cursos que tomaste entre dos semestres."],
              ["convalidaciones", "Convalidaciones", "Ramos reconocidos de otra carrera o institución."],
            ] as const
          ).map(([v, t, d]) => (
            <label key={v} className={cx("flex cursor-pointer items-start gap-3 rounded-2xl border p-3", tipo === v ? "border-accent bg-accent-soft" : "border-line", v === "convalidaciones" && yaConv && "pointer-events-none opacity-50")}>
              <input type="radio" name="tipo-periodo" className="mt-1 accent-[var(--accent)]" checked={tipo === v} disabled={v === "convalidaciones" && yaConv} onChange={() => setTipo(v)} />
              <span>
                <strong className="text-[13.5px]">{t}</strong>
                <span className="block text-[12.5px] text-fg-2">{v === "convalidaciones" && yaConv ? "Ya existe." : d}</span>
              </span>
            </label>
          ))}
          {tipo !== "convalidaciones" && (
            <div className="pt-2">
              <label className="label" htmlFor="num-periodo">
                {tipo === "verano" ? `${verano} después del semestre` : "Número de semestre"}
              </label>
              <select id="num-periodo" className="input" value={n} onChange={(e) => setNumero(Number(e.target.value))}>
                {opciones.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <PieModal>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="primario">
            Crear
          </Boton>
        </PieModal>
      </form>
    </Modal>
  );
}

function ModalEscala({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [max, setMax] = useState<number | null>(60);
  const [exig, setExig] = useState<number | null>(60);
  const [obtenido, setObtenido] = useState<number | null>(null);
  const esc = { puntajeMax: max ?? 0, exigencia: (exig ?? 60) / 100 };
  const valido = (max ?? 0) > 0 && (exig ?? 0) > 0 && (exig ?? 0) < 100;
  const notas = [2, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7];
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} etiqueta="Escala de notas" ancho="lg">
      <CabeceraModal icono={<Calculator className="size-5" />} sobretitulo="Herramienta" titulo="Escala de notas" onCerrar={onCerrar}>
        Convierte puntaje en nota con la escala chilena (1,0 a 7,0, aprobación 4,0).
      </CabeceraModal>
      <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Puntaje máximo</label>
              <CampoNumero className="input" valor={max} min={1} onGuardar={setMax} />
            </div>
            <div>
              <label className="label">Exigencia (%)</label>
              <CampoNumero className="input" valor={exig} min={1} max={99} onGuardar={setExig} />
            </div>
          </div>
          <div>
            <label className="label">Tu puntaje</label>
            <CampoNumero className="input text-lg font-bold" valor={obtenido} min={0} placeholder="Ej. 42" onGuardar={setObtenido} />
          </div>
          <div className="rounded-2xl bg-accent-soft p-4 text-center">
            <p className="text-[12px] font-semibold text-fg-2">Tu nota</p>
            <p className={cx("text-[40px] leading-none font-extrabold tabular", obtenido !== null && valido ? (notaDesdePuntaje(obtenido, esc) >= 3.95 ? "text-ok" : "text-danger") : "text-fg-3")}>
              {obtenido !== null && valido ? fmtNota(notaDesdePuntaje(obtenido, esc)) : "—"}
            </p>
            {valido && <p className="mt-1 text-[12px] text-fg-2">El 4,0 se obtiene con {fmtNota(puntajeParaNota(4, esc), 1)} puntos.</p>}
          </div>
        </div>
        <div>
          <p className="label">Puntaje mínimo por nota</p>
          <table className="w-full text-[13px]">
            <tbody>
              {notas.map((n) => (
                <tr key={n} className="border-b border-line last:border-0">
                  <td className={cx("py-1.5 font-mono font-bold", n >= 4 ? "text-ok" : "text-danger")}>{fmtNota(n)}</td>
                  <td className="py-1.5 text-right tabular">{valido ? `${fmtNota(puntajeParaNota(n, esc), 1)} pts` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function BuscadorRamo({ periodo }: { periodo: Periodo }) {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const clave = clavePeriodo(periodo);
  const conv = periodo.tipo === "convalidaciones";
  const resultados = useMemo(() => {
    const t = normalizarTexto(q.trim());
    return ctx.cur.ramos
      .filter((r) => !esSoloMalla(r) && creditosCurriculares(ctx, r) > 0 && (r.tipo === "OFG" || !periodo.ramos.some((e) => e.id === r.id)))
      .filter((r) => !t || normalizarTexto(`${r.id} ${r.sigla ?? ""} ${r.nombre}`).includes(t))
      .slice(0, 8);
  }, [q, ctx, periodo]);
  const agregar = (id: string) => {
    const r = ctx.cur.map[id];
    mutar(`Agregar ${r.nombre}`, (c) => {
      const p = periodoPorClave(c.st, clave);
      if (p) agregarRamoAPeriodo(c, p, id);
    });
    toast(`${r.nombre} agregado a ${nombrePeriodo(periodo, ctx.cur.malla.periodoVerano)}`);
    setQ("");
    setAbierto(false);
  };
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" />
      <input
        className="input !py-2.5 !pl-9"
        placeholder={conv ? "Buscar y agregar un ramo convalidado…" : "Buscar y agregar un ramo a este periodo…"}
        value={q}
        role="combobox"
        aria-expanded={abierto}
        aria-controls="lista-buscador"
        onChange={(e) => (setQ(e.target.value), setAbierto(true), setActivo(0))}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setActivo((a) => Math.min(resultados.length - 1, a + 1)));
          if (e.key === "ArrowUp") (e.preventDefault(), setActivo((a) => Math.max(0, a - 1)));
          if (e.key === "Enter" && resultados[activo]) (e.preventDefault(), agregar(resultados[activo].id));
          if (e.key === "Escape") setAbierto(false);
        }}
      />
      {abierto && resultados.length > 0 && (
        <ul id="lista-buscador" role="listbox" className="animar-entrada absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {resultados.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === activo}>
              <button
                type="button"
                onMouseDown={(e) => (e.preventDefault(), agregar(r.id))}
                onMouseEnter={() => setActivo(i)}
                className={cx("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px]", i === activo && "bg-surface-2")}
              >
                <span className="w-20 shrink-0 font-mono text-[11.5px] text-fg-3">{r.sigla ?? r.id}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.nombre}</span>
                <span className="text-[12px] text-fg-3">S{r.semestre || "–"} · {r.creditos} cr</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Notas() {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const [sel, setSel] = useState<string | null>(null);
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalEscala, setModalEscala] = useState(false);
  const verano = ctx.cur.malla.periodoVerano ?? "Semestre de verano";
  const posicion = ctx.cur.malla.posicionToma === "banner" ? "Banner" : "Ventana";
  const ordenados = periodosOrdenados(ctx.st);
  const claveSel = sel && ordenados.some((p) => clavePeriodo(p) === sel) ? sel : `s${ctx.st.semestreActual}`;
  const periodo = ordenados.find((p) => clavePeriodo(p) === claveSel) ?? ordenados.at(-1);
  const promedio = periodo ? calcularPPA(ctx, [periodo]).ppa : null;
  const tieneNotas = periodo?.ramos.some((e) => e.notaFinal !== null || e.categorias.some((c) => c.notas.some((n) => n.n !== null)));

  const exportarPDF = () => {
    let cuerpo = "";
    periodosOrdenados(ctx.st).forEach((p) => {
      const filas = p.ramos
        .map((e) => ({ e, n: notaEntrada(ctx, e) }))
        .filter((x) => x.n !== null)
        .map(({ e, n }) => `<tr><td class="mono">${escaparHTML(siglaEntrada(ctx, e))}</td><td>${escaparHTML(nombreEntrada(ctx, e))}</td><td class="num ${n! < NOTA_APROB ? "mal" : ""}">${fmtNota(n)}</td></tr>`)
        .join("");
      if (!filas) return;
      const ppaP = calcularPPA(ctx, [p]).ppa;
      cuerpo += `<h2>${escaparHTML(nombrePeriodo(p, verano))}${p.ventana ? ` · ${posicion} ${escaparHTML(p.ventana)}` : ""}</h2><table><tr><th style="width:110px">Sigla</th><th>Ramo</th><th style="width:80px">Nota</th></tr>${filas}<tr class="total"><td></td><td>Promedio del periodo</td><td class="num">${fmtNota(ppaP, 2)}</td></tr></table>`;
    });
    if (!cuerpo) return toast("Aún no hay notas finales registradas.", "error");
    const total = calcularPPA(ctx);
    cuerpo += `<table><tr class="total"><td>PPA acumulado</td><td class="num" style="width:80px">${fmtNota(total.ppa, 3)}</td></tr></table>`;
    abrirImpresion("Notas y PPA", `${ctx.cur.malla.carrera} · ${ctx.cur.malla.universidad}`, cuerpo);
  };

  const exportarICS = () => {
    const evs = evaluacionesConFecha(ctx);
    if (!evs.length) return toast("Primero agrega fechas a tus evaluaciones (botón ··· de cada nota).", "info");
    descargarArchivo(`evaluaciones-s${ctx.st.semestreActual}.ics`, generarICS(evs, `Evaluaciones · ${ctx.cur.malla.carrera}`), "text/calendar");
    toast(`${plural(evs.length, "evaluación exportada", "evaluaciones exportadas")}. Ábrelo con Google Calendar o tu app de calendario.`);
  };

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[13.5px] text-fg-2">
        Funciona como una planilla: ingresas tus evaluaciones una vez y se calculan solos los promedios por categoría, la nota del ramo, lo que necesitas para aprobar y tu PPA.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-fg-2">Promedio · {periodo ? nombrePeriodo(periodo, verano) : "—"}</p>
            <p className={cx("mt-1 text-[40px] leading-none font-extrabold tracking-tight tabular", promedio === null ? "text-fg-3" : promedio >= NOTA_APROB ? "text-fg" : "text-danger")}>{fmtNota(promedio, 2)}</p>
            <p className="mt-1 text-[12px] text-fg-3">Ponderado por créditos, solo ramos con nota final.</p>
          </div>
          {periodo && periodo.tipo === "regular" && (
            <div className="flex items-center gap-2">
              <label className="text-[12.5px] font-semibold text-fg-2" htmlFor="ventana">
                {posicion} del semestre
              </label>
              <input
                id="ventana"
                key={claveSel}
                className="input w-24 text-center font-bold uppercase placeholder:font-normal placeholder:normal-case"
                defaultValue={periodo.ventana ?? ""}
                placeholder={posicion === "Ventana" ? "Ej. A5" : "Ej. 7/16"}
                maxLength={posicion === "Ventana" ? 2 : 8}
                title={posicion === "Ventana" ? "Letra de A a E y número de 1 a 5, por ejemplo A5" : "Tu posición de banner, por ejemplo 7/16"}
                onBlur={(e) => {
                  const v = e.target.value.trim().toUpperCase();
                  if (posicion === "Ventana" && v && !/^[A-E][1-5]$/.test(v)) {
                    e.target.value = periodo.ventana ?? "";
                    return toast("Ventana inválida. Usa una letra de A a E y un número de 1 a 5 (ej. A5).", "error");
                  }
                  if (v !== (periodo.ventana ?? "")) mutar(`${posicion} del semestre`, (c) => {
                    const p = periodoPorClave(c.st, claveSel);
                    if (p) p.ventana = v || undefined;
                  });
                }}
              />
            </div>
          )}
        </Tarjeta>
        <Simulador />
      </div>

      <Tarjeta>
        <CabeceraTarjeta
          icono={<FolderOpen className="size-[18px]" />}
          titulo="Periodos"
          descripcion="El semestre en curso se crea solo con los ramos que marcaste como Cursando."
          acciones={
            <>
              <Boton tamano="sm" variante="fantasma" icono={<Calculator className="size-4" />} onClick={() => setModalEscala(true)}>
                Escala de notas
              </Boton>
              <Boton tamano="sm" variante="fantasma" icono={<CalendarPlus className="size-4" />} onClick={exportarICS}>
                Calendario
              </Boton>
              <Boton tamano="sm" variante="fantasma" icono={<FileDown className="size-4" />} onClick={exportarPDF}>
                PDF
              </Boton>
              <Boton tamano="sm" variante="primario" icono={<FolderPlus className="size-4" />} onClick={() => setModalPeriodo(true)}>
                Crear periodo
              </Boton>
            </>
          }
        />
        <div className="scroll-x -mx-1 mb-4 px-1 pb-1">
          <div className="flex gap-2" role="tablist" aria-label="Periodos">
            {ordenados.map((p) => {
              const k = clavePeriodo(p);
              const activo = k === clavePeriodo(periodo!);
              const ppaP = calcularPPA(ctx, [p]).ppa;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setSel(k)}
                  className={cx(
                    "flex min-w-[118px] shrink-0 flex-col items-start gap-0.5 rounded-2xl border px-3.5 py-2.5 text-left transition-colors",
                    activo ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-bold">
                    {p.tipo === "convalidaciones" ? <FileCheck2 className="size-3.5" /> : p.tipo === "verano" ? <Sun className="size-3.5" /> : null}
                    {p.tipo === "convalidaciones" ? "Convalidaciones" : p.tipo === "verano" ? `Verano ${p.numero}` : `Semestre ${p.numero}`}
                  </span>
                  <span className="text-[11.5px] text-fg-3">
                    {esPeriodoActual(ctx.st, p) && <span className="mr-1 font-bold text-accent">Actual ·</span>}
                    {ppaP !== null ? `Prom. ${fmtNota(ppaP, 2)}` : plural(p.ramos.length, "ramo")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {periodo && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[240px] flex-1">
                <BuscadorRamo periodo={periodo} />
              </div>
              {periodo.ramos.length > 1 && (
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  onClick={() =>
                    mutar(null, (c) => {
                      const p = periodoPorClave(c.st, claveSel);
                      if (!p) return;
                      const colapsar = !p.ramos.every((e) => e.colapsado);
                      p.ramos.forEach((e) => (e.colapsado = colapsar));
                    })
                  }
                >
                  {periodo.ramos.every((e) => e.colapsado) ? "Expandir todo" : "Colapsar todo"}
                </Boton>
              )}
              {!esPeriodoActual(ctx.st, periodo) && (
                <BotonIcono
                  etiqueta={`Eliminar ${nombrePeriodo(periodo, verano)}`}
                  className="hover:!text-danger"
                  onClick={async () => {
                    const ok = await confirmar({
                      titulo: `Eliminar ${nombrePeriodo(periodo, verano)}`,
                      mensaje: periodo.ramos.length ? `Tiene ${plural(periodo.ramos.length, "ramo")} con sus notas. Puedes deshacerlo justo después.` : "Está vacío.",
                      aceptar: "Eliminar",
                      peligro: true,
                    });
                    if (!ok) return;
                    mutar(`Eliminar ${nombrePeriodo(periodo, verano)}`, (c) => {
                      const p = periodoPorClave(c.st, claveSel);
                      if (p) eliminarPeriodo(c, p);
                    });
                    setSel(null);
                  }}
                >
                  <Trash2 className="size-4" />
                </BotonIcono>
              )}
            </div>
            {!tieneNotas && (
              <p className="text-[13px] text-fg-2">
                {periodo.ramos.length > 0
                  ? "Así se ve un ramo con notas (el ejemplo desaparece al ingresar la primera):"
                  : esPeriodoActual(ctx.st, periodo)
                    ? "Marca ramos como Cursando en la malla o búscalos arriba. Así se ve un ramo con notas:"
                    : "Busca arriba los ramos que cursaste en este periodo. Así se ve un ramo con notas:"}
              </p>
            )}
            <div className="grid gap-4 2xl:grid-cols-2">
              {!tieneNotas && <RamoEjemplo />}
              {periodo.ramos.map((e) => (
                <RamoCard key={e.uid} ctx={ctx} periodo={periodo} entrada={e} />
              ))}
            </div>
          </div>
        )}
      </Tarjeta>

      <ModalPeriodo
        abierto={modalPeriodo}
        onCerrar={() => setModalPeriodo(false)}
        onCrear={(tipo, n) => {
          mutar("Crear periodo", (c) => void obtenerPeriodo(c.st, tipo, n, true));
          setSel(tipo === "convalidaciones" ? "c0" : (tipo === "verano" ? "v" : "s") + n);
          setModalPeriodo(false);
        }}
      />
      <ModalEscala abierto={modalEscala} onCerrar={() => setModalEscala(false)} />
    </div>
  );
}
