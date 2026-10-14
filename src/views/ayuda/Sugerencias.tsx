import { Image as IconoImagen, Send, ShieldAlert, X } from "lucide-react";
import { useRef, useState } from "react";
import { ADJUNTO_TIPOS, MAX_ADJUNTO, MAX_CORREO, MAX_MENSAJE, TIPOS, fmtMB, validarAdjunto, validarSugerencia, type TipoSugerencia } from "../../sugerencias/validar";
import { Aviso, Boton, BotonIcono, Campo, Segmentado } from "../../ui/primitives";

// Mientras no haya un destino configurado el formulario no se muestra: solo el enlace a los issues de GitHub.
// El plan para conectarlo está en docs/plan-formulario-sugerencias.md.
const sugerenciasDisponible = !!import.meta.env.VITE_SUGERENCIAS_URL;
const URL_ISSUES = "https://github.com/NuggetNuclear/plan-academico/issues/new";

export function Sugerencias() {
  if (!sugerenciasDisponible)
    return (
      <p>
        ¿Algo no funciona, falta una idea o tienes una duda? Escríbenos abriendo un{" "}
        <a className="font-semibold text-accent hover:underline" href={URL_ISSUES} target="_blank" rel="noopener noreferrer">
          issue en GitHub
        </a>
        . Necesitas una cuenta de GitHub y lo que escribas queda público, así que no incluyas notas ni datos personales.
      </p>
    );
  return <FormularioSugerencias />;
}

function FormularioSugerencias() {
  const [tipo, setTipo] = useState<TipoSugerencia>("idea");
  const [mensaje, setMensaje] = useState("");
  const [correo, setCorreo] = useState("");
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);
  const [tocado, setTocado] = useState({ mensaje: false, correo: false });
  const inputArchivo = useRef<HTMLInputElement>(null);

  const errores = validarSugerencia({ tipo, mensaje, correo });

  async function elegirArchivo(archivo: File | undefined) {
    if (!archivo) return;
    const motivo = await validarAdjunto(archivo);
    setErrorAdjunto(motivo);
    setAdjunto(motivo ? null : archivo);
    if (motivo && inputArchivo.current) inputArchivo.current.value = "";
  }

  function quitarArchivo() {
    setAdjunto(null);
    setErrorAdjunto(null);
    if (inputArchivo.current) inputArchivo.current.value = "";
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTocado({ mensaje: true, correo: true });
    if (errores.mensaje || errores.correo) return;
    // El envío se conecta aquí cuando se elija dónde guardar las respuestas (ver el plan).
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <p>¿Algo no funciona, falta una idea o tienes una duda? Cuéntanos. No hace falta que dejes tu correo, solo si quieres que te respondamos.</p>

      <Campo etiqueta="Tipo de mensaje">
        <Segmentado etiqueta="Tipo de mensaje" opciones={TIPOS.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))} valor={tipo} onChange={setTipo} />
      </Campo>

      <Campo
        etiqueta="Mensaje"
        htmlFor="sug-mensaje"
        ayuda={
          <span className="flex justify-between gap-3">
            <span className={tocado.mensaje && errores.mensaje ? "text-danger" : ""}>{tocado.mensaje && errores.mensaje ? errores.mensaje : "Mientras más concreto, mejor."}</span>
            <span>
              {mensaje.length}/{MAX_MENSAJE}
            </span>
          </span>
        }
      >
        <textarea
          id="sug-mensaje"
          className="input min-h-28 resize-y"
          rows={4}
          maxLength={MAX_MENSAJE}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onBlur={() => setTocado((t) => ({ ...t, mensaje: true }))}
          aria-invalid={tocado.mensaje && !!errores.mensaje}
          placeholder="Ej.: me gustaría ver el PPA de cada año en Estadísticas…"
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Correo (opcional)" htmlFor="sug-correo" ayuda={tocado.correo && errores.correo ? <span className="text-danger">{errores.correo}</span> : "Solo para responderte."}>
          <input
            id="sug-correo"
            type="email"
            className="input"
            maxLength={MAX_CORREO}
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            onBlur={() => setTocado((t) => ({ ...t, correo: true }))}
            aria-invalid={tocado.correo && !!errores.correo}
          />
        </Campo>

        <Campo etiqueta="Captura de pantalla (opcional)" htmlFor="sug-archivo" ayuda={`PNG, JPG o WebP · máximo ${fmtMB(MAX_ADJUNTO)}`}>
          {adjunto ? (
            <div className="flex items-center gap-2 rounded-[0.65rem] border border-line-strong bg-surface-2 py-1 pr-1 pl-3 text-[13px]">
              <IconoImagen className="size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate font-semibold text-fg">{adjunto.name}</span>
              <span className="shrink-0 text-fg-3">{fmtMB(adjunto.size)}</span>
              <BotonIcono etiqueta="Quitar captura" tamano="sm" onClick={quitarArchivo}>
                <X className="size-4" />
              </BotonIcono>
            </div>
          ) : (
            <input
              id="sug-archivo"
              ref={inputArchivo}
              type="file"
              accept={ADJUNTO_TIPOS.join(",")}
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-accent"
              onChange={(e) => void elegirArchivo(e.target.files?.[0])}
            />
          )}
          {errorAdjunto && (
            <p role="alert" className="mt-1 text-[11.5px] text-danger">
              {errorAdjunto}
            </p>
          )}
        </Campo>
      </div>

      <Aviso tono="warn" icono={<ShieldAlert />}>
        Por seguridad solo se aceptan <strong>imágenes</strong> (PNG, JPG o WebP) de hasta <strong>{fmtMB(MAX_ADJUNTO)}</strong>. Se revisa el contenido del archivo, no solo su nombre, y no se aceptan PDF, SVG, comprimidos ni ejecutables. No subas capturas con notas o datos
        personales que no quieras compartir.
      </Aviso>

      <div className="flex flex-wrap items-center gap-3">
        <Boton variante="primario" type="submit" icono={<Send className="size-4" />}>
          Enviar
        </Boton>
        <p className="text-[12px] text-fg-3">
          Al enviar aceptas los{" "}
          <a className="font-semibold text-accent hover:underline" href="./terminos.html">
            términos
          </a>{" "}
          y la{" "}
          <a className="font-semibold text-accent hover:underline" href="./privacidad.html">
            política de privacidad
          </a>
          .
        </p>
      </div>
    </form>
  );
}
