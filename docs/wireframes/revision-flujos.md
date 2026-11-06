# Revisión de flujos de los wireframes

6 de noviembre de 2026. Material de revisión previo a implementar. Basado en `docs/plan-rediseno-ux.md`, `Inicio.tsx`, `Notas.tsx`, `RegistroNota.tsx`, `EditorEvaluacion.tsx`, `RamoCard.tsx` y el estado de UI/aplicación. No sustituye una prueba con estudiantes ni acredita accesibilidad en la aplicación final.

## Prioridades de revisión

- **P0 · Registro inequívoco.** Mostrar periodo, ramo y evaluación antes de Guardar; conservar la selección al llegar desde Inicio o Agenda. El registro general debe permitir cambiar ramo sin atribuir el valor anterior a otra evaluación silenciosamente.
- **P0 · Resultado académico honesto.** Guardar una evaluación actualiza pendientes y el promedio parcial correspondiente. No equivale a cerrar el ramo ni a incorporar una nota final al PPA. Etiquetar el promedio y su base, sin mostrar pendientes como cero.
- **P0 · Deshacer correcto.** El aviso debe revertir la operación anunciada. El código actual llama a una pila global desde cada aviso: si hay otra edición posterior, un aviso antiguo puede revertir otra operación. Antes de implementar, elegir operación identificada o caducar el aviso anterior; el wireframe no debe prometer una garantía inexistente.
- **P1 · Regreso y borradores.** Atrás recupera origen, periodo, filtros y posición; al salir a otra sección, el borrador de sesión se recupera explícitamente. No prometer recuperación después de recargar.
- **P1 · Navegación móvil exacta.** En Mi malla, Plan de carrera u otro destino del cajón, Inicio no permanece seleccionado. Menú conserva su nombre de acción; el título y el destino del cajón identifican la página.
- **P1 · Guardado y alerta compatibles.** Una alerta académica no reemplaza la confirmación de guardado: indicar ambos estados y ofrecer detalle persistente en Inicio/ramo. Guardado local y sincronización son estados distintos.

## Datos de ejemplo

Rotular el prototipo «Datos ficticios de demostración». No cargar datos locales reales ni nombres de estudiantes. Usar estos valores exclusivamente para comprobar coherencia entre pantallas:

| Dato ficticio | Antes | Después de guardar | Después de deshacer |
| --- | --- | --- | --- |
| Ramo | Cálculo I · ejemplo | Igual | Igual |
| Periodo | Semestre actual · ejemplo | Igual | Igual |
| Solemne 1 · 30% | 5,0 | 5,0 | 5,0 |
| Solemne 2 · 30% | Pendiente | 6,0 | Pendiente |
| Trabajo · 40% | Pendiente | Pendiente | Pendiente |
| Promedio sobre lo registrado | 5,0 · 30% evaluado | 5,5 · 60% evaluado | 5,0 · 30% evaluado |
| Evaluaciones pendientes | 2 | 1 | 2 |

El 5,5 resulta de `(5 × 30 + 6 × 30) / 60`. Este ejemplo no tiene examen, requisitos especiales ni cierre de ramo; no se extrapola a otros esquemas. Fechas, siglas y métricas adicionales del prototipo deben identificarse también como ficticias.

## Lista de comprobación del recorrido

- [ ] Inicio prioriza la próxima evaluación y Registrar nota; sin datos ofrece Importar avance / Configurar manualmente, con navegación disponible y sin exigir cuenta.
- [ ] Registrar desde una evaluación preselecciona sus identificadores; desde un acceso general permite escoger ramo y evaluación de manera visible.
- [ ] Nota acepta coma o punto y explica rango 1,0 a 7,0. El error aparece junto al campo, conserva el texto y permite corregirlo.
- [ ] Guardar confirma evaluación y valor, muestra promedio parcial y pendientes coherentes, ofrece Deshacer y devuelve al origen. Una nota no aparece duplicada en Agenda y Notas.
- [ ] Quitar valor deja evaluación y fecha pendientes; Eliminar evaluación tiene nombre distinto, consecuencias explícitas y recuperación coherente. No competir con Guardar en la tarea habitual.
- [ ] Si falta estructura, ofrecer plantilla o registro simple. El código permite guardar una nota sin porcentaje: explicar que aún no cuenta y enlazar a configurar su ponderación.
- [ ] Puntaje a nota permanece contextual, sin un segundo modal. Usar nota incorpora el cálculo al campo; guardar sigue siendo una acción explícita.
- [ ] Reglas, plantillas/copia, pesos, examen, eximición y asistencia tienen destino concreto en Notas > ramo > Reglas. Meta tiene acceso propio. Décimas, cierre y reapertura permanecen en Evaluaciones, fuera del ingreso habitual.
- [ ] Un ramo cerrado muestra su estado y Reabrir; no se presenta como evaluación editable ni se reabre al guardar silenciosamente.
- [ ] Simulaciones mantiene título y advertencia «Estos cambios no modifican tus notas»; no ofrece Aplicar a mis notas. Plan distingue propuesta, cambios y plan guardado.
- [ ] Menú móvil muestra los mismos nombres y grupos que escritorio; selección cierra el cajón y lleva al título. Escape, fondo y cierre explícito permiten salir devolviendo foco al disparador.
- [ ] Cajón limita foco y bloquea el fondo. Barra inferior de cuatro destinos y avisos no cubren campos, foco ni Guardar; contemplar teclado y safe area.
- [ ] Todos los controles tienen nombre y estado comprensibles, foco visible y objetivo táctil de 44px; nada depende solo de color, hover o arrastre.
- [ ] Las acciones de secciones secundarias abren un destino o declaran su condición de demostración. Un panel con un enlace esbozado no equivale a función implementada.

