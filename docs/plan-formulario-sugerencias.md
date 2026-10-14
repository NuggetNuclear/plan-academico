# Plan: formulario de dudas y sugerencias

**Estado:** **no implementado.** El formulario está construido (`src/views/ayuda/Sugerencias.tsx`) con su validación (`src/sugerencias/validar.ts`, con tests), pero **no envía nada** y está **oculto** mientras no exista `VITE_SUGERENCIAS_URL`. Hoy **Ayuda › Dudas y sugerencias** solo muestra un enlace a los [issues de GitHub](https://github.com/NuggetNuclear/plan-academico/issues/new) (opción G). Este documento dice cómo conectarlo cuando se decida dónde guardar las respuestas.

## 1. Qué recoge

| Campo | Regla |
|---|---|
| Tipo | `idea`, `error` o `duda` |
| Mensaje | 10 a 2.000 caracteres, obligatorio |
| Correo | Opcional, máx. 120, solo para responder |
| Captura | Opcional, una imagen PNG/JPG/WebP de hasta **2 MB** |

No se recoge nada más (ni cuenta, ni IP guardada, ni datos académicos). Si el usuario tiene la sesión de Google iniciada **no** se adjunta su identidad.

## 2. Seguridad de los archivos adjuntos

La validación del navegador (`validarAdjunto`) mejora la experiencia, pero **un atacante puede saltársela** enviando la petición directamente. Por eso toda regla se repite en quien recibe los datos.

**En el navegador (ya hecho):**
- Máximo 2 MB y solo `image/png`, `image/jpeg`, `image/webp`.
- Se leen los primeros bytes (firma del archivo) y deben coincidir con el tipo declarado: un `.exe` renombrado a `.png` se rechaza.
- Nada de SVG (puede contener scripts), PDF, ZIP ni ejecutables.

**En el destino (obligatorio al conectar):**
1. Volver a comprobar tamaño, tipo y firma de bytes. Ignorar el nombre y el `Content-Type` que mande el cliente.
2. **Re-codificar la imagen** (decodificar y volver a guardar como PNG/WebP) antes de almacenarla: elimina metadatos y cualquier carga escondida tras un encabezado válido. Si no se puede re-codificar, se descarta.
3. Guardar con un nombre generado (UUID), nunca con el nombre original.
4. Servir los archivos desde un origen distinto al de la app, con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`, y sin acceso público: solo quien administra los ve.
5. Al mostrar el mensaje en cualquier panel, tratarlo como **texto plano** (nunca como HTML ni Markdown con HTML).

**Contra abuso (spam y relleno de almacenamiento):**
- Campo trampa oculto (*honeypot*) en el formulario; si viene lleno, se descarta en silencio.
- Verificación anti-bot: Cloudflare Turnstile, reCAPTCHA o Firebase App Check, según el destino.
- Límite de envíos por IP/dispositivo y tope diario global.
- Presupuesto/alerta de cuota en el servicio elegido, para que un ataque no genere cobros.

## 3. Dónde guardar las respuestas

| # | Opción | Qué es | A favor | En contra |
|---|---|---|---|---|
| A | **Firestore** (ya está en el proyecto por la sincronización) | Colección `sugerencias` donde cualquiera puede **crear** pero nadie puede leer desde la web | Ya hay SDK, proyecto y `firestore.rules`; sin servidor propio; las reglas validan largo y campos | Revisar respuestas en la consola es incómodo. La captura no cabe bien: sin Cloud Storage solo se puede guardar una imagen pequeña re-comprimida en el propio documento (límite de 1 MiB por documento). Cloud Storage de Firebase hoy exige plan de pago (Blaze); verifícalo |
| B | **Google Apps Script → Google Sheets + Drive** | Un script publicado como web app recibe el POST, valida y escribe una fila en una hoja; la imagen va a una carpeta de Drive | Gratis, tus datos quedan en tu Drive, la hoja sirve de bandeja de entrada y el script valida en servidor | CORS incómodo (hay que enviar como `text/plain`), cuotas diarias de Google, el script lo mantienes tú, difícil rate-limit por IP |
| C | **GitHub Issues vía función serverless** (Cloudflare Worker o similar) | La función valida y crea un issue con etiqueta `sugerencia` usando un token guardado como secreto | Ya estás en GitHub; notificaciones por correo, etiquetas y seguimiento gratis; público si el repo es público | El mensaje queda **visible para todos** (no incluir correo ni capturas); requiere desplegar la función; el token es un secreto que cuidar |
| D | **Servicio de formularios** (Formspree, Web3Forms, Getform, etc.) | Un POST a su URL; te llega un correo y tienen panel | Cero código de servidor, se configura en minutos, traen anti-spam | Un tercero procesa los datos (hay que declararlo en privacidad); los planes gratis limitan envíos y casi siempre los **archivos son de pago**; revisa las condiciones vigentes |
| E | **Supabase** (Postgres + Storage) | Tabla `sugerencias` con RLS (solo insertar) y un bucket privado para las capturas | Base de datos real, el bucket permite fijar tamaño máximo y tipos MIME permitidos, panel decente | Servicio nuevo que mantener; el plan gratis puede pausar proyectos inactivos (revisar) |
| F | **Cloudflare Worker + D1 + R2** | Endpoint propio: Turnstile, validación, fila en D1 y la imagen en R2 | Control total, generoso plan gratis, buen anti-bot | Es lo que más código requiere |
| G | **Sin almacenamiento**: botón `mailto:` o enlace a *New issue* | El formulario arma el texto y abre el correo/GitHub del usuario | Nada que mantener ni que declarar en privacidad | Sin capturas; depende de que el usuario tenga correo/cuenta |

### Recomendación

- **Si ya vas a activar Firebase para la sincronización → A**, solo texto (sin captura) al inicio. Es lo más barato de integrar y las reglas viven en el repo.
- **Si quieres capturas y una bandeja cómoda sin gastar → B** (Apps Script + Sheets + Drive).
- **Si quieres seguimiento tipo tickets y no te importa que sea público → C.**
- Mientras tanto, G ya está en pantalla: la Ayuda enlaza a *New issue* de GitHub en lugar del formulario.

## 4. Pasos para conectarlo (cuando se elija)

1. **Elegir destino** (sección 3) y crear la cuenta/proyecto/script.
2. **Implementar el receptor** con las reglas de la sección 2 (validar de nuevo, re-codificar, anti-bot, rate limit).
3. **Crear `src/sugerencias/enviar.ts`**: una función `enviarSugerencia(datos, adjunto)` que haga el POST (o escriba en Firestore) y devuelva éxito o un error legible. Con timeout y sin reintentos automáticos.
4. **Conectar el formulario**: en `enviar()` de `FormularioSugerencias` (`Sugerencias.tsx`), llamar a esa función, mostrar estado «Enviando…», un `toast` de éxito y limpiar los campos; en error, conservar lo escrito. Agregar el *honeypot*.
5. **Configuración**: definir `VITE_SUGERENCIAS_URL` (y la clave pública del anti-bot) como variable del repositorio y pasarla en el paso `build` de `.github/workflows/deploy.yml`, igual que las de Firebase. Documentarla en `.env.example` y en el README.
6. **Si el destino es Firestore** (A): agregar a `firestore.rules` una regla `match /sugerencias/{id} { allow create: if <validar tipos y largos>; allow read, update, delete: if false; }` y activar App Check.
7. **Privacidad y términos**: actualizar `public/privacidad.html` (qué se recoge, dónde se guarda, cuánto tiempo, quién lo ve, terceros si los hay) y `public/terminos.html`. Esto es **obligatorio antes de activar**: hoy la privacidad dice que no hay recolección.
8. **Retención**: decidir cuánto se guardan los mensajes (p. ej. 12 meses) y cómo se borran a pedido de quien los envió.

## 5. Pruebas

- Ya hay tests de `validar.ts` (tamaño, tipos, firma de bytes, ejecutable disfrazado, mensaje y correo).
- Al conectar: probar con un archivo de 2 MB + 1 byte, un `.exe` renombrado a `.png`, un SVG con `<script>`, una imagen con metadatos EXIF, un envío con el *honeypot* lleno y 20 envíos seguidos para comprobar el rate limit. Cada uno debe rechazarse **en el receptor**, no solo en el navegador.
- Comprobar en móvil y con teclado (el formulario usa etiquetas, `aria-invalid` y `role="alert"` para los errores).

## 6. Fuera de alcance por ahora

Respuestas desde la app, cuentas de usuario para el formulario, adjuntos que no sean imágenes y un panel de administración propio.
