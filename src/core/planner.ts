import { aprobadosSet, ramosSemestreActual, type Ctx } from "./academic";
import { cumpleRequisitos, evaluarReglaPractica, profundidades, type Curriculum } from "./curriculum";
import type { PlanGuardado, TipoSemestrePlan } from "./state";
import type { Ramo } from "./types";

export interface SemestrePlan {
  numero: number;
  tipo: TipoSemestrePlan;
  ramos: Ramo[];
  /** Créditos que ocupan el tope (la práctica en sobrecupo no cuenta). */
  creditos: number;
}

interface Intercambio {
  ramo1: string;
  sem1: number;
  ramo2: string;
  sem2: number;
}

export interface Plan {
  etiqueta: string;
  descripcion: string;
  maxRamos: number;
  semestres: SemestrePlan[];
  semestresRestantes: number;
  creditosPorSemestre: number;
  creditosMaximos: number;
  intercambios: Intercambio[];
}

type Estrategia = "semestre" | "desbloqueo" | "equilibrado";
type Flex = "flex_last" | "flex_first" | "ingles_first";
type Curva = "pareja" | "creciente" | "decreciente";

const esFlexible = (r: Ramo) => r.tipo === "CFG" || r.tipo === "TIN";
const esIngles = (cur: Curriculum, r: Ramo) => (cur.malla.nivelesIngles ?? []).includes(r.id);

export const esPracticaSobrecupo = (ctx: Ctx, r: Ramo) => !!r.reglaPractica && ctx.st.modoPractica === "sobrecupo";

function creditosCarga(ctx: Ctx, lista: Ramo[]): number {
  return lista.reduce((s, r) => s + (esPracticaSobrecupo(ctx, r) ? 0 : r.creditos), 0);
}

export function creditosSobrecupo(ctx: Ctx, lista: Ramo[]): number {
  return lista.reduce((s, r) => s + (esPracticaSobrecupo(ctx, r) ? r.creditos : 0), 0);
}

export function maxCreditos(ctx: Ctx): number {
  return Math.min(ctx.st.maxCreditos ?? ctx.cur.maxCreditosSemestre, ctx.cur.maxCreditosSemestre);
}

/** Lo que se cursa en paralelo: una práctica arrastra el ramo adeudado. */
function ramosEnParalelo(ramo: Ramo, completados: Set<string>): string[] {
  return ramo.reglaPractica ? evaluarReglaPractica(ramo, completados).deuda : [];
}

export function idsPendientes(ctx: Ctx): Set<string> {
  const apr = aprobadosSet(ctx);
  const cursando = new Set(ctx.st.cursando);
  return new Set(
    ctx.cur.ramos
      .filter((r) => !apr.has(r.id) && !cursando.has(r.id))
      .map((r) => r.id),
  );
}

/**
 * Arma un plan semestre a semestre (algoritmo voraz con ramos críticos primero).
 * El objetivo es el mínimo de semestres posible: el mayor entre lo que exigen
 * los créditos, el tope de ramos y la cadena de prerrequisitos más larga.
 */
