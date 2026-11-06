# Plan de rediseño del planner académico

Fecha: 6 de noviembre de 2026. Estado: dirección visual aprobada (wireframe v2); etapas 1, 2 y 3 implementadas. Ver «Avance de la implementación» al final.

## Objetivo y criterio de diseño

Ayudar al estudiante a decidir qué necesita hacer, realizarlo y entender el resultado sin recorrer herramientas que no corresponden a su tarea. Conservar la capacidad académica actual y reorganizar su acceso.

Lectura del diseño: herramienta académica para estudiantes, con lenguaje tranquilo, legible y predecible, apoyada en componentes de producto accesibles y en los tokens existentes.

- DESIGN_VARIANCE: 3. La ubicación estable de controles importa más que la sorpresa visual.
- MOTION_INTENSITY: 2. Transiciones breves para confirmar acciones y cambios de estado.
- VISUAL_DENSITY: 4. Resúmenes sencillos, con detalle accesible cuando se necesita.
- Modalidad: rediseño de arquitectura y presentación, conservando datos, reglas académicas e identidad reconocible.
- Base: React, Tailwind 4, componentes propios y Lucide ya instalados. No se propone migrar el sistema de componentes para cambiar la apariencia. Revisar los componentes interactivos existentes antes de decidir si necesitan una biblioteca accesible.

La skill design-taste-frontend se usa para auditoría, identidad, coherencia y contraste. Sus composiciones de landing, imágenes decorativas y restricciones de tablas no corresponden a esta aplicación.

## Auditoría inicial basada en código

Esta revisión comprende README, Shell, tokens CSS, navegación, vistas principales y componentes de notas. No es una auditoría visual en navegador ni una investigación con usuarios. Las fricciones siguientes son hipótesis fundamentadas en la estructura, pendientes de comprobar en un prototipo.

| Hallazgo actual | Consecuencia probable | Decisión propuesta |
| --- | --- | --- |
| Seis destinos en la barra inferior, incluyendo Ayuda | Todos compiten por espacio y prioridad en móvil | Menú lateral completo y cuatro accesos inferiores |
| Notas tiene Registro y Planificación; existe otra Planificación global | El mismo nombre describe dos tareas distintas | Separar Notas, Simulaciones y Plan de carrera |
| Inicio contiene checklist, resumen, situación académica, ramos, evaluaciones y avisos | La acción cotidiana puede quedar desplazada | Priorizar próximas evaluaciones y registro de notas; resumir el resto |
| Exportar calendario está dentro de Más herramientas de Notas | La tarea temporal carece de destino propio | Agenda independiente sobre las evaluaciones existentes |
| Simulador de PPA y ventana del semestre comparten un desplegable | Agrupación de tareas sin una intención común | Simulador a Simulaciones; ventana a datos del periodo |
| Datos personales académicos aparecen antes de la malla | Configuración ocasional compite con exploración habitual | Configuración académica separada, con acceso contextual |
| Planificación presenta punto de partida y preferencias antes del plan | El usuario recurrente recorre configuración antes del resultado | Abrir el plan y ofrecer preferencias en una pestaña local |
| Pie extenso repite navegación en cada vista | Aumenta longitud sin ayudar a la tarea principal | Pie compacto con enlaces legales y ayuda |

Identidad actual: Plus Jakarta Sans y JetBrains Mono, violeta #5B47F0 en claro y #8E80FF en oscuro, neutros fríos, tarjetas redondeadas, marca Notas con birrete y degradado violeta. Conservar nombre y logo durante esta propuesta. Radios actuales aproximados: campos 10px, navegación 12px, tarjetas 18px. Lectura orientativa actual de los diales: 3 / 2 / 6; la densidad es una inferencia del contenido, no una medición visual.

Fortalezas que se deben conservar: temas claro/oscuro/sistema, foco visible, enlace para saltar al contenido, movimiento reducido, campos táctiles de 44px, búsqueda por comando, deshacer, carga diferida, funcionamiento local, sincronización opcional, importación con revisión y alternativa Mover a… al arrastre.

