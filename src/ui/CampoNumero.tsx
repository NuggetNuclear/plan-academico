import { useEffect, useState, type InputHTMLAttributes } from "react";
import { leerNumero, numeroConComa } from "../core/format";
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setTexto(mostrar(valor)), [valor]);

  const guardar = () => {
    const n = leerNumero(texto);
    if (Number.isNaN(n)) {
      if (texto.trim() === "" && vacioPermitido) {
        if (valor !== null && valor !== undefined) onGuardar(null);
      } else setTexto(mostrar(valor));
      return;
    }
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    const f = 10 ** decimales;
    v = Math.round(v * f) / f;
    setTexto(mostrar(v));
    if (v !== valor) onGuardar(v);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      onChange={(e) => {
        let v = e.target.value.replace(".", ",").replace(/[^\d,]/g, "");
        const i = v.indexOf(",");
        if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, "");
        setTexto(v);
      }}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setTexto(mostrar(valor));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cx("tabular", className)}
      {...rest}
    />
  );
}

/** Campo de texto que guarda al salir (para nombres de categorías, siglas, etc.). */
export function CampoTexto({ valor, onGuardar, className, ...rest }: { valor: string; onGuardar: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <input
      type="text"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => texto !== valor && onGuardar(texto.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setTexto(valor);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
      {...rest}
    />
  );
}
