import { nuevoUid, type Entrada } from "../../core/state";

/** Copia independiente para probar valores, incluso a partir de un ramo cerrado. */
export function crearSimulacion(origen?: Entrada): Entrada {
  const entrada: Entrada = origen ? structuredClone(origen) : {
    uid: nuevoUid(), id: "simulacion", notaFinal: null,
    categorias: [{ nombre: "Pruebas", peso: 100, notas: Array.from({ length: 3 }, () => ({ n: null, f: 1 })) }],
  };
  entrada.notaFinal = null;
  entrada.decimas = 0;
  entrada.modo = "actual";
  entrada.categorias.forEach((c) => {
    c.id ??= nuevoUid();
    c.notas.forEach((n) => { n.id ??= nuevoUid(); });
  });
  return entrada;
}
