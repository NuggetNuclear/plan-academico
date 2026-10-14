import { Check, ChevronDown, ClipboardList, Copy, GraduationCap, LayoutTemplate, Minus, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { clavePeriodo, nombreEntrada, siglaRamo, ramoCatalogo, type Ctx } from "../../core/academic";
import { esPersonalizable } from "../../core/curriculum";
import { fmtPct, normalizarTexto, plural } from "../../core/format";
import { CATEGORIAS_SUGERIDAS, PLANTILLAS, aplicarPlantilla, configExamen, inferirEscala, plantillaDesdeEntrada, type Plantilla } from "../../core/grades";
import type { Categoria, ConfigExamen, Entrada, Periodo } from "../../core/state";
import { useApp } from "../../store/app";
import { periodoPorClave } from "../../store/mutaciones";
import { toast } from "../../store/ui";
import { CampoNumero, CampoTexto } from "../../ui/CampoNumero";
import { CabeceraModal, Modal } from "../../ui/overlays";
import { Boton, BotonIcono, Interruptor, cx } from "../../ui/primitives";

interface Borrador {
  categorias: Categoria[];
  examen: ConfigExamen;
}

const notasRegistradas = (cats: Categoria[]) => cats.reduce((s, c) => s + c.notas.filter((n) => n.n !== null).length, 0);

/** Aplica una plantilla conservando las notas de las categorías que se llaman igual. */
function conPlantilla(actual: Categoria[], p: Plantilla): { categorias: Categoria[]; perdidas: number } {
  const tmp = { categorias: [] as Categoria[] } as Pick<Entrada, "categorias" | "examen">;
  aplicarPlantilla(tmp as Entrada, p);
  const usadas = new Set<Categoria>();
  tmp.categorias.forEach((c) => {
    const previa = actual.find((x) => !usadas.has(x) && !!x.examen === !!c.examen && normalizarTexto(x.nombre) === normalizarTexto(c.nombre));
    if (!previa) return;
    usadas.add(previa);
    const notas = previa.notas.map((n) => ({ ...n }));
    while (notas.length < c.notas.length) notas.push({ n: null, f: 1 });
    c.notas = notas;
  });
  const perdidas = actual.filter((c) => !usadas.has(c)).reduce((s, c) => s + c.notas.filter((n) => n.n !== null).length, 0);
  return { categorias: tmp.categorias, perdidas };
}

/** Plantillas a partir de los otros ramos que ya configuraste (el más reciente de cada uno). */
function plantillasPropias(ctx: Ctx, uid: string): Plantilla[] {
  const vistos = new Map<string, Plantilla>();
  ctx.st.periodos.forEach((p) =>
    p.ramos.forEach((e) => {
      if (e.uid === uid || e.categorias.length === 0 || e.categorias.every((c) => c.peso === 0)) return;
      const pl = plantillaDesdeEntrada(nombreEntrada(ctx, e), e);
      vistos.set(e.id, pl);
    }),
  );
  return [...vistos.values()].reverse();
}

const resumenPlantilla = (p: Plantilla) =>
  p.descripcion ?? p.categorias.map((c) => `${c.nombre} ${fmtPct(c.peso)}%`).join(" · ");

function SelectorPlantilla({ propias, onElegir }: { propias: Plantilla[]; onElegir: (p: Plantilla) => void }) {
  const grupo = (titulo: string, icono: React.ReactNode, lista: Plantilla[]) =>
    lista.length > 0 && (
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-fg-2">{icono}{titulo}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {lista.map((p) => (
            <button key={p.nombre} type="button" onClick={() => onElegir(p)} className="rounded-xl border border-line bg-surface-2 p-3 text-left transition-colors hover:border-accent">
              <span className="block text-[13.5px] font-semibold">{p.nombre}</span>
              <span className="mt-0.5 block text-xs text-fg-2">{resumenPlantilla(p)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <div className="space-y-4">
      {grupo("Igual que otro de tus ramos", <Copy className="size-3.5" />, propias)}
      {grupo("Plantillas comunes", <LayoutTemplate className="size-3.5" />, PLANTILLAS)}
    </div>
  );
}

function FilaCategoria({ cat, indice, conExamen, onCambiar, onQuitar }: { cat: Categoria; indice: number; conExamen: boolean; onCambiar: (fn: (c: Categoria) => void) => void; onQuitar: () => void }) {
  const id = useId();
  const reglas = [cat.req, cat.minimos?.examen, cat.minimos?.eximir, cat.minimos?.eximirCada].filter((v) => v != null && v !== false).length;
  const [abierto, setAbierto] = useState(reglas > 0);
  const nombre = cat.nombre || `Categoría ${indice + 1}`;
  const ultimaConNota = cat.notas.length > 0 && cat.notas[cat.notas.length - 1].n !== null;
  return (
    <li className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto_auto]">
        <div className="col-span-3 sm:col-span-1">
          <label className="label" htmlFor={`${id}-nombre`}>Nombre</label>
          <CampoTexto id={`${id}-nombre`} className="input !py-2" valor={cat.nombre} placeholder={`Categoría ${indice + 1}`} onGuardar={(v) => onCambiar((c) => (c.nombre = v))} />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-peso`}>Vale</label>
          <div className="relative">
            <CampoNumero id={`${id}-peso`} className="input !py-2 pr-7 text-right font-semibold" valor={cat.peso || null} min={0} max={100} decimales={1} placeholder="0" onGuardar={(v) => onCambiar((c) => (c.peso = v ?? 0))} />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[13px] text-fg-3">%</span>
          </div>
        </div>
        <div>
          <span className="label" id={`${id}-cant`}>Notas</span>
          <div className="flex items-center rounded-xl border border-line-strong bg-surface" role="group" aria-labelledby={`${id}-cant`}>
            <BotonIcono tamano="sm" etiqueta={`Quitar una nota de ${nombre}`} disabled={cat.notas.length <= 1 || ultimaConNota} title={ultimaConNota ? "La última ya tiene nota: bórrala desde la tarjeta" : undefined} onClick={() => onCambiar((c) => c.notas.pop())}>
              <Minus className="size-3.5" />
            </BotonIcono>
            <span className="w-6 text-center text-sm font-bold tabular" aria-live="polite">{cat.notas.length}</span>
            <BotonIcono tamano="sm" etiqueta={`Agregar una nota a ${nombre}`} disabled={cat.notas.length >= 20} onClick={() => onCambiar((c) => c.notas.push({ n: null, f: 1 }))}>
              <Plus className="size-3.5" />
            </BotonIcono>
          </div>
        </div>
        <BotonIcono etiqueta={`Eliminar ${nombre}`} className="self-end hover:!text-danger" onClick={onQuitar}>
          <Trash2 className="size-4" />
        </BotonIcono>
      </div>
      <button type="button" className="mt-2 flex items-center gap-1 text-xs font-semibold text-fg-2 hover:text-fg" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <ChevronDown className={cx("size-3.5 transition-transform", abierto && "rotate-180")} />
        Reglas especiales{reglas > 0 ? ` (${reglas})` : ""}
      </button>
      {abierto && (
        <div className="mt-2 space-y-3 rounded-lg bg-surface p-3">
          <label className="flex cursor-pointer items-start gap-2 text-[13px]">
            <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={!!cat.req} onChange={(e) => onCambiar((c) => (e.target.checked ? (c.req = true) : delete c.req))} />
            <span>
              <strong>Hay que aprobarla por separado</strong>
              <span className="block text-xs text-fg-2">Si su promedio queda bajo 4,0, repruebas el ramo aunque el resto esté bien.</span>
            </span>
          </label>
          {conExamen && (
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["examen", "Para dar examen, promedio ≥", "Mínimo de esta categoría para tener derecho a examen"],
                  ["eximir", "Para eximirte, promedio ≥", "Promedio mínimo de esta categoría para eximirte"],
                  ["eximirCada", "Para eximirte, cada nota ≥", "Nota mínima de cada evaluación para eximirte"],
                ] as const
              ).map(([clave, etiqueta, aria]) => (
                <div key={clave}>
                  <label className="label" htmlFor={`${id}-${clave}`}>{etiqueta}</label>
                  <CampoNumero id={`${id}-${clave}`} aria-label={`${aria} (${nombre})`} className="input !py-1.5" valor={cat.minimos?.[clave] ?? null} min={1} max={7} decimales={1} minDecimales={1} placeholder="Sin mínimo" onGuardar={(v) => onCambiar((c) => (c.minimos = { ...c.minimos, [clave]: v }))} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Configuración de cómo se evalúa un ramo, en lenguaje simple y con un solo "Guardar". */
export function EditorEvaluacion({ ctx, periodo, entrada, onCerrar }: { ctx: Ctx; periodo: Periodo; entrada: Entrada; onCerrar: () => void }) {
  const id = useId();
  const mutar = useApp((s) => s.mutar);
  const inicial = useMemo<Borrador>(() => ({ categorias: structuredClone(entrada.categorias), examen: configExamen(entrada) }), [entrada]);
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const ultimo = useRef(borrador);
  const cambiar = (fn: (b: Borrador) => void) => {
    const b = structuredClone(ultimo.current);
    fn(b);
    ultimo.current = b;
    setBorrador(b);
  };
  const propias = useMemo(() => plantillasPropias(ctx, entrada.uid), [ctx, entrada.uid]);
  const [verPlantillas, setVerPlantillas] = useState(entrada.categorias.length === 0);
  const [pendiente, setPendiente] = useState<{ p: Plantilla; perdidas: number } | null>(null);
  const ramo = ramoCatalogo(ctx, entrada.id);
  const personalizable = esPersonalizable(ramo);

  const { categorias, examen } = borrador;
  const iEx = categorias.findIndex((c) => c.examen);
  const exCat = iEx >= 0 ? categorias[iEx] : null;
  const presentacion = categorias.map((c, i) => ({ c, i })).filter(({ i }) => i !== iEx);
  const suma = presentacion.reduce((s, { c }) => s + c.peso, 0);
  const pesoEx = exCat?.peso ?? 0;
  const escala = exCat ? inferirEscala(categorias) : null;
  const usados = new Set(categorias.map((c) => normalizarTexto(c.nombre)));
  const sugerencias = CATEGORIAS_SUGERIDAS.filter((n) => !usados.has(normalizarTexto(n)));

  const estadoSuma = (() => {
    if (!presentacion.length) return null;
    if (!exCat || pesoEx <= 0) {
      if (Math.abs(suma - 100) < 0.05) return { ok: true, texto: "Suman 100%. ¡Perfecto!" };
      return { ok: false, texto: suma > 100 ? `Suman ${fmtPct(suma)}%: te pasaste por ${fmtPct(suma - 100)}%.` : `Suman ${fmtPct(suma)}%: falta asignar ${fmtPct(100 - suma)}%.` };
    }
    if (escala === "presentacion") return { ok: true, texto: `Suman 100% de tu nota de presentación, que vale ${fmtPct(100 - pesoEx)}% del ramo.` };
    if (escala === "ramo") return { ok: true, texto: `Suman ${fmtPct(suma)}% del ramo; con el examen (${fmtPct(pesoEx)}%) completan 100%.` };
    return { ok: false, texto: `Suman ${fmtPct(suma)}%. Deben sumar 100% (si son % de la nota de presentación) o ${fmtPct(100 - pesoEx)}% (si son % del ramo).` };
  })();

  const elegirPlantilla = (p: Plantilla) => {
    const r = conPlantilla(ultimo.current.categorias, p);
    if (r.perdidas > 0) return setPendiente({ p, perdidas: r.perdidas });
    usarPlantilla(p);
  };
  const usarPlantilla = (p: Plantilla) => {
    cambiar((b) => {
      b.categorias = conPlantilla(b.categorias, p).categorias;
      if (p.examen) b.examen = { ...p.examen, asistencia: b.examen.asistencia };
    });
    setPendiente(null);
    setVerPlantillas(false);
  };

  const agregarCategoria = (nombre = "") =>
    cambiar((b) => {
      const pos = b.categorias.findIndex((c) => c.examen);
      const nueva: Categoria = { nombre, peso: 0, notas: [{ n: null, f: 1 }] };
      if (pos >= 0) b.categorias.splice(pos, 0, nueva);
      else b.categorias.push(nueva);
    });

  const alternarExamen = (si: boolean) =>
    cambiar((b) => {
      if (si) {
        const existente = b.categorias.find((c) => normalizarTexto(c.nombre) === "examen");
        if (existente) {
          existente.examen = true;
          if (!existente.peso) existente.peso = 30;
        } else b.categorias.push({ nombre: "Examen", peso: 30, examen: true, notas: [{ n: null, f: 1 }] });
        if (b.examen.eximicion === null && !entrada.examen) b.examen = { ...b.examen, eximicion: 5 };
      } else {
        const i = b.categorias.findIndex((c) => c.examen);
        if (i >= 0) b.categorias.splice(i, 1);
      }
    });

  const guardar = () => {
    const b = ultimo.current;
    const cats = b.categorias.map((c, i) => ({ ...c, nombre: c.nombre.trim() || (c.examen ? "Examen" : `Categoría ${i + 1}`) }));
    const tieneExamen = cats.some((c) => c.examen);
    const esc = inferirEscala(cats) ?? b.examen.escala;
    mutar(`Evaluación de ${nombreEntrada(ctx, entrada)}`, (c) => {
      const e = periodoPorClave(c.st, clavePeriodo(periodo))?.ramos.find((x) => x.uid === entrada.uid);
      if (!e) return;
      e.categorias = structuredClone(cats);
      if (tieneExamen) e.examen = { ...b.examen, escala: esc };
      else delete e.examen;
    });
    toast("Evaluación guardada", "ok", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
    onCerrar();
  };

  const perdidasAlQuitar = (c: Categoria) => c.notas.filter((n) => n.n !== null).length;

  return (
    <Modal abierto onCerrar={onCerrar} etiqueta={`Cómo se evalúa ${nombreEntrada(ctx, entrada)}`} ancho="xl">
      <CabeceraModal icono={<ClipboardList className="size-5" />} sobretitulo={nombreEntrada(ctx, entrada)} titulo="¿Cómo se evalúa este ramo?" onCerrar={onCerrar}>
        Copia el programa del curso: qué evaluaciones hay y cuánto vale cada una.
      </CabeceraModal>

      <div className="space-y-6 px-6 py-5">
        {personalizable && (
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <div>
              <label className="label" htmlFor={`${id}-sigla`}>Sigla real</label>
              <CampoTexto id={`${id}-sigla`} className="input !py-2 font-mono" valor={ctx.st.alias[entrada.id]?.sigla ?? ""} placeholder={siglaRamo(ctx, entrada.id)} onGuardar={(v) => mutar("Cambiar sigla", ({ st }) => void (st.alias[entrada.id] = { ...st.alias[entrada.id], sigla: v || undefined }))} />
            </div>
            <div>
              <label className="label" htmlFor={`${id}-nombre`}>Nombre real del curso</label>
              <CampoTexto id={`${id}-nombre`} className="input !py-2" valor={ctx.st.alias[entrada.id]?.nombre ?? ""} placeholder={ramo?.nombre ?? entrada.id} onGuardar={(v) => mutar("Cambiar nombre", ({ st }) => void (st.alias[entrada.id] = { ...st.alias[entrada.id], nombre: v || undefined }))} />
            </div>
          </div>
        )}

        {verPlantillas ? (
          <section aria-labelledby={`${id}-plantillas`} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 id={`${id}-plantillas`} className="font-bold">Parte de una plantilla</h3>
              {categorias.length > 0 && <Boton tamano="sm" variante="fantasma" onClick={() => setVerPlantillas(false)}>Volver</Boton>}
            </div>
            <p className="text-[13px] text-fg-2">Elige la más parecida y después ajusta nombres y porcentajes.</p>
            {pendiente ? (
              <div role="alert" className="space-y-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm">
                <p>Usar «{pendiente.p.nombre}» borrará {plural(pendiente.perdidas, "nota registrada", "notas registradas")} de categorías que no existen en la plantilla.</p>
                <div className="flex gap-2">
                  <Boton tamano="sm" variante="peligro" onClick={() => usarPlantilla(pendiente.p)}>Usar igual</Boton>
                  <Boton tamano="sm" variante="fantasma" onClick={() => setPendiente(null)}>Cancelar</Boton>
                </div>
              </div>
            ) : (
              <SelectorPlantilla propias={propias} onElegir={elegirPlantilla} />
            )}
            {categorias.length === 0 && (
              <Boton variante="fantasma" tamano="sm" icono={<Plus className="size-4" />} onClick={() => (agregarCategoria(), setVerPlantillas(false))}>
                Prefiero armarlo desde cero
              </Boton>
            )}
          </section>
        ) : (
          <>
            <section aria-labelledby={`${id}-cats`} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={`${id}-cats`} className="font-bold">{exCat ? "Notas durante el semestre" : "Evaluaciones"}</h3>
                <Boton tamano="sm" variante="fantasma" icono={<LayoutTemplate className="size-4" />} onClick={() => setVerPlantillas(true)}>Usar plantilla</Boton>
              </div>
              {exCat && <p className="-mt-1 text-[13px] text-fg-2">Con ellas se calcula tu nota de presentación al examen.</p>}
              <ul className="space-y-2">
                {presentacion.map(({ c, i }) => (
                  <FilaCategoria
                    key={i}
                    cat={c}
                    indice={i}
                    conExamen={!!exCat}
                    onCambiar={(fn) => cambiar((b) => fn(b.categorias[i]))}
                    onQuitar={() => {
                      const n = perdidasAlQuitar(c);
                      cambiar((b) => void b.categorias.splice(i, 1));
                      if (n) toast(`${c.nombre || "Categoría"} quitada con ${plural(n, "nota")}. Cierra sin guardar para recuperarla.`, "info");
                    }}
                  />
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-1.5">
                <Boton tamano="sm" variante="suave" icono={<Plus className="size-4" />} onClick={() => agregarCategoria()}>Agregar categoría</Boton>
                {sugerencias.slice(0, 5).map((n) => (
                  <button key={n} type="button" onClick={() => agregarCategoria(n)} className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-fg-2 transition-colors hover:border-accent hover:text-accent">
                    + {n}
                  </button>
                ))}
              </div>
              {estadoSuma && (
                <p role="status" className={cx("flex items-start gap-1.5 text-[13px] font-semibold", estadoSuma.ok ? "text-ok" : "text-warn")}>
                  {estadoSuma.ok && <Check className="mt-0.5 size-4 shrink-0" />}
                  {estadoSuma.texto}
                </p>
              )}
            </section>

            <section aria-labelledby={`${id}-examen`} className="space-y-3 rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id={`${id}-examen`} className="flex items-center gap-2 font-bold"><GraduationCap className="size-4.5 text-accent" />Examen final</h3>
                <Interruptor checked={!!exCat} onChange={alternarExamen} etiqueta={exCat ? "Tiene examen" : "No tiene examen"} />
              </div>
              {exCat && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor={`${id}-pex`}>El examen vale</label>
                      <div className="relative">
                        <CampoNumero id={`${id}-pex`} className="input !py-2 pr-7 font-semibold" valor={exCat.peso || null} min={1} max={99} decimales={1} placeholder="30" vacioPermitido={false} onGuardar={(v) => cambiar((b) => void (b.categorias[iEx].peso = v ?? 30))} />
                        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[13px] text-fg-3">%</span>
                      </div>
                      <p className="mt-1 text-xs text-fg-3">de la nota final. Tu presentación vale el {fmtPct(100 - (exCat.peso || 0))}% restante.</p>
                    </div>
                    <div>
                      <label className="label" htmlFor={`${id}-exime`}>Te eximes con presentación ≥</label>
                      <CampoNumero id={`${id}-exime`} className="input !py-2" valor={examen.eximicion} min={1} max={7} decimales={1} minDecimales={1} placeholder="No se puede eximir" onGuardar={(v) => cambiar((b) => void (b.examen.eximicion = v))} />
                      <p className="mt-1 text-xs text-fg-3">{examen.eximicion === null ? "Vacío: siempre se rinde examen." : "Si llegas a esa nota no das examen y tu nota final es la de presentación."}</p>
                    </div>
                    <div>
                      <label className="label" htmlFor={`${id}-minnp`}>Para dar examen necesitas presentación ≥</label>
                      <CampoNumero id={`${id}-minnp`} className="input !py-2" valor={examen.minPresentacion ?? null} min={1} max={7} decimales={1} minDecimales={1} placeholder="Sin mínimo" onGuardar={(v) => cambiar((b) => void (b.examen.minPresentacion = v))} />
                      <p className="mt-1 text-xs text-fg-3">Bajo esa nota no puedes rendirlo y repruebas. Vacío si no hay mínimo.</p>
                    </div>
                    {examen.eximicion !== null && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label" htmlFor={`${id}-asmin`}>Asistencia para eximirte</label>
                          <CampoNumero id={`${id}-asmin`} aria-label="Asistencia exigida para eximirse (%)" className="input !py-2" valor={examen.asistenciaMin} min={0} max={100} decimales={0} placeholder="No exige" onGuardar={(v) => cambiar((b) => void (b.examen.asistenciaMin = v))} />
                        </div>
                        <div>
                          <label className="label" htmlFor={`${id}-as`}>Tu asistencia</label>
                          <CampoNumero id={`${id}-as`} aria-label="Tu asistencia (%)" className="input !py-2" valor={examen.asistencia} min={0} max={100} decimales={0} placeholder="%" disabled={examen.asistenciaMin === null} onGuardar={(v) => cambiar((b) => void (b.examen.asistencia = v))} />
                        </div>
                      </div>
                    )}
                  </div>
                  {examen.eximicion !== null && presentacion.length > 0 && <p className="text-xs text-fg-2">¿Alguna categoría exige un mínimo para eximirte o dar examen? Ábrela en «Reglas especiales».</p>}
                </>
              )}
            </section>
          </>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        <span className="mr-auto hidden text-xs text-fg-3 sm:inline">{notasRegistradas(categorias) > 0 ? `Tus ${plural(notasRegistradas(categorias), "nota registrada", "notas registradas")} se mantienen.` : ""}</span>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton variante="primario" icono={<Check className="size-4" />} disabled={categorias.length === 0} onClick={guardar}>Guardar</Boton>
      </div>
    </Modal>
  );
}