function generarPlan(ctx: Ctx, maxCred: number, maxRamos: number, estrategia: Estrategia, flex: Flex, curva: Curva = "pareja"): SemestrePlan[] {
  const { cur, st } = ctx;
  const map = cur.map;
  const semestres: SemestrePlan[] = [];
  let numSem = st.semestreActual + 1;
  const modo = st.modoPractica;
  const pendientes = idsPendientes(ctx);

  const actuales = ramosSemestreActual(ctx);
  if (actuales.length > 0) semestres.push({ numero: st.semestreActual, ramos: actuales, creditos: creditosCarga(ctx, actuales), tipo: "cursando" });
  // Si aún no inscribes ramos este semestre, el plan parte desde el semestre actual.
  else numSem = st.semestreActual;

  const completados = new Set([...aprobadosSet(ctx), ...st.cursando]);

  if (modo === "quitar") {
    [...pendientes].forEach((id) => {
      if (!map[id]?.reglaPractica) return;
      pendientes.delete(id);
      completados.add(id);
    });
  }
  const practicasVerano = new Set(modo === "verano" ? [...pendientes].filter((id) => map[id]?.reglaPractica) : []);
  let prioridadDeuda = new Set<string>();

  const ubicarPracticasVerano = (numeroPrevio: number) => {
    practicasVerano.forEach((id) => {
      if (!pendientes.has(id)) return;
      const ramo = map[id];
      const ev = evaluarReglaPractica(ramo, completados);
      if (!ev.ok || ev.deuda.some((d) => practicasVerano.has(d))) return;
      semestres.push({ numero: numeroPrevio, ramos: [ramo], creditos: ramo.creditos, tipo: "verano" });
      pendientes.delete(id);
      completados.add(id);
      ev.deuda.forEach((d) => prioridadDeuda.add(d));
    });
  };
  ubicarPracticasVerano(st.semestreActual);

  const profundidad = profundidades(cur, pendientes);
  let credPend = 0;
  pendientes.forEach((id) => {
    const r = map[id];
    if (!practicasVerano.has(id) && !esPracticaSobrecupo(ctx, r)) credPend += r.creditos;
  });

  const minPorCreditos = Math.ceil(credPend / maxCred);
  const minPorRamos = Math.ceil((pendientes.size - practicasVerano.size) / maxRamos);
  let minPorCadena = 0;
  pendientes.forEach((id) => (minPorCadena = Math.max(minPorCadena, profundidad[id] || 1)));
  const objetivo = Math.max(1, minPorCreditos, minPorRamos, minPorCadena);

  let creados = 0;
  let iter = 0;
  const conCarga = (lista: Ramo[]) => lista.filter((r) => creditosCarga(ctx, [r]) > 0).length;

  while (pendientes.size > 0 && iter < 40) {
    if ([...pendientes].every((id) => practicasVerano.has(id))) break;
    iter++;
    const restantes = Math.max(1, objetivo - creados);
    let objetivoCred = maxCred;
    if (curva !== "pareja" && objetivo > 1) {
      const avance = creados / (objetivo - 1);
      const factor = curva === "creciente" ? 0.65 + 0.35 * avance : 1 - 0.35 * avance;
      objetivoCred = Math.min(maxCred, Math.round((objetivoCred * factor) / 5) * 5);
    }
    // Piso: aliviar la carga nunca puede sumar un semestre que no era necesario.
    objetivoCred = Math.max(objetivoCred, Math.min(maxCred, Math.ceil(credPend / restantes / 5) * 5));

    const disponibles: Ramo[] = [];
    pendientes.forEach((id) => {
      const r = map[id];
      if (!r || practicasVerano.has(id)) return;
      if (!r.req.every((x) => completados.has(x))) return;
      if (!evaluarReglaPractica(r, completados).ok) return;
      const paralelosOk = ramosEnParalelo(r, completados).every((cid) => {
        if (completados.has(cid)) return true;
        const co = map[cid];
        return !!co && pendientes.has(cid) && co.req.every((x) => completados.has(x));
      });
      if (paralelosOk) disponibles.push(r);
    });

    if (disponibles.length === 0) {
      numSem++;
      continue;
    }

    const esCritico = (r: Ramo) => prioridadDeuda.has(r.id) || (profundidad[r.id] || 1) >= restantes;
    const criticos = disponibles.filter(esCritico);
    const resto = disponibles.filter((r) => !esCritico(r));
    criticos.sort(
      (a, b) =>
        (prioridadDeuda.has(b.id) ? 1 : 0) - (prioridadDeuda.has(a.id) ? 1 : 0) || (profundidad[b.id] || 0) - (profundidad[a.id] || 0),
    );
    ordenarPorEstrategia(cur, resto, estrategia, flex);

    const semRamos: Ramo[] = [];
    const idsSem = new Set<string>();
    let credSem = 0;

    const bloqueConParalelos = (ramo: Ramo): Ramo[] | null => {
      const bloque: Ramo[] = [];
      const visitados = new Set<string>();
      const agregar = (c: Ramo): boolean => {
        if (completados.has(c.id) || idsSem.has(c.id) || visitados.has(c.id)) return true;
        visitados.add(c.id);
        if (!pendientes.has(c.id)) return false;
        if (!c.req.every((x) => completados.has(x))) return false;
        if (!evaluarReglaPractica(c, completados).ok) return false;
        bloque.push(c);
        return ramosEnParalelo(c, completados).every((cid) => completados.has(cid) || idsSem.has(cid) || (!!map[cid] && agregar(map[cid])));
      };
      return agregar(ramo) ? bloque : null;
    };

    const intentarAgregar = (ramo: Ramo, limite: number): boolean => {
      if (idsSem.has(ramo.id)) return true;
      const bloque = bloqueConParalelos(ramo);
      if (!bloque) return false;
      const nuevos = bloque.filter((c) => !idsSem.has(c.id));
      if (conCarga(semRamos) + conCarga(nuevos) > maxRamos) return false;
      const cr = creditosCarga(ctx, nuevos);
      if (credSem + cr > limite) return false;
      nuevos.forEach((c) => {
        semRamos.push(c);
        idsSem.add(c.id);
        credSem += creditosCarga(ctx, [c]);
      });
      return true;
    };

    const lleno = (r: Ramo) => conCarga(semRamos) >= maxRamos && creditosCarga(ctx, [r]) > 0;
    for (const r of criticos) if (!lleno(r)) intentarAgregar(r, maxCred);
    for (const r of resto) if (!lleno(r)) intentarAgregar(r, objetivoCred);
    if (semRamos.length === 0) for (const r of [...criticos, ...resto]) if (intentarAgregar(r, maxCred)) break;
    if (semRamos.length === 0) {
      numSem++;
      continue;
    }

    semestres.push({ numero: numSem, ramos: semRamos, creditos: credSem, tipo: "futuro" });
    semRamos.forEach((r) => {
      pendientes.delete(r.id);
      completados.add(r.id);
      credPend -= creditosCarga(ctx, [r]);
    });
    prioridadDeuda = new Set([...prioridadDeuda].filter((id) => pendientes.has(id)));
    ubicarPracticasVerano(numSem);
    creados++;
    numSem++;
  }

  if (pendientes.size > 0) {
    const resto = [...pendientes].map((id) => map[id]).filter(Boolean);
    if (resto.length) semestres.push({ numero: numSem, ramos: resto, creditos: resto.reduce((s, r) => s + r.creditos, 0), tipo: "overflow" });
  }
  return semestres;
}

