import { Eraser, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useId, type Dispatch, type SetStateAction } from "react";
import { esPeriodoActual, nombreEntrada, nombrePeriodo, periodosOrdenados, type Ctx } from "../../core/academic";
import { fmtNota, fmtPct } from "../../core/format";
import { aplicarPlantilla, calcularRamo, PLANTILLAS, statsCategoria } from "../../core/grades";
import { nuevoUid, type Entrada } from "../../core/state";
import { CampoNumero, CampoTexto } from "../../ui/CampoNumero";
import { Aviso, Boton, BotonIcono, Tarjeta } from "../../ui/primitives";
import { crearSimulacion } from "./planificacion";

export interface EscenarioNotas { origen: string; entrada: Entrada }

/** Calculadora local: todas las ediciones se quedan en el escenario recibido. */
export function PlanificacionNotas({ ctx, escenario, onCambiar }: {
  ctx: Ctx; escenario: EscenarioNotas; onCambiar: Dispatch<SetStateAction<EscenarioNotas>>;
}) {
  const id = useId();
  const { entrada } = escenario;
  const calculo = calcularRamo(entrada);
  const fuentes = periodosOrdenados(ctx.st).flatMap((p) => p.ramos.filter((e) => e.categorias.length > 0).map((e) => ({
    entrada: e, corto: nombreEntrada(ctx, e), nombre: `${nombreEntrada(ctx, e)} · ${nombrePeriodo(p, ctx.cur.malla.periodoVerano)}`, actual: esPeriodoActual(ctx.st, p),
  })));
  const delSemestre = fuentes.filter((f) => f.actual);
  const editar = (fn: (e: Entrada) => void) => onCambiar((previo) => {
    const copia = structuredClone(previo.entrada);
    fn(copia);
    return { ...previo, entrada: copia };
  });
  const elegirBase = (origen: string) => {
    if (origen === "") return;
    let copia = crearSimulacion();
    if (origen.startsWith("ramo:")) {
      const fuente = fuentes.find((f) => f.entrada.uid === origen.slice(5));
      if (!fuente) return;
      copia = crearSimulacion(fuente.entrada);
    } else if (origen.startsWith("plantilla:")) {
      const plantilla = PLANTILLAS[Number(origen.slice(10))];
      if (!plantilla) return;
      aplicarPlantilla(copia, plantilla);
      copia = crearSimulacion(copia);
    }
    onCambiar({ origen, entrada: copia });
  };
  const peso = calculo.examen?.pesoPresentacion ?? calculo.pesoTotal;
  const esperado = calculo.examen?.pesoPresentacionEsperado ?? 100;

  const nombreOrigen = escenario.origen.startsWith("ramo:")
    ? fuentes.find((f) => f.entrada.uid === escenario.origen.slice(5))?.nombre ?? "Un ramo"
    : escenario.origen.startsWith("plantilla:")
      ? `Plantilla ${PLANTILLAS[Number(escenario.origen.slice(10))]?.nombre ?? ""}`
      : "Un ramo en blanco";
  const otrosRamos = (
    <select id={`${id}-base`} className="input" value="" onChange={(e) => elegirBase(e.target.value)}>
      <option value="">Elegir…</option>
      {fuentes.length > 0 && <optgroup label="Mis ramos">
        {fuentes.map((f) => <option key={f.entrada.uid} value={`ramo:${f.entrada.uid}`}>{f.nombre}</option>)}
      </optgroup>}
      <optgroup label="Plantillas">
        {PLANTILLAS.map((p, i) => <option key={p.nombre} value={`plantilla:${i}`}>{p.nombre}</option>)}
      </optgroup>
    </select>
  );

  // Primer paso: elegir qué simular. Así se entiende de entrada qué hace esta pantalla.
  if (escenario.origen === "") {
    return (
      <Tarjeta className="space-y-4">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight">¿Qué ramo quieres simular?</h2>
          <p className="mt-0.5 text-[13.5px] text-fg-2">Copiamos sus porcentajes y tus notas; después cambias o agregas notas para ver con cuánto terminarías.</p>
        </div>
        {delSemestre.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {delSemestre.map((f) => (
              <button key={f.entrada.uid} type="button" onClick={() => elegirBase(`ramo:${f.entrada.uid}`)} className="min-h-11 rounded-full bg-accent-soft px-4 text-[13.5px] font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-fg">
                {f.corto}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <label className="label" htmlFor={`${id}-base`}>{delSemestre.length > 0 ? "Otro ramo o una plantilla" : "Un ramo o una plantilla"}</label>
            {otrosRamos}
          </div>
          <Boton variante="fantasma" icono={<Plus className="size-4" />} onClick={() => onCambiar({ origen: "blanco", entrada: crearSimulacion() })}>Partir en blanco</Boton>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 text-[13.5px]">
          <span className="text-fg-2">Simulando:</span> <strong>{nombreOrigen}</strong>
        </p>
        <Boton tamano="sm" variante="fantasma" icono={<Eraser className="size-4" />} onClick={() => editar((e) => e.categorias.forEach((c) => c.notas.forEach((n) => { n.n = null; })))}>Vaciar notas de prueba</Boton>
        <Boton tamano="sm" variante="suave" icono={<RefreshCw className="size-4" />} onClick={() => onCambiar({ origen: "", entrada: crearSimulacion() })}>Simular otro ramo</Boton>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-label="Evaluaciones de prueba" className="min-w-0 space-y-3">
          {entrada.categorias.map((c, ci) => (
            <Tarjeta key={c.id} className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="label" htmlFor={`${id}-cat-${ci}`}>{c.examen ? "Examen" : "Categoría"}</label>
                  <CampoTexto id={`${id}-cat-${ci}`} className="input" valor={c.nombre} onGuardar={(v) => editar((e) => { e.categorias[ci].nombre = v; })} />
                </div>
                <div className="w-20 shrink-0">
                  <label className="label" htmlFor={`${id}-peso-${ci}`}>Vale %</label>
                  <CampoNumero id={`${id}-peso-${ci}`} className="input text-right" aria-label={`Porcentaje de ${c.nombre || `categoría ${ci + 1}`}`} valor={c.peso} min={0} max={100} onGuardar={(v) => editar((e) => { e.categorias[ci].peso = v ?? 0; })} />
                </div>
                <BotonIcono etiqueta={`Eliminar categoría de prueba ${c.nombre}`} onClick={() => editar((e) => { e.categorias.splice(ci, 1); })}><Trash2 className="size-4" /></BotonIcono>
              </div>
              <ul className="space-y-2">
                {c.notas.map((n, ni) => {
                  const nombre = n.etiqueta || `${c.nombre || "Evaluación"} ${ni + 1}`;
                  return <li key={n.id} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1 basis-28">
                      <label className="label" htmlFor={`${id}-nota-${ci}-${ni}`}>{nombre}</label>
                      <CampoNumero id={`${id}-nota-${ci}-${ni}`} className="input font-bold tabular" aria-label={`Nota de prueba: ${nombre}`} valor={n.n} placeholder="—" min={1} max={7} minDecimales={1} onGuardar={(v) => editar((e) => { e.categorias[ci].notas[ni].n = v; })} />
                    </div>
                    <div className="w-16 shrink-0">
                      <label className="label" htmlFor={`${id}-factor-${ci}-${ni}`}>Peso ×</label>
                      <CampoNumero id={`${id}-factor-${ci}-${ni}`} className="input text-right" aria-label={`Peso de prueba: ${nombre}`} valor={n.f} min={0} max={100} vacioPermitido={false} onGuardar={(v) => editar((e) => { e.categorias[ci].notas[ni].f = v!; })} />
                    </div>
                    <BotonIcono etiqueta={`Quitar valor de prueba de ${nombre}`} disabled={n.n === null} onClick={() => editar((e) => { e.categorias[ci].notas[ni].n = null; })}><Eraser className="size-4" /></BotonIcono>
                    <BotonIcono etiqueta={`Eliminar evaluación de prueba ${nombre}`} onClick={() => editar((e) => { e.categorias[ci].notas.splice(ni, 1); })}><Trash2 className="size-4" /></BotonIcono>
                  </li>;
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Boton tamano="sm" variante="fantasma" icono={<Plus className="size-4" />} onClick={() => editar((e) => { e.categorias[ci].notas.push({ id: nuevoUid(), n: null, f: 1 }); })}>Agregar evaluación</Boton>
                <p className="text-sm text-fg-2">Promedio: <strong className="tabular">{fmtNota(statsCategoria(c).promRendido, 2)}</strong></p>
              </div>
            </Tarjeta>
          ))}
          <Boton icono={<Plus className="size-4" />} onClick={() => editar((e) => { e.categorias.push({ id: nuevoUid(), nombre: `Categoría ${e.categorias.length + 1}`, peso: 0, notas: [{ id: nuevoUid(), n: null, f: 1 }] }); })}>Agregar categoría</Boton>
        </section>
        <Tarjeta className="space-y-3 lg:sticky lg:top-24">
          <div role="status" aria-live="polite" aria-atomic="true">
            <h2 className="text-sm font-semibold text-fg-2">Promedio de prueba</h2>
            <p className="mt-1 text-4xl font-extrabold text-accent tabular">{fmtNota(calculo.nfActual, 2)}</p>
            <p className="mt-1 text-xs text-fg-3">Con los valores ingresados · {fmtPct(calculo.pesoEvaluado)}% evaluado</p>
            <p className="mt-3 text-sm text-fg-2">Peor caso: <strong className="tabular">{fmtNota(calculo.nfPeor, 2)}</strong></p>
            {calculo.necesaria !== null && <p className="mt-1 text-sm text-fg-2">Para el 4,0: {calculo.necesaria > 7 ? "ya no alcanza con lo pendiente" : calculo.necesaria <= 1 ? "alcanza con 1,0 en lo pendiente" : `necesitas ${fmtNota(calculo.necesaria, 2)} en lo pendiente`}.</p>}
            {calculo.examen && <p className="mt-2 text-sm text-fg-2">Presentación: <strong>{fmtNota(calculo.examen.np, 2)}</strong>{["eximido", "asegurada"].includes(calculo.examen.estado) ? " · Eximición alcanzada en esta prueba" : ""}.</p>}
          </div>
          {Math.abs(peso - esperado) > 0.05 && <Aviso tono="warn">Los porcentajes suman {fmtPct(peso)}%; deben sumar {fmtPct(esperado)}%{calculo.examen ? " antes del examen" : ""}.</Aviso>}
          {(calculo.reqFallidos.length > 0 || calculo.examen?.habilitacion === "no-habilitado") && <Aviso tono="warn">Estos valores no cumplen los requisitos de aprobación o de acceso al examen.</Aviso>}
          <p className="text-xs text-fg-3">Las notas pendientes no cuentan en el promedio actual; en el peor caso cuentan como 1,0. Un peso ×0 excluye esa evaluación.</p>
        </Tarjeta>
      </div>
    </div>
  );
}
