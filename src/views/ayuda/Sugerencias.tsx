import { Bug, CircleAlert, ExternalLink, Send } from "lucide-react";
import { useState } from "react";
import { enviarSugerencia, sugerenciasDisponible } from "../../sugerencias/enviar";
import { MAX_CORREO, MAX_MENSAJE, TIPOS, validarSugerencia, type TipoSugerencia } from "../../sugerencias/validar";
import { toast } from "../../store/ui";
import { Aviso, Boton, Campo, Segmentado, claseBoton } from "../../ui/primitives";

const REPO = "https://github.com/NuggetNuclear/plan-academico";
const URL_NUEVO_ERROR = `${REPO}/issues/new?template=error.yml`;
const URL_ISSUES = `${REPO}/issues`;

const enlace = "font-semibold text-accent hover:underline";

export function Sugerencias() {
  // Sin Firebase configurado no hay dónde guardar los mensajes: queda solo GitHub.
  if (!sugerenciasDisponible)
    return (
      <p>
        ¿Tienes una duda o una idea? Escríbeme abriendo un{" "}
        <a className={enlace} href={`${REPO}/issues/new`} target="_blank" rel="noopener noreferrer">
          issue en GitHub
        </a>
        . Necesitas una cuenta de GitHub y lo que escribas queda público, así que no incluyas notas ni datos personales.
      </p>
    );
  return <FormularioSugerencias />;
}

function FormularioSugerencias() {
  const [tipo, setTipo] = useState<TipoSugerencia>("duda");
  const [mensaje, setMensaje] = useState("");
  const [correo, setCorreo] = useState("");
  // Campo trampa: invisible para personas, los bots que rellenan todo lo completan.
  const [trampa, setTrampa] = useState("");
  const [tocado, setTocado] = useState({ mensaje: false, correo: false });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errores = validarSugerencia({ tipo, mensaje, correo });

  function limpiar() {
    setMensaje("");
    setCorreo("");
    setTocado({ mensaje: false, correo: false });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTocado({ mensaje: true, correo: true });
    if (errores.mensaje || errores.correo || enviando) return;
    setError(null);
    if (trampa) {
      limpiar();
      return;
    }
    setEnviando(true);
    const motivo = await enviarSugerencia({ tipo, mensaje, correo });
    setEnviando(false);
    if (motivo) return setError(motivo);
    toast(correo.trim() ? "¡Gracias! Me llegó tu mensaje y te respondo a tu correo." : "¡Gracias! Me llegó tu mensaje.");
    limpiar();
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <p>
        ¿Tienes una duda sobre cómo usar la app, una idea o algo que quieras contarme? Escríbeme aquí. Si quieres que te responda, deja tu correo. Si algo no funciona, mejor usa <strong>Reportar un error</strong>, más abajo.
      </p>

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
          placeholder={tipo === "idea" ? "Ej.: me gustaría ver el PPA de cada año en Estadísticas…" : "Ej.: ¿cómo registro un ramo que convalidé?"}
        />
      </Campo>

      <Campo etiqueta="Correo (opcional)" htmlFor="sug-correo" ayuda={tocado.correo && errores.correo ? <span className="text-danger">{errores.correo}</span> : "Solo para responderte. No lo uso para nada más."}>
        <input
          id="sug-correo"
          type="email"
          className="input sm:max-w-sm"
          maxLength={MAX_CORREO}
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          onBlur={() => setTocado((t) => ({ ...t, correo: true }))}
          aria-invalid={tocado.correo && !!errores.correo}
        />
      </Campo>

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="sug-web">Sitio web</label>
        <input id="sug-web" type="text" tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} />
      </div>

      {error && (
        <Aviso tono="danger" icono={<CircleAlert />}>
          <span role="alert">{error}</span>
        </Aviso>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Boton variante="primario" type="submit" disabled={enviando} icono={<Send className="size-4" />}>
          {enviando ? "Enviando…" : "Enviar"}
        </Boton>
        <p className="text-[12px] text-fg-3">
          Al enviar aceptas los{" "}
          <a className={enlace} href="./terminos.html">
            términos
          </a>{" "}
          y la{" "}
          <a className={enlace} href="./privacidad.html">
            política de privacidad
          </a>
          . No incluyas notas ni datos personales que no quieras compartir.
        </p>
      </div>
    </form>
  );
}

export function ReportarError() {
  return (
    <>
      <p>
        Si algo no funciona como debería (un cálculo que no cuadra, un botón que no responde, un reporte de la UDP que no se importa bien), repórtalo en GitHub. Así queda registrado, puedo seguirlo y te aviso ahí cuando esté
        arreglado.
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Revisa si alguien ya lo reportó en la lista de issues.</li>
        <li>Si no, abre uno nuevo: el formulario te pide qué pasó, los pasos para repetirlo y qué esperabas.</li>
        <li>Si puedes, agrega una captura de pantalla. Es lo que más me ayuda.</li>
      </ol>
      <Aviso tono="warn" icono={<Bug />}>
        Necesitas una cuenta de GitHub y los issues son <strong>públicos</strong>: no incluyas tus notas, tu RUT ni otros datos personales, y tapa esa información en las capturas.
      </Aviso>
      <div className="flex flex-wrap gap-2">
        <a href={URL_NUEVO_ERROR} target="_blank" rel="noopener noreferrer" className={claseBoton("primario", "sm")}>
          <Bug className="size-4" /> Reportar un error
        </a>
        <a href={URL_ISSUES} target="_blank" rel="noopener noreferrer" className={claseBoton("secundario", "sm")}>
          <ExternalLink className="size-4" /> Ver errores reportados
        </a>
      </div>
      {sugerenciasDisponible && <p className="text-[12.5px]">¿No tienes cuenta de GitHub? Cuéntamelo igual desde «Escríbeme», eligiendo «Otro».</p>}
    </>
  );
}
