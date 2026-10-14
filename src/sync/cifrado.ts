// Cifrado de extremo a extremo de la copia en la nube. La clave sale de una contraseña que solo
// conoce la persona: ni Firebase ni quien administra el proyecto pueden leer los datos.
//
// PBKDF2-SHA-256 con 600.000 iteraciones (mínimo de OWASP 2023) → AES-256-GCM. Cada escritura usa un IV aleatorio,
// el uid va como dato autenticado (un documento no se puede pasar a otra cuenta) y el texto se
// rellena a bloques de 4 KB para que el tamaño no delate cuánto progreso hay.
// ponytail: PBKDF2 por ser nativo; Argon2id (resistente a GPU) pediría una dependencia WASM.

export const ITERACIONES = 600_000;
const BLOQUE = 4096;

/** Lo único que se guarda en Firestore. */
export interface Sobre {
  v: 2;
  iter: number;
  sal: string;
  iv: string;
  datos: string;
}

const texto = new TextEncoder();

function aBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

const deBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const asociado = (uid: string) => texto.encode(`notas-planner:v2:${uid}`);

export const nuevaSal = () => aBase64(crypto.getRandomValues(new Uint8Array(16)));

/** Clave no extraíble: ni este código puede leer sus bytes. */
export async function derivarClave(contrasena: string, sal: string, iter = ITERACIONES): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", texto.encode(contrasena.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: deBase64(sal), iterations: iter },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function cifrar(clave: CryptoKey, sal: string, iter: number, uid: string, datos: unknown): Promise<Sobre> {
  const json = texto.encode(JSON.stringify(datos));
  // Relleno con espacios: JSON.parse los ignora al final.
  const relleno = new Uint8Array(Math.ceil((json.length + 1) / BLOQUE) * BLOQUE).fill(0x20);
  relleno.set(json);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: asociado(uid) }, clave, relleno);
  return { v: 2, iter, sal, iv: aBase64(iv), datos: aBase64(new Uint8Array(cifrado)) };
}

/** Falla si la contraseña no corresponde, si el documento es de otra cuenta o si fue alterado. */
export async function descifrar(clave: CryptoKey, uid: string, sobre: Sobre): Promise<unknown> {
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(sobre.iv), additionalData: asociado(uid) }, clave, deBase64(sobre.datos));
  return JSON.parse(new TextDecoder().decode(plano));
}

export const esSobre = (d: unknown): d is Sobre => {
  const s = d as Sobre | null;
  return s?.v === 2 && [s.sal, s.iv, s.datos].every((x) => typeof x === "string") && Number.isInteger(s.iter) && s.iter > 0;
};
