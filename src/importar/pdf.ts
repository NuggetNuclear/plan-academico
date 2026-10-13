// Extrae las líneas de texto de un PDF en el navegador (pdf.js se carga recién al importar).
import { ErrorImportacion } from "./udp";

interface ItemTexto {
  str: string;
  transform: number[];
  width: number;
}

/** Une los fragmentos de cada página por posición vertical, de arriba abajo y de izquierda a derecha. */
export function lineasDesdeItems(paginas: ItemTexto[][]): string[] {
  const lineas: string[] = [];
  for (const items of paginas) {
    const filas = new Map<number, ItemTexto[]>();
    items
      .filter((i) => i.str !== "")
      .forEach((i) => {
        const y = Math.round(i.transform[5] / 2) * 2; // tolera diferencias de 1 pt en una misma línea
        (filas.get(y) ?? filas.set(y, []).get(y)!).push(i);
      });
    [...filas.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, fila]) => {
        fila.sort((a, b) => a.transform[4] - b.transform[4]);
        let texto = "";
        let finPrevio = -Infinity;
        fila.forEach((i) => {
          const x = i.transform[4];
          if (texto && x - finPrevio > 1 && !/\s$/.test(texto) && !/^\s/.test(i.str)) texto += " ";
          texto += i.str;
          finPrevio = x + i.width;
        });
        lineas.push(texto.replace(/\s+/g, " ").trim());
      });
  }
  return lineas;
}

export async function lineasDePDF(buffer: ArrayBuffer): Promise<string[]> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const tarea = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  let doc;
  try {
    doc = await tarea.promise;
  } catch {
    throw new ErrorImportacion("No pude abrir el PDF. ¿Está protegido o dañado? Descárgalo de nuevo desde la UDP.");
  }
  if (doc.numPages > 20) throw new ErrorImportacion("Ese PDF es demasiado largo para ser un Avance curricular.");
  const paginas: ItemTexto[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const contenido = await (await doc.getPage(n)).getTextContent();
    paginas.push(contenido.items.filter((i): i is typeof i & ItemTexto => "str" in i) as ItemTexto[]);
  }
  void tarea.destroy();
  return lineasDesdeItems(paginas);
}
