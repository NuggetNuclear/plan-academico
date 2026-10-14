import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import { leerNumero, numeroConComa } from "../core/format";
import { toast } from "../store/ui";
import { cx } from "./primitives";

/**
 * Campo numérico con coma decimal. Guarda al salir del campo o con Enter, así cada
 * cambio queda como un solo paso en el historial de deshacer.
 */
export function CampoNumero({
  valor,
  onGuardar,
  min,
  max,
  decimales = 2,
  minDecimales = 0,
  className,
  vacioPermitido = true,
  ...rest
}: {
  valor: number | null | undefined;
  onGuardar: (v: number | null) => void;
  min?: number;
  max?: number;
  decimales?: number;
  /** Muestra al menos estos decimales (las notas se ven como "6,0"). */
  minDecimales?: number;
  vacioPermitido?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  const mostrar = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : minDecimales > 0 && Number.isInteger(v * 10 ** minDecimales) ? v.toFixed(minDecimales).replace(".", ",") : numeroConComa(v);
  const [texto, setTexto] = useState(mostrar(valor));
  const [error, setError] = useState("");
  const errorId = useId();
  const cancelando = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setTexto(mostrar(valor)); setError(""); }, [valor]);

  const guardar = () => {
    if (cancelando.current) { cancelando.current = false; return; }
    const n = leerNumero(texto);
    if (texto.trim() === "" && vacioPermitido) {
      setError("");
      if (valor !== null && valor !== undefined) onGuardar(null);
      return;
    }
    if (!Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
      const mensaje = min !== undefined && max !== undefined ? `Escribe un número entre ${numeroConComa(min)} y ${numeroConComa(max)}.` : min !== undefined ? `Escribe un número mayor o igual a ${numeroConComa(min)}.` : "Escribe un número válido.";
      setError(mensaje);
      toast(`${rest["aria-label"] ?? "Valor no guardado"}: ${mensaje}`, "error");
      return;
    }
    setError("");
    let v = n;
    const f = 10 ** decimales;
    v = Math.round(v * f) / f;
    setTexto(mostrar(v));
    if (v !== valor) onGuardar(v);
  };

  return (
    <>
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      onChange={(e) => { setTexto(e.target.value); setError(""); }}
      aria-invalid={!!error || undefined}
      aria-describedby={[rest["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") || undefined}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          cancelando.current = true;
          setError("");
          setTexto(mostrar(valor));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cx("tabular", className)}
      {...rest}
    />
    {error && <span id={errorId} className="sr-only">{error}</span>}
    </>
  );
}

/** Campo de texto que guarda al salir (para nombres de categorías, siglas, etc.). */
export function CampoTexto({ valor, onGuardar, className, ...rest }: { valor: string; onGuardar: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [texto, setTexto] = useState(valor);
  const cancelando = useRef(false);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <input
      type="text"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { if (cancelando.current) { cancelando.current = false; return; } if (texto !== valor) onGuardar(texto.trim()); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") {
          cancelando.current = true;
          setTexto(valor);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
      {...rest}
    />
  );
}
