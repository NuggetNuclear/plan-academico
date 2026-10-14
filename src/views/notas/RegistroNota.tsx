import { Calculator, Check, ChevronDown, NotebookPen, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { clavePeriodo, nombreEntrada, nombrePeriodo, siglaEntrada, type Ctx } from "../../core/academic";
import { fmtNota, leerNumero, numeroConComa } from "../../core/format";
import { configExamen, indiceExamen, notaDesdePuntaje } from "../../core/grades";
import type { Entrada, Periodo } from "../../core/state";
import { useApp } from "../../store/app";
import { periodoPorClave } from "../../store/mutaciones";
import { toast } from "../../store/ui";
import { CabeceraModal, Modal, PieModal } from "../../ui/overlays";
import { Boton, cx } from "../../ui/primitives";
import { alertaTrasNota } from "../riesgoCausal";
import { guardarRegistro, validarRegistro, type Registro } from "./registro";

export interface SeleccionNota { uid?: string; categoria?: string; nota?: string }

/** destino = "idCategoría:idNota" → posiciones actuales (-1 si ya no existe). */
function ubicar(e: Entrada | undefined, destino: string): [number, number] {
  const [cid, nid] = destino.split(":");
  const ci = e?.categorias.findIndex((c) => c.id === cid) ?? -1;
  return [ci, ci < 0 ? -1 : e!.categorias[ci].notas.findIndex((n) => n.id === nid)];
}

/** Puntaje → nota con la escala chilena, para no salir del registro. */
function DesdePuntaje({ onUsar }: { onUsar: (nota: number) => void }) {
  const [p, setP] = useState({ obtenido: "", max: "", exigencia: "60" });
  const nota = (() => {
    const o = leerNumero(p.obtenido);
    const m = leerNumero(p.max);
    const ex = leerNumero(p.exigencia);
    if (![o, m, ex].every(Number.isFinite) || m <= 0 || o < 0 || o > m || ex <= 0 || ex >= 100) return null;
    return notaDesdePuntaje(o, { puntajeMax: m, exigencia: ex / 100 });
  })();
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-surface p-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor="puntaje-obtenido">Tu puntaje</label>
          <input id="puntaje-obtenido" className="input !py-1.5 text-center" inputMode="decimal" placeholder="42" value={p.obtenido} onChange={(e) => setP({ ...p, obtenido: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="puntaje-max">Puntaje máximo</label>
          <input id="puntaje-max" className="input !py-1.5 text-center" inputMode="decimal" placeholder="60" value={p.max} onChange={(e) => setP({ ...p, max: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="puntaje-exigencia">Exigencia %</label>
          <input id="puntaje-exigencia" className="input !py-1.5 text-center" inputMode="numeric" value={p.exigencia} onChange={(e) => setP({ ...p, exigencia: e.target.value })} />
        </div>
      </div>
      <Boton tamano="sm" variante="suave" className="w-full" disabled={nota === null} onClick={() => nota !== null && onUsar(nota)}>
        {nota !== null ? `Usar nota ${fmtNota(nota)}` : "Escribe tu puntaje y el máximo"}
      </Boton>
    </div>
  );
}

/** La próxima evaluación sin nota: es casi siempre la que vienes a registrar. */
function primeraPendiente(e: Entrada | undefined): string {
  for (const c of e?.categorias ?? []) {
    const n = c.notas.find((n) => n.n === null);
    if (n) return `${c.id}:${n.id}`;
  }
  return "nueva";
}

function datosDe(e: Entrada | undefined, destino: string) {
  if (!e || destino === "nueva") return { nombre: "", nota: "", fecha: "", factor: "" };
  const [ci, ni] = ubicar(e, destino);
  const cat = e.categorias[ci];
  const n = cat?.notas[ni];
  if (!n) return { nombre: "", nota: "", fecha: "", factor: "" };
  return { nombre: n.etiqueta || `${cat.nombre || "Evaluación"} ${ni + 1}`, nota: numeroConComa(n.n), fecha: n.fecha ?? "", factor: numeroConComa(n.f) };
}

export function RegistroNota({ ctx, periodo, seleccion, onCerrar }: { ctx: Ctx; periodo: Periodo; seleccion: SeleccionNota; onCerrar: () => void }) {
  const disponibles = periodo.ramos.filter((e) => e.notaFinal === null);
  const nombres = disponibles.map((e) => nombreEntrada(ctx, e));
  const repetidos = new Set(nombres.filter((n, i) => nombres.indexOf(n) !== i));
  const [uid, setUid] = useState(seleccion.uid ?? disponibles[0]?.uid ?? "");
  const entrada = disponibles.find((e) => e.uid === uid);
  const inicial = seleccion.categoria && seleccion.nota ? `${seleccion.categoria}:${seleccion.nota}` : primeraPendiente(entrada);
  const [destino, setDestino] = useState(inicial);
  const [categoria, setCategoria] = useState("nueva");
  const datos0 = datosDe(entrada, inicial);
  const original = inicial !== "nueva";
  const [nombre, setNombre] = useState(datos0.nombre);
  const [nota, setNota] = useState(datos0.nota);
  const [fecha, setFecha] = useState(datos0.fecha);
  const [factor, setFactor] = useState(datos0.factor);
  const [porcentaje, setPorcentaje] = useState("");
  const [puntaje, setPuntaje] = useState(false);
  const [mas, setMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const guardando = useRef(false);
  const existente = destino !== "nueva";
  const nuevaCategoria = !existente && categoria === "nueva";
  const elegir = (valor: string, e = entrada) => {
    setDestino(valor);
    setError(null);
    const d = datosDe(e, valor);
    setNombre(d.nombre);
    setNota(d.nota);
    setFecha(d.fecha);
    setFactor(d.factor);
  };
  const mostrarError = (mensaje: string) => {
    setError(mensaje);
    requestAnimationFrame(() => errorRef.current?.focus());
  };
  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrada || guardando.current) return;
    // Las posiciones se resuelven contra el ramo que se modifica: si algo cambió, se ubica por id.
    const datosPara = (e: Entrada): Registro => {
      const [ci, ni] = ubicar(e, destino);
      const cat = categoria === "nueva" ? null : e.categorias.findIndex((c) => c.id === categoria);
      return { categoria: existente ? ci : cat, evaluacion: existente ? ni : null, nombre, nota, fecha, porcentaje, factor: existente ? factor : "" };
    };
    const err = validarRegistro(entrada, datosPara(entrada));
    if (err) return mostrarError(err);
    guardando.current = true;
    let fallo: string | null = null;
    useApp.getState().mutar(`Nota de ${nombreEntrada(ctx, entrada)}`, (actual) => {
      const ramo = periodoPorClave(actual.st, clavePeriodo(periodo))?.ramos.find((r) => r.uid === uid);
      fallo = ramo ? guardarRegistro(ramo, datosPara(ramo)) : "Este ramo ya no está en el periodo.";
    });
    if (fallo) { guardando.current = false; return mostrarError(fallo); }
    const { cur, st } = useApp.getState();
    const alerta = cur ? alertaTrasNota({ cur, st }, uid) : null;
    toast(alerta ?? `${nombre.trim()}: ${nota.replace(".", ",")} guardada`, alerta ? "error" : "ok", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
    onCerrar();
  };
  const eliminar = () => {
    if (!entrada || !existente) return;
    useApp.getState().mutar(`Eliminar ${nombre.trim() || "evaluación"}`, (actual) => {
      const ramo = periodoPorClave(actual.st, clavePeriodo(periodo))?.ramos.find((r) => r.uid === uid);
      const [ci, ni] = ubicar(ramo, destino);
      if (ni >= 0) ramo!.categorias[ci].notas.splice(ni, 1);
    });
    toast(`${nombre.trim() || "Evaluación"} eliminada`, "info", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
    onCerrar();
  };
  const catActual = existente ? entrada?.categorias[ubicar(entrada, destino)[0]] : null;

  return (
    <Modal abierto onCerrar={onCerrar} etiqueta="Registrar nota" ancho="md">
      <form onSubmit={guardar} noValidate aria-describedby={error ? "registro-error" : undefined}>
        <CabeceraModal icono={<NotebookPen className="size-5" />} titulo="Registrar nota" sobretitulo={nombrePeriodo(periodo, ctx.cur.malla.periodoVerano)} onCerrar={onCerrar}>
          Elige la evaluación, escribe tu nota y listo.
        </CabeceraModal>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="registro-ramo" className="label">Ramo</label>
            <select id="registro-ramo" className="input" value={uid} onChange={(e) => { const otra = disponibles.find((r) => r.uid === e.target.value); setUid(e.target.value); setCategoria("nueva"); setPorcentaje(""); elegir(primeraPendiente(otra), otra); }}>
              {disponibles.map((r) => <option key={r.uid} value={r.uid}>{repetidos.has(nombreEntrada(ctx, r)) ? `${nombreEntrada(ctx, r)} · ${siglaEntrada(ctx, r)}` : nombreEntrada(ctx, r)}</option>)}
            </select>
          </div>
          {!!entrada?.categorias.length && <div>
            <label htmlFor="registro-evaluacion" className="label">Evaluación</label>
            <select id="registro-evaluacion" className="input" value={destino} onChange={(e) => elegir(e.target.value)}>
              {entrada.categorias.map((c, ci) => <optgroup key={c.id} label={c.nombre || `Categoría ${ci + 1}`}>
                {c.notas.map((n, ni) => <option key={n.id} value={`${c.id}:${n.id}`}>{n.etiqueta || `${c.nombre || "Evaluación"} ${ni + 1}`} · {n.n === null ? "Pendiente" : fmtNota(n.n)}</option>)}
              </optgroup>)}
              <option value="nueva">Otra evaluación (nueva)</option>
            </select>
          </div>}
          {!existente && !!entrada?.categorias.length && <div>
            <label htmlFor="registro-categoria" className="label">¿Dónde cuenta esta evaluación?</label>
            <select id="registro-categoria" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="nueva">Tiene su propio porcentaje</option>
              {entrada.categorias.map((c, ci) => <option key={c.id} value={c.id}>{c.nombre || `Categoría ${ci + 1}`} ({c.peso}%)</option>)}
            </select>
            {categoria !== "nueva" && <p className="mt-1 text-xs text-fg-2">Se suma a esa categoría y reparte su porcentaje con las demás.</p>}
          </div>}
          {!existente && <div>
            <label htmlFor="registro-nombre" className="label">Nombre de la evaluación</label>
            <input id="registro-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Solemne 1" required maxLength={100} aria-invalid={!!error && !nombre.trim()} aria-describedby={error && !nombre.trim() ? "registro-error" : undefined} />
          </div>}
          <div className="rounded-2xl border border-accent-line bg-accent-soft p-4">
            <label htmlFor="registro-nota" className="label">Tu nota{existente ? ` en ${nombre}` : ""}</label>
            <input id="registro-nota" data-autofocus={original ? true : undefined} className="input !text-3xl font-bold tabular" inputMode="decimal" autoComplete="off" enterKeyHint="done" placeholder="5,5" value={nota} onChange={(e) => setNota(e.target.value)} aria-invalid={!!error && (!Number.isFinite(leerNumero(nota)) || leerNumero(nota) < 1 || leerNumero(nota) > 7)} aria-describedby={error ? "registro-ayuda registro-error" : "registro-ayuda"} required />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p id="registro-ayuda" className="text-xs text-fg-2">De 1,0 a 7,0. Acepta coma o punto.</p>
              <button type="button" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline" aria-expanded={puntaje} onClick={() => setPuntaje((v) => !v)}>
                <Calculator className="size-3.5" /> Me dieron puntaje
              </button>
            </div>
            {puntaje && <DesdePuntaje onUsar={(n) => (setNota(numeroConComa(Math.round(n * 10) / 10)), setPuntaje(false))} />}
          </div>
          {nuevaCategoria && <div>
            <label htmlFor="registro-peso" className="label">Porcentaje de la nota {entrada && indiceExamen(entrada) >= 0 && configExamen(entrada).escala === "presentacion" ? "de presentación" : "final"} (opcional)</label>
            <input id="registro-peso" className="input" inputMode="decimal" placeholder="Ej. 30" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} aria-describedby="registro-peso-ayuda" />
            <p id="registro-peso-ayuda" className="mt-1 text-xs text-fg-2">¿No lo sabes? Déjalo vacío. La nota queda guardada y contará cuando le pongas porcentaje en «Evaluaciones».</p>
          </div>}
          <div>
            <button type="button" className="flex items-center gap-1 text-[13px] font-semibold text-fg-2 hover:text-fg" aria-expanded={mas} aria-controls="registro-mas" onClick={() => setMas((v) => !v)}>
              <ChevronDown className={cx("size-4 transition-transform", mas && "rotate-180")} /> Fecha y más opciones
            </button>
            {mas && <div id="registro-mas" className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="registro-fecha" className="label">Fecha de la evaluación</label>
                <input id="registro-fecha" className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              {existente && <>
                <div>
                  <label htmlFor="registro-nombre" className="label">Nombre</label>
                  <input id="registro-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} />
                </div>
                <div>
                  <label htmlFor="registro-factor" className="label">Vale × dentro de {catActual?.nombre || "su categoría"}</label>
                  <input id="registro-factor" className="input" inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value)} aria-describedby="registro-factor-ayuda" />
                  <p id="registro-factor-ayuda" className="mt-1 text-xs text-fg-3">1 = igual que las demás, 2 = doble, 0 = no cuenta.</p>
                </div>
              </>}
            </div>}
          </div>
          {error && <p id="registro-error" ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        </div>
        <PieModal>
          {existente && <Boton variante="fantasma" className="mr-auto hover:!text-danger" icono={<Trash2 className="size-4" />} onClick={eliminar}>Eliminar</Boton>}
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="primario" icono={<Check className="size-4" />} disabled={!entrada}>Guardar nota</Boton>
        </PieModal>
      </form>
    </Modal>
  );
}