function ordenarPorEstrategia(cur: Curriculum, lista: Ramo[], est: Estrategia, flex: Flex) {
  const peso = cur.peso;
  lista.sort((a, b) => {
    if (est === "desbloqueo") {
      const d = (peso[b.id] || 0) - (peso[a.id] || 0);
      if (d) return d;
    } else if (est === "semestre") {
      if (a.semestre !== b.semestre) return a.semestre - b.semestre;
    } else {
      const sa = (peso[a.id] || 0) * 2 + (cur.semestresObjetivo - a.semestre);
      const sb = (peso[b.id] || 0) * 2 + (cur.semestresObjetivo - b.semestre);
      if (sa !== sb) return sb - sa;
    }
    if (flex === "flex_last" || flex === "flex_first") {
      const ta = esFlexible(a) ? 1 : 0;
      const tb = esFlexible(b) ? 1 : 0;
      if (ta !== tb) return flex === "flex_last" ? ta - tb : tb - ta;
    } else {
      const ta = esIngles(cur, a) ? 0 : 1;
      const tb = esIngles(cur, b) ? 0 : 1;
      if (ta !== tb) return ta - tb;
    }
    if (a.semestre !== b.semestre) return a.semestre - b.semestre;
    return (peso[b.id] || 0) - (peso[a.id] || 0);
  });
}

