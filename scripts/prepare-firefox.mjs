import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, ".output", "firefox");
const runtimeEntries = [
    "background.js", "content.js", "sidepanel.js", "sidepanel.html", "sidepanel.css",
    "options.js", "options.html", "options.css", "tokens.css", "manifest.firefox.json", "icons", "lib"
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (const entry of runtimeEntries) {
    await cp(path.join(repoRoot, entry), path.join(outputDir, entry), { recursive: true });
}

const firefoxManifest = JSON.parse(await readFile(path.join(outputDir, "manifest.firefox.json"), "utf8"));
await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(firefoxManifest, null, 4) + "\n");
await rm(path.join(outputDir, "manifest.firefox.json"), { force: true });
console.log(`Firefox package prepared at ${path.relative(repoRoot, outputDir)}`);
