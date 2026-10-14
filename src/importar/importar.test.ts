import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { aprobadosSet, type Ctx } from "../core/academic";
import { construirCurriculum } from "../core/curriculum";
import { estadoInicial, nuevoUid, normalizarEstado, type PlannerState } from "../core/state";
import type { MallaDef } from "../core/types";
import { sincronizar } from "../store/mutaciones";
import { parsearAvance, romanoANumero } from "./avance";
import { lineasDesdeItems } from "./pdf";
import { aplicarPlan, construirPlanAvance, construirPlanTrabajo, previsualizar, semestreSugerido } from "./plan";
import { leerTrabajoAcademico, registrosDesdeFilas, type RegistroTrabajo } from "./trabajo";
import { ErrorImportacion, esPlanInformatica, tituloCaso } from "./udp";

const inf = JSON.parse(readFileSync("public/carreras/inf.json", "utf8")) as MallaDef;
const cur = construirCurriculum(inf);

let fila = 1;
const reg = (r: Partial<RegistroTrabajo> & Pick<RegistroTrabajo, "codigo">): RegistroTrabajo => ({
  fila: ++fila, nombre: "", anio: 2023, periodo: "1", creditos: null, nota: null, tipo: "Obligatorio", estado: "aprobado", ...r,
});
const aprobado = (codigo: string, anio: number, periodo: "1" | "2" | "E", nota: number, extra: Partial<RegistroTrabajo> = {}) =>
  reg({ codigo, anio, periodo, nota, estado: nota >= 3.95 ? "aprobado" : "reprobado", ...extra });

function aplicar(plan: ReturnType<typeof construirPlanTrabajo>, st: PlannerState = estadoInicial()): PlannerState {
  const ctx: Ctx = { cur, st: structuredClone(st) };
  aplicarPlan(ctx, plan);
  sincronizar(ctx);
  return ctx.st;
}

describe("Avance curricular (PDF)", () => {
  const lineas = [
    "Nombre estudiante : PERSONA DE PRUEBA",
    "Plan de estudio : 10202878 ING. CIVIL INFORMÁTICA Y TELECOM",
    "Fecha consulta : 13.10.2026",
    "Año ingreso : 2023",
    "I Semestre",
    "CBM1000 ÁLGEBRA Y GEOMETRÍA APROBADO",
    "II Semestre",
    "FG1_4 CURSO DE FORMACIÓN GENERAL 1 APROBADO",
    "CFG5095 - AI LANDSCAPES: CULTURE, POWER AND SOCIETY",
    "IN THE 21ST CENTURY",
    "CBM1003 CÁLCULO II INSCRITO",
    "1",
    "IV Semestre",
    "CIT4000 PRÁCTICA I NO CURSADO",
    "XI Semestre",
    "CIT4011 TITULACIÓN EXÁMEN DE TÍTULO NO CURSADO TITULACIÓN VIA EXAMEN DE TÍTULO",
    "Estado módulos académicos",
    "APROBADOS : 2",
  ];

  it("lee encabezado, estados, semestres romanos y nombres reales de formación general", () => {
    const a = parsearAvance(lineas);
    expect(a).toMatchObject({ plan: "10202878 ING. CIVIL INFORMÁTICA Y TELECOM", anioIngreso: 2023, fechaConsulta: "2026-10-13" });
    expect(a.ramos.map((r) => [r.codigo, r.estado, r.semestreMalla])).toEqual([
      ["CBM1000", "aprobado", 1],
      ["FG1_4", "aprobado", 2],
      ["CBM1003", "inscrito", 2],
      ["CIT4000", "no-cursado", 4],
      ["CIT4011", "no-cursado", 11],
    ]);
    expect(a.ramos[1].real).toEqual({ codigo: "CFG5095", nombre: "AI LANDSCAPES: CULTURE, POWER AND SOCIETY IN THE 21ST CENTURY" });
    expect(a.ignoradas).toEqual([]);
  });

  it("rechaza un PDF que no es un avance curricular", () => {
    expect(() => parsearAvance(["Hola", "esto no es un reporte"])).toThrow(ErrorImportacion);
  });

  it("convierte números romanos y deduce el semestre actual por la fecha", () => {
    expect(["I", "IV", "IX", "X", "XI"].map(romanoANumero)).toEqual([1, 4, 9, 10, 11]);
    expect(semestreSugerido({ fechaConsulta: "2026-10-13", anioIngreso: 2023 })).toBe(8);
    expect(semestreSugerido({ fechaConsulta: "2026-04-02", anioIngreso: 2023 })).toBe(7);
    expect(semestreSugerido({ fechaConsulta: "2027-01-20", anioIngreso: 2023 })).toBe(8); // verano: aún es el 2.º semestre
    expect(semestreSugerido({ fechaConsulta: null, anioIngreso: 2023 })).toBeNull();
  });

  it("une los fragmentos de texto de cada línea de arriba hacia abajo", () => {
    const item = (str: string, x: number, y: number, width = str.length * 5) => ({ str, width, transform: [1, 0, 0, 1, x, y] });
    const lineasPDF = lineasDesdeItems([
      [item("INSCRITO", 300, 500), item("CIT2011", 10, 500.4), item("SISTEMAS", 50, 500), item("DISTRIBUIDOS", 95, 500), item("I Semestre", 10, 520)],
    ]);
    expect(lineasPDF).toEqual(["I Semestre", "CIT2011 SISTEMAS DISTRIBUIDOS INSCRITO"]);
  });

  it("construye el plan: aprobados, inscritos y formación general con su nombre real", () => {
    const plan = construirPlanAvance(cur, parsearAvance(lineas));
    expect(plan.aprobadosRapidos).toEqual(["CBM-1000", "CFG-1"]);
    expect(plan.cursando).toEqual(["CBM-1003"]);
    expect(plan.alias["CFG-1"]).toEqual({ sigla: "CFG5095", nombre: "AI Landscapes: Culture, Power and Society in the 21st Century" });
    expect(plan.semestreActual).toBe(8);
    expect(plan.noReconocidos).toEqual([]);
  });

  it("aplicar es idempotente, corrige marcas que el reporte no respalda y respeta las notas", () => {
    const plan = construirPlanAvance(cur, parsearAvance(lineas));
    const previo = estadoInicial();
    previo.marcas["CBM-1001"] = null; // marcado a mano, pero el PDF no lo da por aprobado
    previo.periodos = [{ tipo: "regular", numero: 1, ramos: [{ uid: nuevoUid(), id: "CIT-1000", categorias: [], notaFinal: 6.5 }] }];
    const una = aplicar(plan, previo);
    const dos = aplicar(plan, una);
    expect(dos).toEqual(una);
    expect(una.marcas["CBM-1001"]).toBeUndefined();
    expect(una.marcas["CBM-1000"]).toBeNull();
    expect(una.periodos.find((p) => p.numero === 1)!.ramos.some((e) => e.id === "CIT-1000" && e.notaFinal === 6.5)).toBe(true);
    expect(una.cursando).toEqual(["CBM-1003"]);
  });
});

