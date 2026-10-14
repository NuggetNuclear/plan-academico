import { AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet, FileText, FileUp, Info, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import type { Curriculum } from "../core/curriculum";
import { fmtNota, plural } from "../core/format";
import type { PlannerState } from "../core/state";
import { parsearAvance, type AvanceCurricular } from "../importar/avance";
import { lineasDePDF } from "../importar/pdf";
import { aplicarPlan, construirPlanAvance, construirPlanTrabajo, previsualizar, type PlanImportacion } from "../importar/plan";
import { COLUMNAS_TRABAJO, leerTrabajoAcademico, type TablaTrabajo } from "../importar/trabajo";
import { ErrorImportacion, esPlanInformatica } from "../importar/udp";
import { useApp } from "../store/app";
import { toast, useUI } from "../store/ui";
import { CabeceraModal, Modal } from "../ui/overlays";
import { Aviso, Boton, Insignia, Segmentado, cx } from "../ui/primitives";

type Modo = "rapido" | "avanzado";

interface Revision {
  cur: Curriculum;
  base: PlannerState;
  plan: PlanImportacion;
  conPDF: boolean;
  conExcel: boolean;
}

const MAX_BYTES = 8 * 1024 * 1024;
const esPDF = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
const esZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

async function leerArchivos(archivos: File[]) {
  let avance: AvanceCurricular | null = null;
  let trabajo: TablaTrabajo | null = null;
  for (const f of archivos) {
    if (f.size > MAX_BYTES) throw new ErrorImportacion(`«${f.name}» pesa demasiado para ser un reporte de la UDP.`);
    const buffer = await f.arrayBuffer();
    const cabecera = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
    if (esPDF(cabecera)) {
      if (avance) throw new ErrorImportacion("Subiste dos PDF. Necesito solo uno: el Avance curricular.");
      avance = parsearAvance(await lineasDePDF(buffer));
    } else if (esZip(cabecera)) {
      if (trabajo) throw new ErrorImportacion("Subiste dos Excel. Necesito solo uno: el Trabajo académico.");
      trabajo = await leerTrabajoAcademico(buffer);
    } else {
      throw new ErrorImportacion(`«${f.name}» no es un PDF ni un Excel (.xlsx). Si lo tienes en .xls, ábrelo y guárdalo como .xlsx.`);
    }
  }
  return { avance, trabajo };
}

async function prepararRevision(archivos: File[]): Promise<Revision> {
  const { avance, trabajo } = await leerArchivos(archivos);
  if (!avance && !trabajo) throw new ErrorImportacion("Elige tu Avance curricular (PDF) o tu Trabajo académico (Excel).");
  if (avance?.plan && !esPlanInformatica(avance.plan))
    throw new ErrorImportacion(`Tu plan («${avance.plan}») no es Ing. Civil en Informática y Telecomunicaciones: la app solo funciona con esa carrera.`);
  const { st: base, cur } = useApp.getState();
  if (!cur) throw new ErrorImportacion("La malla aún no termina de cargar. Vuelve a intentarlo en unos segundos.");
  const plan = trabajo ? construirPlanTrabajo(cur, trabajo.registros, avance) : construirPlanAvance(cur, avance!);
  plan.advertencias.unshift(...(trabajo?.advertencias ?? []));
  return { cur, base, plan, conPDF: !!avance, conExcel: !!trabajo };
}

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: ReactNode; detalle?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/50 p-3">
      <p className="text-[11px] font-semibold text-fg-3">{etiqueta}</p>
      <p className="text-xl leading-tight font-bold tracking-tight">{valor}</p>
      {detalle && <p className="text-[11.5px] text-fg-3">{detalle}</p>}
    </div>
  );
}

