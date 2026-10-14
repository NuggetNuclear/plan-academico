import { Asterisk, ChevronDown, CircleCheck, CircleX, ClipboardList, Flag, GraduationCap, MoreHorizontal, Plus, RotateCcw, Target, Trash2, TrendingDown } from "lucide-react";
import { useRef, useState } from "react";
import { clavePeriodo, creditosEntrada, esPeriodoActual, nombreEntrada, siglaEntrada, situacionSemestreUDP, type Ctx } from "../../core/academic";
import { NOTA_APROB, fmtNota, leerNumero, numeroConComa } from "../../core/format";
import { calcularRamo, configExamen, indiceExamen, ramoAsegurado, statsCategoria, type Condicion, type InfoExamen } from "../../core/grades";
import type { ConfigExamen, Entrada, Periodo } from "../../core/state";
import { useApp } from "../../store/app";
import { cerrarEntrada, periodoPorClave, quitarEntrada, reabrirEntrada } from "../../store/mutaciones";
import { confirmar, pedirTexto, toast } from "../../store/ui";
import { OpcionMenu, Popover } from "../../ui/overlays";
import { Boton, BotonIcono, Insignia, cx } from "../../ui/primitives";

import { AvisoCausalRamo, letrasCausal } from "../riesgoCausal";
import { EditorEvaluacion } from "./EditorEvaluacion";
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

const pct = (n: number) => fmtNota(n, n % 1 ? 1 : 0);

type Tono = "ok" | "warn" | "danger" | "acento" | "neutro";
interface Ayuda { k: string; tono: Tono; icono: React.ReactNode; texto: string }
const TONO_TEXTO: Record<Tono, string> = { ok: "text-ok", warn: "text-warn", danger: "text-danger", acento: "text-accent", neutro: "text-fg-2" };
const PRIORIDAD: Record<Tono, number> = { danger: 0, warn: 1, acento: 2, ok: 3, neutro: 4 };

/** Mensajes sobre la nota de presentación, la eximición y el derecho a examen. */
function ayudasExamen(ex: InfoExamen, cfg: ConfigExamen): Ayuda[] {
  const out: Ayuda[] = [];
  const ic = <GraduationCap className="size-3.5" />;
  if (ex.np !== null) out.push({ k: "np", tono: "neutro", icono: ic, texto: `Nota de presentación ${fmtNota(ex.np, 2)}${ex.presentacionCompleta ? "" : " con lo rendido"}` });
  const asistencia = ex.asistenciaPendiente ? ` (y ${cfg.asistenciaMin}% de asistencia)` : "";
  const lo = (c: Condicion) => (c.cada ? `saca al menos ${fmtNota(c.nec, 1)} en cada una de las que quedan` : `necesitas ${fmtNota(c.nec, 2)} en lo que queda`);
  if (ex.estado === "eximido") out.push({ k: "ex", tono: "ok", icono: <CircleCheck className="size-3.5" />, texto: `Eximido del examen${asistencia}: tu nota final es la de presentación` });
  else if (ex.estado === "asegurada") out.push({ k: "ex", tono: "ok", icono: <CircleCheck className="size-3.5" />, texto: `Eximición asegurada aunque saques 1,0 antes del examen${asistencia}` });
  else if (ex.estado === "posible")
    ex.condicionesEximir
      .filter((c) => c.estado === "pendiente")
      .forEach((c, i) => out.push({ k: "ex" + i, tono: "acento", icono: ic, texto: `Para eximirte, ${c.texto}: ${lo(c)}${i === 0 ? asistencia : ""}` }));
  else if (ex.estado === "no-eximido") {
    const falla = ex.condicionesEximir.find((c) => c.estado === "falla");
    const motivo = ex.motivo === "asistencia" ? `tu asistencia está bajo ${cfg.asistenciaMin}%` : ex.motivo === "requisito" ? "tienes un requisito bajo 4,0" : `no cumples ${falla?.texto ?? "lo exigido"}`;
    out.push({ k: "ex", tono: "warn", icono: ic, texto: `Sin eximición: ${motivo}${ex.habilitacion !== "no-habilitado" ? `. Vas a examen (${pct(ex.peso)}%)` : ""}` });
  }
  if (ex.habilitacion === "no-habilitado") {
    const falla = ex.condicionesExamen.find((c) => c.estado === "falla");
    out.push({ k: "hab", tono: "danger", icono: <CircleX className="size-3.5" />, texto: `Sin derecho a examen: no cumples ${falla?.texto ?? "los mínimos"}. Repruebas el ramo` });
  } else if (ex.habilitacion === "pendiente")
    ex.condicionesExamen
      .filter((c) => c.estado === "pendiente")
      .forEach((c, i) => out.push({ k: "hab" + i, tono: "warn", icono: ic, texto: `Para dar examen, ${c.texto}: ${lo(c)}` }));
  return out;
}