describe("Excel (lector de .xlsx)", () => {
  function zip(archivos: Record<string, string>, comprimir = true): ArrayBuffer {
    const trozos: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const [nombre, texto] of Object.entries(archivos)) {
      const datos = Buffer.from(texto, "utf8");
      const comp = comprimir ? deflateRawSync(datos) : datos;
      const nom = Buffer.from(nombre);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(comprimir ? 8 : 0, 8);
      local.writeUInt32LE(comp.length, 18);
      local.writeUInt32LE(datos.length, 22);
      local.writeUInt16LE(nom.length, 26);
      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(0x02014b50, 0);
      cd.writeUInt16LE(comprimir ? 8 : 0, 10);
      cd.writeUInt32LE(comp.length, 20);
      cd.writeUInt32LE(datos.length, 24);
      cd.writeUInt16LE(nom.length, 28);
      cd.writeUInt32LE(offset, 42);
      trozos.push(local, nom, comp);
      central.push(cd, nom);
      offset += 30 + nom.length + comp.length;
    }
    const cdBuf = Buffer.concat(central);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0);
    fin.writeUInt16LE(Object.keys(archivos).length, 8);
    fin.writeUInt16LE(Object.keys(archivos).length, 10);
    fin.writeUInt32LE(cdBuf.length, 12);
    fin.writeUInt32LE(offset, 16);
    const todo = Buffer.concat([...trozos, cdBuf, fin]);
    return todo.buffer.slice(todo.byteOffset, todo.byteOffset + todo.length);
  }

  const libro = (hoja: string, compartidos: string) => ({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": `<sst>${compartidos}</sst>`,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${hoja}</sheetData></worksheet>`,
  });
  const textos = ["Trbj acad. (Abrev)", "Trbj acad. (Den)", "Periodo acad.", "Año acad.", "Periodo acad.", "Créd.inscr.", "Nota", "Tipo Trbj acad.", "Estado Trbj acad.", "CBM1000", "ÁLGEBRA &amp; GEOMETRÍA", "1er. Semestre", "7,0"].map((t) => `<si><t>${t}</t></si>`).join("");
  const encabezado = '<row r="1">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<c r="${"ABCDEFGHI"[i]}1" t="s"><v>${i}</v></c>`).join("") + "</row>";
  const filaDatos =
    '<row r="2"><c r="A2" t="s"><v>9</v></c><c r="B2" t="s"><v>10</v></c><c r="C2" t="s"><v>11</v></c><c r="D2" t="inlineStr"><is><t>2023</t></is></c>' +
    '<c r="E2"><v>001</v></c><c r="F2"><v>7</v></c><c r="G2" t="s"><v>12</v></c><c r="H2" t="inlineStr"><is><t>Obligatorio</t></is></c><c r="I2" t="inlineStr"><is><t>Aprobado</t></is></c></row>';

  it("lee strings compartidos, inline, entidades XML y columnas repetidas", async () => {
    for (const comprimir of [true, false]) {
      const t = await leerTrabajoAcademico(zip(libro(encabezado + filaDatos, textos), comprimir));
      expect(t.registros).toEqual([
        { fila: 2, codigo: "CBM1000", nombre: "ÁLGEBRA & GEOMETRÍA", anio: 2023, periodo: "1", creditos: 7, nota: 7, tipo: "Obligatorio", estado: "aprobado" },
      ]);
    }
  });

  it("rechaza archivos que no son Excel o no traen los encabezados esperados", async () => {
    await expect(leerTrabajoAcademico(new ArrayBuffer(200))).rejects.toThrow(ErrorImportacion);
    await expect(leerTrabajoAcademico(zip(libro('<row r="1"><c r="A1" t="inlineStr"><is><t>hola</t></is></c></row>', "")))).rejects.toThrow(/encabezados/);
  });

  it("avisa qué columnas faltan", () => {
    expect(() => registrosDesdeFilas([["Trbj acad. (Abrev)", "Nota", "Estado Trbj acad."], ["CBM1000", "5,0", "Aprobado"]])).toThrow(/Año acad\., Periodo acad\./);
  });

  it("interpreta períodos por código o por texto, notas con coma y años 0000", () => {
    const cab = ["Trbj acad. (Abrev)", "Año acad.", "Periodo acad.", "Nota", "Estado Trbj acad."];
    const t = registrosDesdeFilas([
      cab,
      ["cbm1000", "2023", "002", "5,3", "Aprobado"],
      ["CBM1003", "2023", "Sem. Especial", "5.0", "Aprobado"],
      ["CIG1012", "0000", "000", "7,0", "Aprobado"],
      ["CIT2110", "2026", "2do. Semestre", "", "Inscrito"],
      ["CIT2011", "2026", "001", "9,9", "Reprobado"],
      ["", "", "", "", ""],
    ]);
    expect(t.registros.map((r) => [r.codigo, r.anio, r.periodo, r.nota, r.estado])).toEqual([
      ["CBM1000", 2023, "2", 5.3, "aprobado"],
      ["CBM1003", 2023, "E", 5, "aprobado"],
      ["CIG1012", null, null, 7, "aprobado"],
      ["CIT2110", 2026, "2", null, "inscrito"],
      ["CIT2011", 2026, "1", null, "reprobado"],
    ]);
    expect(t.advertencias).toHaveLength(1);
  });
});