const CONFIGS: { est: Estrategia; flex: Flex; curva: Curva; menosRamos?: boolean; etiqueta: string; descripcion: string }[] = [
  { est: "semestre", flex: "flex_last", curva: "pareja", etiqueta: "Sigue el orden de la malla", descripcion: "Toma los ramos en el orden oficial, llenando cada semestre." },
  { est: "desbloqueo", flex: "flex_last", curva: "pareja", etiqueta: "Prioriza desbloquear ramos", descripcion: "Primero los ramos de los que dependen más cursos." },
  { est: "semestre", flex: "flex_first", curva: "creciente", etiqueta: "Empieza liviano", descripcion: "Carga menor al principio y mayor al final." },
  { est: "equilibrado", flex: "flex_last", curva: "decreciente", etiqueta: "Empieza fuerte", descripcion: "Carga mayor al principio para terminar más relajado." },
  { est: "semestre", flex: "ingles_first", curva: "pareja", etiqueta: "Adelanta inglés", descripcion: "Los niveles de inglés van lo antes posible." },
  { est: "desbloqueo", flex: "flex_last", curva: "pareja", menosRamos: true, etiqueta: "Menos ramos por semestre", descripcion: "Un ramo menos por semestre cuando es posible." },
];

function resumirPlan(ctx: Ctx, plan: Omit<Plan, "semestresRestantes" | "creditosPorSemestre" | "creditosMaximos" | "intercambios">): Plan {
  const semestres = plan.semestres.filter((s) => s.ramos.length > 0);
  semestres.forEach((s) => {
    s.creditos = s.tipo === "verano" ? s.ramos.reduce((t, r) => t + r.creditos, 0) : creditosCarga(ctx, s.ramos);
  });
  const futuros = semestres.filter((s) => s.tipo === "futuro");
  const tot = futuros.reduce((t, s) => t + s.creditos, 0);
  const completo = {
    ...plan,
    semestres,
    semestresRestantes: futuros.length,
    creditosPorSemestre: futuros.length ? Math.round(tot / futuros.length) : 0,
    creditosMaximos: futuros.reduce((m, s) => Math.max(m, s.creditos), 0),
    intercambios: [] as Intercambio[],
  };
  completo.intercambios = calcularIntercambios(ctx, completo);
  return completo;
}

/** Varias estrategias; se quedan solo las que terminan en el mínimo de semestres y no se repiten. */
export function generarPlanes(ctx: Ctx): Plan[] {
  const pendientes = idsPendientes(ctx);
  if (pendientes.size === 0) return [];
  const mc = maxCreditos(ctx);
  const creditos = [...pendientes].map((id) => ctx.cur.map[id]?.creditos ?? 0).filter((c) => c > 0);
  const tipico = creditos.length ? Math.min(...creditos) : 10;
  const mrMax = Math.max(3, Math.floor(mc / tipico));

  const planes = CONFIGS.map((cfg) => {
    const mr = cfg.menosRamos ? Math.max(3, mrMax - 1) : mrMax;
    return resumirPlan(ctx, {
      etiqueta: cfg.etiqueta,
      descripcion: cfg.descripcion,
      maxRamos: mr,
      semestres: generarPlan(ctx, mc, mr, cfg.est, cfg.flex, cfg.curva),
    });
  });

  const varianza = (p: Plan) => {
    const f = p.semestres.filter((s) => s.tipo === "futuro");
    if (!f.length) return 0;
    const avg = f.reduce((s, x) => s + x.creditos, 0) / f.length;
    return f.reduce((s, x) => s + (x.creditos - avg) ** 2, 0) / f.length;
  };
  const overflow = (p: Plan) => (p.semestres.some((s) => s.tipo === "overflow") ? 1 : 0);
  planes.sort((a, b) => overflow(a) - overflow(b) || a.semestresRestantes - b.semestresRestantes || varianza(a) - varianza(b));
  const mejor = planes[0].semestresRestantes;
  const unicos: Plan[] = [];
  planes
    .filter((p) => p.semestresRestantes === mejor && overflow(p) === overflow(planes[0]))
    .forEach((p) => !unicos.some((u) => planesEquivalentes(u, p)) && unicos.push(p));
  return unicos;
}

