import {
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { createZip } from "@aklinker1/zero-zip";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const root = resolve(".output/chrome-mv3");
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8"));
if (manifest.version !== version || manifest.manifest_version !== 3)
  throw new Error("Manifest/version mismatch");
for (const file of [
  "app.html",
  "newtab.html",
  "popup.html",
  "sidepanel.html",
  "background.js",
])
  if (!statSync(`${root}/${file}`).isFile()) throw new Error(`Missing ${file}`);
mkdirSync("dist", { recursive: true });
const target = resolve(`dist/aether-chromium-v${version}.zip`);
const archive = createZip({ level: 9 });
function addDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) addDirectory(path);
    else if (entry.isFile())
      archive.addFile(
        relative(root, path).replaceAll("\\", "/"),
        readFileSync(path),
      );
  }
}
addDirectory(root);
writeFileSync(target, await archive.toBuffer());
const hash = createHash("sha256").update(readFileSync(target)).digest("hex");
writeFileSync(
  "dist/SHA256SUMS.txt",
  `${hash}  ${relative(resolve("dist"), target)}\n`,
);
writeFileSync(
  "dist/release-manifest.json",
  JSON.stringify(
    {
      version,
      channel: "stable",
      package: relative(resolve("dist"), target),
      sha256: hash,
      manualInstallRequired: true,
    },
    null,
    2,
  ),
);
console.log(`Packaged ${target}`);
function count(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce(
    (n, e) =>
      n +
      (e.isDirectory()
        ? count(`${dir}/${e.name}`)
        : statSync(`${dir}/${e.name}`).size),
    0,
  );
}
console.log(`Extension size: ${count(root)} bytes`);