## Escenarios de aceptación

| Escenario | Acción de revisión | Resultado observable esperado |
| --- | --- | --- |
| A · Tarea cotidiana | Inicio > Solemne 2 > Registrar nota; ingresar `6,0`; guardar | Periodo/ramo/evaluación ya seleccionados; vuelve a Inicio; 5,5 sobre 60% evaluado, 1 pendiente y confirmación con Deshacer. No exige abrir Reglas ni cambia PPA por cierre. |
| B · Corrección | Ingresar `8,5`; guardar; corregir a `6.0` | El primer intento conserva `8,5` y señala el rango junto al campo; el segundo guarda 6,0 una sola vez. |
| C · Revertir | Tras A, activar Deshacer | Solemne 2 vuelve a Pendiente, 2 pendientes y promedio 5,0 sobre 30%; mensaje de reversión; ninguna evaluación se elimina. |
| D · Dos operaciones | Guardar nota A, realizar otra edición B y activar el aviso anterior | A se revierte de forma identificada o el aviso anterior ya no permite ejecutarse. Nunca se anuncia «nota A deshecha» mientras se revierte B. |
| E · Regreso contextual | En Notas elegir periodo anterior, filtrar y abrir un ramo; ir a Reglas y volver; navegar a Agenda y usar Atrás | Vuelve al periodo, filtro, ramo y posición previos; no salta al periodo actual ni a Inicio. |
| F · Borrador de sesión | Escribir nota sin guardar, navegar a otra sección y regresar | Encuentra borrador rotulado, mismo contexto y valor. Guardar lo aplica; Cancelar/descartar es explícito. Recargar no se presenta como recuperación garantizada. |
| G · Sin evaluaciones | Abrir registro de ramo sin estructura; revisar plantilla y registro simple | Puede volver al ingreso conservando contexto; si omite peso, se confirma «guardada; aún no cuenta» y se ofrece configurar ponderación. No mostrar promedio ficticio. |
| H · Quitar o eliminar | En evaluación guardada, elegir Quitar valor; repetir con Eliminar evaluación | La primera conserva entidad/fecha; la segunda explica eliminación. Deshacer restaura exactamente el cambio correspondiente. |
| I · Menú móvil | A 375px abrir Menú, elegir Mi malla; abrir de nuevo y cerrar con Escape | Cajón legible, sin interacción de fondo; título Mi malla; destino exacto activo dentro del cajón; Inicio inactivo; cierre devuelve foco. |
| J · Teclado móvil | A 320/390px abrir registro, enfocar nota y abrir puntaje | Se puede leer error, editar y alcanzar Guardar con teclado abierto; sin desplazamiento horizontal del documento, modal anidado ni barra sobre el campo. Comprobar después en dispositivo real. |
| K · Alertas y confianza | Guardar una nota que dispara aviso académico con datos de prueba | Confirmación de guardado local más causa y enlace al detalle; alerta sigue visible en Inicio/ramo; no afirmar sincronización sin evidencia. No inventar reglas para el ejemplo. |
| L · Funciones avanzadas | Desde el ramo localizar Reglas, Meta y cierre; ir a Simulaciones y cambiar un supuesto | Destinos con nombres concretos; el registro rápido permanece sencillo. La simulación conserva su borrador de sesión y no modifica registros reales. |

## Puerta de revisión

Registrar para cada escenario: completado, error observado y cambio necesario. Los casos A a D son prioritarios antes de pulir color. Validar después navegación y foco a 320, 375, 390, 768, 1024 y 1440px, ambos temas, texto ampliado y teclado real. Los controles o estados no reproducidos por un wireframe deben marcarse pendientes; no atribuirles una validación realizada.