Referencias de implementación: src/ui/Shell.tsx, src/store/ui.ts, src/index.css, src/views/Inicio.tsx, src/views/Notas.tsx, src/views/Malla.tsx, src/views/Planificacion.tsx, src/views/Estadisticas.tsx y src/views/Cuenta.tsx.

Navegación actual mediante hashes: #inicio, #malla, #notas, #planificacion, #estadisticas y #ayuda. Preservar entradas existentes al reorganizar. Hay título dinámico y descripción general en index.html; no se obtuvieron datos de posicionamiento ni analítica. No modificar textos legales ni marca. Los nuevos nombres de navegación son propuestas explícitas de este documento.

## Intenciones de uso

La frecuencia es una hipótesis a validar, no un dato de uso medido.

| Momento | Pregunta del estudiante | Resultado útil |
| --- | --- | --- |
| Primera visita | ¿Cómo incorporo lo que ya cursé? | Avance importado o cargado manualmente, revisado |
| Durante el semestre | ¿Qué viene y qué nota obtuve? | Próxima evaluación localizada o nota guardada |
| Antes de una evaluación | ¿Qué necesito para aprobar? | Cálculo entendible con supuestos visibles |
| Inscripción | ¿Qué puedo tomar y cómo afecta mi egreso? | Plan viable, revisado y guardado |
| Revisión académica | ¿Cómo voy y qué debo atender? | Tendencia y situación explicadas, con próxima acción |
| Cambio de dispositivo | ¿Dónde están mis datos? | Respaldo o sincronización con estado claro |

## Arquitectura propuesta

Los destinos principales son páginas independientes. Las pestañas locales subdividen una misma tarea. No crear una pestaña por cada botón ni ocultar funciones importantes bajo un único menú genérico.

```text
Día a día
  Inicio
  Notas
  Agenda

Mi carrera
  Mi malla
  Plan de carrera
  Simulaciones
  Estadísticas

Utilidades
  Configuración
  Ayuda
  Mi cuenta y sincronización
```

La navegación global mantiene un solo nivel. Los grupos sirven para localizar, sin añadir submenús desplegables. En escritorio, lateral persistente de aproximadamente 240px; modo compacto opcional con nombres accesibles. Destino activo identificado por fondo, texto y aria-current, no solo color.

En móvil, barra inferior con Inicio, Notas, Agenda y Menú. Menú abre el lateral con los mismos grupos y nombres. Si se visita Mi malla o Plan de carrera, el encabezado conserva el título y el lateral identifica el destino exacto. La barra no debe fingir que Inicio sigue activo.

Cambiar de sección debe conservar periodo, filtros y borradores pertinentes durante la sesión. Atrás debe volver al contexto previo, incluido el ramo, posición de lista o evaluación. La implementación actual remonta vistas al navegar; esta conservación requiere trabajo explícito. Las subrutas futuras deben ser compatibles con los hashes anteriores.

## Flujos por sección

