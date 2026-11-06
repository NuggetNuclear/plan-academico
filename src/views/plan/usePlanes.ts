import { useMemo, useRef } from "react";
import { generarPlanes, planDesdeGuardado, type Plan } from "../../core/planner";
import { firmaPlanificacion, useApp, useCtx } from "../../store/app";

/**
 * Planes recomendados. Se recalculan solo cuando cambia algo que los afecta, así
 * los ajustes hechos a mano (mover, intercambiar) se conservan.
 */
export function usePlanes() {
  const ctx = useCtx();
  const editados = useApp((s) => s.planesEditados);
  const setEditados = useApp((s) => s.setPlanesEditados);
  const firma = useMemo(() => firmaPlanificacion(ctx), [ctx]);
  const ref = useRef(ctx);
  ref.current = ctx;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generados = useMemo(() => generarPlanes(ref.current), [firma]);
  const vigentes = editados?.firma === firma;
  const planes = vigentes ? editados.planes : generados;
  const guardado = useMemo(() => (ctx.st.planFijado ? planDesdeGuardado(ctx, ctx.st.planFijado) : null), [ctx]);

  return {
    planes,
    guardado,
    actualizarPlan: (idx: number, plan: Plan) => {
      const lista = [...planes];
      lista[idx] = plan;
      setEditados({ firma, planes: lista });
    },
    /** Vuelve una opción a como la generó la app, sin tocar los cambios hechos en las demás. */
    restaurar: (idx: number) => {
      const lista = [...planes];
      lista[idx] = generados[idx];
      setEditados(lista.every((p, i) => p === generados[i]) ? null : { firma, planes: lista });
    },
    /** Si esa opción tiene cambios hechos a mano. */
    editado: (idx: number) => vigentes && planes[idx] !== generados[idx],
  };
}

/** Semestres que faltan y el último con ramos por cursar (incluye los que aún no caben). */
export function restantesDe(plan: Plan): { n: number; ultimo: number | null } {
  const futuros = plan.semestres.filter((s) => s.tipo === "futuro" || s.tipo === "overflow");
  return { n: futuros.length, ultimo: futuros.at(-1)?.numero ?? null };
}

/** Semestres que faltan según tu plan guardado (o el recomendado). */
export function semestresRestantes(planes: Plan[], guardado: Plan | null): { n: number; ultimo: number | null; fuente: "guardado" | "recomendado" | null } {
  const plan = guardado ?? planes[0] ?? null;
  if (!plan) return { n: 0, ultimo: null, fuente: null };
  return { ...restantesDe(plan), fuente: guardado ? "guardado" : "recomendado" };
}
