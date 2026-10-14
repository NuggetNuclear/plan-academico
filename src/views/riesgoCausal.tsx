import { CircleCheck, ShieldAlert, TriangleAlert } from "lucide-react";
import { listaNombres, nombreEntrada, situacionSemestreUDP, type CausalUDP, type Ctx, type RiesgoRamoUDP, type SituacionSemestreUDP } from "../core/academic";
import { fmtNota } from "../core/format";
import type { Entrada } from "../core/state";
import { Aviso } from "../ui/primitives";

const pct = (n: number) => fmtNota(n, n % 1 ? 1 : 0);

export const letrasCausal = (causales: CausalUDP[]) => (causales.length === 1 ? `causal ${causales[0]}` : `causales ${causales.join(" y ")}`);

/** Cómo vas en el ramo y cuánto necesitas para aprobarlo. */
export function textoRendimiento({ calculo: c, rendimiento }: Pick<RiesgoRamoUDP, "calculo" | "rendimiento">): { tono: "ok" | "warn" | "danger"; texto: string } {
  const requisitos = c.reqMetas.map((m) => ` y al menos ${fmtNota(m.nec, 2)} en ${m.nombre}`).join("");
  switch (rendimiento) {
    case "sin-notas":
      return { tono: "warn", texto: "Aún no registras notas: hazlo apenas las tengas para saber cuánto necesitas." };
    case "asegurado":
      return { tono: "ok", texto: "Ya aseguraste el 4,0: este ramo no te deja en causal." };
    case "perdido":
      if (c.examen?.habilitacion === "no-habilitado") return { tono: "danger", texto: `No cumples ${c.examen.condicionesExamen.find((x) => x.estado === "falla")?.texto ?? "los mínimos"} para dar examen: repruebas el ramo.` };
      return { tono: "danger", texto: c.reqFallidos.length ?`Reprobaste el requisito ${c.reqFallidos.join(", ")}: ya no alcanzas el 4,0.` : "Con tus notas actuales ya no alcanzas el 4,0, ni con 7,0 en lo que queda." };
    case "aprobando":
    case "reprobando": {
      const vas = `Vas con ${fmtNota(c.nfActual)} (${pct(c.pesoEvaluado)}% evaluado)`;
      if (c.necesaria === null || c.restante <= 0) return { tono: rendimiento === "aprobando" ? "ok" : "danger", texto: `${vas}.` };
      if (rendimiento === "aprobando") return { tono: c.necesaria > 4 ? "warn" : "ok", texto: `${vas}. Para no bajar del 4,0 necesitas al menos ${fmtNota(c.necesaria, 2)} en el ${pct(c.restante)}% restante${requisitos}.` };
      return { tono: "danger", texto: `${vas}: estás reprobando. Necesitas promediar ${fmtNota(c.necesaria, 2)} en el ${pct(c.restante)}% restante${requisitos}.` };
    }
  }
}

/** Por qué reprobar este ramo te deja en causal. */
export function motivoCausal(s: SituacionSemestreUDP, r: RiesgoRamoUDP): string {
  const partes: string[] = [];
  if (r.causales.includes("b")) partes.push(`sería tu ${r.reprobaciones + 1}ª reprobación de esta asignatura (b)`);
  if (r.causales.includes("a")) partes.push(`sería tu segunda reprobación y la ${s.dosVeces.length + 1}ª asignatura reprobada dos veces (a)`);
  const texto = partes.join("; ");
  return texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
}

/** Aviso del reglamento UDP dentro de la tarjeta de un ramo en curso. */
export function AvisoCausalRamo({ ctx, entrada }: { ctx: Ctx; entrada: Entrada }) {
  const s = situacionSemestreUDP(ctx);
  const r = s.ramos.find((x) => x.entrada.uid === entrada.uid);
  if (!r) return null;
  const rend = textoRendimiento(r);

  if (r.causales.length) {
    const grave = r.rendimiento === "reprobando" || r.rendimiento === "perdido";
    return (
      <Aviso tono={r.rendimiento === "asegurado" ? "ok" : grave ? "danger" : "warn"} icono={r.rendimiento === "asegurado" ? <CircleCheck /> : <ShieldAlert />}>
        <p className="font-bold">Si repruebas este ramo caes en {letrasCausal(r.causales)} de eliminación</p>
        <p>{motivoCausal(s, r)} {rend.texto}</p>
        {r.rendimiento === "perdido" && (
          <p className="mt-1">
            Habla cuanto antes con tu jefatura de carrera. Si caes en causal puedes solicitar tu permanencia al Comité de Carrera (art. 39); la anulación del semestre (art. 46) solo se puede pedir dentro de los plazos del calendario académico.
          </p>
        )}
        {s.reincidencia && r.rendimiento !== "asegurado" && <p className="mt-1">Ya tuviste una permanencia aceptada: esta sería otra causal y la apelación a la Comisión Especial de Gracia (art. 40) es solo para la primera vez.</p>}
      </Aviso>
    );
  }

  if (s.combinadaA?.claves.includes(r.clave) && r.rendimiento !== "asegurado") {
    return (
      <Aviso tono={r.rendimiento === "reprobando" || r.rendimiento === "perdido" ? "danger" : "warn"} icono={<TriangleAlert />}>
        <p>
          Ya reprobaste este ramo una vez. Si repruebas {s.combinadaA.necesarias} de estos ramos ({listaNombres(ctx, s.combinadaA.claves)}), caes en causal a. {rend.texto}
        </p>
      </Aviso>
    );
  }
  return null;
}

/** Mensaje breve para avisar tras registrar una nota que te está dejando en causal. */
export function alertaTrasNota(ctx: Ctx, uid: string): string | null {
  const s = situacionSemestreUDP(ctx);
  const r = s.ramos.find((x) => x.entrada.uid === uid);
  if (!r?.causales.length) return null;
  const nombre = nombreEntrada(ctx, r.entrada);
  if (r.rendimiento === "perdido") return `${nombre}: ya no alcanzas el 4,0. Si lo repruebas caes en ${letrasCausal(r.causales)}.`;
  if (r.rendimiento !== "reprobando") return null;
  const nec = r.calculo.necesaria;
  return `${nombre}: vas con ${fmtNota(r.calculo.nfActual)} y lo estás reprobando (${letrasCausal(r.causales)}).${nec !== null ? ` Necesitas ${fmtNota(nec, 2)} en lo que queda.` : ""}`;
}

