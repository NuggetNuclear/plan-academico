import { FlaskConical, Gauge, NotebookPen, Target } from "lucide-react";
import { create } from "zustand";
import { calcularPPA, resumenCreditos } from "../core/academic";
import { NOTA_APROB, fmtNota } from "../core/format";
import { useApp, useCtx } from "../store/app";
import { CampoNumero } from "../ui/CampoNumero";
import { PanelPestana, Pestanas, Tarjeta, cx } from "../ui/primitives";
import { PlanificacionNotas, type EscenarioNotas } from "./notas/PlanificacionNotas";
import { crearSimulacion } from "./notas/planificacion";

type Pestana = "notas" | "ppa";

/**
 * Borrador de la sesión: sobrevive al cambiar de sección (el módulo sigue cargado) y se descarta al recargar.
 * Nunca se escribe en el estado de la app.
 */
const useBorrador = create<{ pestana: Pestana; escenario: EscenarioNotas; nota: number }>(() => ({
  pestana: "notas",
  escenario: { origen: "", entrada: crearSimulacion() },
  nota: 5,
}));

function SimuladorPPA() {
  const ctx = useCtx();
  const mutar = useApp((s) => s.mutar);
  const nota = useBorrador((s) => s.nota);
  const setNota = (n: number) => useBorrador.setState({ nota: n });
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
    <Tarjeta>
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


export function Simulaciones() {
  const ctx = useCtx();
  const pestana = useBorrador((s) => s.pestana);
  const escenario = useBorrador((s) => s.escenario);
  return (
    <div className="space-y-5">
      <div className="hero relative flex items-start gap-3.5 overflow-clip rounded-[1.6rem] p-5">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/[0.16]">
          <FlaskConical className="size-5" />
        </span>
        <div>
          <p className="text-[16px] font-extrabold">Esto es una simulación</p>
          <p className="text-[13.5px] text-white/90">Prueba notas sin miedo: nada de lo que hagas aquí cambia tus notas reales ni tu PPA. Se borra al recargar la página.</p>
        </div>
      </div>
      <Pestanas
        base="simulaciones"
        etiqueta="Qué quieres simular"
        valor={pestana}
        onChange={(p) => useBorrador.setState({ pestana: p })}
        opciones={[
          { valor: "notas", etiqueta: "Notas de un ramo", icono: <NotebookPen /> },
          { valor: "ppa", etiqueta: "PPA y meta", icono: <Gauge /> },
        ]}
      />
      <PanelPestana base="simulaciones" valor={pestana}>
        {pestana === "notas" ? (
          <PlanificacionNotas ctx={ctx} escenario={escenario} onCambiar={(v) => useBorrador.setState((s) => ({ escenario: typeof v === "function" ? v(s.escenario) : v }))} />
        ) : (
          <SimuladorPPA />
        )}
      </PanelPestana>
    </div>
  );
}
