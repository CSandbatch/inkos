import { mkdir, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceDirectory = resolve(root, "docs/diagrams");
const outputDirectory = resolve(root, "packages/site/public/diagrams");
const binary = resolve(root, "node_modules/@mermaid-js/mermaid-cli/src/cli.js");
if (!existsSync(binary)) throw new Error("Mermaid CLI is not installed. Run corepack pnpm install.");
await mkdir(outputDirectory, { recursive: true });
const sources = (await readdir(sourceDirectory)).filter((file) => file.endsWith(".mmd")).sort();
for (const source of sources) {
  const input = resolve(sourceDirectory, source); const stem = basename(source, ".mmd");
  for (const format of ["svg", "png"]) {
    const output = resolve(outputDirectory, `${stem}.${format}`);
    if (process.argv.includes("--check") && !existsSync(output)) throw new Error(`Missing generated diagram: ${output}`);
    if (!process.argv.includes("--check")) execFileSync(process.execPath, [binary, "-i", input, "-o", output, "-c", resolve(root, "scripts/mermaid-config.json"), "-b", "transparent", "-s", format === "png" ? "2" : "1"], { stdio: "inherit" });
  }
  const sourceText = await readFile(input, "utf8");
  if (/\\n|<[^>]+>|[^\x00-\x7F]/u.test(sourceText)) throw new Error(`Diagram source contains unsupported label syntax: ${source}`);
}
process.stdout.write(`Verified ${sources.length} canonical diagrams.\n`);
