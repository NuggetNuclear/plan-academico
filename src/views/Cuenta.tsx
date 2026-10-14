import { Download, FileUp, GitCompareArrows, Info, LogOut, RefreshCw, Trash2, Upload, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CARRERA_ID, useApp, leerTodosLosEstados, borrarEstadosLocales } from "../store/app";
import { crearRespaldo, descargarArchivo, leerRespaldo } from "../store/respaldo";
import { confirmar, toast, useUI } from "../store/ui";
import { cerrarSesion, eliminarCuenta, entrarConGoogle, estadoSync, iniciarSync, resolverConflicto, sincronizarAhora, syncDisponible, useSync } from "../sync/useSync";
import { CabeceraModal, Modal, PieModal } from "../ui/overlays";
import { Boton, cx } from "../ui/primitives";

const fmtFecha = (ms: number | null) => (ms ? new Date(ms).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : "sin fecha");

function AccionDatos({ icono, titulo, descripcion, onClick }: { icono: React.ReactNode; titulo: string; descripcion: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-start gap-3 rounded-2xl border border-line p-3.5 text-left transition-colors hover:border-accent hover:bg-accent-soft">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent [&>svg]:size-[18px]">{icono}</span>
      <span>
        <strong className="block text-[13.5px]">{titulo}</strong>
        <span className="block text-[12px] text-fg-2">{descripcion}</span>
      </span>
    </button>
  );
}

function ModalConflicto() {
  const conflicto = useSync((s) => s.conflicto);
  const [eleccion, setEleccion] = useState<"nube" | "local">("nube");
  if (!conflicto) return null;
  return (
    <Modal abierto onCerrar={() => {}} cerrable={false} etiqueta="Conflicto de sincronización">
      <CabeceraModal icono={<GitCompareArrows className="size-5" />} sobretitulo="Sincronización" titulo="¿Qué progreso quieres conservar?">
        Este dispositivo y tu cuenta tienen datos distintos. Elige cuál mantener; el otro se reemplazará.
      </CabeceraModal>
      <div className="space-y-2 px-6 pt-4">
        {(
          [
            ["nube", "El de mi cuenta", `Guardado en la nube el ${fmtFecha(conflicto.nube.actualizado)}.`],
            ["local", "El de este dispositivo", "Guardado en este navegador."],
          ] as const
        ).map(([v, t, d]) => (
          <label key={v} className={cx("flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5", eleccion === v ? "border-accent bg-accent-soft" : "border-line")}>
            <input type="radio" name="conflicto" className="mt-1 accent-[var(--accent)]" checked={eleccion === v} onChange={() => setEleccion(v)} />
            <span>
              <strong className="block text-[14px]">{t}</strong>
              <span className="text-[12.5px] text-fg-2">{d}</span>
            </span>
          </label>
        ))}
        <p className="flex items-start gap-1.5 pt-1 text-[12px] text-fg-3">
          <Info className="mt-0.5 size-3.5 shrink-0" /> Si no estás seguro, primero exporta un respaldo desde Mi cuenta.
        </p>
      </div>
      <PieModal>
        <Boton variante="primario" onClick={() => resolverConflicto(eleccion)}>
          Conservar selección
        </Boton>
      </PieModal>
    </Modal>
  );
}