| Sección | Entrada y primera vista | Flujo principal y salida | Detalle avanzado | Adaptación móvil |
| --- | --- | --- | --- | --- |
| Inicio | Resumen del semestre, siguiente evaluación y aviso relevante si existe | Abrir evaluación o Registrar nota, completar y volver con resultado actualizado | Resumen de PPA/avance enlaza a Estadísticas; situación enlaza a su detalle | Una columna; próxima acción primero, métricas después |
| Notas | Periodo actual y lista compacta de ramos con promedio y pendientes | Elegir ramo, Registrar nota, validar, guardar, ver promedio actualizado y Deshacer | En el detalle del ramo: Evaluaciones, Reglas y Meta; plantillas, pesos, examen, asistencia, décimas, cierre y reapertura | Lista de ramos; detalle ocupa pantalla; teclado decimal sin tapar Guardar |
| Agenda | Próximas evaluaciones en orden de fecha | Abrir evaluación, editar fecha/nombre o registrar resultado; volver a la misma fecha | Lista/Mes como vistas, filtro por ramo y exportación ICS | Lista por defecto; selector de fecha; nunca una cuadrícula mensual encogida como única opción |
| Mi malla | Avance y filtros, sin configuración personal arriba | Buscar ramo, abrir detalle, entender requisitos, cambiar estado explícitamente | Ruta crítica, prerrequisitos/desbloqueos, notas, convalidación y marcado masivo | Lista agrupada por semestre por defecto; vista de mapa opcional en contenedor propio |
| Plan de carrera | Plan guardado si existe; propuesta si no existe | Revisar carga y requisitos, mover ramo, entender conflicto, guardar plan | Pestañas Plan / Preferencias / Alternativas; estrategias, prácticas, tope de créditos, intercambios y PDF | Semestres en lista vertical; Mover a… como acción principal, arrastre opcional |
| Simulaciones | Elección visible entre Notas de un ramo y PPA | Elegir origen real o ejemplo vacío, cambiar supuestos, comparar resultado, restablecer | Meta por ramo, objetivo de PPA y modos actual/peor caso donde correspondan | Campos y resultado en una columna; resultado cercano a la edición |
| Estadísticas | PPA y evolución como resumen | Elegir periodo, consultar tendencia, abrir explicación o volver al registro del ramo | Pestañas Evolución / Créditos / Áreas y notas; gráfico y tabla equivalentes | Gráficos con etiquetas legibles; detalle debajo, no dependiente del hover |
| Configuración | Pestañas Datos académicos / Importar y respaldar / Apariencia | Modificar dato o revisar importación antes de aplicar, recibir confirmación | Semestre, inglés, congelaciones, ventana del periodo, asistente y restauración | Formularios de una columna; acciones destructivas separadas |
| Ayuda | Temas por tarea y búsqueda o índice corto | Elegir pregunta, leer explicación contextual, volver a la tarea | Reglas, cálculos, atajos, sugerencias y reporte de error | Acordeones con encabezados completos; formularios sin modal anidado |
| Mi cuenta | Estado local o sincronizado y última operación conocida | Conectar si se desea, revisar conflicto y elegir datos conscientemente | Resolución de conflictos; enlace a respaldos en Configuración | Pantalla completa; comparación de versiones apilada |

### Inicio sin datos

Ofrecer Importar avance y Configurar manualmente. La cuenta no es requisito. Importación: elegir reporte, procesar localmente, revisar cambios y advertencias, aplicar y mostrar resumen. Configuración manual: establecer contexto mínimo, marcar avance y ramos en curso, llegar a Inicio. Permitir retomar después sin bloquear navegación.

### Guardar una nota

Inicio o Notas > Registrar nota > ramo y evaluación preseleccionados cuando hay contexto > valor > Guardar > promedio y pendientes actualizados. Si falta configurar evaluaciones, ofrecer una plantilla y volver al registro. No obligar a recorrer reglas avanzadas en cada ingreso. Un error conserva el valor y explica cómo corregirlo. Quitar valor mantiene la evaluación pendiente; eliminar evaluación es otra acción.

### Simular sin confundir con registros

Usar el título persistente Simulación y la explicación «Estos cambios no modifican tus notas». Ningún cálculo simulado actualiza notas reales, PPA real, avance o alertas reales. Conservar el borrador durante la navegación de la sesión; no prometer persistencia tras recargar hasta implementarla. No incorporar un botón genérico Aplicar a mis notas.

### Planificar sin perder el plan vigente

Separar plan guardado, propuesta y cambios sin guardar. Modificar preferencias no sustituye silenciosamente el plan guardado. Mostrar qué cambió y permitir guardar o descartar. Ante requisitos incumplidos, explicar el ramo y requisito implicados; ofrecer movimientos válidos. Si cambió el avance desde el guardado, advertir y permitir revisar antes de reemplazar.

### Riesgo académico

No usar alarmas visuales permanentes cuando no hay riesgo. Si existe un aviso relevante, mantenerlo visible en Inicio y en el ramo implicado. Presentar estado, causa, datos usados y acción posible. El detalle de causales y permanencias se conserva en Estadísticas, dentro de Evolución > Situación académica. Los textos y cálculos reglamentarios se mantienen; este trabajo no los reinterpreta.

