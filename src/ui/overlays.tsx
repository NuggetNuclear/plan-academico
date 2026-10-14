import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useUI } from "../store/ui";
import { Boton, BotonIcono, cx } from "./primitives";

/** Diálogo modal accesible: foco atrapado, Escape para cerrar y fondo difuminado. */
export function Modal({
  abierto,
  onCerrar,
  children,
  ancho = "md",
  etiqueta,
  cerrable = true,
}: {
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: "sm" | "md" | "lg" | "xl";
  etiqueta: string;
  cerrable?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // El callback cambia al editar campos; no debe reiniciar el foco del diálogo.
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  useLayoutEffect(() => {
    if (!abierto || !ref.current) return;
    const dialogo = ref.current;
    const previo = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialogo.showModal();
    document.body.style.overflow = "hidden";
    const inicial = dialogo.querySelector<HTMLElement>("[data-autofocus]") ?? dialogo.querySelector<HTMLElement>("input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled), button:not(:disabled):not([data-cerrar])");
    inicial?.focus();
    return () => {
      dialogo.close();
      document.body.style.overflow = overflow;
      if (previo?.isConnected) previo.focus();
    };
  }, [abierto]);

  if (!abierto) return null;
  const anchos = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl", xl: "max-w-3xl" };
  return createPortal(
    <dialog
      ref={ref}
      aria-label={etiqueta}
      aria-modal="true"
      onCancel={(e) => { e.preventDefault(); if (cerrable) cerrarRef.current(); }}
      onClick={(e) => { if (e.target === e.currentTarget && cerrable) cerrarRef.current(); }}
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none items-end justify-center border-0 bg-transparent p-0 text-fg backdrop:bg-black/50 backdrop:backdrop-blur-[3px] sm:items-center sm:p-4"
    >
      <div className={cx("animar-entrada max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-pop sm:rounded-3xl", anchos[ancho])}>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

export function CabeceraModal({ icono, sobretitulo, titulo, children, onCerrar }: { icono?: ReactNode; sobretitulo?: string; titulo: ReactNode; children?: ReactNode; onCerrar?: () => void }) {
  return (
    <div className="flex items-start gap-3.5 px-6 pt-6">
      {icono && <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">{icono}</span>}
      <div className="min-w-0 flex-1">
        {sobretitulo && <p className="text-[11px] font-bold tracking-wider text-accent uppercase">{sobretitulo}</p>}
        <h2 className="text-lg leading-snug font-bold tracking-tight">{titulo}</h2>
        {children && <div className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{children}</div>}
      </div>
      {onCerrar && (
        <BotonIcono etiqueta="Cerrar" data-cerrar onClick={onCerrar} className="-mt-1 -mr-2">
          <X className="size-4.5" />
        </BotonIcono>
      )}
    </div>
  );
}

export function PieModal({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 px-6 pt-2 pb-6">{children}</div>;
}

/** Diálogos de confirmación y de texto lanzados con confirmar() / pedirTexto(). */
export function HostDialogos() {
  const dialogo = useUI((s) => s.dialogo);
  const abrir = useUI((s) => s._abrirDialogo);
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValor(dialogo?.opciones.campo?.valor ?? "");
    setError(null);
  }, [dialogo]);

  if (!dialogo) return null;
  const { opciones, resolver } = dialogo;
  const cerrar = (v: string | null) => {
    abrir(null);
    resolver(v);
  };
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (opciones.campo) {
      const err = opciones.campo.validar?.(valor) ?? null;
      if (err) {
        setError(err);
        return;
      }
      cerrar(valor);
    } else cerrar("ok");
  };

  return (
    <Modal abierto onCerrar={() => cerrar(null)} etiqueta={opciones.titulo} ancho="sm">
      <form onSubmit={enviar}>
        <CabeceraModal
          icono={opciones.peligro ? <AlertTriangle className="size-5 text-danger" /> : <Info className="size-5" />}
          sobretitulo={opciones.etiqueta}
          titulo={opciones.titulo}
        >
          {opciones.mensaje && <p className="whitespace-pre-line">{opciones.mensaje}</p>}
        </CabeceraModal>
        {opciones.campo && (
          <div className="px-6 pt-4">
            <label className="label" htmlFor="dialogo-campo">
              {opciones.campo.etiqueta}
            </label>
            <input
              id="dialogo-campo"
              aria-invalid={!!error}
              aria-describedby={error ? "dialogo-error" : undefined}
              data-autofocus
              className={cx("input", error && "border-danger")}
              value={valor}
              placeholder={opciones.campo.placeholder}
              inputMode={opciones.campo.inputMode}
              autoComplete="off"
              onChange={(e) => {
                setValor(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id="dialogo-error" role="alert" className="mt-1.5 text-[12px] font-medium text-danger">
                {error}
              </p>
            )}
          </div>
        )}
        <PieModal>
          <Boton variante="fantasma" onClick={() => cerrar(null)}>
            {opciones.cancelar ?? "Cancelar"}
          </Boton>
          <Boton type="submit" variante={opciones.peligro ? "peligro" : "primario"} data-autofocus={opciones.campo ? undefined : true}>
            {opciones.aceptar ?? "Aceptar"}
          </Boton>
        </PieModal>
      </form>
    </Modal>
  );
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const cerrar = useUI((s) => s.cerrarToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 lg:right-6 lg:left-auto lg:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animar-entrada pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-[13.5px] shadow-pop"
        >
          {t.tipo === "error" ? (
            <XCircle className="mt-0.5 size-4.5 shrink-0 text-danger" />
          ) : t.tipo === "info" ? (
            <Info className="mt-0.5 size-4.5 shrink-0 text-info" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-ok" />
          )}
          <span className="min-w-0 flex-1 leading-snug">{t.mensaje}</span>
          {t.accion && (
            <button
              type="button"
              className="shrink-0 font-bold text-accent hover:underline"
              onClick={() => {
                t.accion!.fn();
                cerrar(t.id);
              }}
            >
              {t.accion.etiqueta}
            </button>
          )}
          <button type="button" aria-label="Cerrar aviso" className="shrink-0 text-fg-3 hover:text-fg" onClick={() => cerrar(t.id)}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Popover anclado a un elemento; se cierra al hacer clic fuera o con Escape. */
export function Popover({
  ancla,
  abierto,
  onCerrar,
  children,
  ancho = 240,
  className,
}: {
  ancla: RefObject<HTMLElement | null>;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!abierto || !ancla.current) return;
    const ubicar = () => {
      const r = ancla.current!.getBoundingClientRect();
      const alto = ref.current?.offsetHeight ?? 200;
      const margen = 8;
      const left = Math.max(margen, Math.min(r.left, window.innerWidth - ancho - margen));
      const abajo = r.bottom + 6 + alto <= window.innerHeight - margen;
      setPos({ top: abajo ? r.bottom + 6 : Math.max(margen, r.top - alto - 6), left });
    };
    ubicar();
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    return () => {
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", ubicar, true);
    };
  }, [abierto, ancla, ancho]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ancla.current?.contains(t)) return;
      cerrarRef.current();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.contains(document.activeElement)) {
        e.stopPropagation();
        e.preventDefault();
        cerrarRef.current();
        ancla.current?.focus();
      }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla, true);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("button, input, select")?.focus(), 20);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla, true);
    };
  }, [abierto, ancla]);

  if (!abierto) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Opciones"
      onBlur={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget) && !ancla.current?.contains(e.relatedTarget)) cerrarRef.current(); }}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: ancho, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100dvh - 16px)", overflowY: "auto" }}
      className={cx("animar-entrada fixed z-[55] rounded-2xl border border-line bg-surface p-1.5 shadow-pop", className)}
    >
      {children}
    </div>,
    document.body,
  );
}

export function OpcionMenu({ icono, children, onClick, activo, peligro, descripcion }: { icono?: ReactNode; children: ReactNode; onClick: () => void; activo?: boolean; peligro?: boolean; descripcion?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors",
        activo ? "bg-accent-soft text-accent" : peligro ? "text-danger hover:bg-danger-soft" : "text-fg hover:bg-surface-2",
      )}
    >
      {icono && <span className="mt-0.5 shrink-0 [&>svg]:size-4">{icono}</span>}
      <span className="min-w-0">
        {children}
        {descripcion && <span className="block text-[11.5px] font-medium text-fg-3">{descripcion}</span>}
      </span>
    </button>
  );
}