export function Cuenta() {
  const abierto = useUI((s) => s.cuentaAbierta);
  const setCuenta = useUI((s) => s.setCuenta);
  const carga = useApp((s) => s.carga);
  const sync = useSync();
  const archivo = useRef<HTMLInputElement>(null);
  const estado = estadoSync(sync);

  useEffect(() => {
    if (carga === "listo") iniciarSync();
  }, [carga]);

  const exportar = () => {
    const estados = leerTodosLosEstados();
    if (!Object.keys(estados).length) return toast("Todavía no hay datos guardados en este dispositivo.", "error");
    descargarArchivo(`notas-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(crearRespaldo(estados, CARRERA_ID), null, 2));
    toast("Respaldo descargado. Guárdalo en un lugar seguro.");
  };

  const importar = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = await leerRespaldo(f);
      if (!r.estados[CARRERA_ID]) throw new Error("El respaldo no trae progreso de Informática UDP.");
      const fecha = r.exportado ? fmtFecha(Date.parse(r.exportado)) : "fecha desconocida";
      const ok = await confirmar({
        titulo: "Importar respaldo",
        mensaje: `Se reemplazará el progreso de este dispositivo por el del archivo (exportado el ${fecha}).${sync.usuario ? "\nTambién se actualizará tu cuenta." : ""}`,
        aceptar: "Importar y reemplazar",
        peligro: true,
      });
      if (!ok) return;
      useApp.getState().reemplazarTodo(r.estados);
      setCuenta(false);
      toast("Respaldo importado correctamente.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo leer el archivo.", "error");
    } finally {
      if (archivo.current) archivo.current.value = "";
    }
  };

  return (
    <>
      <Modal abierto={abierto} onCerrar={() => setCuenta(false)} etiqueta="Mi cuenta" ancho="lg">
        <CabeceraModal sobretitulo="Mi cuenta" titulo={sync.usuario ? sync.usuario.nombre : "Tus datos"} onCerrar={() => setCuenta(false)}>
          {sync.usuario ? sync.usuario.correo : "Todo se guarda en este navegador. Respáldalo o sincronízalo para usarlo en otros dispositivos."}
        </CabeceraModal>
        <div className="space-y-5 px-6 py-5">
          <section className="rounded-2xl border border-line p-4">
            {sync.usuario ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-accent-soft text-accent">
                  {sync.usuario.foto ? <img src={sync.usuario.foto} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : <UserRound className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13.5px] font-bold">
                    <span className={cx("size-2 rounded-full", estado.tono === "ok" ? "bg-ok" : "bg-warn")} /> {estado.texto}
                  </p>
                  <p className="text-[12px] text-fg-2">Última sincronización: {fmtFecha(sync.ultima)}</p>
                </div>
                <Boton tamano="sm" icono={<RefreshCw className="size-4" />} onClick={() => sincronizarAhora()}>
                  Sincronizar ahora
                </Boton>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[14px] font-bold">Sincroniza tu progreso</p>
                <p className="text-[12.5px] text-fg-2">Usa tu malla, notas y planes en el teléfono y el computador. Solo se usa tu nombre, correo y foto para identificar tu cuenta.</p>
                <Boton variante="secundario" disabled={!syncDisponible} onClick={entrarConGoogle} className="w-full sm:w-auto">
                  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                  </svg>
                  Continuar con Google
                </Boton>
                {!syncDisponible && (
                  <p className="flex items-start gap-1.5 text-[12px] text-fg-3">
                    <Info className="mt-0.5 size-3.5 shrink-0" /> La sincronización aún no está configurada en este sitio (ver README). Mientras tanto, exporta e importa tus datos.
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <p className="mb-2 text-[13.5px] font-bold">Mis datos</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <AccionDatos
                icono={<FileUp />}
                titulo="Importar desde la UDP"
                descripcion="Sube tu Avance curricular (PDF) o tu Trabajo académico (Excel) y se rellena tu malla."
                onClick={() => {
                  setCuenta(false);
                  useUI.getState().setImportar(true);
                }}
              />
              <AccionDatos icono={<Download />} titulo="Exportar respaldo" descripcion="Un archivo con tu malla, notas y planes." onClick={exportar} />
              <AccionDatos icono={<Upload />} titulo="Importar respaldo" descripcion="Restaura un respaldo exportado desde esta app." onClick={() => archivo.current?.click()} />
            </div>
            <input ref={archivo} type="file" accept="application/json,.json" hidden onChange={(e) => importar(e.target.files?.[0])} />
          </section>

          <section className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Boton
              tamano="sm"
              variante="fantasma"
              className="text-danger hover:!bg-danger-soft"
              icono={<Trash2 className="size-4" />}
              onClick={async () => {
                const ok = await confirmar({
                  titulo: "Borrar datos de este dispositivo",
                  mensaje: sync.usuario ? "Se borrará el progreso de este navegador y se cerrará tu sesión. Tu cuenta en la nube no se modifica." : "Se borrará todo el progreso guardado en este navegador. Si no lo exportaste, no se podrá recuperar.",
                  aceptar: "Borrar",
                  peligro: true,
                });
                if (!ok) return;
                if (sync.usuario) await cerrarSesion();
                borrarEstadosLocales();
                location.reload();
              }}
            >
              Borrar datos de este dispositivo
            </Boton>
            {sync.usuario && (
              <>
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  className="text-danger hover:!bg-danger-soft"
                  icono={<Trash2 className="size-4" />}
                  onClick={async () => {
                    if (await confirmar({ titulo: "Eliminar mi cuenta y datos", mensaje: "Se borrarán tus datos de la nube y tu cuenta. El progreso de este dispositivo se conserva.", aceptar: "Eliminar", peligro: true }))
                      eliminarCuenta();
                  }}
                >
                  Eliminar cuenta
                </Boton>
                <span className="flex-1" />
                <Boton tamano="sm" icono={<LogOut className="size-4" />} onClick={cerrarSesion}>
                  Cerrar sesión
                </Boton>
              </>
            )}
          </section>
        </div>
      </Modal>
      <ModalConflicto />
    </>
  );
}
