// Envío del formulario de ayuda a la colección `sugerencias` de Firestore. Cualquiera puede crear un
// mensaje y nadie puede leerlos desde la web (ver firestore.rules); los reviso en la consola de Firebase.
// No se adjunta la cuenta de Google aunque haya sesión iniciada.
import { cargarFirebase, syncDisponible } from "../sync/useSync";
import type { DatosSugerencia } from "./validar";

export const sugerenciasDisponible = syncDisponible;

const COLECCION = "sugerencias";
const TIEMPO_MAX_MS = 15_000;
const ESPERA_ENTRE_ENVIOS_MS = 60_000;
const CLAVE_ULTIMO_ENVIO = "notas:ultimo-mensaje-ayuda";

function ultimoEnvio(): number {
  try {
    return Number(localStorage.getItem(CLAVE_ULTIMO_ENVIO)) || 0;
  } catch {
    return 0;
  }
}

/** Devuelve el motivo del fallo, o null si el mensaje se guardó. Sin reintentos automáticos. */
export async function enviarSugerencia({ tipo, mensaje, correo }: DatosSugerencia): Promise<string | null> {
  const espera = ultimoEnvio() + ESPERA_ENTRE_ENVIOS_MS - Date.now();
  if (espera > 0) return `Acabas de enviarme un mensaje. Espera ${Math.ceil(espera / 1000)} s para mandar otro.`;
  if (!navigator.onLine) return "Estás sin conexión. Tu mensaje sigue aquí; inténtalo cuando vuelva internet.";
  try {
    const { db, m } = await cargarFirebase();
    const guardar = m.addDoc(m.collection(db, COLECCION), { tipo, mensaje: mensaje.trim(), correo: correo.trim(), creado: m.serverTimestamp() });
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const tope = new Promise<never>((_, rechazar) => {
      reloj = setTimeout(() => rechazar(new Error("tiempo")), TIEMPO_MAX_MS);
    });
    await Promise.race([guardar, tope]).finally(() => clearTimeout(reloj));
    try {
      localStorage.setItem(CLAVE_ULTIMO_ENVIO, String(Date.now()));
    } catch {
      /* sin almacenamiento: solo se pierde la espera entre envíos */
    }
    return null;
  } catch (e) {
    if (e instanceof Error && e.message === "tiempo") return "El envío está tardando demasiado. Revisa tu conexión e inténtalo de nuevo.";
    return "No pude recibir tu mensaje. Inténtalo de nuevo en un rato o repórtalo en GitHub.";
  }
}
