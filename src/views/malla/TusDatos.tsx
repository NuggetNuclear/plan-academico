import { ChevronDown, Eraser, IdCard, Info, Plus, Snowflake, Wand2, X } from "lucide-react";
import { useState } from "react";
import { useApp, useCtx } from "../../store/app";
import { confirmar, toast, useUI } from "../../store/ui";
import { estadoInicial } from "../../core/state";
import { Boton, Campo, Interruptor, cx } from "../../ui/primitives";

export function TusDatos() {
  const ctx = useCtx();
  const { st, cur } = ctx;
  const mutar = useApp((s) => s.mutar);
  const setWizard = useUI((s) => s.setWizard);
  const [abierto, setAbierto] = useState(false);
  const niveles = (cur.malla.nivelesIngles ?? []).filter((id) => cur.map[id] || cur.catalogo[id]);

  return (
    <section className="card overflow-hidden">
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex w-full items-center gap-3 px-5 py-4 text-left sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <IdCard className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">Tus datos</span>
          <span className="block break-words text-[13px] text-fg-2">
            Semestre {st.semestreActual} · {st.inglesEximido ? `${st.inglesEximido} nivel(es) de inglés eximidos` : "sin inglés eximido"}
            {st.congelaciones.length > 0 && ` · ${st.congelaciones.length} congelación(es)`}
          </span>
        </span>
        <ChevronDown className={cx("size-5 text-fg-3 transition-transform", abierto && "rotate-180")} />
      </button>
      {abierto && (
        <div className="animar-entrada space-y-5 border-t border-line px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Semestre actual" htmlFor="td-sem" ayuda="El que estás cursando ahora, sin contar congelaciones.">
              <input
                id="td-sem"
                type="number"
                min={1}
                max={20}
                className="input"
                value={st.semestreActual}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(20, Math.trunc(Number(e.target.value) || 1)));
                  mutar("Cambiar semestre actual", ({ st }) => (st.semestreActual = n));
                }}
              />
            </Campo>
            {niveles.length > 0 && (
              <Campo etiqueta="Inglés eximido" htmlFor="td-ingles" ayuda="Los niveles eximidos se marcan como aprobados.">
                <select
                  id="td-ingles"
                  className="input"
                  value={st.inglesEximido}
                  onChange={(e) => mutar("Cambiar inglés eximido", ({ st }) => (st.inglesEximido = Number(e.target.value)))}
                >
                  <option value={0}>Ninguno</option>
                  {niveles.map((_, i) => (
                    <option key={i} value={i + 1}>
                      {i === 0 ? "Nivel 1" : i === niveles.length - 1 ? `Todos (1-${i + 1})` : `Niveles 1-${i + 1}`}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>

          <div className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[13.5px] font-bold">
                  <Snowflake className="size-4 text-info" /> ¿Congelaste estudios?
                </p>
                <p className="text-[12.5px] text-fg-2">Las pausas mueven tu semestre calendario y la fecha estimada de egreso.</p>
              </div>
              <Interruptor
                checked={st.congelaciones.length > 0}
                etiqueta={st.congelaciones.length > 0 ? "Sí" : "No"}
                onChange={(v) =>
                  mutar(v ? "Agregar congelación" : "Quitar congelaciones", ({ st }) => {
                    st.congelaciones = v ? [{ desde: Math.max(1, st.semestreActual), duracion: 1 }] : [];
                  })
                }
              />
            </div>
            {st.congelaciones.length > 0 && (
              <div className="mt-3 space-y-2">
                {st.congelaciones.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="text-fg-2">Desde el semestre</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input w-20"
                      value={c.desde}
                      aria-label="Semestre que quedó pendiente"
                      onChange={(e) => mutar("Editar congelación", ({ st }) => (st.congelaciones[i].desde = Math.max(1, Math.trunc(Number(e.target.value) || 1))))}
                    />
                    <span className="text-fg-2">durante</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input w-20"
                      value={c.duracion}
                      aria-label="Semestres congelados"
                      onChange={(e) => mutar("Editar congelación", ({ st }) => (st.congelaciones[i].duracion = Math.max(1, Math.trunc(Number(e.target.value) || 1))))}
                    />
                    <span className="text-fg-2">semestre(s)</span>
                    <button
                      type="button"
                      aria-label="Quitar congelación"
                      className="rounded-lg p-1.5 text-fg-3 hover:bg-danger-soft hover:text-danger"
                      onClick={() => mutar("Quitar congelación", ({ st }) => st.congelaciones.splice(i, 1))}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <Boton tamano="sm" variante="fantasma" icono={<Plus className="size-4" />} onClick={() => mutar("Agregar congelación", ({ st }) => st.congelaciones.push({ desde: st.semestreActual, duracion: 1 }))}>
                  Agregar otra
                </Boton>
                <p className="flex items-start gap-1.5 text-[12px] text-fg-3">
                  <Info className="mt-0.5 size-3.5 shrink-0" /> Si terminaste el semestre 2 y luego congelaste, indica desde el semestre 3. La pausa no cuenta como semestre cursado ni cambia notas o créditos.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Boton tamano="sm" icono={<Wand2 className="size-4" />} onClick={() => setWizard(true)}>
              Repetir asistente de inicio
            </Boton>
            <Boton
              tamano="sm"
              variante="peligro"
              icono={<Eraser className="size-4" />}
              onClick={async () => {
                const ok = await confirmar({
                  titulo: "Borrar todo tu progreso",
                  mensaje: `Se borrarán la malla marcada, tus notas y planes de ${cur.malla.carrera}. Podrás deshacerlo justo después con Ctrl+Z.`,
                  aceptar: "Borrar todo",
                  peligro: true,
                });
                if (!ok) return;
                mutar("Borrar progreso", (c) => {
                  const nuevo = estadoInicial();
                  nuevo.prefs.wizardHecho = true;
                  Object.assign(c.st, nuevo);
                });
                toast("Progreso borrado.", "info", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
              }}
            >
              Borrar todo mi progreso
            </Boton>
          </div>
        </div>
      )}
    </section>
  );
}
