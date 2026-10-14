import {
  Asterisk,
  Calculator,
  CalendarDays,
  CircleCheck,
  CircleX,
  Flag,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Settings2,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { creditosEntrada, esPeriodoActual, nombreEntrada, nombreRamo, ramoCatalogo, siglaEntrada, siglaRamo, situacionSemestreUDP, type Ctx } from "../../core/academic";
import { esPersonalizable } from "../../core/curriculum";
import { NOTA_APROB, fmtNota, leerNumero, numeroConComa } from "../../core/format";
import { calcularRamo, notaDesdePuntaje, PLANTILLAS, ramoAsegurado, statsCategoria } from "../../core/grades";
import type { Categoria, Entrada, Nota, Periodo } from "../../core/state";
import { useApp } from "../../store/app";
import { cerrarEntrada, periodoPorClave, quitarEntrada, reabrirEntrada } from "../../store/mutaciones";
import { clavePeriodo } from "../../core/academic";
import { confirmar, pedirTexto, toast } from "../../store/ui";
import { CampoNumero, CampoTexto } from "../../ui/CampoNumero";
import { OpcionMenu, Popover } from "../../ui/overlays";
import { Boton, BotonIcono, Insignia, Segmentado, cx } from "../../ui/primitives";

import { AvisoCausalRamo, letrasCausal } from "../riesgoCausal";
import type { SeleccionNota } from "./RegistroNota";

type Editor = (etiqueta: string | null, fn: (e: Entrada, ctx: Ctx, p: Periodo) => void) => void;

function useEditor(clave: string, uid: string): Editor {
  const mutar = useApp((s) => s.mutar);
  return (etiqueta, fn) =>
    mutar(etiqueta, (ctx) => {
      const p = periodoPorClave(ctx.st, clave);
      const e = p?.ramos.find((x) => x.uid === uid);
      if (p && e) fn(e, ctx, p);
    });
}

const claseNota = (n: number | null) => (n === null ? "text-fg-3" : n >= NOTA_APROB ? "text-ok" : "text-danger");

// ── Casilla de una evaluación ──
function CasillaNota({ nota, etiqueta, onEditar, onBorrar, soloLectura, modoActual }: { etiqueta: string; nota: Nota; onEditar: (n: Partial<Nota>) => void; onBorrar: () => void; soloLectura: boolean; modoActual: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [puntaje, setPuntaje] = useState({ obtenido: "", max: "", exigencia: "60" });
  const campoId = useId();
  const nombre = nota.etiqueta?.trim() || etiqueta;
  const fechaCorta = nota.fecha ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(nota.fecha + "T12:00:00")) : null;
  const notaPuntaje = (() => {
    const o = leerNumero(puntaje.obtenido);
    const m = leerNumero(puntaje.max);
    const ex = leerNumero(puntaje.exigencia);
    if (Number.isNaN(o) || Number.isNaN(m) || Number.isNaN(ex) || m <= 0 || o < 0 || o > m || ex <= 0 || ex >= 100) return null;
    return notaDesdePuntaje(o, { puntajeMax: m, exigencia: ex / 100 });
  })();

  return (
    <div className="group/nota relative flex flex-col items-center">
      <div
        className={cx(
          "flex items-stretch overflow-hidden rounded-lg border bg-surface transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft",
          nota.n === null ? "border-dashed border-line-strong" : "border-line-strong",
          nota.f === 0 && "opacity-50",
        )}
      >
        <CampoNumero
          valor={nota.n}
          min={1}
          max={7}
          minDecimales={1}
          onGuardar={(v) => onEditar({ n: v })}
          disabled={soloLectura}
          placeholder="—"
          aria-label={nombre ? `Nota de ${nombre}` : "Nota"}
          title={nota.n === null ? (modoActual ? "Pendiente: no cuenta hasta que pongas la nota" : "Pendiente: cuenta como 1,0") : undefined}
          className={cx("w-11 bg-transparent px-1 py-1.5 text-center font-mono text-[13px] font-semibold outline-none", claseNota(nota.n))}
        />
        {!soloLectura && (
          <button
            ref={ref}
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label={`Opciones de ${nombre}`}
            aria-expanded={abierto}
            aria-haspopup="dialog"
            className={cx(
              "grid min-w-8 place-items-center border-l border-line text-fg-3 hover:bg-surface-2 hover:text-fg",
              nota.f !== 1 && "w-auto px-1 font-mono text-[10px] font-bold text-accent",
            )}
          >
            {nota.f !== 1 ? `×${numeroConComa(nota.f)}` : <MoreHorizontal className="size-3" />}
          </button>
        )}
      </div>
      {(nombre || fechaCorta) && (
        <span className="mt-0.5 max-w-[76px] truncate text-[10px] leading-tight text-fg-3" title={[nombre, fechaCorta].filter(Boolean).join(" · ")}>
          {fechaCorta ?? nombre}
        </span>
      )}
      <Popover ancla={ref} abierto={abierto} onCerrar={() => setAbierto(false)} ancho={260} className="p-3">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="label" htmlFor={`${campoId}-nombre`}>Nombre</label>
              <CampoTexto id={`${campoId}-nombre`} className="input !py-1.5" valor={nota.etiqueta ?? ""} placeholder="Ej. Solemne 2" onGuardar={(v) => onEditar({ etiqueta: v || undefined })} />
            </div>
            <div>
              <label className="label" htmlFor={`${campoId}-fecha`}>Fecha</label>
              <input id={`${campoId}-fecha`} type="date" className="input !px-2 !py-1.5" value={nota.fecha ?? ""} onChange={(e) => onEditar({ fecha: e.target.value || null })} />
            </div>
            <div>
              <label htmlFor={`${campoId}-factor`} className="label" title="Cuánto vale frente a las demás de su categoría (0 = no cuenta)">
                Peso ×
              </label>
              <CampoNumero id={`${campoId}-factor`} className="input !py-1.5" valor={nota.f} min={0} max={100} vacioPermitido={false} onGuardar={(v) => onEditar({ f: v ?? 1 })} />
            </div>
          </div>
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold">
              <Calculator className="size-3.5 text-accent" /> Desde puntaje
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <input className="input !px-2 !py-1 text-center" inputMode="decimal" placeholder="Pts" aria-label="Puntaje obtenido" value={puntaje.obtenido} onChange={(e) => setPuntaje({ ...puntaje, obtenido: e.target.value })} />
              <input className="input !px-2 !py-1 text-center" inputMode="decimal" placeholder="Máx" aria-label="Puntaje máximo" value={puntaje.max} onChange={(e) => setPuntaje({ ...puntaje, max: e.target.value })} />
              <div className="relative">
                <input className="input !px-2 !py-1 pr-5 text-center" inputMode="numeric" aria-label="Exigencia" value={puntaje.exigencia} onChange={(e) => setPuntaje({ ...puntaje, exigencia: e.target.value })} />
                <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] text-fg-3">%</span>
              </div>
            </div>
            <Boton
              tamano="sm"
              variante="suave"
              className="mt-2 w-full"
              disabled={notaPuntaje === null}
              onClick={() => {
                onEditar({ n: notaPuntaje });
                setAbierto(false);
              }}
            >
              {notaPuntaje !== null ? `Usar nota ${fmtNota(notaPuntaje)}` : "Escribe puntaje y máximo"}
            </Boton>
          </div>
          <OpcionMenu icono={<Trash2 />} peligro onClick={() => (onBorrar(), setAbierto(false))}>
            Eliminar evaluación
          </OpcionMenu>
        </div>
      </Popover>
    </div>
  );
}

