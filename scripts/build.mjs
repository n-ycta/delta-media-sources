import { build } from "vite";
for (const p of ["youtube", "soundcloud", "spotify"]) {
  process.env.PROVIDER = p;
  await build({ logLevel: "warn", define: { __PROVIDER__: JSON.stringify(p) }, build: { outDir: "dist/" + p, emptyOutDir: true } });
  console.log("built", p);
}
