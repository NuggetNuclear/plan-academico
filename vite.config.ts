import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" permite publicar el sitio en cualquier subruta (GitHub Pages incluido).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), {
    name: "precache-offline",
    apply: "build",
    generateBundle(_, bundle) {
      const plantilla = readFileSync(new URL("./public/sw.js", import.meta.url), "utf8");
      const hash = createHash("sha256").update(plantilla);
      for (const salida of Object.values(bundle)) hash.update(salida.type === "chunk" ? salida.code : salida.source);
      const assets = Object.keys(bundle).filter((archivo) => /\.(?:js|mjs|css)$/.test(archivo));
      // La revisión cambia con cada build; incluye las secciones diferidas para seguir funcionando sin conexión.
      this.emitFile({ type: "asset", fileName: "sw.js", source: plantilla
        .replace("__REVISION__", hash.digest("hex").slice(0, 16))
        .replace("/* __ASSETS__ */", assets.map((archivo) => JSON.stringify("./" + archivo)).join(",")) });
    },
  }],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