## Compartimentación sin pérdida de funciones

| Función existente | Destino propuesto |
| --- | --- |
| Ponderaciones, pesos relativos, requisitos por categoría, examen y eximición | Notas > ramo > Reglas |
| Plantillas y copiar estructura de otro ramo | Notas > ramo > Reglas |
| Registro, quitar valor, décimas, cerrar y reabrir | Notas > ramo > Evaluaciones |
| Periodos históricos, verano y convalidaciones | Notas > selector y gestión de periodos |
| Puntaje a nota | Herramienta contextual al registrar; acceso secundario en Notas |
| Simulación de notas y de PPA | Simulaciones, con destinos locales distintos |
| Metas | Meta del ramo en Notas; proyección de PPA en Simulaciones |
| Fechas y exportación ICS | Agenda; la evaluación sigue siendo la misma entidad de Notas |
| Estados de malla, marcado rápido/masivo y convalidaciones | Mi malla; modo de edición explícito y Deshacer |
| Ruta crítica y egreso estimado | Mi malla y Plan de carrera; resumen en Inicio |
| Seis estrategias, validaciones, prácticas, intercambios y plan guardado | Plan de carrera |
| Evolución PPA, créditos, áreas, distribución y tabla accesible | Estadísticas |
| Causales, permanencias y riesgo por ramo | Estadísticas con resumen en Inicio y contexto en Notas |
| PDF de notas y PDF de plan | Menú de exportación de cada sección correspondiente |
| Semestre, inglés eximido, congelaciones y ventana | Configuración > Datos académicos |
| Importación UDP, respaldo, restauración y reinicio | Configuración > Importar y respaldar |
| Cuenta, sincronización y conflictos | Mi cuenta |
| Deshacer, búsqueda y uso sin conexión | Capacidades globales, conservadas |

Agenda reorganiza datos existentes. No incluye tareas genéricas, horario de clases ni integración bidireccional con calendarios externos en este alcance.

## Sistema visual propuesto

Mantener la identidad violeta, reduciendo saturación y superficies coloreadas. Neutros fríos coherentes; color intenso reservado para acción principal, selección y foco. El color no garantiza confort por sí solo: importan luminancia, legibilidad, densidad, contexto y preferencias personales.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| Fondo | #F6F7FB | #10131C | Lienzo |
| Superficie | #FCFCFE | #151824 | Formularios y contenido |
| Superficie secundaria | #EEF0F6 | #1E2332 | Agrupación discreta |
| Texto principal | #202436 | #ECEEF5 | Contenido |
| Texto secundario | #586174 | #B0B8CC | Ayuda y metadatos |
| Acento | #5846C7 | #B5A7F5 | Acción, selección y foco |
| Texto sobre acento | #FCFCFE | #151824 | Botón principal |

Contrastes calculados con luminancia relativa sRGB: texto principal sobre fondo claro 14,35:1; secundario sobre superficie clara 6,07:1; botón claro 6,58:1; texto principal sobre superficie oscura 15,25:1; secundario oscuro 8,90:1; botón oscuro 8,26:1. Son pares base, no certificación de todas las variantes. Hover, disabled, focos, bordes y transparencias se validarán en el prototipo.

Conservar familias semánticas verde, ámbar y rojo para éxito, atención y error, siempre con texto o icono. El rojo no debe indicar simplemente una ruta crítica. Las categorías académicas pueden tener colores diferentes del acento, pero no deben competir coloreando toda la tarjeta. Validar distinción bajo simulación de deficiencias de visión del color; el comentario actual del CSS no sustituye una comprobación.

Conservar Plus Jakarta Sans para continuidad. Texto habitual 16px, auxiliar 14px, títulos de página 24-28px en escritorio y 20-24px en móvil. Cifras tabulares para promedios; evitar bloques enteros en monospace. Alojar fuentes localmente al implementar para favorecer estabilidad y uso sin conexión.