// ── Fila de una categoría ──
function FilaCategoria({ cat, ci, editar, soloLectura, modoActual }: { cat: Categoria; ci: number; editar: Editor; soloLectura: boolean; modoActual: boolean }) {
  const st = statsCategoria(cat);
  const prom = modoActual ? st.promRendido : st.prom;
  const editarCat = (et: string | null, fn: (c: Categoria) => void) => editar(et, (e) => fn(e.categorias[ci]));
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="flex items-center gap-1.5">
        <CampoTexto
          valor={cat.nombre}
          disabled={soloLectura}
          placeholder="Categoría"
          aria-label="Nombre de la categoría"
          onGuardar={(v) => editarCat("Renombrar categoría", (c) => (c.nombre = v))}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-semibold outline-none hover:border-line focus:border-accent focus:bg-surface"
        />
        <div className="flex items-center rounded-lg border border-line-strong bg-surface pr-1.5 focus-within:border-accent">
          <CampoNumero
            valor={cat.peso || null}
            min={0}
            max={100}
            decimales={1}
            disabled={soloLectura}
            placeholder="0"
            aria-label="Porcentaje de la categoría"
            onGuardar={(v) => editarCat("Cambiar porcentaje", (c) => (c.peso = v ?? 0))}
            className="w-10 bg-transparent px-1 py-1 text-right text-[13px] font-semibold outline-none"
          />
          <span className="text-[12px] text-fg-3">%</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-1.5">
        {cat.notas.map((n, ni) => (
          <CasillaNota
            key={ni}
            nota={n}
            etiqueta={`${cat.nombre || "Evaluación"} ${ni + 1}`}
            soloLectura={soloLectura}
            modoActual={modoActual}
            onEditar={(cambio) => editarCat("Editar nota", (c) => Object.assign(c.notas[ni], cambio))}
            onBorrar={() => editarCat("Eliminar evaluación", (c) => c.notas.splice(ni, 1))}
          />
        ))}
        {!soloLectura && (
          <button
            type="button"
            onClick={() => editarCat("Agregar evaluación", (c) => c.notas.push({ n: null, f: 1 }))}
            className="grid h-[34px] w-9 place-items-center rounded-lg border border-dashed border-line-strong text-fg-3 transition-colors hover:border-accent hover:text-accent"
            aria-label={`Agregar evaluación a ${cat.nombre || "esta categoría"}`}
            title="Agregar evaluación"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 self-end sm:self-start">
        <button
          type="button"
          disabled={soloLectura}
          onClick={() => editarCat(cat.req ? "Quitar requisito" : "Marcar requisito", (c) => (c.req = !c.req))}
          title={cat.req ? "Requisito aprobatorio: debe promediar 4,0 por sí sola (clic para quitar)" : "Marcar como requisito aprobatorio (debe promediar 4,0)"}
          aria-label={`Exigir promedio 4,0 en ${cat.nombre || "esta categoría"}`}
          aria-pressed={!!cat.req}
          className={cx(
            "grid size-7 place-items-center rounded-lg transition-colors",
            cat.req ? (prom !== null && prom < NOTA_APROB ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent") : "text-fg-3 hover:bg-surface-3",
            soloLectura && !cat.req && "invisible",
          )}
        >
          <Asterisk className="size-3.5" />
        </button>
        <span className={cx("w-11 text-right font-mono text-[13px] font-bold tabular", claseNota(prom))} title={modoActual ? "Promedio de lo rendido" : "Promedio con 1,0 en lo pendiente"}>
          {fmtNota(prom, 2)}
        </span>
        {!soloLectura && (
          <BotonIcono tamano="sm" etiqueta={`Eliminar categoría ${cat.nombre || ci + 1}`} onClick={async () => {
            if (cat.notas.some((n) => n.n !== null) && !(await confirmar({ titulo: "Eliminar categoría", mensaje: `Se quitarán ${cat.nombre || "esta categoría"} y sus notas. Puedes deshacerlo.`, aceptar: "Eliminar", peligro: true }))) return;
            editar("Eliminar categoría", (e) => e.categorias.splice(ci, 1));
            toast("Categoría eliminada", "info", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
          }}>
            <Trash2 className="size-3.5" />
          </BotonIcono>
        )}
      </div>
    </div>
  );
}

// ── Tarjeta del ramo ──
export function RamoCard({ ctx, periodo, entrada, onRegistrar }: { ctx: Ctx; periodo: Periodo; entrada: Entrada; onRegistrar: (seleccion?: SeleccionNota) => void }) {
  const [configurando, setConfigurando] = useState(false);
  const panelId = useId();
  const clave = clavePeriodo(periodo);
  const editar = useEditor(clave, entrada.uid);
  const mutar = useApp((s) => s.mutar);
  const refPlantilla = useRef<HTMLButtonElement>(null);
  const [plantillas, setPlantillas] = useState(false);
  const r = calcularRamo(entrada);
  const ramo = ramoCatalogo(ctx, entrada.id);
  const esOFG = ramo?.tipo === "OFG";
  const conv = periodo.tipo === "convalidaciones";
  const actual = esPeriodoActual(ctx.st, periodo);
  const cursando = actual && ctx.st.cursando.includes(entrada.id);
  const asegurado = ramoAsegurado(r);
  const reqMal = r.reqFallidos.length > 0;
  const notaMostrada = r.nf !== null ? Math.min(7, r.nf + (r.cerrado ? r.decimas : 0)) : null;
  const personalizable = esPersonalizable(ramo) && !r.cerrado;

  const chip = r.cerrado ? (
    <Insignia tono={notaMostrada! >= NOTA_APROB ? "ok" : "danger"}>{conv ? "Convalidado" : notaMostrada! >= NOTA_APROB ? "Aprobado" : "Reprobado"}</Insignia>
  ) : asegurado ? (
    <Insignia tono="ok" icono={<CircleCheck className="size-3" />}>4,0 asegurado</Insignia>
  ) : conv ? (
    <Insignia tono="acento">Convalidado</Insignia>
  ) : cursando ? (
    <Insignia tono="info">Cursando</Insignia>
  ) : null;

  // Mensajes de lo que necesitas (sin redundancias).
  const ayudas: React.ReactNode[] = [];
  if (!r.cerrado) {
    if (r.nf === null && !entrada.categorias.some((c) => c.notas.some((n) => n.n !== null))) ayudas.push(<span key="v" className="text-fg-3">Registra tu primera nota para empezar</span>);
    else {
      const maxReq = r.reqMetas.length ? Math.max(...r.reqMetas.map((m) => m.nec)) : null;
      const generalManda = r.reqMetas.length === 0 || r.pendienteNoReq > 0 || (r.necesaria !== null && r.necesaria > (maxReq ?? 0));
      if (r.restante > 0 && r.necesaria !== null && generalManda) {
        if (r.necesaria <= 1 && !r.reqMetas.length) ayudas.push(<span key="a" className="flex items-center gap-1 font-semibold text-ok"><CircleCheck className="size-3.5" />4,0 asegurado aunque saques 1,0</span>);
        else if (r.necesaria > 7) ayudas.push(<span key="a" className="flex items-center gap-1 font-semibold text-danger"><CircleX className="size-3.5" />Ya no alcanza el 4,0</span>);
        else
          ayudas.push(
            <span key="a" className={cx("flex items-center gap-1 font-semibold", r.necesaria <= 4 ? "text-ok" : "text-warn")}>
              <Target className="size-3.5" />
              Necesitas {fmtNota(r.necesaria, 2)} en el {fmtNota(r.restante, r.restante % 1 ? 1 : 0)}% restante
            </span>,
          );
      }
      r.reqMetas.forEach((m) => ayudas.push(<span key={m.nombre} className="flex items-center gap-1 font-semibold text-warn"><Asterisk className="size-3.5" />{m.nombre}: ≥ {fmtNota(m.nec, 2)} en lo que queda</span>));
      r.reqFallidos.forEach((n) => ayudas.push(<span key={"f" + n} className="flex items-center gap-1 font-semibold text-danger"><Asterisk className="size-3.5" />{n}: bajo 4,0</span>));
      if (r.necesariaMeta !== null && entrada.meta)
        ayudas.push(
          <span key="m" className="flex items-center gap-1 font-semibold text-accent">
            <Flag className="size-3.5" />
            Meta {fmtNota(entrada.meta)}: {r.necesariaMeta > 7 ? "ya no alcanza" : r.necesariaMeta <= 1 ? "asegurada" : `necesitas ${fmtNota(r.necesariaMeta, 2)}`}
          </span>,
        );
    }
  }

  const registrarFinal = async () => {
    const v = await pedirTexto({
      titulo: "Registrar nota final",
      mensaje: `${nombreEntrada(ctx, entrada)}. Al registrarla, el ramo se actualiza en la malla y entra a tu PPA.`,
      etiqueta: "Cierre del ramo",
      aceptar: "Registrar",
      campo: {
        etiqueta: "Nota final (1,0 a 7,0)",
        valor: r.nf !== null ? numeroConComa(Math.round(r.nf * 10) / 10) : "",
        placeholder: "Ej. 5,5",
        inputMode: "decimal",
        validar: (x) => {
          const n = leerNumero(x);
          if (Number.isNaN(n) || n < 1 || n > 7) return "La nota debe estar entre 1,0 y 7,0.";
          if (conv && n < NOTA_APROB) return "Una convalidación debe tener nota 4,0 o superior.";
          return null;
        },
      },
    });
    if (v === null) return;
    const nota = leerNumero(v);
    const causales = (actual && ctx.cur.malla.reglamento === "udp" && situacionSemestreUDP(ctx).ramos.find((x) => x.entrada.uid === entrada.uid)?.causales) || [];
    editar(`Nota final de ${nombreEntrada(ctx, entrada)}`, (e, c, p) => cerrarEntrada(c, p, e, nota));
    if (nota >= NOTA_APROB) toast(`${nombreEntrada(ctx, entrada)} ${conv ? "convalidado" : "aprobado"} con ${fmtNota(nota)} 🎉`);
    else if (causales.length) toast(`${nombreEntrada(ctx, entrada)} reprobado con ${fmtNota(nota)}: quedas en ${letrasCausal(causales)} de eliminación. Revisa Inicio › Tu situación académica.`, "error");
    else toast(`${nombreEntrada(ctx, entrada)} reprobado con ${fmtNota(nota)}. La nota queda en tu PPA y el ramo vuelve a estar disponible.`, "error");
  };

  return (
    <article aria-label={nombreEntrada(ctx, entrada)}
      className={cx(
        "card min-w-0 flex flex-col overflow-hidden !rounded-2xl transition-colors",
        r.cerrado ? (notaMostrada! >= NOTA_APROB ? "border-ok/30" : "border-danger/30") : asegurado ? "border-ok/30" : reqMal ? "border-danger/30" : "",
      )}
    >
      <header className="flex items-start gap-3 border-b border-line p-4">
        <div className="min-w-0 flex-1">
          {personalizable && configurando ? (
            <div className="flex flex-wrap gap-1.5">
              <CampoTexto
                className="input w-28 !px-2 !py-1 font-mono !text-[12px]"
                valor={esOFG ? entrada.siglaReal ?? "" : ctx.st.alias[entrada.id]?.sigla ?? ""}
                placeholder={siglaRamo(ctx, entrada.id)}
                aria-label="Sigla real"
                onGuardar={(v) =>
                  esOFG
                    ? editar("Cambiar sigla", (e) => (e.siglaReal = v))
                    : mutar("Cambiar sigla", ({ st }) => {
                        st.alias[entrada.id] = { ...st.alias[entrada.id], sigla: v || undefined };
                      })
                }
              />
              <CampoTexto
                className="input min-w-0 flex-1 !px-2 !py-1 !text-[13px] font-semibold"
                valor={esOFG ? entrada.nombreReal ?? "" : ctx.st.alias[entrada.id]?.nombre ?? ""}
                placeholder={ramo?.nombre ?? entrada.id}
                aria-label="Nombre real del curso"
                onGuardar={(v) =>
                  esOFG
                    ? editar("Cambiar nombre", (e) => (e.nombreReal = v))
                    : mutar("Cambiar nombre", ({ st }) => {
                        st.alias[entrada.id] = { ...st.alias[entrada.id], nombre: v || undefined };
                      })
                }
              />
            </div>
          ) : (
            <>
              <p className="font-mono text-[11px] font-semibold text-fg-3">{siglaEntrada(ctx, entrada)}</p>
              <h3 className="text-[14.5px] leading-snug font-bold">{esOFG ? nombreEntrada(ctx, entrada) : nombreRamo(ctx, entrada.id)}</h3>
            </>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {esOFG && !r.cerrado ? (
              <label className="flex items-center gap-1 text-[12px] text-fg-2" title="Créditos reales de este curso">
                <CampoNumero
                  className="input w-12 !px-1.5 !py-0.5 text-center !text-[12px]"
                  valor={creditosEntrada(ctx, entrada)}
                  min={0}
                  max={30}
                  decimales={0}
                  vacioPermitido={false}
                  onGuardar={(v) => editar("Cambiar créditos", (e) => (e.creditos = v))}
                />
                cr
              </label>
            ) : (
              <Insignia>{creditosEntrada(ctx, entrada)} cr</Insignia>
            )}
            {chip}
          </div>
        </div>
        <div className="flex w-20 shrink-0 flex-col items-end gap-1.5 sm:w-28">
          <div className="flex items-baseline gap-1.5">
            <span className={cx("text-[30px] leading-none font-extrabold tracking-tight tabular", claseNota(notaMostrada))}>{fmtNota(notaMostrada)}</span>
            {r.cerrado && (
              <button
                type="button"
                className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-bold text-fg-2 hover:border-accent hover:text-accent"
                title="Agregar décimas"
                onClick={async () => {
                  const v = await pedirTexto({
                    titulo: "Agregar décimas",
                    mensaje: nombreEntrada(ctx, entrada),
                    aceptar: "Guardar",
                    campo: {
                      etiqueta: "Décimas (0 a 1,0)",
                      valor: numeroConComa(entrada.decimas || 0),
                      inputMode: "decimal",
                      validar: (x) => {
                        const n = x.trim() === "" ? 0 : leerNumero(x);
                        return Number.isNaN(n) || n < 0 || n > 1 ? "Escribe un número entre 0 y 1,0." : null;
                      },
                    },
                  });
                  if (v === null) return;
                  const d = v.trim() === "" ? 0 : Math.round(leerNumero(v) * 10) / 10;
                  editar("Décimas", (e) => (e.decimas = d));
                }}
              >
                {entrada.decimas ? `+${fmtNota(entrada.decimas)}` : "+ déc."}
              </button>
            )}
          </div>
          <span className="max-w-28 text-right text-[11px] font-medium text-fg-3">
            {r.cerrado ? "Nota final" : r.modo === "peor" ? "Si sacas 1,0 en lo que falta" : r.pesoEvaluado > 0 && r.pesoEvaluado < 100 ? `Promedio · ${fmtNota(r.pesoEvaluado, r.pesoEvaluado % 1 ? 1 : 0)}% evaluado` : "Promedio actual"}
          </span>
        </div>

      </header>

      {!configurando && (
        <div id={`${panelId}-notas`} className="space-y-3 p-4">
          {actual && !r.cerrado && <AvisoCausalRamo ctx={ctx} entrada={entrada} />}
          {entrada.categorias.length === 0 ? <p className="text-sm leading-relaxed text-fg-2">¿Te entregaron una nota? Regístrala ahora. Puedes definir los porcentajes después.</p> :
            <div className="space-y-3">
              {entrada.categorias.map((cat, ci) => <div key={ci}>
                <p className="mb-1.5 flex flex-wrap justify-between gap-1 text-xs font-semibold text-fg-2">
                  <span>{cat.nombre || `Categoría ${ci + 1}`}</span>
                  <span>{cat.peso ? `${cat.peso}% del ramo` : "Porcentaje por definir"}</span>
                </p>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {cat.notas.map((n, ni) => {
                    const nombre = n.etiqueta || `${cat.nombre || "Evaluación"} ${ni + 1}`;
                    const contenido = <><span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-medium">{nombre}</span><span className="block text-xs text-fg-2">{n.n === null ? "Pendiente" : n.f === 0 ? "No cuenta" : "Registrada"}{n.fecha ? ` · ${new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(n.fecha + "T12:00:00"))}` : ""}</span></span><span className={cx("text-lg font-bold tabular", claseNota(n.n))}>{n.n === null ? "+" : fmtNota(n.n)}</span></>;
                    return r.cerrado ? <div key={ni} className="flex items-center gap-2 rounded-xl bg-surface-2 p-3">{contenido}</div> : <button key={ni} type="button" className="flex min-h-16 items-center gap-2 rounded-xl border border-line bg-surface-2 p-3 text-left transition-colors hover:border-accent" onClick={() => onRegistrar({ ci, ni })}>{contenido}<span className="sr-only">{n.n === null ? ". Toca para registrar la nota" : ". Toca para editar"}</span></button>;
                  })}
                </div>
              </div>)}
            </div>}
          {entrada.categorias.some((c) => c.peso === 0 && c.notas.some((n) => n.n !== null)) && <p className="text-xs text-warn">Hay notas sin porcentaje: aún no cuentan en tu promedio. Puedes asignarlo en «Configurar ramo».</p>}
          {entrada.categorias.length > 0 && <div className="space-y-1 text-xs">{ayudas}</div>}
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line p-3">
        {!r.cerrado && <Boton variante="suave" icono={<Plus className="size-4" />} onClick={() => onRegistrar()}>Registrar nota</Boton>}
        <Boton variante="fantasma" className="ml-auto" icono={<Settings2 className="size-4" />} aria-expanded={configurando} aria-controls={`${panelId}-config`} onClick={() => setConfigurando((v) => !v)}>{configurando ? "Cerrar ajustes" : r.cerrado ? "Ver opciones" : "Configurar ramo"}</Boton>
      </div>
      {configurando && <div id={`${panelId}-config`}>
      {(
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-sm font-semibold">Evaluaciones y porcentajes</p>
          <p className="mb-2 text-xs text-fg-2">Cada categoría agrupa evaluaciones y aporta un porcentaje de la nota final. Los porcentajes deben sumar 100%. Los cambios se guardan al salir del campo.</p>
          {!r.cerrado && entrada.categorias.length > 0 && (
            <Segmentado
              tamano="xs"
              etiqueta="Cómo calcular el promedio"
              valor={r.modo}
              onChange={(m) => editar(null, (e) => (e.modo = m))}
              opciones={[
                { valor: "actual", etiqueta: "Actual", title: "Solo lo que ya rendiste, ponderado por el % evaluado" },
                { valor: "peor", etiqueta: "Peor caso", title: "Lo pendiente cuenta como 1,0: si igual da 4,0, ya aprobaste" },
              ]}
            />
          )}
          {entrada.categorias.map((c, ci) => (
            <FilaCategoria key={ci} cat={c} ci={ci} editar={editar} soloLectura={r.cerrado} modoActual={r.modo === "actual"} />
          ))}
          {!r.cerrado && entrada.categorias.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-5 text-center">
              <p className="text-[13px] text-fg-2">¿Cómo se evalúa este ramo? Parte de una plantilla o agrega categorías a mano.</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {PLANTILLAS.map((p) => (
                  <Boton
                    key={p.nombre}
                    tamano="sm"
                    variante="suave"
                    onClick={() =>
                      editar(`Plantilla ${p.nombre}`, (e) => {
                        e.categorias = p.categorias.map((c) => ({ nombre: c.nombre, peso: c.peso, req: c.req, notas: Array.from({ length: c.casillas }, () => ({ n: null, f: 1 })) }));
                      })
                    }
                  >
                    {p.nombre}
                  </Boton>
                ))}
              </div>
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[12px]">
            {!r.cerrado && entrada.categorias.length > 0 && (
              <span className={cx("font-semibold", r.avisoPorcentaje ? "text-danger" : Math.abs(r.pesoTotal - 100) < 0.05 ? "text-fg-3" : "text-warn")}>
                Ponderación {fmtNota(r.pesoTotal, r.pesoTotal % 1 ? 1 : 0)}%{r.avisoPorcentaje ? " · supera el 100%" : r.pesoTotal < 99.95 ? " · falta definir" : ""}
              </span>
            )}
            {ayudas}
          </div>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-1.5 border-t border-line bg-surface-2/50 px-3 py-2.5">
        {!r.cerrado ? (
          <>
            <Boton tamano="sm" variante="fantasma" icono={<Plus className="size-4" />} onClick={() => editar("Agregar categoría", (e) => e.categorias.push({ nombre: "", peso: 0, notas: [{ n: null, f: 1 }] }))}>
              Agregar categoría
            </Boton>
            {entrada.categorias.length > 0 && (
              <>
                <Boton ref={refPlantilla} tamano="sm" variante="fantasma" icono={<LayoutTemplate className="size-4" />} onClick={() => setPlantillas((v) => !v)}>
                  Plantilla
                </Boton>
                <Popover ancla={refPlantilla} abierto={plantillas} onCerrar={() => setPlantillas(false)} ancho={240}>
                  <p className="px-2.5 py-1 text-[11.5px] font-bold text-fg-3">Reemplaza las categorías actuales</p>
                  {PLANTILLAS.map((p) => (
                    <OpcionMenu
                      key={p.nombre}
                      descripcion={p.categorias.map((c) => `${c.nombre} ${c.peso}%`).join(" · ")}
                      onClick={async () => {
                        setPlantillas(false);
                        if (!(await confirmar({ titulo: `Usar «${p.nombre}»`, mensaje: "Se reemplazarán las categorías y notas actuales de este ramo.", aceptar: "Reemplazar", peligro: true }))) return;
                        editar(`Plantilla ${p.nombre}`, (e) => {
                          e.categorias = p.categorias.map((c) => ({ nombre: c.nombre, peso: c.peso, req: c.req, notas: Array.from({ length: c.casillas }, () => ({ n: null, f: 1 })) }));
                        });
                      }}
                    >
                      {p.nombre}
                    </OpcionMenu>
                  ))}
                </Popover>
              </>
            )}
            <Boton
              tamano="sm"
              variante="fantasma"
              icono={<Target className="size-4" />}
              onClick={async () => {
                const v = await pedirTexto({
                  titulo: "Meta para este ramo",
                  mensaje: "¿Qué nota te gustaría sacar? Te diremos cuánto necesitas en lo que queda. Déjalo vacío para quitarla.",
                  aceptar: "Guardar meta",
                  campo: {
                    etiqueta: "Nota objetivo",
                    valor: entrada.meta ? numeroConComa(entrada.meta) : "",
                    placeholder: "Ej. 5,5",
                    inputMode: "decimal",
                    validar: (x) => {
                      if (!x.trim()) return null;
                      const n = leerNumero(x);
                      return Number.isNaN(n) || n < 1 || n > 7 ? "Escribe una nota entre 1,0 y 7,0." : null;
                    },
                  },
                });
                if (v === null) return;
                editar("Meta del ramo", (e) => (e.meta = v.trim() ? Math.round(leerNumero(v) * 10) / 10 : null));
              }}
            >
              {entrada.meta ? `Meta ${fmtNota(entrada.meta)}` : "Meta"}
            </Boton>
            <Boton tamano="sm" variante="secundario" className="ml-auto" icono={<Flag className="size-4" />} onClick={registrarFinal}>
              Cerrar ramo con nota final
            </Boton>
          </>
        ) : (
          <Boton tamano="sm" variante="fantasma" icono={<RotateCcw className="size-4" />} onClick={() => editar(`Reabrir ${nombreEntrada(ctx, entrada)}`, (e, c, p) => reabrirEntrada(c, p, e))}>
            Reabrir
          </Boton>
        )}
        <Boton
          tamano="sm"
          variante="fantasma"
          className={cx("text-fg-3 hover:!text-danger", r.cerrado && "ml-auto")}
          icono={<X className="size-4" />}
          onClick={async () => {
            const tieneDatos = entrada.notaFinal !== null || entrada.categorias.some((c) => c.notas.some((n) => n.n !== null));
            if (tieneDatos && !(await confirmar({ titulo: "Quitar ramo", mensaje: `¿Quitar ${nombreEntrada(ctx, entrada)} de este periodo? Se perderán sus notas (puedes deshacerlo).`, aceptar: "Quitar", peligro: true })))
              return;
            editar(`Quitar ${nombreEntrada(ctx, entrada)}`, (e, c, p) => quitarEntrada(c, p, e));
            toast(`${nombreEntrada(ctx, entrada)} quitado`, "info", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
          }}
        >
          Quitar
        </Boton>
      </footer>
      </div>}
    </article>
  );
}

export function RamoEjemplo() {
  return (
    <article className="card pointer-events-none relative overflow-hidden !rounded-2xl opacity-80 select-none" aria-hidden="true">
      <header className="flex items-start gap-3 border-b border-line p-4">
        <div className="flex-1">
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold text-fg-3">
            CIT-0000 <span className="rounded-full bg-accent px-2 py-0.5 font-sans text-[10.5px] font-bold text-accent-fg">Ejemplo</span>
          </p>
          <h3 className="text-[14.5px] font-bold">Ramo de ejemplo</h3>
          <div className="mt-1.5 flex gap-1.5">
            <Insignia>6 cr</Insignia>
            <Insignia tono="ok">4,0 asegurado</Insignia>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[30px] leading-none font-extrabold text-ok">5,3</p>
          <p className="text-[11px] text-fg-3">Llevas · 70% evaluado</p>
        </div>
      </header>
      <div className="space-y-2 p-4 text-[13px]">
        {[
          { n: "Solemnes", p: 60, notas: ["4,5", "5,8", "—"], prom: "5,15", f: [1, 2, 1] },
          { n: "Laboratorios", p: 40, notas: ["6,2", "5,3"], prom: "5,75", f: [1, 1] },
        ].map((c) => (
          <div key={c.n} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 p-2.5">
            <span className="w-28 font-semibold">{c.n}</span>
            <span className="w-10 text-fg-3">{c.p}%</span>
            <span className="flex flex-1 gap-1.5">
              {c.notas.map((x, i) => (
                <span key={i} className={cx("rounded-lg border px-2 py-1 font-mono text-[12.5px] font-semibold", x === "—" ? "border-dashed border-line-strong text-fg-3" : "border-line-strong text-ok")}>
                  {x}
                  {c.f[i] !== 1 && <span className="ml-1 text-[10px] text-accent">×{c.f[i]}</span>}
                </span>
              ))}
            </span>
            <span className="font-mono font-bold text-ok">{c.prom}</span>
          </div>
        ))}
        <p className="flex items-center gap-1 pt-1 text-[12px] font-semibold text-ok">
          <CalendarDays className="size-3.5" /> Pon fechas a tus evaluaciones y te avisamos en Inicio.
        </p>
      </div>
    </article>
  );
}
