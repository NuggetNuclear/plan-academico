import { Check, NotebookPen } from "lucide-react";
import { useRef, useState } from "react";
import { clavePeriodo, nombreEntrada, nombrePeriodo, type Ctx } from "../../core/academic";
import { fmtNota, leerNumero, numeroConComa } from "../../core/format";
import { configExamen, indiceExamen } from "../../core/grades";
import type { Periodo } from "../../core/state";
import { useApp } from "../../store/app";
import { periodoPorClave } from "../../store/mutaciones";
import { toast } from "../../store/ui";
import { CabeceraModal, Modal, PieModal } from "../../ui/overlays";
import { Boton } from "../../ui/primitives";
import { alertaTrasNota } from "../riesgoCausal";
import { guardarRegistro, validarRegistro, type Registro } from "./registro";

export interface SeleccionNota { uid?: string; ci?: number; ni?: number }

export function RegistroNota({ ctx, periodo, seleccion, onCerrar }: { ctx: Ctx; periodo: Periodo; seleccion: SeleccionNota; onCerrar: () => void }) {
  const disponibles = periodo.ramos.filter((e) => e.notaFinal === null);
  const [uid, setUid] = useState(seleccion.uid ?? disponibles[0]?.uid ?? "");
  const entrada = disponibles.find((e) => e.uid === uid);
  const inicial = seleccion.ci !== undefined && seleccion.ni !== undefined ? `${seleccion.ci}:${seleccion.ni}` : "nueva";
  const [destino, setDestino] = useState(inicial);
  const [categoria, setCategoria] = useState("nueva");
  const original = entrada?.categorias[seleccion.ci ?? -1]?.notas[seleccion.ni ?? -1];
  const [nombre, setNombre] = useState(original?.etiqueta || (original ? `${entrada?.categorias[seleccion.ci!].nombre || "Evaluación"} ${seleccion.ni! + 1}` : ""));
  const [nota, setNota] = useState(numeroConComa(original?.n));
  const [fecha, setFecha] = useState(original?.fecha ?? "");
  const [porcentaje, setPorcentaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const guardando = useRef(false);
  const nuevaCategoria = destino === "nueva" && categoria === "nueva";
  const elegir = (valor: string) => {
    setDestino(valor);
    setError(null);
    if (valor === "nueva") { setNombre(""); setNota(""); setFecha(""); return; }
    const [ci, ni] = valor.split(":").map(Number);
    const cat = entrada!.categorias[ci];
    const n = cat.notas[ni];
    setNombre(n.etiqueta || `${cat.nombre || "Evaluación"} ${ni + 1}`);
    setNota(numeroConComa(n.n));
    setFecha(n.fecha ?? "");
  };
  const mostrarError = (mensaje: string) => {
    setError(mensaje);
    requestAnimationFrame(() => errorRef.current?.focus());
  };
  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrada || guardando.current) return;
    const [ci, ni] = destino.split(":").map(Number);
    const datos: Registro = { categoria: destino !== "nueva" ? ci : categoria === "nueva" ? null : Number(categoria), evaluacion: destino !== "nueva" ? ni : null, nombre, nota, fecha, porcentaje };
    const err = validarRegistro(entrada, datos);
    if (err) return mostrarError(err);
    guardando.current = true;
    let fallo: string | null = null;
    useApp.getState().mutar(`Nota de ${nombreEntrada(ctx, entrada)}`, (actual) => {
      const ramo = periodoPorClave(actual.st, clavePeriodo(periodo))?.ramos.find((r) => r.uid === uid);
      fallo = ramo ? guardarRegistro(ramo, datos) : "Este ramo ya no está en el periodo.";
    });
    if (fallo) { guardando.current = false; return mostrarError(fallo); }
    const { cur, st } = useApp.getState();
    const alerta = cur ? alertaTrasNota({ cur, st }, uid) : null;
    toast(alerta ?? `${nombre.trim()}: ${nota.replace(".", ",")} guardada`, alerta ? "error" : "ok", { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() });
    onCerrar();
  };

  return (
    <Modal abierto onCerrar={onCerrar} etiqueta="Registrar nota" ancho="md">
      <form onSubmit={guardar} noValidate aria-describedby={error ? "registro-error" : undefined}>
        <CabeceraModal icono={<NotebookPen className="size-5" />} titulo="Registrar nota" sobretitulo={nombrePeriodo(periodo, ctx.cur.malla.periodoVerano)} onCerrar={onCerrar}>
          Elige la evaluación, escribe tu nota y listo.
        </CabeceraModal>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="registro-ramo" className="label">Ramo</label>
            <select id="registro-ramo" className="input" value={uid} onChange={(e) => { setUid(e.target.value); setDestino("nueva"); setCategoria("nueva"); setNombre(""); setNota(""); setFecha(""); setPorcentaje(""); setError(null); }}>
              {disponibles.map((r) => <option key={r.uid} value={r.uid}>{nombreEntrada(ctx, r)}</option>)}
            </select>
          </div>
          {!!entrada?.categorias.length && <div>
            <label htmlFor="registro-evaluacion" className="label">Evaluación</label>
            <select id="registro-evaluacion" className="input" value={destino} onChange={(e) => elegir(e.target.value)}>
              <option value="nueva">Agregar una evaluación nueva</option>
              {entrada.categorias.map((c, ci) => <optgroup key={ci} label={c.nombre || `Categoría ${ci + 1}`}>
                {c.notas.map((n, ni) => <option key={ni} value={`${ci}:${ni}`}>{n.etiqueta || `${c.nombre || "Evaluación"} ${ni + 1}`} · {n.n === null ? "Pendiente" : fmtNota(n.n)}</option>)}
              </optgroup>)}
            </select>
          </div>}
          {destino === "nueva" && !!entrada?.categorias.length && <div>
            <label htmlFor="registro-categoria" className="label">¿Dónde cuenta esta evaluación?</label>
            <select id="registro-categoria" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="nueva">Tiene su propio porcentaje</option>
              {entrada.categorias.map((c, ci) => <option key={ci} value={ci}>{c.nombre || `Categoría ${ci + 1}`} ({c.peso}%)</option>)}
            </select>
            {categoria !== "nueva" && <p className="mt-1 text-xs text-fg-2">Se agrega con peso ×1 dentro del grupo. Esto cambia cómo se reparte su porcentaje.</p>}
          </div>}
          <div>
            <label htmlFor="registro-nombre" className="label">Nombre de la evaluación</label>
            <input id="registro-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Solemne 1" required maxLength={100} aria-invalid={!!error && !nombre.trim()} aria-describedby={error && !nombre.trim() ? "registro-error" : undefined} />
          </div>
          <div className="rounded-2xl border border-accent-line bg-accent-soft p-4">
            <label htmlFor="registro-nota" className="label">Tu nota</label>
            <input id="registro-nota" data-autofocus={original ? true : undefined} className="input !text-3xl font-bold tabular" inputMode="decimal" autoComplete="off" enterKeyHint="done" placeholder="5,5" value={nota} onChange={(e) => setNota(e.target.value)} aria-invalid={!!error && (!Number.isFinite(leerNumero(nota)) || leerNumero(nota) < 1 || leerNumero(nota) > 7)} aria-describedby={error ? "registro-ayuda registro-error" : "registro-ayuda"} required />
            <p id="registro-ayuda" className="mt-2 text-xs text-fg-2">De 1,0 a 7,0. Acepta coma o punto.</p>
          </div>
          {nuevaCategoria && <div>
            <label htmlFor="registro-peso" className="label">Porcentaje de la nota {entrada && indiceExamen(entrada) >= 0 && configExamen(entrada).escala === "presentacion" ? "de presentación" : "final"} (opcional)</label>
            <input id="registro-peso" className="input" inputMode="decimal" placeholder="Ej. 30" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} aria-describedby="registro-peso-ayuda" />
            <p id="registro-peso-ayuda" className="mt-1 text-xs text-fg-2">¿No lo sabes? Déjalo vacío. La nota queda registrada y contará en el promedio cuando asignes su porcentaje en «Configurar ramo».</p>
          </div>}
          <div>
            <label htmlFor="registro-fecha" className="label">Fecha de la evaluación (opcional)</label>
            <input id="registro-fecha" className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          {error && <p id="registro-error" ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        </div>
        <PieModal>
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="primario" icono={<Check className="size-4" />} disabled={!entrada}>Guardar nota</Boton>
        </PieModal>
      </form>
    </Modal>
  );
}