Escala de espaciado: 4, 8, 12, 16, 24 y 32px. Radios documentados: controles 10px, contenedores 16px, etiquetas de estado con forma de píldora solo cuando aporta agrupación. Sombras discretas en capas flotantes; contenido ordinario agrupado principalmente por títulos, espacio y separadores.

Principios: proximidad para reunir dato y acción, jerarquía para destacar la tarea principal, consistencia para facilitar reconocimiento, divulgación progresiva para reglas ocasionales. Los controles frecuentes permanecen visibles; las funciones avanzadas tienen nombres concretos y un destino estable.

## Comportamiento responsive

- Desde 1024px: lateral persistente, contenido de hasta 1400px, encabezado compacto y panel de detalle cuando haya ancho suficiente.
- De 768 a 1023px: lateral en cajón, contenido de una o dos columnas según tarea, sin forzar la navegación de escritorio.
- Menos de 768px: una columna, márgenes laterales de 16px y barra inferior de cuatro destinos. El menú lateral ocupa hasta 320px sin exceder el viewport.
- El cajón bloquea interacción de fondo, contiene el foco, cierra con Escape y devuelve el foco al disparador. Al elegir destino, cierra y enfoca el título principal.
- Formularios complejos a pantalla completa en móvil; no apilar modales. Acciones de guardado visibles sin ocultar campos al abrir el teclado.
- Objetivo de producto: áreas táctiles de al menos 44x44px y separación suficiente. No confundir este objetivo con el mínimo AA de 24px y sus excepciones.
- No depender de hover, arrastre ni gestos sin alternativa visible. Detalles de prerrequisitos accesibles por toque y teclado.
- Ningún desplazamiento horizontal del documento a 320px. Mapas/tablas que requieran dos dimensiones deben tener contenedor propio y alternativa legible en lista o tabla adaptada.
- Respetar safe areas, ampliación de texto, orientación horizontal y movimiento reducido. Validar ambos temas en todas las secciones.

## Estados y confianza

Cada destino contempla carga, vacío, resultados filtrados vacíos y error. Diferenciar «sin notas» de «sin resultados» y de «no se pudo cargar». Un cero no sustituye un dato desconocido.

Mostrar guardado local y sincronización como estados distintos. No decir «sincronizado» si solo se guardó en el dispositivo. Mantener edición y acceso local sin cuenta. Las operaciones destructivas requieren descripción concreta y confirmación; acciones reversibles ofrecen Deshacer. Los errores de formulario van junto al campo y preservan el contenido.

## Secuencia de ejecución

1. Inventario y referencia visual: capturar las vistas actuales en escritorio/móvil y ambos temas con datos de prueba. Confirmar que cada función de la tabla de conservación tiene un destino. No usar datos personales reales para material de diseño.
2. Wireframes navegables: resolver primero Inicio, registro de nota y menú móvil; después malla, plan, simulaciones y configuración. Validar nombres y encontrar tareas antes de pulir colores.
3. Sistema visual: tokens, tipografía, controles, selección, focos, estados y superficies; revisar claro/oscuro y contraste real.
4. Navegación: shell, lateral, barra móvil, destinos y compatibilidad de hashes, conservación de contexto y botón Atrás.
5. Reorganización de vistas: extraer Agenda y Simulaciones, separar configuración y redistribuir detalle. Reutilizar cálculos existentes y mantener una sola fuente de datos.
6. Validación: pruebas de tareas, accesibilidad manual/automática, regresión académica, importación, guardado, sincronización y PWA. Corregir antes de reemplazar el diseño actual.

No introducir cambios de reglas académicas ni migraciones de datos como efecto secundario del rediseño. Si una nueva necesidad exige persistencia adicional, documentar esquema y compatibilidad por separado.

## Criterios de aceptación