/** Equivalentes si casi todos los ramos caen en el mismo semestre (≤2 ramos u 8% de diferencia). */
function planesEquivalentes(a: Plan, b: Plan): boolean {
  const fa = a.semestres.filter((s) => s.tipo === "futuro");
  const fb = b.semestres.filter((s) => s.tipo === "futuro");
  if (fa.length !== fb.length) return false;
  const semA: Record<string, number> = {};
  const semB: Record<string, number> = {};
  fa.forEach((s) => s.ramos.forEach((r) => (semA[r.id] = s.numero)));
  fb.forEach((s) => s.ramos.forEach((r) => (semB[r.id] = s.numero)));
  const ids = Object.keys(semA);
  if (ids.length !== Object.keys(semB).length) return false;
  const distintos = ids.filter((id) => semA[id] !== semB[id]).length;
  return distintos <= Math.max(2, Math.round(ids.length * 0.08));
}

// ── Validaciones al editar un plan ──

const ordenSem = (s: SemestrePlan) => s.numero + (s.tipo === "verano" ? 0.5 : 0);

function baseCompletados(ctx: Ctx): Set<string> {
  const base = new Set([...aprobadosSet(ctx), ...ctx.st.cursando]);
  if (ctx.st.modoPractica === "quitar") ctx.cur.ramos.forEach((r) => r.reglaPractica && base.add(r.id));
  return base;
}

/** Cada práctica sigue cumpliendo su regla después de mover o intercambiar ramos. */
function planRespetaPracticas(ctx: Ctx, semestres: SemestrePlan[]): boolean {
  const base = baseCompletados(ctx);
  const periodos = semestres.filter((s) => s.tipo === "futuro" || s.tipo === "verano").sort((a, b) => ordenSem(a) - ordenSem(b));
  for (const p of periodos) {
    const antes = new Set(base);
    periodos.forEach((q) => ordenSem(q) < ordenSem(p) && q.ramos.forEach((r) => antes.add(r.id)));
    const mismo = new Set(p.ramos.map((r) => r.id));
    for (const r of p.ramos) {
      if (!r.reglaPractica) continue;
      const ev = evaluarReglaPractica(r, antes);
      if (!ev.ok) return false;
      if (p.tipo === "futuro" && !ev.deuda.every((id) => mismo.has(id))) return false;
    }
  }
  return true;
}

export function puedeMoverRamo(ctx: Ctx, plan: Plan, ramoId: string, origen: number, destino: number): boolean {
  if (origen === destino) return false;
  const ramo = ctx.cur.map[ramoId];
  const dest = plan.semestres.find((s) => s.numero === destino && s.tipo === "futuro");
  if (!ramo || !dest) return false;
  if (dest.creditos + creditosCarga(ctx, [ramo]) > maxCreditos(ctx)) return false;
  const antes = baseCompletados(ctx);
  plan.semestres.forEach((s) => {
    if ((s.tipo === "futuro" || s.tipo === "verano") && s.numero < destino) s.ramos.forEach((x) => x.id !== ramoId && antes.add(x.id));
  });
  const mismo = new Set(dest.ramos.map((x) => x.id));
  mismo.add(ramoId);
  if (!cumpleRequisitos(ramo, antes, mismo)) return false;
  const dependienteAntes = plan.semestres.some(
    (s) => s.tipo === "futuro" && s.numero <= destino && s.ramos.some((x) => x.id !== ramoId && x.req.includes(ramoId)),
  );
  if (dependienteAntes) return false;
  const simulado = plan.semestres.map((s) => ({
    ...s,
    ramos: s.tipo === "futuro" && s.numero === origen ? s.ramos.filter((x) => x.id !== ramoId) : s === dest ? [...s.ramos, ramo] : s.ramos,
  }));
  return planRespetaPracticas(ctx, simulado);
}

