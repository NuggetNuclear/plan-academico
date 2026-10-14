# Notas · Planner académico

Malla interactiva, notas con ponderaciones, simulador de PPA, planificación de semestres y estadísticas para estudiantes de **Ingeniería Civil en Informática y Telecomunicaciones (UDP)**.

## Funciones

**Base**

- **Inicio:** avance de la carrera (créditos válidos), PPA acumulado con tendencia, semestres que faltan, situación académica (causales de eliminación UDP art. 38 a 40: cuánto te falta para cada una, qué ramos en curso te dejarían en causal y cuánto necesitas para aprobarlos, y registro de permanencias aceptadas), ramos del semestre, avisos (prácticas y ramos en riesgo) y lista de próximos pasos.
- **Mi malla:** estados aprobado / cursando / puedo tomar / bloqueado, menú por ramo (aprobado con semestre o convalidado, cursando, desmarcar), marcado rápido, marcar semestres completos, resaltado de prerrequisitos y de lo que desbloquea, búsqueda y filtros, notas en la malla, inglés eximido y congelaciones.
- **Notas:** periodos regulares, de verano/TAV y convalidaciones; categorías con %, notas con peso relativo (×), categorías con requisito de 4,0, examen con nota de presentación y eximición (nota y asistencia), modo *actual* o *peor caso*, nota necesaria, nota final con décimas, reabrir, ventana por semestre, simulador de PPA y exportación a PDF.
- **Planificación:** seis estrategias que se filtran por las que terminan en el mínimo de semestres, ramos críticos primero, tope de créditos, reglas de práctica (dentro de la carga, sobrecupo, verano o fuera del plan), arrastrar y soltar con validación, ajustes sugeridos (intercambios), guardar el plan y PDF.
- **Estadísticas:** PPA, créditos inscritos/aprobados/reprobados/de avance, evolución del PPA (gráfico o tabla), aprobación de créditos por semestre, rendimiento por tipo de ramo y distribución de notas por ramo o por evaluación.
- **Asistente de inicio, modo oscuro, exportar/importar, sincronización opcional con Google.**
- **Ayuda:** cómo funciona, reglas de la carrera (prácticas y causales), cómo se calcula cada dato y enlace para reportar errores o ideas en los [issues de GitHub](https://github.com/NuggetNuclear/plan-academico/issues).

**Herramientas avanzadas**

- **Ruta crítica (CPM):** la cadena de prerrequisitos más larga que te queda; dice el mínimo real de semestres y qué ramos no puedes atrasar. Se ve en la malla y en la planificación.
- **Egreso estimado** en semestre calendario (ej. «2.º semestre 2029»).
- **Calendario de evaluaciones:** fecha y nombre por evaluación, «Próximas evaluaciones» en Inicio y exportación `.ics` (Google Calendar, Apple, Outlook) con recordatorio un día antes.
- **Escala de notas:** puntaje → nota con cualquier exigencia, como herramienta y dentro de cada casilla.
- **Metas:** nota objetivo por ramo y PPA objetivo de egreso, con lo que necesitas en lo que queda.
- **Plantillas de evaluación** (cátedra + laboratorio, solemnes + examen, proyecto…).
- **Ramos en riesgo** en Avisos (requisito perdido, ya no alcanza, necesitas más de 5,5).
- **Deshacer** cualquier cambio (`Ctrl/⌘ Z` o el botón del encabezado).
- **Paleta de comandos** (`Ctrl/⌘ K`): busca ramos y acciones.
- **Celular de verdad:** barra inferior, arrastrar con toque largo y botón «Mover a…» en cada ramo del plan.
- **PWA:** instalable y funciona sin conexión.
- **Importar desde la UDP:** sube el *Avance curricular* (PDF) para marcar tu malla en segundos, o el *Trabajo académico del estudiante* (Excel) para importar todo (notas por semestre, repeticiones, verano, congelaciones, inglés eximido y PPA). Se procesa en el navegador; ver `src/importar/`.

## Reglas académicas implementadas

Toda la lógica vive en `src/core/` y está cubierta por tests:

- Se aprueba con **3,95** (redondea a 4,0). El PPA pondera por créditos e incluye reprobados; las décimas se suman con tope 7,0.
- Nota de un ramo: Σ promedio de categoría × %; en cada categoría las casillas pendientes cuentan como 1,0 en el peor caso y un factor 0 elimina una nota.
- Prácticas UDP: todo aprobado hasta cierto semestre, se puede deber un ramo (que no esté en `sinDeuda`) y se cursa en paralelo.
- El planificador es voraz: calcula el mínimo de semestres (créditos, tope de ramos y profundidad de la cadena de prerrequisitos) y llena cada semestre poniendo primero los ramos críticos.
- **Nota necesaria:** se calcula como `(3,95 − lo asegurado) ÷ fracción pendiente`, y las categorías que aún no suman 100% cuentan como pendientes. Hay un test que lo cubre.
- En el peor caso, las categorías sin casillas también cuentan como 1,0.
- **Examen y eximición:** si una categoría es el examen, las demás forman la nota de presentación (NP). Sus % pueden escribirse sobre la presentación (suman 100%) o sobre el ramo (suman 100% − examen, y se normalizan). Con NP ≥ nota de eximición (redondeada a una décima) y la asistencia exigida, la nota final es NP; si no, NF = NP × (1 − %examen) + examen × %examen. Cada categoría puede exigir mínimos para eximirse (promedio y/o cada nota) y para dar examen (promedio), y se puede exigir una NP mínima para dar examen; sin derecho a examen, el ramo queda reprobado.

## Stack

- [Vite 7](https://vite.dev) + React 19 + TypeScript (estricto)
- Tailwind CSS 4 con tokens propios (claro/oscuro) y paleta categórica validada para daltonismo
- Zustand (estado + deshacer), dnd-kit (arrastrar y soltar con mouse, teclado y toque), lucide-react (íconos)
- Gráficos en SVG propio, sin librerías de charts
- Vitest para la lógica

```
src/
  core/        Lógica pura y testeada: malla, notas, PPA, créditos, reglamentos, planificador, calendario
  store/       Estado (zustand), mutaciones, persistencia y respaldos
  importar/    Lectores de los reportes de la UDP (PDF y Excel), armado y aplicación del plan de importación
  views/       Inicio, Mi malla, Notas, Planificación, Estadísticas, Ayuda, asistente y cuenta
  ui/          Componentes base, diálogos, popovers, paleta de comandos y el shell
  sync/        Sincronización opcional con Firebase (se carga desde el CDN solo si está configurada)
public/
  carreras/    inf.json: la malla de la carrera
  sw.js        Service worker (modo sin conexión)
```

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de la lógica
npm run build      # typecheck + build de producción en dist/
```

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy.yml` corre los tests, construye y publica en cada push a `main`. En el repositorio: **Settings › Pages › Source: GitHub Actions**. El build usa rutas relativas, así que funciona en `usuario.github.io/plan-academico/`.

## La malla

La malla vive en `public/carreras/inf.json`. Para corregir un ramo, sus créditos o sus prerrequisitos, edita ese archivo:

```jsonc
{
  "id": "inf",
  "carrera": "Ingeniería Civil en Informática y Telecomunicaciones",
  "universidad": "Universidad Diego Portales",
  "siglaUniversidad": "UDP",
  "periodoVerano": "Semestre de verano",
  "maxCreditosSemestre": 36,
  "semestresObjetivo": 11,
  "nivelesIngles": ["CIG-1012", "CIG-1013", "CIG-1014"],
  "tipos": { "PC": "Plan común", "FI": "Formación ingeniería" },
  "ramos": [
    { "id": "CBM-1001", "nombre": "Cálculo I", "creditos": 7, "semestre": 1, "req": [], "tipo": "PC" },
    { "id": "CIT-4000", "nombre": "Práctica Profesional I", "creditos": 7, "semestre": 5, "req": [], "tipo": "ELEC",
      "reglaPractica": { "hastaSemestre": 4, "maxDeuda": 1 } }
  ]
}
```

   Campos opcionales por ramo: `sigla`, `equivalentes` (otros códigos con que los reportes de la UDP informan el ramo), `reglaPractica` y `aviso`.

La app está hecha solo para esta carrera: las causales, las prácticas, el importador de reportes y los respaldos asumen la UDP y `inf.json`. Agregar otra carrera no es solo agregar un JSON.

## Dudas y sugerencias

El formulario de **Ayuda › Dudas y sugerencias** ya está construido y validado (`src/views/ayuda/Sugerencias.tsx`, `src/sugerencias/`), pero todavía **no envía nada** y solo se muestra si existe `VITE_SUGERENCIAS_URL`. Mientras tanto, la Ayuda enlaza a los issues de GitHub. El plan para conectarlo está en [`docs/plan-formulario-sugerencias.md`](docs/plan-formulario-sugerencias.md).

## Sincronización con Google (opcional)

1. Crea un proyecto en [Firebase](https://console.firebase.google.com), activa **Authentication › Google** y **Firestore**.
2. Publica las reglas de `firestore.rules` (cada persona solo accede a `usuarios/{su uid}`).
3. Copia `.env.example` a `.env.local` con la configuración de tu app web, o defínelas como *Variables* del repositorio para el workflow.
4. Agrega tu dominio de GitHub Pages en **Authentication › Settings › Authorized domains**.

Sin esas variables, el botón de Google aparece desactivado y todo sigue funcionando en el navegador.

## Aviso

Es una herramienta de orientación. La planificación no garantiza horarios, cupos ni que un ramo se dicte, y las causales académicas son una estimación con lo que registras. Confirma siempre con tu universidad.
