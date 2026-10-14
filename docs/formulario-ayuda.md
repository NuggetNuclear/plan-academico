# Formulario de ayuda y reporte de errores

En **Ayuda** hay dos secciones para hablar conmigo:

- **Escríbeme: dudas e ideas** — formulario dentro de la app (`src/views/ayuda/Sugerencias.tsx`). Guarda el mensaje en Firestore. Pensado para quien no tiene cuenta de GitHub o no quiere que su mensaje sea público.
- **Reportar un error** — enlaces a *New issue* con la plantilla `.github/ISSUE_TEMPLATE/error.yml` y a la lista de issues. Los errores van a GitHub para poder seguirlos y avisar cuando estén arreglados.

## Qué recoge el formulario

| Campo | Regla |
|---|---|
| `tipo` | `duda`, `idea` u `otro` |
| `mensaje` | 10 a 2.000 caracteres, obligatorio (se guarda sin espacios al inicio ni al final) |
| `correo` | Opcional (cadena vacía si no viene), máx. 120, solo para responder |
| `creado` | `serverTimestamp()` |

Nada más: ni la cuenta de Google aunque haya sesión, ni datos académicos, ni capturas. Las capturas se piden en el issue de GitHub.

## Cómo funciona

- `src/sugerencias/validar.ts` valida en el navegador (con tests).
- `src/sugerencias/enviar.ts` reutiliza el Firebase de la sincronización (`cargarFirebase` de `src/sync/useSync.ts`) y hace un `addDoc` en `sugerencias`, con 15 s de tope y sin reintentos. Si falla, el texto se conserva en el formulario.
- `firestore.rules` repite las reglas: solo `create` con exactamente esos cuatro campos, `tipo` válido, largos dentro del rango y `creado == request.time`. Nadie puede leer, editar ni borrar desde la web.
- El formulario solo aparece si están las variables `VITE_FIREBASE_*` (las mismas de la sincronización). Sin ellas, la sección muestra un enlace a GitHub.

**Contra abuso:** campo trampa oculto (si viene lleno, se descarta en silencio) y 60 s de espera entre envíos en el mismo navegador. Ambos se pueden saltar con una petición directa, así que el límite real son las reglas (tamaño máximo por documento) y lo que se configure en Firebase.

## Para activarlo

1. Publicar `firestore.rules` (Firebase console › Firestore › Reglas, o `firebase deploy --only firestore:rules`).
2. Recomendado: activar **App Check** con reCAPTCHA Enterprise para Firestore, y una **alerta de presupuesto** en el proyecto, para que un ataque de spam no genere cobros.
3. Leer los mensajes en Firebase console › Firestore › `sugerencias`. Mostrar el texto siempre como texto plano si algún día se usa en otro panel.

## Retención

La política de privacidad dice que los mensajes se borran a los 12 meses o antes si la persona lo pide. Hoy el borrado es manual desde la consola; se puede automatizar con una política TTL de Firestore sobre un campo de expiración.

## Pendiente / fuera de alcance

Respuestas desde la app, adjuntos, rate limit en servidor (requeriría App Check o una función propia) y un panel de administración.
