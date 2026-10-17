import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("release", { recursive: true });
let sums = "";
for (const p of ["youtube", "soundcloud", "spotify"]) {
  const manifest = JSON.parse(await readFile(`manifests/dev.delta.${p}.json`, "utf8"));
  if (manifest.version !== pkg.version) throw Error(`manifest ${p} version ${manifest.version} != ${pkg.version}`);
  const dist = "dist/" + p, files = [];
  async function visit(dir) {
    for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const f = join(dir, e.name);
      if (e.isDirectory()) await visit(f);
      else if (e.isFile()) {
        const b = await readFile(f);
        files.push({ path: relative(dist, f).replaceAll("\\", "/"), sha256: createHash("sha256").update(b).digest("hex"), data: b.toString("base64") });
      } else throw Error("Special file is not allowed");
    }
  }
  await visit(dist);
  const bytes = Buffer.from(JSON.stringify({ format: "delta-app-v1", manifest, files }));
  const name = `delta-${p}.delta-app`;
  await writeFile("release/" + name, bytes);
  sums += createHash("sha256").update(bytes).digest("hex") + "  " + name + "\n";
  console.log(`Packaged ${name}: ${files.length} assets, ${bytes.length} bytes`);
}
await writeFile("release/SHA256SUMS", sums);