function Lista({ items, icono }: { items: ReactNode[]; icono: ReactNode }) {
  return (
    <ul className="space-y-1.5">
      {items.map((x, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] text-fg-2 [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0">
          {icono}
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

function Tutorial() {
  return (
    <details className="group rounded-2xl border border-line">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-[13.5px] font-bold select-none">
        <ChevronRight className="size-4 text-fg-3 transition-transform group-open:rotate-90" />
        ¿Cómo saco el Excel?
        <Insignia tono="info" className="ml-auto">
          Tutorial con capturas: próximamente
        </Insignia>
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-fg-2">
          <li>
            En tu portal de la UDP abre el reporte <strong className="text-fg">Trabajo académico del estudiante</strong>.
          </li>
          <li>
            Déjalo con <strong className="text-fg">todo tu historial</strong> (sin filtrar por año ni semestre, incluyendo semestres especiales).
          </li>
          <li>
            Expórtalo a <strong className="text-fg">Excel (.xlsx)</strong> y súbelo aquí. Si queda en .xls, ábrelo y guárdalo como .xlsx.
          </li>
        </ol>
        <div>
          <p className="mb-2 text-[12.5px] font-bold">Columnas que lee la app</p>
          <p className="mb-2 text-[12px] text-fg-3">El reporte original ya las trae todas: no tienes que agregar nada. Si lo editas, no borres las obligatorias.</p>
          <ul className="divide-y divide-line rounded-xl border border-line text-[12.5px]">
            {COLUMNAS_TRABAJO.map((c) => (
              <li key={c.rol} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2">
                <code className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[12px] font-semibold">{c.nombre}</code>
                <span className="min-w-0 flex-1 basis-48 text-fg-2">{c.para}</span>
                <Insignia tono={c.obligatoria ? "acento" : "neutro"}>{c.obligatoria ? "Obligatoria" : "Opcional"}</Insignia>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

export function ImportarUDP() {
  const abierto = useUI((s) => s.importarAbierto);
  const setImportar = useUI((s) => s.setImportar);
  const [modo, setModo] = useState<Modo>("rapido");
  const [leyendo, setLeyendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState<Revision | null>(null);
  const [semestre, setSemestre] = useState(1);

  useEffect(() => {
    if (!abierto) return;
    setRev(null);
    setError(null);
    setLeyendo(false);
  }, [abierto]);

  const procesar = async (archivos: File[]) => {
    if (!archivos.length) return;
    setError(null);
    setLeyendo(true);
    try {
      const r = await prepararRevision(archivos);
      setSemestre(r.plan.semestreActual);
      setRev(r);
    } catch (e) {
      setError(e instanceof ErrorImportacion ? e.message : "No pude leer los archivos. Revisa que sean los reportes originales de la UDP.");
      if (!(e instanceof ErrorImportacion)) console.error(e);
    } finally {
      setLeyendo(false);
    }
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    void procesar(Array.from(e.dataTransfer.files));
  };

  const plan = useMemo(() => (rev ? { ...rev.plan, semestreActual: semestre } : null), [rev, semestre]);
  const resumen = useMemo(() => (rev && plan ? previsualizar(rev.cur, rev.base, plan) : null), [rev, plan]);

  const importar = () => {
    if (!rev || !plan) return;
    useApp.getState().mutar("Importar avance de la UDP", (ctx) => aplicarPlan(ctx, plan));
    setImportar(false);
    useUI.getState().irA("malla");
    toast(
      rev.conExcel ? "¡Listo! Importé tu historial completo: notas, repeticiones y PPA." : "¡Listo! Marqué tus ramos aprobados e inscritos.",
      "ok",
      { etiqueta: "Deshacer", fn: () => useApp.getState().deshacer() },
    );
  };

  const completo = rev?.plan.fuente === "trabajo";

  return (
    <Modal abierto={abierto} onCerrar={() => setImportar(false)} etiqueta="Importar desde la UDP" ancho="lg">
      <CabeceraModal icono={<FileUp className="size-5" />} sobretitulo="Importar desde la UDP" titulo={rev ? "Revisa antes de importar" : "Rellena tu planner con tus reportes"} onCerrar={() => setImportar(false)}>
        {rev ? "Ing. Civil en Informática y Telecomunicaciones." : "Sube el reporte que descargas de la UDP y se completa tu malla sola."}
      </CabeceraModal>

      {!rev && (
        <div className="space-y-4 px-6 pt-4 pb-6">
          <Segmentado<Modo>
            etiqueta="Tipo de importación"
            tamano="sm"
            valor={modo}
            onChange={setModo}
            opciones={[
              { valor: "rapido", etiqueta: "Rápido · PDF" },
              { valor: "avanzado", etiqueta: "Avanzado · Excel" },
            ]}
          />

          {modo === "rapido" ? (
            <div className="space-y-3">
              <p className="text-[13.5px] text-fg-2">
                Sube tu <strong className="text-fg">Avance curricular</strong> (PDF). Es lo más rápido: en segundos tienes tu malla marcada.
              </p>
              <Lista icono={<CheckCircle2 className="text-ok" />} items={["Ramos aprobados e inscritos (los que cursas ahora)", "Nombre real de tus cursos de Formación General", "Semestre actual, según la fecha del reporte"]} />
              <Aviso tono="info" icono={<Info />}>
                El PDF <strong>no trae notas ni en qué semestre aprobaste cada ramo</strong>, así que tu PPA y estadísticas quedarán vacíos. Para tener todo, usa el modo avanzado.
              </Aviso>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13.5px] text-fg-2">
                Sube tu <strong className="text-fg">Trabajo académico del estudiante</strong> (Excel) y se importa <strong className="text-fg">todo automáticamente</strong>, sin que agregues nada a mano:
              </p>
              <Lista
                icono={<CheckCircle2 className="text-ok" />}
                items={[
                  "Cada ramo en su semestre, con su nota",
                  "Ramos repetidos y reprobados (alertas de permanencia)",
                  "Semestres especiales, congelaciones e inglés eximido",
                  "PPA y estadísticas listos desde el primer momento",
                ]}
              />
              <Tutorial />
              <Aviso tono="acento" icono={<Sparkles />}>
                Opcional: arrastra <strong>también el PDF</strong> del Avance curricular. Completa los nombres de Formación General y avisa si algo no cuadra entre ambos.
              </Aviso>
            </div>
          )}

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
            className={cx(
              "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-accent",
              arrastrando ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent hover:bg-accent-soft/50",
            )}
          >
            <input
              type="file"
              className="sr-only"
              multiple={modo === "avanzado"}
              accept={modo === "rapido" ? "application/pdf,.pdf" : ".xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
              onChange={(e) => {
                void procesar(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
              disabled={leyendo}
            />
            {leyendo ? <Loader2 className="size-7 animate-spin text-accent" /> : modo === "rapido" ? <FileText className="size-7 text-accent" /> : <FileSpreadsheet className="size-7 text-accent" />}
            <strong className="text-[14px]">{leyendo ? "Leyendo tu reporte…" : modo === "rapido" ? "Arrastra tu Avance curricular aquí" : "Arrastra tu Excel (y el PDF, si quieres) aquí"}</strong>
            {!leyendo && <span className="text-[12.5px] text-fg-2">o toca para elegir el archivo</span>}
          </label>

          {error && (
            <Aviso tono="danger" icono={<AlertTriangle />}>
              {error}
            </Aviso>
          )}
          <p className="flex items-start gap-1.5 text-[12px] text-fg-3">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok" /> Los archivos se leen en tu navegador y no se suben a ningún servidor. Tu nombre y matrícula no se guardan.
          </p>
        </div>
      )}

      {rev && plan && resumen && (
        <div className="space-y-4 px-6 pt-4 pb-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Dato etiqueta="Ramos aprobados" valor={`${resumen.ramosAprobados}/${resumen.ramosMalla}`} detalle="de tu malla" />
            <Dato etiqueta="Cursando ahora" valor={resumen.cursando} detalle={plural(resumen.cursando, "ramo")} />
            {completo ? (
              <Dato etiqueta="PPA" valor={fmtNota(resumen.ppa, 2)} detalle={`${plural(resumen.semestres, "semestre")} con notas`} />
            ) : (
              <Dato etiqueta="Notas" valor="—" detalle="el PDF no las trae" />
            )}
            {completo && <Dato etiqueta="Ramos reprobados" valor={resumen.intentosReprobados} detalle="intentos en total" />}
            {completo && <Dato etiqueta="Inglés eximido" valor={resumen.inglesEximido} detalle={plural(resumen.inglesEximido, "nivel", "niveles")} />}
            {completo && <Dato etiqueta="Congelaciones" valor={resumen.congelaciones} />}
          </div>

          {completo ? (
            <Aviso tono="ok" icono={<CheckCircle2 />}>
              Estás en el <strong>semestre {resumen.semestreActual}</strong>, según tu historial. Cada ramo quedó en el semestre en que lo cursaste.
            </Aviso>
          ) : (
            <div className="space-y-1">
              <label className="label" htmlFor="imp-sem">
                Semestre que estás cursando
              </label>
              <input id="imp-sem" type="number" min={1} max={20} className="input max-w-32" value={semestre} onChange={(e) => setSemestre(Math.max(1, Math.min(20, Math.trunc(Number(e.target.value) || 1))))} />
              <p className="text-[11.5px] text-fg-3">Lo calculé con la fecha del reporte. Cuéntalo sin congelaciones; corrígelo si no coincide.</p>
            </div>
          )}

          {plan.notas.length > 0 && <Lista icono={<Info className="text-info" />} items={plan.notas} />}
          {plan.advertencias.length > 0 && (
            <Aviso tono="warn" icono={<AlertTriangle />}>
              <p className="font-semibold">A revisar</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px]">
                {plan.advertencias.slice(0, 8).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              {plan.advertencias.length > 8 && <p className="mt-1 text-[12px] text-fg-2">…y {plan.advertencias.length - 8} más.</p>}
            </Aviso>
          )}
          {plan.noReconocidos.length > 0 && (
            <Aviso tono="warn" icono={<AlertTriangle />}>
              <p className="font-semibold">No encontré {plural(plan.noReconocidos.length, "ramo")} en tu malla (los omití)</p>
              <p className="mt-0.5 text-[12.5px] text-fg-2">{plan.noReconocidos.join(" · ")}</p>
            </Aviso>
          )}

          <p className="text-[12.5px] text-fg-2">
            {completo
              ? "Esto reemplaza tu historial actual por el del Excel (conserva las evaluaciones que ya cargaste en los mismos ramos y semestres)."
              : "Esto marca tus ramos según el PDF y quita las marcas manuales que no respalda. Tus notas ya registradas no se tocan."}{" "}
            Después puedes deshacerlo.
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Boton variante="fantasma" onClick={() => setRev(null)}>
              Elegir otros archivos
            </Boton>
            <Boton variante="primario" onClick={importar} icono={<CheckCircle2 className="size-4" />}>
              Importar a mi planner
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