- Un estudiante localiza Registrar nota, próxima evaluación, requisitos de un ramo y plan guardado sin explicación previa. Evaluar con tareas concretas y registrar errores, retrocesos y tiempo; no atribuir mejoras sin comparar una línea base.
- Registrar una nota desde un ramo preseleccionado no obliga a abrir configuración avanzada.
- Simular nunca altera notas, avance ni PPA reales; cambiar de sección conserva el borrador de sesión según lo diseñado.
- Cada función actual tiene un acceso comprobado en la matriz de conservación.
- Un movimiento inválido del plan muestra motivo y alternativa; guardar es explícito y el plan anterior no desaparece silenciosamente.
- Volver desde un detalle mantiene periodo, filtros y contexto; los hashes existentes siguen abriendo destinos útiles.
- Revisar 320, 375, 390, 768, 1024 y 1440px, zoom de texto al 200%, reflow equivalente a 320px y teclado virtual en móvil real.
- Texto normal con contraste mínimo 4,5:1, texto grande 3:1 y componentes/indicadores necesarios 3:1; comprobar foco visible y no oculto por barras fijas.
- Recorrer todas las tareas por teclado y probar lectura de nombres/estados con lector de pantalla. Probar malla y plan sin arrastre.
- Al implementar, ejecutar npm test y npm run build; ampliar pruebas solo para navegación, estado y comportamiento nuevos. Medir rendimiento con Lighthouse y dispositivos representativos; objetivos orientativos LCP <2,5s, INP <200ms y CLS <0,1, sin confundir laboratorio con datos reales.

## Aspectos por validar con estudiantes

¿Es más frecuente registrar notas o consultar fechas? ¿Se entiende Simulaciones sin ayuda? ¿Plan de carrera expresa mejor la intención que Planificación? ¿Qué detalle del ramo se consulta primero? Estas preguntas ajustan prioridad y lenguaje; no impiden preparar wireframes con la hipótesis actual.

## Fuentes

- W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C, contraste mínimo: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum
- Nielsen Norman Group, divulgación progresiva: https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group, reconocimiento frente a recuerdo: https://www.nngroup.com/articles/recognition-and-recall/

Las fuentes fundamentan criterios generales. La arquitectura y la paleta son propuestas específicas para este planner y requieren validación de uso.

## Avance de la implementación

**Dirección visual elegida:** `docs/wireframes/planner-wireframes-v2.html`. La v1 se descartó por verse como plantilla: cajas con borde en todas partes, barra superior vacía y etiquetas en mayúsculas. La v2 conserva el flujo y cambia el lenguaje visual:

- Superficies sin borde marcado, con sombra suave y radios de 22 a 28px; fondo con un leve tinte violeta.
- Tarjeta destacada con el degradado de marca (`--hero`) para la próxima evaluación.
- Ramos con color por tipo (paleta categórica existente), iniciales, barra de % evaluado y promedio grande.
- Botones y selección en forma de píldora; los grupos de navegación van en minúsculas.
- Barra inferior flotante en el celular y avisos como píldora oscura con Deshacer.

**Etapa 1, hecha:**

- Tokens (`src/index.css`): fondo, superficies, sombras, `--hero`, `.card` y `.hero`. Botones en píldora (`primitives.tsx`).
- Shell (`src/ui/Shell.tsx`): lateral flotante agrupado (Día a día / Mi carrera / Utilidades) y encabezado con el semestre y el estado de guardado. En el celular, barra con Inicio, Notas, Malla y Menú; Menú abre un cajón modal con los mismos grupos. Fuera de la barra, ningún acceso queda marcado como activo y Menú anuncia la sección actual. El pie quedó compacto. Planificación se llama «Plan de carrera» en la navegación y el hash `#planificacion` no cambia.
- Inicio: tarjeta destacada (próxima evaluación con Registrar nota preseleccionado; si no hay fechas, el registro general; sin datos, Importar avance / Marcar a mano), una franja con avance, PPA y egreso, y «Mis ramos» con acceso directo al registro. El registro se abre sin salir de Inicio y vuelve ahí al guardar.
- Registro de nota: chips para ramo (hasta 8) y evaluación (hasta 10), con lista desplegable cuando hay más. Campo de nota grande y una vista previa del promedio, calculada sobre una copia con las reglas reales del ramo, que avisa si la nota aún no cuenta por falta de porcentaje.
- Deshacer de los avisos (P0 de `revision-flujos.md`): cada aviso queda ligado a su cambio (`accionDeshacer` en `src/store/app.ts`). Si después hubo otro cambio, no revierte el equivocado y remite al Deshacer del encabezado. Tiene test.

