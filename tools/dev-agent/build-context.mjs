#!/usr/bin/env node
/**
 * Portable context bundle for a development agent.
 *
 * Writes `.agent/context.json` containing the same logical context regardless of
 * which runtime consumes it — Claude Code, Codex, or anything else. The point is
 * that the *repository* defines what context a task needs, rather than each tool
 * discovering it differently through its own memory mechanism.
 *
 *   pnpm agent:context --scope packages/core --issue 17
 *   pnpm agent:context --scope packages/core/src/auth
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../../scripts/lib/mini-yaml.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

const scope = arg("scope");
const issue = arg("issue");
const base = arg("base") ?? "main";

// ── Constitutional instructions ──────────────────────────────────────────────
const instructions = { root: null, nested: [] };
if (existsSync(join(root, "AGENTS.md"))) {
  instructions.root = await readFile(join(root, "AGENTS.md"), "utf8");
}
// A nested AGENTS.md narrows the root rules for one package.
if (scope) {
  let current = scope;
  while (current && current !== "." && current !== "/") {
    const candidate = join(root, current, "AGENTS.md");
    if (existsSync(candidate)) {
      instructions.nested.push({ path: join(current, "AGENTS.md"), content: await readFile(candidate, "utf8") });
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

// ── Architectural decisions ──────────────────────────────────────────────────
const decisionsDir = join(root, "docs/architecture/decisions");
const decisions = [];
if (existsSync(decisionsDir)) {
  for (const name of (await readdir(decisionsDir)).sort()) {
    if (!name.endsWith(".md") || name === "README.md") continue;
    const text = await readFile(join(decisionsDir, name), "utf8");
    const title = /^#\s+(.+)$/mu.exec(text)?.[1] ?? name;
    const status = /^\*\*Status:\*\*\s+(.+)$/mu.exec(text)?.[1]?.replace(/\*/gu, "").trim() ?? "unknown";
    // Summaries only: the full text is a file read away, and a bundle that
    // inlines every ADR stops being usable as context.
    const context = /##\s+Context\s*\n+([\s\S]*?)(?=\n##\s)/u.exec(text)?.[1]?.trim().split("\n\n")[0] ?? "";
    decisions.push({ file: `docs/architecture/decisions/${name}`, title, status, context });
  }
}

// ── Capability registry, filtered to scope ───────────────────────────────────
let capabilities = [];
const registryPath = join(root, "docs/engineering/capability-registry.yaml");
if (existsSync(registryPath)) {
  const registry = parseYaml(await readFile(registryPath, "utf8"));
  capabilities = Object.entries(registry.capabilities ?? {})
    .map(([id, entry]) => ({
      id,
      title: entry.title,
      status: entry.status,
      phase: entry.phase,
      owner: entry.owner,
      blockers: entry.blockers ?? [],
    }))
    .filter((entry) => !scope || !entry.owner || String(entry.owner).startsWith(scope) || scope.startsWith(String(entry.owner)));
}

// ── Repository state ─────────────────────────────────────────────────────────
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], "unknown");
const head = git(["rev-parse", "--short", "HEAD"], "unknown");
const changed = git(["diff", "--name-only", `${base}...HEAD`]).split("\n").filter(Boolean);
const uncommitted = git(["status", "--porcelain"]).split("\n").filter(Boolean)
  .map((line) => line.slice(3));
const recentCommits = git(["log", "-8", "--format=%h %s"]).split("\n").filter(Boolean);

// ── Assemble ─────────────────────────────────────────────────────────────────
const context = {
  generatedAt: new Date().toISOString(),
  scope: scope ?? null,
  issue: issue ? Number(issue) : null,
  repository: { branch, head, base, changedFromBase: changed, uncommitted, recentCommits },
  instructions,
  decisions,
  capabilities,
  requiredCommands: [
    "corepack pnpm -r build",
    "corepack pnpm typecheck",
    "corepack pnpm -r test",
    "corepack pnpm lint",
    "corepack pnpm capabilities:check",
    "corepack pnpm provenance:check",
  ],
  reminders: [
    "State the invariant this change affects before editing.",
    "New source files need a provenance-ledger row.",
    "A capability may not be described in the present tense unless the registry says shipped.",
    "Credentials never enter project files.",
  ],
};

await mkdir(join(root, ".agent"), { recursive: true });
const output = join(root, ".agent/context.json");
await writeFile(output, `${JSON.stringify(context, null, 2)}\n`, "utf8");

console.log(`Wrote ${output}`);
console.log(`  scope        ${scope ?? "(whole repository)"}`);
console.log(`  branch       ${branch} @ ${head}`);
console.log(`  decisions    ${decisions.length}`);
console.log(`  capabilities ${capabilities.length} in scope`);
console.log(`  changed      ${changed.length} vs ${base}, ${uncommitted.length} uncommitted`);