export function moverRamo(ctx: Ctx, plan: Plan, ramoId: string, origen: number, destino: number): Plan {
  const semestres = plan.semestres.map((s) => ({ ...s, ramos: [...s.ramos] }));
  const so = semestres.find((s) => s.numero === origen && s.tipo === "futuro");
  const sd = semestres.find((s) => s.numero === destino && s.tipo === "futuro");
  if (!so || !sd) return plan;
  const i = so.ramos.findIndex((r) => r.id === ramoId);
  if (i === -1) return plan;
  sd.ramos.push(...so.ramos.splice(i, 1));
  return resumirPlan(ctx, { ...plan, semestres });
}

export function intercambiar(ctx: Ctx, plan: Plan, sw: Intercambio): Plan {
  const semestres = plan.semestres.map((s) => ({ ...s, ramos: [...s.ramos] }));
  const s1 = semestres.find((s) => s.numero === sw.sem1 && s.tipo === "futuro");
  const s2 = semestres.find((s) => s.numero === sw.sem2 && s.tipo === "futuro");
  if (!s1 || !s2) return plan;
  const i1 = s1.ramos.findIndex((r) => r.id === sw.ramo1);
  const i2 = s2.ramos.findIndex((r) => r.id === sw.ramo2);
  if (i1 < 0 || i2 < 0) return plan;
  [s1.ramos[i1], s2.ramos[i2]] = [s2.ramos[i2], s1.ramos[i1]];
  return resumirPlan(ctx, { ...plan, semestres });
}

/** Intercambios de dos ramos entre semestres que respetan requisitos, créditos y oferta. */
function calcularIntercambios(ctx: Ctx, plan: Plan): Intercambio[] {
  const futuros = plan.semestres.filter((s) => s.tipo === "futuro");
  if (futuros.length < 2) return [];
  const semDe: Record<string, number> = {};
  futuros.forEach((s) => s.ramos.forEach((r) => (semDe[r.id] = s.numero)));
  const base = baseCompletados(ctx);
  const mc = maxCreditos(ctx);

  const completadosAntes = (n: number) => {
    const done = new Set(base);
    plan.semestres.forEach((s) => (s.tipo === "futuro" || s.tipo === "verano") && s.numero < n && s.ramos.forEach((r) => done.add(r.id)));
    return done;
  };
  const masTemprano = (id: string) => {
    const r = ctx.cur.map[id];
    for (const s of futuros) {
      if (cumpleRequisitos(r, completadosAntes(s.numero), new Set(s.ramos.map((x) => x.id)))) return s.numero;
    }
    return Infinity;
  };
  const masTardio = (id: string) => {
    const deps = (ctx.cur.desbloquea[id] ?? []).filter((d) => semDe[d] !== undefined);
    const minDep = deps.length ? Math.min(...deps.map((d) => semDe[d])) : Infinity;
    const cands = futuros.filter((s) => s.numero < minDep);
    return cands.length ? cands[cands.length - 1].numero : semDe[id];
  };

  const rango: Record<string, [number, number]> = {};
  futuros.forEach((s) => s.ramos.forEach((r) => (rango[r.id] = [masTemprano(r.id), masTardio(r.id)])));

  const out: (Intercambio & { dist: number; mismoTipo: number })[] = [];
  const vistos = new Set<string>();
  for (let i = 0; i < futuros.length; i++)
    for (let j = i + 1; j < futuros.length; j++) {
      const s1 = futuros[i];
      const s2 = futuros[j];
      for (const r1 of s1.ramos)
        for (const r2 of s2.ramos) {
          const [min1, max1] = rango[r1.id];
          const [min2, max2] = rango[r2.id];
          if (!(s2.numero >= min1 && s2.numero <= max1)) continue;
          if (!(s1.numero >= min2 && s1.numero <= max2)) continue;
          const c1 = s1.creditos - creditosCarga(ctx, [r1]) + creditosCarga(ctx, [r2]);
          const c2 = s2.creditos - creditosCarga(ctx, [r2]) + creditosCarga(ctx, [r1]);
          if (c1 > mc || c2 > mc) continue;
          const key = [r1.id, r2.id].sort().join("↔");
          if (vistos.has(key)) continue;
          const sim = plan.semestres.map((s) => ({
            ...s,
            ramos: s === s1 ? s.ramos.map((r) => (r === r1 ? r2 : r)) : s === s2 ? s.ramos.map((r) => (r === r2 ? r1 : r)) : s.ramos,
          }));
          if (!planRespetaPracticas(ctx, sim)) continue;
          vistos.add(key);
          out.push({ ramo1: r1.id, sem1: s1.numero, ramo2: r2.id, sem2: s2.numero, dist: s2.numero - s1.numero, mismoTipo: r1.tipo === r2.tipo ? 1 : 0 });
        }
    }
  out.sort((a, b) => a.dist - b.dist || a.mismoTipo - b.mismoTipo);
  return out.map(({ ramo1, sem1, ramo2, sem2 }) => ({ ramo1, sem1, ramo2, sem2 }));
}

