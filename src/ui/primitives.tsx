import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variante = "primario" | "secundario" | "fantasma" | "peligro" | "suave";
type Tamano = "sm" | "md";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-accent text-accent-fg hover:bg-accent-hover shadow-soft",
  secundario: "bg-surface text-fg border border-line-strong hover:bg-surface-2",
  fantasma: "text-fg-2 hover:bg-surface-2 hover:text-fg",
  peligro: "bg-surface text-danger border border-line-strong hover:bg-danger-soft hover:border-danger/40",
  suave: "bg-accent-soft text-accent hover:bg-accent-soft/70",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "min-h-9 px-3 py-1.5 text-[13px] gap-1.5 rounded-lg",
  md: "min-h-11 px-4 py-2 text-sm gap-2 rounded-xl",
};

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  icono?: ReactNode;
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = "secundario", tamano = "md", icono, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex max-w-full shrink-0 items-center justify-center font-semibold whitespace-normal transition-colors sm:whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none [&>svg]:shrink-0",
        VARIANTES[variante],
        TAMANOS[tamano],
        className,
      )}
      {...rest}
    >
      {icono}
      {children}
    </button>
  );
});

export const BotonIcono = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { etiqueta: string; tamano?: "sm" | "md" }>(
  function BotonIcono({ etiqueta, className, children, tamano = "md", type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={etiqueta}
        title={etiqueta}
        className={cx(
          "inline-flex shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40",
          tamano === "sm" ? "size-8" : "size-11",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export function Tarjeta({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx("card min-w-0 p-5 sm:p-6", className)} {...rest}>
      {children}
    </section>
  );
}

export function CabeceraTarjeta({ titulo, descripcion, acciones, icono }: { titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode; icono?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icono && <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icono}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight text-fg">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-[13px] leading-relaxed text-fg-2">{descripcion}</p>}
        </div>
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}

type Tono = "neutro" | "acento" | "ok" | "info" | "warn" | "danger";
const TONOS: Record<Tono, string> = {
  neutro: "bg-surface-2 text-fg-2 border-line",
  acento: "bg-accent-soft text-accent border-accent-line",
  ok: "bg-ok-soft text-ok border-ok/25",
  info: "bg-info-soft text-info border-info/25",
  warn: "bg-warn-soft text-warn border-warn/25",
  danger: "bg-danger-soft text-danger border-danger/25",
};

export function Insignia({ tono = "neutro", children, className, icono, title }: { tono?: Tono; children: ReactNode; className?: string; icono?: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", TONOS[tono], className)}>
      {icono}
      {children}
    </span>
  );
}

export function Interruptor({ checked, onChange, etiqueta, descripcion, id }: { checked: boolean; onChange: (v: boolean) => void; etiqueta: ReactNode; descripcion?: string; id?: string }) {
  const etiquetaId = useId();
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 select-none" title={descripcion}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-labelledby={etiquetaId}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-5.5 w-9.5 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span className={cx("absolute top-0.5 left-0.5 size-4.5 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
      </button>
      <span id={etiquetaId} className="text-[13px] font-semibold text-fg-2">{etiqueta}</span>
    </label>
  );
}

export function Segmentado<T extends string>({ opciones, valor, onChange, etiqueta, tamano = "sm" }: { opciones: { valor: T; etiqueta: ReactNode; title?: string }[]; valor: T; onChange: (v: T) => void; etiqueta: string; tamano?: "sm" | "xs" }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          title={o.title}
          aria-pressed={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cx(
            "rounded-[10px] font-semibold whitespace-nowrap transition-colors",
            tamano === "sm" ? "px-3 py-1.5 text-[13px]" : "px-2 py-1 text-[11px]",
            valor === o.valor ? "bg-surface text-fg shadow-soft" : "text-fg-2 hover:text-fg",
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

export function Vacio({ icono, titulo, children, accion }: { icono: ReactNode; titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">{icono}</span>
      <p className="font-bold text-fg">{titulo}</p>
      {children && <p className="max-w-md text-[13px] text-fg-2">{children}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

export function Aviso({ tono = "info", icono, children, className }: { tono?: "info" | "warn" | "ok" | "danger" | "acento"; icono?: ReactNode; children: ReactNode; className?: string }) {
  const t = {
    info: "bg-info-soft text-fg border-info/20 [&>svg]:text-info",
    warn: "bg-warn-soft text-fg border-warn/25 [&>svg]:text-warn",
    ok: "bg-ok-soft text-fg border-ok/20 [&>svg]:text-ok",
    danger: "bg-danger-soft text-fg border-danger/20 [&>svg]:text-danger",
    acento: "bg-accent-soft text-fg border-accent-line [&>svg]:text-accent",
  }[tono];
  return (
    <div className={cx("flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", t, className)}>
      {icono}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Campo({ etiqueta, children, ayuda, htmlFor }: { etiqueta: ReactNode; children: ReactNode; ayuda?: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-[11.5px] text-fg-3">{ayuda}</p>}
    </div>
  );
}
