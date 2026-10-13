import { toast } from "../store/ui";

export const escaparHTML = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ESTILO = `
  * { box-sizing: border-box; }
  body { font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif; color: #0e1121; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { font-size: 12px; color: #5b6380; margin-bottom: 18px; }
  h2 { font-size: 14px; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  th, td { border: 1px solid #dde1ec; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #f1f2fb; font-weight: 700; }
  .num { text-align: center; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .mal { color: #c02f2f; }
  .total td { background: #f1f2fb; font-weight: 700; }
  .mono { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #5b6380; }
  footer { margin-top: 24px; font-size: 10.5px; color: #8a90a8; }
  @media print { body { margin: 12mm; } }
`;

/** Abre una ventana lista para imprimir o guardar como PDF. */
export function abrirImpresion(titulo: string, subtitulo: string, cuerpo: string) {
  const fecha = new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const w = window.open("", "_blank");
  if (!w) {
    toast("El navegador bloqueó la ventana. Permite ventanas emergentes para exportar.", "error");
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escaparHTML(titulo)}</title><style>${ESTILO}</style></head>
<body><h1>${escaparHTML(titulo)}</h1><div class="sub">${escaparHTML(subtitulo)} · ${fecha}</div>${cuerpo}
<footer>Generado con Notas · Planner académico. Documento de orientación, no es un certificado oficial.</footer>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 150); };<\/script></body></html>`);
  w.document.close();
}
