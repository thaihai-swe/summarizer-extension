import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(repoRoot, "firefox-output");
const outputDir = path.join(outputRoot, "firefox");
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

const xpiPath = path.join(outputRoot, `deepdigest-firefox-${firefoxManifest.version}.xpi`);
await rm(xpiPath, { force: true });
await execFileAsync("zip", ["-qr", xpiPath, "."], { cwd: outputDir });

console.log(`Firefox package prepared at ${path.relative(repoRoot, outputDir)}`);
console.log(`Firefox XPI built at ${path.relative(repoRoot, xpiPath)}`);
