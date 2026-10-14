import type { Curriculum } from "../core/curriculum";
import { NOTA_APROB, fmtNota } from "../core/format";
import { cx } from "./primitives";

/** Color de identidad de cada tipo de ramo: orden fijo de la paleta categórica. */
export function colorTipo(cur: Curriculum, tipo: string): string {
  const orden = Object.keys(cur.tipos);
  const i = orden.indexOf(tipo);
  return i >= 0 && i < 8 ? `var(--s${i + 1})` : "var(--fg-3)";
}

/** Las áreas usan la misma paleta que los tipos; desde la novena (Electivos) quedan en gris. */
export function colorArea(cur: Curriculum, area: string): string {
  const i = Object.keys(cur.areas).indexOf(area);
  return i >= 0 && i < 8 ? `var(--s${i + 1})` : "var(--fg-3)";
}

export function etiquetaTipo(cur: Curriculum, tipo: string): string {
  return cur.tipos[tipo] ?? tipo;
}

export function NotaChip({ nota, className, titulo = "Nota final" }: { nota: number | null; className?: string; titulo?: string }) {
  if (nota === null) return <span className={cx("font-mono text-[12px] text-fg-3", className)}>—</span>;
  const ok = nota >= NOTA_APROB;
  return (
    <span
      title={`${titulo}: ${fmtNota(nota)}${ok ? " (aprobada)" : " (reprobada)"}`}
      className={cx(
        "inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[12px] font-semibold tabular",
        ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger",
        className,
      )}
    >
      {fmtNota(nota)}
    </span>
  );
}

export function Anillo({ porcentaje, tamano = 120, grosor = 10, children }: { porcentaje: number; tamano?: number; grosor?: number; children?: React.ReactNode }) {
  const r = (tamano - grosor) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, porcentaje));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90" aria-hidden="true">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={grosor} />
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke="url(#grad-anillo)"
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
        <defs>
          <linearGradient id="grad-anillo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="#b44bf0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Mini gráfico de línea (tendencia) en el tono de énfasis. */
export function Sparkline({ valores, ancho = 140, alto = 48 }: { valores: number[]; ancho?: number; alto?: number }) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores, 4) - 0.2;
  const max = Math.max(...valores) + 0.2;
  const x = (i: number) => 4 + (i * (ancho - 8)) / (valores.length - 1);
  const y = (v: number) => alto - 4 - ((v - min) / (max - min || 1)) * (alto - 8);
  const puntos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `M${x(0)},${alto} L${puntos.replace(/ /g, " L")} L${x(valores.length - 1)},${alto} Z`;
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true" className="overflow-visible">
      <path d={area} fill="var(--accent)" opacity="0.1" />
      <polyline points={puntos} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(valores.length - 1)} cy={y(valores.at(-1)!)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">{children}</kbd>;
}