const fechaCorta = (f: string) => new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(f + "T12:00:00"));

// ── Tarjeta del ramo ──
export function RamoCard({ ctx, periodo, entrada, onRegistrar }: { ctx: Ctx; periodo: Periodo; entrada: Entrada; onRegistrar: (seleccion?: SeleccionNota) => void }) {
  const [editando, setEditando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const refMenu = useRef<HTMLButtonElement>(null);
  const clave = clavePeriodo(periodo);
  const editar = useEditor(clave, entrada.uid);
  const r = calcularRamo(entrada);
  const conv = periodo.tipo === "convalidaciones";
  const actual = esPeriodoActual(ctx.st, periodo);
  const cursando = actual && ctx.st.cursando.includes(entrada.id);
  const asegurado = ramoAsegurado(r);
  const reqMal = r.reqFallidos.length > 0 || r.examen?.habilitacion === "no-habilitado";
  const notaMostrada = r.nf !== null ? Math.min(7, r.nf + (r.cerrado ? r.decimas : 0)) : null;
  const ex = r.examen;
  const cfgExamen = configExamen(entrada);
  const iExamen = indiceExamen(entrada);
  const escalaPresentacion = iExamen >= 0 && cfgExamen.escala === "presentacion";
  const eximido = ex?.estado === "eximido" || ex?.estado === "asegurada";
  const nombre = nombreEntrada(ctx, entrada);
  const sinConfigurar = entrada.categorias.length === 0;
  const hayNotas = entrada.categorias.some((c) => c.notas.some((n) => n.n !== null));

  const chip = r.cerrado ? (
    <Insignia tono={notaMostrada! >= NOTA_APROB ? "ok" : "danger"}>{conv ? "Convalidado" : notaMostrada! >= NOTA_APROB ? "Aprobado" : "Reprobado"}</Insignia>
  ) : asegurado ? (
    <Insignia tono="ok" icono={<CircleCheck className="size-3" />}>4,0 asegurado</Insignia>
  ) : eximido ? (
    <Insignia tono="ok" icono={<GraduationCap className="size-3" />}>Eximido</Insignia>
  ) : conv ? (
    <Insignia tono="acento">Convalidado</Insignia>
  ) : cursando ? (
    <Insignia tono="info">Cursando</Insignia>
  ) : null;

  // Lo que necesitas, de lo más urgente a lo informativo.
  const ayudas: Ayuda[] = [];
  if (!r.cerrado && hayNotas) {
    const maxReq = r.reqMetas.length ? Math.max(...r.reqMetas.map((m) => m.nec)) : null;
    const generalManda = r.reqMetas.length === 0 || r.pendienteNoReq > 0 || (r.necesaria !== null && r.necesaria > (maxReq ?? 0));
    if (r.restante > 0 && r.necesaria !== null && generalManda && ex?.habilitacion !== "no-habilitado") {
      if (r.necesaria <= 1 && !r.reqMetas.length) ayudas.push({ k: "a", tono: "ok", icono: <CircleCheck className="size-3.5" />, texto: "4,0 asegurado aunque saques 1,0" });
      else if (r.necesaria > 7) ayudas.push({ k: "a", tono: "danger", icono: <CircleX className="size-3.5" />, texto: "Ya no alcanza el 4,0" });
      else ayudas.push({ k: "a", tono: r.necesaria <= 4 ? "ok" : "warn", icono: <Target className="size-3.5" />, texto: `Para aprobar necesitas ${fmtNota(r.necesaria, 2)} ${ex?.necesariaExamen != null ? "en el examen" : `en lo que queda (${pct(r.restante)}%)`}` });
    }
    if (ex) ayudas.push(...ayudasExamen(ex, cfgExamen));
    r.reqMetas.forEach((m) => ayudas.push({ k: "r" + m.nombre, tono: "warn", icono: <Asterisk className="size-3.5" />, texto: `${m.nombre} debe aprobarse: ≥ ${fmtNota(m.nec, 2)} en lo que queda` }));
    r.reqFallidos.forEach((n) => ayudas.push({ k: "f" + n, tono: "danger", icono: <Asterisk className="size-3.5" />, texto: `${n} quedó bajo 4,0 y debía aprobarse` }));
    if (r.necesariaMeta !== null && entrada.meta)
      ayudas.push({ k: "m", tono: "acento", icono: <Flag className="size-3.5" />, texto: `Meta ${fmtNota(entrada.meta)}: ${r.necesariaMeta > 7 ? "ya no alcanza" : r.necesariaMeta <= 1 ? "asegurada" : `necesitas ${fmtNota(r.necesariaMeta, 2)}`}` });
  }
  // El aviso principal va primero; la nota de presentación es información, no urgencia.
  const ordenadas = [...ayudas].sort((a, b) => (a.k === "a" ? -1 : b.k === "a" ? 1 : PRIORIDAD[a.tono] - PRIORIDAD[b.tono]));
  const visibles = verTodo ? ordenadas : ordenadas.slice(0, 2);

  const registrarFinal = async () => {
    const v = await pedirTexto({
      titulo: "Registrar nota final",
      mensaje: `${nombre}. Al registrarla, el ramo se actualiza en la malla y entra a tu PPA.`,
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
    const causales = (actual && situacionSemestreUDP(ctx).ramos.find((x) => x.entrada.uid === entrada.uid)?.causales) || [];
    editar(`Nota final de ${nombre}`, (e, c, p) => cerrarEntrada(c, p, e, nota));
    if (nota >= NOTA_APROB) toast(`${nombre} ${conv ? "convalidado" : "aprobado"} con ${fmtNota(nota)} 🎉`);
    else if (causales.length) toast(`${nombre} reprobado con ${fmtNota(nota)}: quedas en ${letrasCausal(causales)} de eliminación. Revisa Inicio › Tu situación académica.`, "error");
    else toast(`${nombre} reprobado con ${fmtNota(nota)}. La nota queda en tu PPA y el ramo vuelve a estar disponible.`, "error");
  };

  const definirMeta = async () => {
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
  };

  const agregarDecimas = async () => {
    const v = await pedirTexto({
      titulo: "Agregar décimas",
      mensaje: nombre,
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
  };

  const quitar = async () => {
    const tieneDatos = entrada.notaFinal !== null || hayNotas;
    if (tieneDatos && !(await confirmar({ titulo: "Quitar ramo", mensaje: `¿Quitar ${nombre} de este periodo? Se perderán sus notas (puedes deshacerlo).`, aceptar: "Quitar", peligro: true }))) return;
    editar(`Quitar ${nombre}`, (e, c, p) => quitarEntrada(c, p, e));
    toast(`${nombre} quitado`, "info", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
  };

  const opcion = (fn: () => void) => () => (setMenu(false), fn());

  return (
    <article
      aria-label={nombre}
      className={cx(
        "card flex min-w-0 flex-col overflow-hidden !rounded-2xl transition-colors",
        r.cerrado ? (notaMostrada! >= NOTA_APROB ? "border-ok/30" : "border-danger/30") : asegurado ? "border-ok/30" : reqMal ? "border-danger/30" : "",
      )}
    >
      <header className="flex items-start gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-semibold text-fg-3">{siglaEntrada(ctx, entrada)}</p>
          <h3 className="text-[15px] leading-snug font-bold">{nombre}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Insignia>{creditosEntrada(ctx, entrada)} cr</Insignia>
            {chip}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <div className="flex items-baseline gap-1.5">
            {r.cerrado && (
              <button type="button" className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-bold text-fg-2 hover:border-accent hover:text-accent" title="Agregar décimas" onClick={agregarDecimas}>
                {entrada.decimas ? `+${fmtNota(entrada.decimas)}` : "+ déc."}
              </button>
            )}
            <span className={cx("text-[32px] leading-none font-extrabold tracking-tight tabular", claseNota(notaMostrada))}>{fmtNota(notaMostrada)}</span>
          </div>
          <span className="mt-1 max-w-32 text-right text-[11px] font-medium text-fg-3">
            {r.cerrado ? "Nota final" : !hayNotas ? "Sin notas aún" : ex?.estado === "eximido" ? "Nota de presentación" : r.modo === "peor" ? "Peor caso" : r.pesoEvaluado > 0 && r.pesoEvaluado < 100 ? `Promedio · ${pct(r.pesoEvaluado)}% evaluado` : "Promedio"}
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-3 px-4 pb-4">
        {actual && !r.cerrado && <AvisoCausalRamo ctx={ctx} entrada={entrada} />}

        {sinConfigurar && !r.cerrado ? (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-center">
            <p className="text-sm font-semibold">¿Cómo se evalúa este ramo?</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-fg-2">Elige una plantilla o copia la de otro ramo. Toma un minuto y después solo anotas tus notas.</p>
            <Boton tamano="sm" variante="suave" className="mt-3" icono={<ClipboardList className="size-4" />} onClick={() => setEditando(true)}>Configurar evaluaciones</Boton>
          </div>
        ) : (
          entrada.categorias.length > 0 && (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {entrada.categorias.map((cat, ci) => {
                const st = statsCategoria(cat);
                const prom = r.modo === "actual" ? st.promRendido : st.prom;
                const esExamen = ci === iExamen;
                const etiquetaPeso = !cat.peso ? "sin %" : escalaPresentacion && !esExamen ? `${pct(cat.peso)}% de la presentación` : `${pct(cat.peso)}%`;
                return (
                  <li key={ci} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex-nowrap">
                    <div className="min-w-0 basis-full sm:w-32 sm:basis-auto sm:shrink-0">
                      <p className="flex items-center gap-1 truncate text-[13px] font-semibold">
                        {esExamen && <GraduationCap aria-hidden="true" className="size-3.5 shrink-0 text-accent" />}
                        {cat.nombre || `Categoría ${ci + 1}`}
                      </p>
                      <p className={cx("text-[11px] leading-tight", cat.peso ? "text-fg-3" : "font-semibold text-warn")}>
                        {etiquetaPeso}
                        {cat.req && " · debe aprobarse"}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {cat.notas.map((n, ni) => {
                        const etiqueta = n.etiqueta || `${cat.nombre || "Evaluación"} ${ni + 1}`;
                        const saltado = esExamen && eximido && n.n === null;
                        const titulo = [etiqueta, n.fecha ? fechaCorta(n.fecha) : null, n.f !== 1 ? `vale ×${numeroConComa(n.f)}` : null, saltado ? "no lo rindes" : null].filter(Boolean).join(" · ");
                        const contenido = n.n === null ? (saltado ? "—" : n.fecha ? fechaCorta(n.fecha) : <Plus aria-hidden="true" className="size-3.5" />) : fmtNota(n.n);
                        const clase = cx(
                          "inline-flex h-9 min-w-11 items-center justify-center rounded-lg border px-2 font-mono text-[13px] font-bold tabular transition-colors",
                          n.n === null ? "border-dashed border-line-strong text-fg-3" : cx("border-line-strong bg-surface-2", claseNota(n.n)),
                          n.f === 0 && "opacity-50",
                          n.n === null && n.fecha && "font-sans text-[11px] font-semibold",
                        );
                        return r.cerrado ? (
                          <span key={ni} className={clase} title={titulo}>{contenido}</span>
                        ) : (
                          <button key={ni} type="button" className={cx(clase, "hover:border-accent hover:text-accent")} title={titulo} aria-label={`${etiqueta}: ${n.n === null ? "pendiente, registrar nota" : `${fmtNota(n.n)}, editar`}`} onClick={() => onRegistrar({ ci, ni })}>
                            {contenido}
                          </button>
                        );
                      })}
                    </div>
                    <span className={cx("w-10 shrink-0 text-right font-mono text-[13px] font-bold tabular", claseNota(prom))} title={r.modo === "actual" ? "Promedio de lo rendido" : "Promedio con 1,0 en lo pendiente"}>
                      {prom === null ? "" : fmtNota(prom, 1)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {entrada.categorias.some((c) => c.peso === 0 && c.notas.some((n) => n.n !== null)) && (
          <p className="text-xs text-warn">
            Hay notas sin porcentaje: aún no cuentan en tu promedio.{" "}
            <button type="button" className="font-semibold underline" onClick={() => setEditando(true)}>Asignar porcentajes</button>
          </p>
        )}

        {ordenadas.length > 0 && (
          <div className="space-y-1 text-xs">
            {visibles.map((a) => (
              <p key={a.k} className={cx("flex items-start gap-1.5 font-semibold [&>svg]:mt-px [&>svg]:shrink-0", TONO_TEXTO[a.tono])}>
                {a.icono}
                {a.texto}
              </p>
            ))}
            {ordenadas.length > 2 && (
              <button type="button" className="flex items-center gap-1 pt-0.5 font-semibold text-fg-3 hover:text-fg" aria-expanded={verTodo} onClick={() => setVerTodo((v) => !v)}>
                <ChevronDown className={cx("size-3.5 transition-transform", verTodo && "rotate-180")} />
                {verTodo ? "Ver menos" : `Ver ${ordenadas.length - 2} más`}
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        {r.cerrado ? (
          <Boton tamano="sm" variante="fantasma" icono={<RotateCcw className="size-4" />} onClick={() => editar(`Reabrir ${nombre}`, (e, c, p) => reabrirEntrada(c, p, e))}>
            Reabrir
          </Boton>
        ) : (
          <Boton tamano="sm" variante="suave" icono={<Plus className="size-4" />} onClick={() => onRegistrar()}>
            Registrar nota
          </Boton>
        )}
        {!r.cerrado && !sinConfigurar && (
          <Boton tamano="sm" variante="fantasma" icono={<ClipboardList className="size-4" />} onClick={() => setEditando(true)}>
            Evaluaciones
          </Boton>
        )}
        <BotonIcono ref={refMenu} tamano="sm" className="ml-auto" etiqueta={`Más opciones de ${nombre}`} aria-expanded={menu} aria-haspopup="dialog" onClick={() => setMenu((v) => !v)}>
          <MoreHorizontal className="size-4" />
        </BotonIcono>
        <Popover ancla={refMenu} abierto={menu} onCerrar={() => setMenu(false)} ancho={250}>
          {!r.cerrado && (
            <>
              <OpcionMenu icono={<Target />} onClick={opcion(definirMeta)} descripcion="Te decimos cuánto necesitas para lograrla">
                {entrada.meta ? `Meta: ${fmtNota(entrada.meta)}` : "Ponerme una meta"}
              </OpcionMenu>
              {!sinConfigurar && (
                <OpcionMenu
                  icono={<TrendingDown />}
                  onClick={opcion(() => editar(null, (e) => (e.modo = r.modo === "peor" ? "actual" : "peor")))}
                  descripcion={r.modo === "peor" ? "Volver al promedio de lo rendido" : "Lo pendiente cuenta como 1,0"}
                >
                  {r.modo === "peor" ? "Ver promedio actual" : "Ver peor caso"}
                </OpcionMenu>
              )}
              <OpcionMenu icono={<Flag />} onClick={opcion(registrarFinal)} descripcion="Cuando ya tienes la nota oficial">
                Cerrar con nota final
              </OpcionMenu>
            </>
          )}
          <OpcionMenu icono={<Trash2 />} peligro onClick={opcion(quitar)}>
            Quitar del periodo
          </OpcionMenu>
        </Popover>
      </footer>
      {editando && <EditorEvaluacion ctx={ctx} periodo={periodo} entrada={entrada} onCerrar={() => setEditando(false)} />}
    </article>
  );
}