describe("Plan desde el Trabajo académico", () => {
  it("numera semestres, ubica el verano, detecta eximidos y deja lo inscrito como cursando", () => {
    const plan = construirPlanTrabajo(cur, [
      reg({ codigo: "CIG1012", anio: null, periodo: null, nota: 7 }),
      reg({ codigo: "CIG1013", anio: null, periodo: null, nota: 6.2 }),
      aprobado("CBM1001", 2023, "1", 4.5),
      aprobado("CBM1003", 2023, "2", 3.2),
      aprobado("CBM1003", 2023, "E", 5.0),
      aprobado("CIG1014", 2024, "2", 6.9),
      reg({ codigo: "CBM1005", anio: 2025, periodo: "1", estado: "inscrito" }),
    ]);
    expect(plan.inglesEximido).toBe(2);
    expect(plan.semestreActual).toBe(4); // 2023-1, 2023-2, 2024-2, 2025-1
    expect(plan.congelaciones).toEqual([{ desde: 3, duracion: 1 }]); // 2024-1 sin ramos
    expect(plan.cursando).toEqual(["CBM-1005"]);
    expect(plan.periodos.map((p) => `${p.tipo}${p.numero}`)).toEqual(["regular1", "regular2", "verano2", "regular3", "regular4"]);
    expect(plan.periodos.find((p) => p.tipo === "verano")!.entradas).toEqual([{ id: "CBM-1003", nota: 5 }]);
  });

  it("aplicado al estado: aprobados y reprobados quedan con su nota, el PPA y la malla cuadran", () => {
    const plan = construirPlanTrabajo(cur, [
      aprobado("CII2750", 2025, "1", 3.4),
      aprobado("CII2750", 2025, "2", 2.9),
      aprobado("CII2750", 2026, "1", 4.2),
      reg({ codigo: "CIT2110", anio: 2026, periodo: "2", estado: "inscrito", creditos: 6 }),
    ]);
    const st = aplicar(plan);
    const ctx: Ctx = { cur, st };
    expect(aprobadosSet(ctx).has("CII-2750")).toBe(true);
    expect(aprobadosSet(ctx).has("CIT-2110")).toBe(false);
    expect(st.cursando).toEqual(["CIT-2110"]);
    expect(st.semestreActual).toBe(4); // 2025-1, 2025-2, 2026-1, 2026-2
    const resumen = previsualizar(cur, estadoInicial(), plan);
    expect(resumen.intentosReprobados).toBe(2);
    expect(resumen.ppa).toBeCloseTo((3.4 + 2.9 + 4.2) / 3, 5);
  });

  it("asigna Formación General y electivos a casillas, con el nombre real", () => {
    const plan = construirPlanTrabajo(cur, [
      aprobado("CFG2354", 2023, "2", 4.1, { nombre: "B-LEARNING GUERRA FRÍA", tipo: "Formación General" }),
      aprobado("CFG5000", 2024, "1", 2.5, { nombre: "CURSO QUE REPROBÉ", tipo: "Formación General" }),
      aprobado("CFG5095", 2026, "1", 5.7, { nombre: "AI LANDSCAPES", tipo: "Formación General" }),
      aprobado("CIT3350", 2026, "1", 6.0, { nombre: "ELECTIVO DE REDES", tipo: "Electivo" }), // CIT33xx → informática
      aprobado("CIT3410", 2026, "1", 6.5, { nombre: "ELECTIVO TEL", tipo: "Electivo" }), // CIT34xx → telecom
    ]);
    const ids = Object.fromEntries(plan.periodos.flatMap((p) => p.entradas).map((e) => [e.sigla, e.id]));
    expect(ids).toEqual({ CFG2354: "CFG-1", CFG5095: "CFG-2", CFG5000: "CFG-3", CIT3350: "CIT-33XX", CIT3410: "CIT-34XX" });
    expect(plan.alias["CFG-2"].nombre).toBe("AI Landscapes");
    expect(plan.alias["CFG-3"]).toBeUndefined(); // el curso reprobado no define el nombre de la casilla
  });

  it("el PDF fija las casillas de Formación General y completa los nombres truncados", () => {
    const avance = parsearAvance([
      "II Semestre",
      "FG1_4 CURSO DE FORMACIÓN GENERAL 1 APROBADO",
      "CFG5095 - AI LANDSCAPES: CULTURE, POWER AND SOCIETY",
      "V Semestre",
      "FG2_4 CURSO DE FORMACIÓN GENERAL 2 APROBADO",
      "CFG2354 - B-LEARNING GUERRA FRÍA",
    ]);
    const plan = construirPlanTrabajo(
      cur,
      [aprobado("CFG2354", 2023, "2", 4.1, { nombre: "B-LEARNING", tipo: "Formación General" }), aprobado("CFG5095", 2026, "1", 5.7, { nombre: "AI LANDSCAPES", tipo: "Formación General" })],
      avance,
    );
    const ids = Object.fromEntries(plan.periodos.flatMap((p) => p.entradas).map((e) => [e.sigla, e.id]));
    expect(ids).toEqual({ CFG2354: "CFG-2", CFG5095: "CFG-1" });
    expect(plan.alias["CFG-1"].nombre).toBe("AI Landscapes: Culture, Power and Society");
    expect(plan.advertencias).toEqual([]);
  });

  it("avisa de códigos desconocidos, estados raros e inscritos viejos, y cruza con el PDF", () => {
    const avance = parsearAvance(["I Semestre", "CBM1000 ÁLGEBRA Y GEOMETRÍA APROBADO", "CBM1001 CÁLCULO I APROBADO", "IV Semestre", "CIT2008 DESARROLLO WEB Y MÓVIL NO CURSADO", "VII Semestre", "CIT2011 SISTEMAS DISTRIBUIDOS INSCRITO"]);
    const plan = construirPlanTrabajo(
      cur,
      [
        aprobado("CBM1000", 2023, "1", 5.0),
        aprobado("ZZZ9999", 2023, "1", 5.0, { nombre: "RAMO DE OTRO PLAN" }),
        reg({ codigo: "CBM1002", anio: 2023, periodo: "1", estado: "otro" }),
        reg({ codigo: "CBM1003", anio: 2023, periodo: "1", estado: "inscrito" }), // inscrito en un semestre ya terminado
        aprobado("CIT2008", 2023, "2", 6.0),
        reg({ codigo: "CIT2011", anio: 2024, periodo: "1", estado: "inscrito" }), // este sí es el semestre en curso
      ],
      avance,
    );
    expect(plan.noReconocidos).toEqual(["ZZZ9999 Ramo de Otro Plan"]);
    expect(plan.advertencias.join("\n")).toMatch(/estado desconocido/);
    expect(plan.advertencias.join("\n")).toMatch(/Cálculo II: inscrito en un semestre anterior/);
    expect(plan.advertencias.join("\n")).toMatch(/Cálculo I: el PDF lo da por aprobado y el Excel no/);
    expect(plan.aprobadosRapidos).toEqual(["CBM-1001"]);
    expect(plan.advertencias.join("\n")).toMatch(/Desarrollo Web y Móvil: el Excel lo da por aprobado y el PDF no/);
  });

  it("al reimportar conserva las evaluaciones del mismo ramo y período y reemplaza el resto", () => {
    const plan = construirPlanTrabajo(cur, [aprobado("CBM1001", 2023, "1", 5.5), reg({ codigo: "CBM1003", anio: 2023, periodo: "2", estado: "inscrito" })]);
    const previo = estadoInicial();
    previo.marcas["CBM-1000"] = null; // sobra: el Excel manda
    previo.periodos = [
      {
        tipo: "regular",
        numero: 1,
        ventana: "Ventana 2",
        ramos: [{ uid: "u1", id: "CBM-1001", notaFinal: 5, decimas: 0.2, categorias: [{ nombre: "Solemnes", peso: 100, notas: [{ n: 5, f: 1 }] }] }],
      },
      { tipo: "regular", numero: 2, ramos: [{ uid: "u2", id: "CBM-1003", categorias: [{ nombre: "Controles", peso: 100, notas: [{ n: 6, f: 1 }] }], notaFinal: null }] },
    ];
    const st = aplicar(plan, previo);
    const s1 = st.periodos.find((p) => p.numero === 1)!;
    expect(s1.ventana).toBe("Ventana 2");
    expect(s1.ramos[0]).toMatchObject({ uid: "u1", notaFinal: 5.5, decimas: 0 });
    expect(s1.ramos[0].categorias[0].nombre).toBe("Solemnes");
    expect(st.periodos.find((p) => p.numero === 2)!.ramos[0].categorias[0].notas[0].n).toBe(6); // inscrito: no se pisa
    expect(st.marcas["CBM-1000"]).toBeUndefined();
    expect(aplicar(plan, st)).toEqual(st);
    expect(normalizarEstado(JSON.parse(JSON.stringify(st)))).toEqual(st);
  });

  it("las vías de titulación del reporte (CIT4011-4014) cubren la actividad de titulación", () => {
    const plan = construirPlanTrabajo(cur, [aprobado("CIT4012", 2029, "2", 6.5, { creditos: 9 })]);
    expect(plan.periodos[0].entradas).toEqual([{ id: "CIT-4002", nota: 6.5 }]);
    expect(plan.noReconocidos).toEqual([]);
  });

  it("créditos distintos a los de la malla quedan en la entrada; los iguales no", () => {
    const plan = construirPlanTrabajo(cur, [aprobado("CBM1001", 2023, "1", 5, { creditos: 7 }), aprobado("CBM1000", 2023, "1", 5, { creditos: 8 })]);
    const e = plan.periodos[0].entradas;
    expect(e.find((x) => x.id === "CBM-1001")!.creditos).toBeUndefined();
    expect(e.find((x) => x.id === "CBM-1000")!.creditos).toBe(8);
  });
});

describe("utilidades", () => {
  it("reconoce el plan de Informática por su nombre", () => {
    expect(esPlanInformatica("10202878 ING. CIVIL INFORMÁTICA Y TELECOM")).toBe(true);
    expect(esPlanInformatica("99 MEDICINA")).toBe(false);
  });

  it("deja legibles los nombres en mayúsculas", () => {
    expect(tituloCaso("B-LEARNING GUERRA FRÍA Y SOCIEDAD ACTUAL")).toBe("B-Learning Guerra Fría y Sociedad Actual");
    expect(tituloCaso("AI LANDSCAPES: CULTURE, POWER AND SOCIETY")).toBe("AI Landscapes: Culture, Power and Society");
  });
});
