import { CalendarDays, Check, FileUp, Grid3x3, Zap, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../store/app";
import { marcarSemestres } from "../store/mutaciones";
import { escribirLocal, leerLocal, toast, useUI } from "../store/ui";
import { CabeceraModal, Modal } from "../ui/overlays";
import { Boton, cx } from "../ui/primitives";

const CLAVE_SALTADO = "notas.v1.wizardSaltado";
export const wizardSaltado = () => leerLocal(CLAVE_SALTADO) === "1";

function Opcion({ activo, onClick, titulo, descripcion, icono }: { activo: boolean; onClick: () => void; titulo: string; descripcion: string; icono?: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={activo} onClick={onClick} className={cx("flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors", activo ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}>
      {icono && <span className={cx("mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl", activo ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2")}>{icono}</span>}
      <span className="min-w-0 flex-1">
        <strong className="block text-[14px]">{titulo}</strong>
        <span className="block text-[12.5px] text-fg-2">{descripcion}</span>
      </span>
      <span className={cx("mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2", activo ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>{activo && <Check className="size-3" />}</span>
    </button>
  );
}

export function Wizard() {
  const abierto = useUI((s) => s.wizardAbierto);
  const setWizard = useUI((s) => s.setWizard);
  const malla = useApp((s) => s.malla);
  const st = useApp((s) => s.st);
  const [paso, setPaso] = useState(1);
  const [semestre, setSemestre] = useState(1);
  const [ingles, setIngles] = useState(0);
  const [congelo, setCongelo] = useState(false);
  const [cong, setCong] = useState({ desde: 1, duracion: 1 });
  const [modo, setModo] = useState<"rapido" | "completo">("rapido");
  const [marcar, setMarcar] = useState(true);

  useEffect(() => {
    if (!abierto) return;
    setPaso(1);
    setSemestre(st.semestreActual);
    setIngles(st.inglesEximido);
    setCongelo(st.congelaciones.length > 0);
    setCong(st.congelaciones[0] ?? { desde: Math.max(1, st.semestreActual), duracion: 1 });
    setModo(st.prefs.marcadoRapido || !st.prefs.wizardHecho ? "rapido" : "completo");
    setMarcar(Object.keys(st.marcas).length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const niveles = malla?.nivelesIngles ?? [];

  // Si la persona cierra el asistente sin terminar, no se vuelve a abrir solo.
  const cerrar = () => {
    escribirLocal(CLAVE_SALTADO, "1");
    setWizard(false);
  };

  const terminar = () => {
    let marcados = 0;
    useApp.getState().mutar("Asistente de inicio", (ctx) => {
      const s = ctx.st;
      s.semestreActual = semestre;
      s.inglesEximido = ingles;
      s.congelaciones = congelo ? [{ desde: Math.max(1, cong.desde), duracion: Math.max(1, cong.duracion) }] : [];
      s.prefs.marcadoRapido = modo === "rapido";
      s.prefs.wizardHecho = true;
      if (marcar && semestre > 1) marcados = marcarSemestres(ctx, semestre - 1);
    });
    setWizard(false);
    toast(marcados ? `¡Listo! Marcamos ${marcados} ramos hasta el semestre ${semestre - 1}. Ahora desmarca los que debes.` : "¡Listo! Ya puedes marcar tu malla.");
    useUI.getState().irA("malla");
  };

  return (
    <Modal abierto={abierto} onCerrar={cerrar} etiqueta="Asistente de inicio" ancho="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (paso < 2) setPaso(paso + 1);
          else terminar();
        }}
      >
        <ol className="flex gap-2 px-6 pt-6" aria-label="Progreso">
          {["Semestre", "Avance"].map((t, i) => (
            <li key={t} className="flex-1">
              <div className={cx("h-1.5 rounded-full transition-colors", i < paso ? "bg-accent" : "bg-surface-3")} />
              <p className={cx("mt-1.5 text-[11.5px] font-semibold", i + 1 === paso ? "text-accent" : "text-fg-3")}>
                {i + 1}. {t}
              </p>
            </li>
          ))}
        </ol>

        {paso === 1 && (
          <>
            <CabeceraModal icono={<CalendarDays className="size-5" />} sobretitulo="Paso 1 de 2" titulo="¿En qué semestre vas?">
              Cuenta el semestre que estás cursando ahora, sin contar congelaciones.
            </CabeceraModal>
            <div className="space-y-4 px-6 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="wz-sem">
                    Semestre actual
                  </label>
                  <input id="wz-sem" type="number" min={1} max={20} className="input" value={semestre} onChange={(e) => setSemestre(Math.max(1, Math.min(20, Math.trunc(Number(e.target.value) || 1))))} />
                </div>
                {niveles.length > 0 && (
                  <div>
                    <label className="label" htmlFor="wz-ing">
                      Inglés eximido
                    </label>
                    <select id="wz-ing" className="input" value={ingles} onChange={(e) => setIngles(Number(e.target.value))}>
                      <option value={0}>Ninguno</option>
                      {niveles.map((_, i) => (
                        <option key={i} value={i + 1}>
                          {i === 0 ? "Nivel 1" : i === niveles.length - 1 ? `Todos (1-${i + 1})` : `Niveles 1-${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Selecciona una opción">
                <Opcion activo={!congelo} onClick={() => setCongelo(false)} titulo="Nunca he congelado" descripcion="Sigue al paso siguiente." />
                <Opcion activo={congelo} onClick={() => setCongelo(true)} titulo="Congelé alguna vez" descripcion="Para estimar bien tu fecha de egreso." />
              </div>
              {congelo && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="wz-cong-desde">Semestre que quedó pendiente</label>
                    <input id="wz-cong-desde" type="number" min={1} max={20} className="input" value={cong.desde} onChange={(e) => setCong({ ...cong, desde: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <div>
                    <label className="label" htmlFor="wz-cong-dur">Semestres que duró</label>
                    <input id="wz-cong-dur" type="number" min={1} max={20} className="input" value={cong.duracion} onChange={(e) => setCong({ ...cong, duracion: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            <CabeceraModal icono={<Grid3x3 className="size-5" />} sobretitulo="Paso 2 de 2" titulo="¿Cómo quieres marcar tu avance?">
              Puedes cambiarlo después con el interruptor «Marcado rápido» de la malla.
            </CabeceraModal>
            <div className="space-y-2 px-6 pt-4" role="group" aria-label="Selecciona una opción">
              <button
                type="button"
                onClick={() => {
                  setWizard(false);
                  useUI.getState().setImportar(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-accent-line bg-accent-soft p-3.5 text-left transition-colors hover:bg-accent-soft/70"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg">
                  <FileUp className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[14px]">Importa tu avance desde la UDP</strong>
                  <span className="block text-[12.5px] text-fg-2">Sube tu Avance curricular (PDF) o tu Trabajo académico (Excel) y nos saltamos este paso.</span>
                </span>
              </button>
              <Opcion activo={modo === "rapido"} onClick={() => setModo("rapido")} icono={<Zap className="size-4" />} titulo="Rápido (recomendado)" descripcion="Un clic marca el ramo como aprobado, sin pedir el semestre. Ideal para planificar." />
              <Opcion activo={modo === "completo"} onClick={() => setModo("completo")} icono={<ListChecks className="size-4" />} titulo="Completo" descripcion="Te preguntamos en qué semestre aprobaste cada ramo para armar tus notas, PPA y estadísticas." />
              {semestre > 1 && (
                <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5">
                  <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={marcar} onChange={(e) => setMarcar(e.target.checked)} />
                  <span>
                    <strong className="block text-[14px]">Marcar como aprobado todo hasta el semestre {semestre - 1}</strong>
                    <span className="block text-[12.5px] text-fg-2">Después solo desmarcas los ramos que debes. Mucho más rápido que marcarlos uno por uno.</span>
                  </span>
                </label>
              )}
            </div>
          </>
        )}

        <div className="flex items-center gap-2 px-6 pt-5 pb-6">
          <Boton variante="fantasma" onClick={cerrar}>
            Saltar por ahora
          </Boton>
          <span className="flex-1" />
          {paso > 1 && (
            <Boton variante="secundario" onClick={() => setPaso(paso - 1)}>
              Atrás
            </Boton>
          )}
          <Boton type="submit" variante="primario">
            {paso < 2 ? "Siguiente" : "Empezar"}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
