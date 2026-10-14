import { nombreEntrada, siglaEntrada, type Ctx } from "./academic";
import { calcularRamo, pesoEnRamo } from "./grades";

interface Evaluacion {
  fecha: string; // AAAA-MM-DD
  ramo: string;
  sigla: string;
  categoria: string;
  etiqueta: string;
  peso: number; // % aproximado del ramo
  rendida: boolean;
  uid: string;
}

/** Evaluaciones con fecha de los ramos aún abiertos (semestre en curso y verano). */
export function evaluacionesConFecha(ctx: Ctx): Evaluacion[] {
  const out: Evaluacion[] = [];
  ctx.st.periodos.forEach((p) => {
    if (p.tipo === "convalidaciones") return;
    p.ramos.forEach((e) => {
      if (e.notaFinal !== null) return;
      // Si ya te eximiste, el examen no aparece como próxima evaluación.
      const eximicion = calcularRamo(e).examen?.estado;
      const eximido = eximicion === "eximido" || eximicion === "asegurada";
      e.categorias.forEach((c, ci) => {
        if (c.examen && eximido) return;
        const peso = pesoEnRamo(e, c);
        const fTot = c.notas.reduce((s, n) => s + (n.f > 0 ? n.f : 0), 0) || 1;
        c.notas.forEach((n, ni) => {
          if (!n.fecha) return;
          out.push({
            fecha: n.fecha,
            ramo: nombreEntrada(ctx, e),
            sigla: siglaEntrada(ctx, e),
            categoria: c.nombre || "Evaluación",
            etiqueta: n.etiqueta || `${c.nombre || "Evaluación"} ${ni + 1}`,
            peso: Math.round(((peso *(n.f > 0 ? n.f : 0)) / fTot) * 10) / 10,
            rendida: n.n !== null,
            uid: n.id ?? `${e.uid}-${ci}-${ni}`,
          });
        });
      });
    });
  });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function hoyISO(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function diasHasta(fecha: string, desde = new Date()): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const objetivo = new Date(y, m - 1, d).getTime();
  const hoy = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime();
  return Math.round((objetivo - hoy) / 86400000);
}

const escaparICS = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Archivo .ics compatible con Google Calendar, Apple Calendar y Outlook. */
export function generarICS(evaluaciones: Evaluacion[], nombreCalendario = "Evaluaciones"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Notas Planner//ES",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escaparICS(nombreCalendario)}`,
  ];
  evaluaciones.forEach((ev) => {
    const inicio = ev.fecha.replace(/-/g, "");
    const [y, m, d] = ev.fecha.split("-").map(Number);
    const fin = hoyISO(new Date(y, m - 1, d + 1)).replace(/-/g, "");
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}@notas-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${inicio}`,
      `DTEND;VALUE=DATE:${fin}`,
      `SUMMARY:${escaparICS(`${ev.etiqueta} · ${ev.ramo}`)}`,
      `DESCRIPTION:${escaparICS(`${ev.sigla} — ${ev.categoria} (${ev.peso}% del ramo)`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escaparICS(`Mañana: ${ev.etiqueta} de ${ev.ramo}`)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lineas.push("END:VCALENDAR");
  return lineas.join("\r\n");
}
