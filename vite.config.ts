import { defineConfig } from "vite";
const provider = process.env.PROVIDER || "youtube";
export default defineConfig({
  base: "./",
  define: { __PROVIDER__: JSON.stringify(provider) },
  build: { target: "es2022", outDir: "dist/" + provider, emptyOutDir: true },
});