**Etapa 2, hecha:**

- Destinos nuevos con hash propio (`#agenda`, `#simulaciones`, `#configuracion`); los hashes anteriores siguen funcionando. Navegación: Día a día (Inicio, Notas, Agenda), Mi carrera (Mi malla, Plan de carrera, Simulaciones, Estadísticas) y Utilidades (Configuración, Ayuda). La barra móvil pasa a Inicio, Notas, Agenda y Menú.
- Agenda: las mismas evaluaciones de Notas ordenadas por fecha. Grupos «Sin nota todavía» (fecha vencida), «Próximos 7 días», «Más adelante» y, opcionalmente, «Registradas». Tiene filtro por ramo y exportación .ics. Tocar una evaluación abre el registro con ella elegida. Avisa cuántas pendientes no tienen fecha y, sin fechas, explica cómo agregarlas.
- Simulaciones: pestañas «Notas de un ramo» (el antiguo modo Planificación de Notas) y «PPA y meta» (el simulador que estaba en un desplegable de Notas). Lleva el aviso permanente «Estos cambios no modifican tus notas…». El borrador y la pestaña se conservan al cambiar de sección y se descartan al recargar.
- Configuración: pestañas Datos académicos (semestre, inglés, congelaciones, asistente y borrar progreso; antes en Mi malla), Importar y respaldar (importación UDP, respaldo y borrado del dispositivo, compartido con Mi cuenta) y Apariencia (tema y barra compacta). Mi malla muestra un resumen con enlace a Configuración.
- Notas queda solo con el registro: sin selector de modo ni desplegable del simulador. La ventana de inscripción va junto al selector de periodo y «Exportar calendario» se reemplazó por «Ver agenda».
- Componente `Pestanas` accesible (roles tab/tabpanel, flechas, Inicio/Fin).
- Tests: auditoría de accesibilidad de las 9 vistas, una prueba de Agenda (lista y abre el registro preseleccionado) y el borrador de Simulaciones al navegar.

**Etapa 3, hecha:**

- Agenda: vistas Lista (por defecto) y Mes, con cuadrícula de lunes a domingo, navegación entre meses y marcas por día (vencida sin nota, pendiente, registrada). Al tocar un día se listan sus evaluaciones. Vista, mes y filtros se conservan al cambiar de sección.
- Notas › ramo: pestañas Evaluaciones / Reglas / Meta.
  - Reglas resume porcentajes, requisitos, mínimos, examen, eximición y asistencia; incluye «Ver peor caso» y «Editar reglas», que abre el editor con plantillas y copia de otro ramo.
  - Meta es un campo directo con lo que necesitas; reemplaza al diálogo.
  - Décimas, cierre, reapertura y quitar el ramo siguen en el pie y el menú.
- Notas recuerda el periodo y la búsqueda al volver desde otra sección.
- Plan de carrera: pestañas Plan / Preferencias / Alternativas. El plan guardado y el recomendado van primero, con un resumen y un enlace a Preferencias. Punto de partida, créditos y práctica pasan a Preferencias, y las alternativas con la misma duración tienen pestaña propia. La pestaña elegida se conserva.
- Pasada visual: los recuadros con borde de Situación académica, Ayuda, Importar, Wizard, editor de evaluaciones, Plan y avisos pasan a superficies suaves. Selectores segmentados en píldora y etiquetas sin mayúsculas. Los menús emergentes y tooltips conservan su borde para separarse del fondo.
- Tests: pestañas del ramo (reglas y meta guardada), vista Mes y Preferencias del plan con auditoría axe. Sin desbordamiento horizontal a 375px en las 9 secciones.

**Pendiente:** validar con estudiantes y en un teléfono real (teclado virtual, lector de pantalla, texto ampliado al 200%) y medir rendimiento con Lighthouse en dispositivos representativos. Son verificaciones fuera del navegador de desarrollo; no hay funciones del plan sin destino.