/** Ramos que una práctica deja adeudados según su posición en el plan. */
export function deudaPracticaEnPlan(ctx: Ctx, plan: Plan, sem: SemestrePlan, ramo: Ramo): string[] {
  const antes = new Set(aprobadosSet(ctx));
  if (sem.tipo !== "cursando") ctx.st.cursando.forEach((id) => antes.add(id));
  plan.semestres.forEach((s) => {
    if (s.tipo !== "futuro" && s.tipo !== "verano") return;
    const previo = s.numero < sem.numero || (sem.tipo === "verano" && s.tipo === "futuro" && s.numero === sem.numero);
    if (previo) s.ramos.forEach((x) => antes.add(x.id));
  });
  return evaluarReglaPractica(ramo, antes).faltan;
}

// ── Plan guardado ──

export function guardarPlan(ctx: Ctx, plan: Plan): PlanGuardado {
  return {
    fecha: new Date().toISOString(),
    etiqueta: plan.etiqueta,
    semestreBase: ctx.st.semestreActual,
    semestres: plan.semestres.map((s) => ({ numero: s.numero, tipo: s.tipo, ids: s.ramos.map((r) => r.id) })),
  };
}

const firma = (sems: { tipo: string; numero: number; ids: string[] }[]) => sems.map((s) => `${s.tipo}${s.numero}:${[...s.ids].sort().join(",")}`).join("|");

export function planCoincide(plan: Plan, guardado: PlanGuardado | null): boolean {
  if (!guardado) return false;
  return firma(plan.semestres.map((s) => ({ tipo: s.tipo, numero: s.numero, ids: s.ramos.map((r) => r.id) }))) === firma(guardado.semestres);
}

export function planDesdeGuardado(ctx: Ctx, g: PlanGuardado): Plan {
  return resumirPlan(ctx, {
    etiqueta: g.etiqueta,
    descripcion: "",
    maxRamos: 0,
    semestres: g.semestres.map((s) => ({
      numero: s.numero,
      tipo: s.tipo,
      creditos: 0,
      ramos: s.ids.map((id) => ctx.cur.map[id]).filter(Boolean),
    })),
  });
}
