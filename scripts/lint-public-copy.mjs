import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, extname } from "node:path";
import { analyzeEnglishProsePatterns } from "../packages/core/dist/studio/prose-patterns.js";

const root = resolve(import.meta.dirname, "..");
const candidates = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "README.md", "SECURITY.md", "SUPPORT.md", "CONTRIBUTING.md", ".github", "packages/site/src", "packages/cli/src"], { cwd: root, encoding: "utf8" }).split(/\r?\n/u).filter(Boolean);
const extensions = new Set([".md", ".mdx", ".astro", ".yml", ".yaml"]);
const allowlistPath = resolve(root, "copy-lint-allowlist.json");
const allowlist = existsSync(allowlistPath) ? JSON.parse(await readFile(allowlistPath, "utf8")) : [];
const findings = [];

for (const path of candidates) {
  if (path.startsWith(".github/workflows/")) continue;
  if (!extensions.has(extname(path)) && path !== "README.md") continue;
  const original = await readFile(resolve(root, path), "utf8");
  const prose = extractProse(original, extname(path));
  for (const finding of analyzeEnglishProsePatterns(prose)) {
    if (["triadic-compulsion", "repetitive-sentence-engineering", "document-regularity"].includes(finding.category) && /^(\s*[-|]|\s*[a-z_-]+:)/iu.test(finding.excerpt)) continue;
    const allowed = allowlist.find((entry) => entry.path === path && entry.category === finding.category && entry.pattern.toLowerCase() === finding.pattern.toLowerCase() && entry.rationale && entry.reviewer && entry.reviewedAt && (entry.permanent === true || (entry.expires && Date.parse(entry.expires) >= Date.now())));
    findings.push({ path, ...finding, allowed: Boolean(allowed), rationale: allowed?.rationale });
  }
}

function extractProse(original, extension) {
  if (extension === ".yml" || extension === ".yaml") {
    return original.split(/\r?\n/u).map((line) => {
      const match = line.match(/^\s*(?:name|title|description|placeholder|body):\s*["']?(.+?)["']?\s*$/iu);
      return match?.[1]?.replace(/^https?:\/\/\S+$/u, "") ?? "";
    }).join("\n");
  }
  return original
    .replace(/```[\s\S]*?```/gu, "")
    .replace(/`[^`]+`/gu, "")
    .replace(/<[^>]+>/gu, " ")
    .replace(/^---[\s\S]*?---/u, "")
    .replace(/\{[^\n]*\}/gu, " ")
    .replace(/^\s*\|.*\|\s*$/gmu, "")
    .replace(/^\s*[-*+]\s+/gmu, "")
    .replace(/^\s*\d+[.)]\s+/gmu, "");
}

await writeFile(resolve(root, "copy-lint-report.json"), `${JSON.stringify({ rulePack: "english-prose-patterns-2026@1", generatedAt: new Date().toISOString(), findings }, null, 2)}\n`);
for (const finding of findings) process.stdout.write(`${finding.allowed ? "ALLOW" : "REVIEW"} ${finding.path}:${finding.line}:${finding.column} ${finding.category} ${JSON.stringify(finding.pattern)}\n`);
const unresolved = findings.filter((finding) => !finding.allowed);
if (unresolved.length && !process.argv.includes("--report-only")) {
  process.stderr.write(`Public copy has ${unresolved.length} unresolved prose-pattern finding(s). See copy-lint-report.json.\n`);
  process.exitCode = 1;
}
