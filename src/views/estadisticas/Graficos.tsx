import { useLayoutEffect, useRef, useState } from "react";
import type { PuntoPPA } from "../../core/academic";
import { fmtNota } from "../../core/format";

/** Ancho real del contenedor, para que el texto del gráfico mantenga su tamaño. */
function useAncho<T extends HTMLElement>(inicial: number) {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(inicial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

const SERIE_SEM = "var(--s1)";
const SERIE_ACUM = "var(--s2)";

/** Evolución del PPA: dos series en un solo eje (1,0–7,0) con línea de referencia en 4,0. */
export function GraficoPPA({ datos, posicion }: { datos: PuntoPPA[]; posicion: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [caja, W] = useAncho<HTMLDivElement>(680);
  const [hover, setHover] = useState<number | null>(null);
  const hayVentana = datos.some((d) => d.ventana);
  const H = hayVentana ? 262 : 246;
  const pad = { l: 34, r: 56, t: 16, b: hayVentana ? 44 : 30 };
  const minV = Math.max(1, Math.floor(Math.min(...datos.map((d) => Math.min(d.ppa, d.acumulado)), 4) - 0.5));
  const maxV = 7;
  const n = datos.length;
  const x = (i: number) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + ((maxV - v) * (H - pad.t - pad.b)) / (maxV - minV);
  const path = (k: "ppa" | "acumulado") => datos.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: maxV - minV + 1 }, (_, i) => minV + i);

  const onMove = (e: React.PointerEvent) => {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let mejor = 0;
    datos.forEach((_, i) => Math.abs(x(i) - px) < Math.abs(x(mejor) - px) && (mejor = i));
    setHover(mejor);
  };
  const d = hover !== null ? datos[hover] : null;

  return (
    <div ref={caja} className="relative">
      <svg
        ref={ref}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto max-w-full touch-none overflow-visible select-none"
        role="img"
        aria-label="Evolución del PPA por semestre"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(v) + 3.5} fontSize="10" fill="var(--fg-3)" textAnchor="end" className="tabular">
              {v},0
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(4)} y2={y(4)} stroke="var(--fg-3)" strokeWidth="1.5" />
        <text x={W - pad.r + 6} y={y(4) + 3.5} fontSize="10" fill="var(--fg-3)" fontWeight="600">
          Mín. 4,0
        </text>
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeWidth="1" />}
        {n > 1 && (
          <>
            <path d={path("acumulado")} fill="none" stroke={SERIE_ACUM} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <path d={path("ppa")} fill="none" stroke={SERIE_SEM} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {datos.map((p, i) => (
          <g key={p.numero}>
            <circle cx={x(i)} cy={y(p.acumulado)} r={hover === i ? 5 : 4} fill={SERIE_ACUM} stroke="var(--surface)" strokeWidth="2" />
            <circle cx={x(i)} cy={y(p.ppa)} r={hover === i ? 5.5 : 4.5} fill={SERIE_SEM} stroke="var(--surface)" strokeWidth="2" />
            <text x={x(i)} y={H - pad.b + 16} fontSize="10.5" fill="var(--fg-2)" textAnchor="middle" fontWeight="600">
              {p.etiqueta}
            </text>
            {p.ventana && (
              <text x={x(i)} y={H - pad.b + 30} fontSize="9.5" fill="var(--fg-3)" textAnchor="middle">
                {posicion.charAt(0)} {p.ventana}
              </text>
            )}
          </g>
        ))}
        {/* Etiqueta directa solo en el último punto de cada serie */}
        {n > 0 && (
          <>
            <text x={x(n - 1) + 9} y={y(datos[n - 1].ppa) + (datos[n - 1].ppa >= datos[n - 1].acumulado ? -4 : 12)} fontSize="11" fontWeight="700" fill="var(--fg)">
              {fmtNota(datos[n - 1].ppa, 2)}
            </text>
            <text x={x(n - 1) + 9} y={y(datos[n - 1].acumulado) + (datos[n - 1].ppa >= datos[n - 1].acumulado ? 12 : -4)} fontSize="11" fontWeight="700" fill="var(--fg-2)">
              {fmtNota(datos[n - 1].acumulado, 2)}
            </text>
          </>
        )}
      </svg>
      {d && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-xl border border-line bg-surface px-3 py-2 text-[12px] shadow-pop"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 75px), calc(100% - 150px))` }}
        >
          <p className="mb-1 font-bold">{d.etiqueta === "Conv." ? "Convalidaciones" : `Semestre ${d.numero}`}</p>
          <p className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded" style={{ background: SERIE_SEM }} />
            <strong className="tabular">{fmtNota(d.ppa, 2)}</strong>
            <span className="text-fg-3">del semestre</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded" style={{ background: SERIE_ACUM }} />
            <strong className="tabular">{fmtNota(d.acumulado, 3)}</strong>
            <span className="text-fg-3">acumulado</span>
          </p>
          <p className="mt-1 text-fg-3">
            {d.creditos} créditos{d.ventana ? ` · ${posicion} ${d.ventana}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

export function LeyendaPPA() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[12px] font-semibold text-fg-2">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded" style={{ background: SERIE_SEM }} />
        PPA del semestre
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded" style={{ background: SERIE_ACUM }} />
        PPA acumulado
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-fg-3" />
        Mínimo 4,0
      </span>
    </div>
  );
}

/** Histograma de notas en rangos de un punto. */
export function Histograma({ notas }: { notas: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const rangos = [
    { min: 1, max: 2, et: "1–2" },
    { min: 2, max: 3, et: "2–3" },
    { min: 3, max: 3.95, et: "3–3,9" },
    { min: 3.95, max: 5, et: "4–4,9" },
    { min: 5, max: 6, et: "5–5,9" },
    { min: 6, max: 7.01, et: "6–7" },
  ];
  const conteos = rangos.map((r) => notas.filter((n) => n >= r.min && n < r.max).length);
  const max = Math.max(1, ...conteos);
  const [caja, W] = useAncho<HTMLDivElement>(420);
  const H = 200;
  const pad = { l: 8, r: 8, t: 22, b: 26 };
  const banda = (W - pad.l - pad.r) / rangos.length;
  const ancho = Math.min(28, banda * 0.6);
  const yBase = H - pad.b;
  return (
    <div ref={caja}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block h-auto max-w-full overflow-visible" role="img" aria-label="Distribución de notas por rango">
      <line x1={pad.l} x2={W - pad.r} y1={yBase} y2={yBase} stroke="var(--line-strong)" strokeWidth="1" />
      {/* Separación entre reprobadas y aprobadas */}
      <line x1={pad.l + banda * 3} x2={pad.l + banda * 3} y1={pad.t - 6} y2={yBase} stroke="var(--fg-3)" strokeWidth="1" strokeDasharray="0" opacity="0.6" />
      <text x={pad.l + banda * 3 + 4} y={pad.t - 2} fontSize="9.5" fill="var(--fg-3)" fontWeight="600">
        4,0
      </text>
      {rangos.map((r, i) => {
        const alto = (conteos[i] / max) * (yBase - pad.t);
        const cx = pad.l + banda * i + banda / 2;
        const xr = cx - ancho / 2;
        const yr = yBase - alto;
        const rad = Math.min(4, alto);
        return (
          <g
            key={r.et}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            tabIndex={0}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${r.et}: ${conteos[i]} notas`}
          >
            <rect x={pad.l + banda * i} y={pad.t - 10} width={banda} height={yBase - pad.t + 10} fill="transparent" />
            {alto > 0 && (
              <path
                d={`M${xr},${yBase} V${yr + rad} Q${xr},${yr} ${xr + rad},${yr} H${xr + ancho - rad} Q${xr + ancho},${yr} ${xr + ancho},${yr + rad} V${yBase} Z`}
                fill={i < 3 ? "var(--s8)" : "var(--s1)"}
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
            )}
            {conteos[i] > 0 && (
              <text x={cx} y={yr - 5} fontSize="11" fontWeight="700" fill="var(--fg)" textAnchor="middle" className="tabular">
                {conteos[i]}
              </text>
            )}
            <text x={cx} y={H - 8} fontSize="10" fill="var(--fg-2)" textAnchor="middle">
              {r.et}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}
