import { BookOpen, Briefcase, Calculator, CalendarDays, ChevronDown, CircleCheck, CircleX, FileUp, Keyboard, Lightbulb, MessageSquare, Route, ShieldCheck, Sparkles } from "lucide-react";
import { nombreRamo, siglaRamo } from "../core/academic";
import { useCtx } from "../store/app";
import { Kbd } from "../ui/comun";
import { Aviso, cx } from "../ui/primitives";
import { Sugerencias } from "./ayuda/Sugerencias";

function Seccion({ id, icono, titulo, children, abierta }: { id?: string; icono: React.ReactNode; titulo: string; children: React.ReactNode; abierta?: boolean }) {
  return (
    <details id={id} open={abierta} className="card group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent [&>svg]:size-[18px]">{icono}</span>
        <span className="flex-1 text-[15px] font-bold">{titulo}</span>
        <ChevronDown className="size-5 text-fg-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-line px-5 py-4 text-[13.5px] leading-relaxed text-fg-2 [&_strong]:text-fg">{children}</div>
    </details>
  );
}

function Causales({ items }: { items: [string, string][] }) {
  return (
    <ol className="space-y-2">
      {items.map(([l, t]) => (
        <li key={l} className="flex gap-2.5">
          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-surface-3 text-[12px] font-bold text-fg uppercase">{l}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

export function Ayuda() {
  const ctx = useCtx();
  const practicas = ctx.cur.ramos.filter((r) => r.reglaPractica);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = mac ? "⌘" : "Ctrl";

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav className="hidden lg:block" aria-label="Contenido de la ayuda">
        <ul className="sticky top-24 space-y-1 text-[13px] font-semibold">
          {[
            ["#ayuda-como", "Cómo funciona"],
            ["#ayuda-reglas", "Reglas de tu carrera"],
            ["#ayuda-datos", "Entiende tus datos"],
            ["#ayuda-herramientas", "Herramientas extra"],
            ["#ayuda-atajos", "Atajos de teclado"],
            ["#ayuda-sugerencias", "Dudas y sugerencias"],
            ["#ayuda-sobre", "Sobre la app"],
          ].map(([h, t]) => (
            <li key={h}>
              <a
                href={h}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.querySelector<HTMLDetailsElement>(h);
                  if (el) {
                    el.open = true;
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="block rounded-lg px-3 py-1.5 text-fg-2 hover:bg-surface-2 hover:text-fg"
              >
                {t}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-3">
        <Seccion id="ayuda-como" icono={<BookOpen />} titulo="Cómo funciona" abierta>
          <ol className="space-y-2.5">
            {[
              ["Completa tus datos.", "El asistente pregunta en qué semestre vas, si tienes inglés eximido y si congelaste. Los cambias cuando quieras en Mi malla › Tus datos."],
              ["Marca tu malla.", "Usa «Marcar semestres completos» y luego desmarca lo que debes. Marca como Cursando los ramos de este semestre."],
              ["Revisa tu plan.", "En Planificación ya tienes un plan recomendado. Ajusta tus créditos y la práctica, arrastra ramos y presiona «Quedarme con este plan»."],
              ["Registra tus notas.", "En Notas, el semestre en curso ya existe con tus ramos. Al registrar la nota final, el ramo pasa a aprobado en la malla."],
              ["Cierra el semestre.", "Cuando todos tus ramos tengan nota final, Inicio te ofrece pasar al semestre siguiente y el plan se recalcula."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-accent-fg">{i + 1}</span>
                <span>
                  <strong>{t}</strong> {d}
                </span>
              </li>
            ))}
          </ol>
        </Seccion>

        <Seccion id="ayuda-importar" icono={<FileUp />} titulo="Importar mi avance desde la UDP">
          <p>
            En vez de marcar la malla a mano, sube un reporte de la UDP desde <strong>Mi malla › Importar desde la UDP</strong>. Los archivos se leen en tu navegador; no se envían a ningún servidor.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Rápido · Avance curricular (PDF):</strong> marca tus ramos aprobados e inscritos y el nombre de tus cursos de Formación General. No trae notas ni el semestre en que aprobaste, así que el PPA queda vacío.
            </li>
            <li>
              <strong>Avanzado · Trabajo académico del estudiante (Excel):</strong> importa todo: cada ramo en su semestre con su nota, repeticiones, semestres especiales, congelaciones e inglés eximido. No tienes que agregar nada a mano.
            </li>
            <li>
              Puedes subir <strong>los dos a la vez</strong>: el PDF completa los nombres de Formación General y la app avisa si algo no cuadra entre ambos.
            </li>
          </ul>
          <p>
            Antes de importar ves un resumen (aprobados, PPA, semestre) y puedes deshacerlo después con <Kbd>Ctrl Z</Kbd>. Si tu historial cambia, vuelve a importar: se conservan las evaluaciones que ya cargaste en los mismos ramos y semestres.
          </p>
        </Seccion>

        <Seccion id="ayuda-reglas" icono={<ShieldCheck />} titulo={`Reglas de tu carrera · ${ctx.cur.malla.siglaUniversidad ?? ""}`}>
          {practicas.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-bold text-fg">
                <Briefcase className="size-4 text-accent" /> Prácticas profesionales
              </p>
              {practicas.map((r) => (
                <div key={r.id} className="rounded-xl border border-line p-3">
                  <p className="font-semibold text-fg">
                    {siglaRamo(ctx, r.id)} — {nombreRamo(ctx, r.id)}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>
                      Debes tener aprobado <strong>todo hasta el semestre {r.reglaPractica!.hastaSemestre}</strong>, incluido inglés, no solo los requisitos directos.
                    </li>
                    <li>
                      Puedes deber <strong>{(r.reglaPractica!.maxDeuda ?? 1) === 1 ? "un ramo" : `${r.reglaPractica!.maxDeuda} ramos`}</strong> y cursarlo en paralelo
                      {r.reglaPractica!.sinDeuda?.length ? (
                        <>
                          , excepto <strong>{r.reglaPractica!.sinDeuda.map((id) => nombreRamo(ctx, id)).join(", ")}</strong>
                        </>
                      ) : null}
                      .
                    </li>
                    <li>Si repruebas el ramo que debías, la práctica también queda reprobada.</li>
                  </ul>
                </div>
              ))}
              <p>En Planificación eliges si la práctica cuenta en tu carga, va en sobrecupo, en un {(ctx.cur.malla.periodoVerano ?? "verano").toLowerCase()} o fuera del plan.</p>
            </div>
          )}
          <div className="space-y-2">
            <p className="font-bold text-fg">Causales de eliminación (Reglamento de Pregrado UDP, art. 38)</p>
            <Causales
              items={[
                ["a", "Reprobar por segunda vez tres o más asignaturas del plan de estudios."],
                ["b", "Reprobar una misma asignatura del plan de estudios tres o más veces."],
                ["c", "Reprobar más del 50% de las asignaturas cursadas en un año académico (los dos últimos semestres efectivamente realizados)."],
              ]}
            />
            <p>
              <strong className="text-fg">Antes de caer.</strong> Con las notas parciales que registras, la app te dice qué ramos en curso te dejarían en causal si los repruebas (por ejemplo, uno que ya reprobaste dos veces), cómo vas en cada uno y cuánto necesitas en lo que queda para aprobar. También te muestra cuántos ramos puedes reprobar este semestre sin superar el 50% de la causal c.
            </p>
            <Aviso tono="info" icono={<ShieldCheck />}>
              Si caíste en causal y la UDP aceptó tu permanencia, regístralo en Inicio › Tu situación académica. Las reprobaciones no se borran: con la a ya cumplida, cada nueva segunda reprobación te deja otra vez en causal, y con la b, cada nueva tercera reprobación de un ramo. Si la causal fue la c, el semestre siguiente efectivamente cursado no se evalúa por ella. La apelación a la Comisión Especial de Gracia de la Vicerrectoría Académica es solo para la primera vez que caes en causal (art. 40).
            </Aviso>
          </div>
          <Aviso tono="acento" icono={<Lightbulb />}>
            Mientras más completo esté tu historial en Notas, más precisos son estos cálculos. Son una orientación: la decisión oficial siempre la toma tu universidad.
          </Aviso>
        </Seccion>

        <Seccion id="ayuda-datos" icono={<Calculator />} titulo="Entiende tus datos">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["Créditos inscritos", "Cada intento registrado (aprobado, reprobado o en curso). Un ramo repetido cuenta una vez por intento."],
              ["Créditos aprobados", "Intentos con nota final 4,0 o más, y ramos marcados como aprobados en la malla."],
              ["Créditos reprobados", "Cada intento cerrado con nota bajo 4,0."],
              ["Créditos de avance", "Los aprobados que avanzan tu malla: no repiten ramos. Es el % de Inicio."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl bg-surface-2 p-3">
                <p className="font-bold text-fg">{t}</p>
                <p className="text-[13px]">{d}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="font-bold text-fg">¿Cómo se calcula el PPA?</p>
            <p className="my-2 rounded-lg bg-surface-2 px-3 py-2 text-center font-mono text-[13px] text-fg">PPA = Σ (nota final × créditos) ÷ Σ créditos con nota final</p>
            <ul className="space-y-1">
              <li className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" /> Entran las notas finales aprobadas y reprobadas; cada intento cuenta.</li>
              <li className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" /> Las décimas se suman a la nota final, con un máximo de 7,0.</li>
              <li className="flex gap-2"><CircleX className="mt-0.5 size-4 shrink-0 text-fg-3" /> Ramos sin nota final, de 0 créditos o marcados rápido no modifican el PPA.</li>
            </ul>
            <p className="mt-2 text-[13px]">Ejemplo: 5,0 en un ramo de 6 créditos y 6,0 en uno de 7 → (5,0×6 + 6,0×7) ÷ 13 = <strong>5,538</strong>.</p>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="font-bold text-fg">Nota de un ramo: actual, peor caso y lo que necesitas</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong>Promedio de categoría:</strong> cada nota pesa según su factor ×. Un factor 0 la elimina (ej. se borra la peor prueba).</li>
              <li><strong>Actual:</strong> promedia solo lo rendido, reescalado al % evaluado.</li>
              <li><strong>Peor caso:</strong> todo lo pendiente cuenta como 1,0. Si igual da 4,0, ya aprobaste.</li>
              <li><strong>Lo que necesitas:</strong> (3,95 − lo asegurado) ÷ % que falta. Si las categorías aún no suman 100%, lo no definido también cuenta como pendiente.</li>
              <li><strong>Requisito (✱):</strong> la categoría debe promediar 4,0 por sí sola, aunque el promedio general apruebe.</li>
              <li><strong>Examen (birrete):</strong> lo demás forma tu nota de presentación. Sus % pueden ser de la presentación (suman 100% y esa nota vale, por ejemplo, 70% del ramo) o del ramo (suman 70% y se normalizan). Si el ramo exime y tu presentación alcanza la nota de eximición (ej. 5,0, redondeada a una décima) con la asistencia exigida, tu nota final es la de presentación y no rindes examen.</li>
              <li><strong>Mínimos:</strong> cada categoría puede exigir un promedio o una nota mínima en cada evaluación para eximirse (ej. tareas ≥ 5,5 y cada tarea ≥ 4,0), y un promedio para dar examen (ej. tareas ≥ 4,0). También puedes exigir una nota de presentación mínima para dar examen (ej. 3,5). Sin derecho a examen, se reprueba el ramo.</li>
              <li>Se aprueba con <strong>3,95</strong>, que se redondea a 4,0.</li>
            </ul>
          </div>
          <Aviso tono="warn" icono={<ShieldCheck />}>
            La planificación considera prerrequisitos, tu tope de créditos, prácticas y congelaciones. No puede garantizar horarios, cupos, topes ni que un ramo se dicte: confírmalo con tu universidad antes de inscribir.
          </Aviso>
        </Seccion>

        <Seccion id="ayuda-herramientas" icono={<Sparkles />} titulo="Herramientas extra">
          <ul className="space-y-2.5">
            {[
              [<Route key="r" className="size-4 text-danger" />, "Ruta crítica", "La cadena de prerrequisitos más larga que te queda (método CPM). Te dice el mínimo de semestres para titularte y qué ramos no puedes atrasar."],
              [<CalendarDays key="c" className="size-4 text-accent" />, "Calendario de evaluaciones", "Pon fecha a cada evaluación (botón ··· de la nota), míralas en Inicio y expórtalas a Google Calendar con recordatorio un día antes."],
              [<Calculator key="e" className="size-4 text-accent" />, "Escala de notas", "Convierte puntaje en nota con cualquier exigencia y úsalo directo en una casilla."],
              [<Lightbulb key="m" className="size-4 text-warn" />, "Metas", "Define la nota que quieres en un ramo o el PPA con que quieres egresar, y te decimos cuánto necesitas."],
              [<Sparkles key="p" className="size-4 text-accent" />, "Plantillas", "Arma la estructura de evaluación de un ramo con un clic (cátedra + laboratorio, solemnes + examen…)."],
            ].map(([i, t, d]) => (
              <li key={t as string} className="flex gap-3">
                <span className="mt-0.5">{i}</span>
                <span>
                  <strong>{t}:</strong> {d}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion id="ayuda-atajos" icono={<Keyboard />} titulo="Atajos de teclado">
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              [`${mod} K`, "Buscar un ramo o una acción"],
              [`${mod} Z`, "Deshacer el último cambio"],
              ["Enter", "Guardar una nota y salir de la casilla"],
              ["Esc", "Cancelar la edición o cerrar un menú"],
            ].map(([k, d]) => (
              <li key={k} className={cx("flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2")}>
                <span>{d}</span>
                <Kbd>{k}</Kbd>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion id="ayuda-sugerencias" icono={<MessageSquare />} titulo="Dudas y sugerencias">
          <Sugerencias />
        </Seccion>

        <Seccion id="ayuda-sobre" icono={<Sparkles />} titulo="Sobre la app">
          <p>
            <strong>Notas</strong> es un planner académico hecho por y para estudiantes de <strong>{ctx.cur.malla.carrera}</strong> ({ctx.cur.malla.siglaUniversidad ?? ctx.cur.malla.universidad}): malla interactiva, notas con ponderaciones, simulador de PPA, planificación de semestres y estadísticas. La malla, las prácticas y las causales siguen las reglas de esa carrera.
          </p>
          <p>
            <strong>Tus datos son tuyos:</strong> todo se guarda en tu navegador. Si activas la sincronización con Google, se guarda una copia en tu cuenta. Exporta un respaldo de vez en cuando desde Mi cuenta.
          </p>
          <p>
            Es un proyecto independiente, no oficial de la universidad. El código está en{" "}
            <a className="font-semibold text-accent hover:underline" href="https://github.com/NuggetNuclear/plan-academico" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            .
          </p>
        </Seccion>
      </div>
    </div>
  );
}
