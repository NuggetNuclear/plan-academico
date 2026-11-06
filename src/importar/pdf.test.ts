import { beforeEach, describe, expect, it, vi } from "vitest";
import { lineasDePDF } from "./pdf";

const pdf = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn(async () => {}) }));
vi.mock("pdfjs-dist", () => ({ getDocument: pdf.getDocument, GlobalWorkerOptions: { workerSrc: "" } }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));
beforeEach(() => { vi.clearAllMocks(); });

describe("recursos del lector de PDF", () => {
  it("libera el documento al terminar la lectura", async () => {
    pdf.getDocument.mockReturnValue({ destroy: pdf.destroy, promise: Promise.resolve({ numPages: 1,
      getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "Texto", width: 10, transform: [1, 0, 0, 1, 0, 10] }] }) }),
    }) });
    expect(await lineasDePDF(new ArrayBuffer(0))).toEqual(["Texto"]);
    expect(pdf.destroy).toHaveBeenCalledTimes(1);
  });

  it("libera un PDF que supera el límite de páginas", async () => {
    pdf.getDocument.mockReturnValue({ destroy: pdf.destroy, promise: Promise.resolve({ numPages: 21 }) });
    await expect(lineasDePDF(new ArrayBuffer(0))).rejects.toThrow("demasiado largo");
    expect(pdf.destroy).toHaveBeenCalledTimes(1);
  });

  it("libera el lector si falla una página", async () => {
    pdf.getDocument.mockReturnValue({ destroy: pdf.destroy, promise: Promise.resolve({ numPages: 1, getPage: async () => { throw new Error("Página dañada"); } }) });
    await expect(lineasDePDF(new ArrayBuffer(0))).rejects.toThrow("Página dañada");
    expect(pdf.destroy).toHaveBeenCalledTimes(1);
  });

  it("libera la tarea si el PDF no se puede abrir", async () => {
    pdf.getDocument.mockImplementationOnce(() => ({ destroy: pdf.destroy, promise: Promise.reject(new Error("Protegido")) }));
    await expect(lineasDePDF(new ArrayBuffer(0))).rejects.toThrow("No pude abrir el PDF");
    expect(pdf.destroy).toHaveBeenCalledTimes(1);
  });
});
