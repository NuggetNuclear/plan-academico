import { ArrowRight, BookOpen, Download, FileUp, Moon, Search, Sun, Undo2, UserRound, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./overlays";
import { aprobadosSet, estadoRamo, ETIQUETA_ESTADO, nombreRamo, siglaRamo } from "../core/academic";
import { normalizarTexto } from "../core/format";
import { useApp, useCtx } from "../store/app";
import { toast, useUI } from "../store/ui";
import { NAV } from "./Shell";
import { cx } from "./primitives";

interface Item {
  id: string;
  grupo: string;
  titulo: string;
  detalle?: string;
  icono: React.ReactNode;
  accion: () => void;
}

/** Buscador universal (Ctrl/⌘ + K): ramos, secciones y acciones. */
export function PaletaComandos() {
  const abierta = useUI((s) => s.paletaAbierta);
  const setPaleta = useUI((s) => s.setPaleta);
  const ctx = useCtx();
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (abierta) {
      setQ("");
      setActivo(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [abierta]);

  const items = useMemo<Item[]>(() => {
    if (!abierta) return [];
    const ui = useUI.getState();
    const cerrarY = (fn: () => void) => () => {
      setPaleta(false);
      fn();
    };
    const apr = aprobadosSet(ctx);
    const secciones: Item[] = NAV.map((n) => ({
      id: "v-" + n.vista,
      grupo: "Ir a",
      titulo: n.titulo,
      detalle: n.descripcion,
      icono: <n.icono className="size-4" />,
      accion: cerrarY(() => ui.irA(n.vista)),
    }));
    const acciones: Item[] = [
      { id: "a-tema", grupo: "Acciones", titulo: "Cambiar tema claro / oscuro", icono: document.documentElement.classList.contains("dark") ? <Sun className="size-4" /> : <Moon className="size-4" />, accion: cerrarY(() => ui.setTema(document.documentElement.classList.contains("dark") ? "claro" : "oscuro")) },
      { id: "a-deshacer", grupo: "Acciones", titulo: "Deshacer el último cambio", icono: <Undo2 className="size-4" />, accion: cerrarY(() => { const e = useApp.getState().deshacer(); toast(e ? `Deshecho: ${e}` : "No hay nada que deshacer", e ? "info" : "error"); }) },
      { id: "a-importar-udp", grupo: "Acciones", titulo: "Importar mi avance desde la UDP (PDF o Excel)", icono: <FileUp className="size-4" />, accion: cerrarY(() => ui.setImportar(true)) },
      { id: "a-respaldo", grupo: "Acciones", titulo: "Exportar o importar mis datos", icono: <Download className="size-4" />, accion: cerrarY(() => ui.setCuenta(true)) },
      { id: "a-cuenta", grupo: "Acciones", titulo: "Mi cuenta y sincronización", icono: <UserRound className="size-4" />, accion: cerrarY(() => ui.setCuenta(true)) },
      { id: "a-wizard", grupo: "Acciones", titulo: "Repetir asistente de inicio", icono: <Wand2 className="size-4" />, accion: cerrarY(() => ui.setWizard(true)) },
    ];
    const ramos: Item[] = ctx.cur.ramos.map((r) => ({
      id: "r-" + r.id,
      grupo: "Ramos",
      titulo: nombreRamo(ctx, r.id),
      detalle: `${siglaRamo(ctx, r.id)} · ${r.semestre ? `Semestre ${r.semestre}` : "Requisito"} · ${r.creditos} cr · ${ETIQUETA_ESTADO[estadoRamo(ctx, r.id, apr)]}`,
      icono: <BookOpen className="size-4" />,
      accion: cerrarY(() => ui.irA("malla", r.id)),
    }));
    return [...secciones, ...acciones, ...ramos];
  }, [abierta, ctx, setPaleta]);

  const filtrados = useMemo(() => {
    const t = normalizarTexto(q.trim());
    if (!t) return items.filter((i) => i.grupo !== "Ramos").concat(items.filter((i) => i.grupo === "Ramos").slice(0, 5));
    const palabras = t.split(/\s+/);
    return items.filter((i) => palabras.every((p) => normalizarTexto(`${i.titulo} ${i.detalle ?? ""}`).includes(p))).slice(0, 30);
  }, [items, q]);

  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-idx="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activo]);

  if (!abierta) return null;
  let grupoPrevio = "";
  return (
    <Modal abierto onCerrar={() => setPaleta(false)} etiqueta="Buscar ramo o acción" ancho="lg">
      <div>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4.5 text-fg-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => (setQ(e.target.value), setActivo(0))}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setActivo((a) => Math.max(0, Math.min(filtrados.length - 1, a + 1))));
              else if (e.key === "ArrowUp") (e.preventDefault(), setActivo((a) => Math.max(0, a - 1)));
              else if (e.key === "Enter") (e.preventDefault(), filtrados[activo]?.accion());
              else if (e.key === "Escape") setPaleta(false);
            }}
            placeholder="Busca un ramo, una sección o una acción…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
            role="combobox"
            aria-label="Buscar ramo, sección o acción"
            aria-autocomplete="list"
            aria-activedescendant={filtrados[activo] ? `paleta-opcion-${activo}` : undefined}
            aria-expanded="true"
            aria-controls="paleta-lista"
          />
          <kbd className="rounded-md border border-line bg-surface-2 px-1.5 font-mono text-[10.5px] text-fg-3">Esc</kbd>
        </div>
        <ul ref={lista} id="paleta-lista" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {filtrados.length === 0 && <li role="presentation" className="px-3 py-8 text-center text-[13.5px] text-fg-3">Sin resultados para «{q}»</li>}
          {filtrados.map((it, i) => {
            const encabezado = it.grupo !== grupoPrevio ? it.grupo : null;
            grupoPrevio = it.grupo;
            return (
              <li key={it.id} role="presentation">
                {encabezado && <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-fg-3 uppercase">{encabezado}</p>}
                <button
                  type="button"
                  data-idx={i}
                  id={`paleta-opcion-${i}`}
                  role="option"
                  aria-selected={i === activo}
                  tabIndex={-1}
                  onClick={it.accion}
                  onMouseMove={() => setActivo(i)}
                  className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === activo ? "bg-accent-soft text-accent" : "text-fg")}
                >
                  <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", i === activo ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2")}>{it.icono}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{it.titulo}</span>
                    {it.detalle && <span className="block truncate text-[12px] text-fg-3">{it.detalle}</span>}
                  </span>
                  {i === activo && <ArrowRight className="size-4 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
