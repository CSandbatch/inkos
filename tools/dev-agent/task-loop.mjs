#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const agentDir = join(root, ".agent");
const taskPath = join(agentDir, "task.json");
const phases = ["discover", "orient", "plan", "implement", "verify", "document", "review", "handoff"];
const transitions = new Map(phases.map((phase, index) => [phase, phases[index + 1]]));

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; }
function command(name, fallback = "") { try { return execFileSync(name, [], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return fallback; } }
function fail(message) { console.error(`[agent] ${message}`); process.exitCode = 1; }
function iso() { return new Date().toISOString(); }
async function load() { if (!existsSync(taskPath)) throw new Error("No .agent/task.json exists; run agent:init first."); return JSON.parse(await readFile(taskPath, "utf8")); }
async function save(task) { await mkdir(agentDir, { recursive: true }); await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, "utf8"); }
function validate(task) {
  const required = ["id", "objective", "scope", "acceptanceCriteria", "phase", "assumptions", "changedFiles", "verification", "documentation", "blockers", "nextAction", "handoff"];
  for (const key of required) if (!(key in task)) throw new Error(`Task field missing: ${key}`);
  if (!phases.includes(task.phase)) throw new Error(`Unknown task phase: ${task.phase}`);
  if (!task.objective.trim() || !task.acceptanceCriteria.length) throw new Error("Objective and acceptance criteria are required");
  if (task.phase === "document" && task.documentation.updated.length === 0) throw new Error("Document phase requires at least one updated documentation path");
  if (task.phase === "handoff" && !task.handoff.summary.trim()) throw new Error("Handoff phase requires a summary");
}

const action = process.argv[2];
try {
  if (action === "init") {
    const task = { id: arg("id") ?? `task-${Date.now()}`, objective: arg("objective") ?? "", scope: arg("scope") ?? ".", acceptanceCriteria: (arg("acceptance") ?? "").split("|").map((v) => v.trim()).filter(Boolean), phase: "discover", assumptions: [], changedFiles: [], verification: { commands: [], evidence: [], passed: false }, documentation: { required: [], updated: [], pending: [] }, blockers: [], nextAction: arg("next") ?? "Inspect the repository and record the implementation boundary.", handoff: { summary: "", nextAction: "", evidence: [] }, createdAt: iso(), updatedAt: iso() };
    validate(task); await save(task); console.log(`Created ${taskPath}`); process.exit(0);
  }
  const task = await load();
  if (action === "check") { validate(task); console.log(`Task ${task.id} is valid at ${task.phase}.`); process.exit(0); }
  if (action === "checkpoint") {
    const next = arg("phase");
    if (!next || !phases.includes(next)) throw new Error(`--phase must be one of ${phases.join(", ")}`);
    if (transitions.get(task.phase) !== next && task.phase !== next) throw new Error(`Illegal transition ${task.phase} → ${next}`);
    task.phase = next; task.nextAction = arg("next") ?? task.nextAction; task.updatedAt = iso(); validate(task); await save(task); console.log(`Task advanced to ${next}.`); process.exit(0);
  }
  if (action === "document") {
    const path = arg("path"); if (!path) throw new Error("--path is required");
    if (!task.documentation.updated.includes(path)) task.documentation.updated.push(path);
    task.documentation.pending = task.documentation.pending.filter((item) => item !== path); task.updatedAt = iso(); validate(task); await save(task); console.log(`Recorded documentation update: ${path}`); process.exit(0);
  }
  if (action === "verify") {
    const commandText = arg("command"); const evidence = arg("evidence");
    if (!commandText || !evidence) throw new Error("verify requires --command and --evidence");
    task.verification.commands.push(commandText); task.verification.evidence.push(evidence); task.verification.passed = arg("passed") !== "false"; task.updatedAt = iso();
    validate(task); await save(task); console.log(`Recorded verification evidence: ${evidence}`); process.exit(0);
  }
  if (action === "handoff") {
    task.phase = "handoff"; task.handoff = { summary: arg("summary") ?? "", nextAction: arg("next") ?? task.nextAction, evidence: task.verification.evidence }; task.updatedAt = iso(); validate(task); await save(task); console.log(`Recorded handoff for ${task.id}.`); process.exit(0);
  }
  throw new Error("Usage: task-loop.mjs init|check|checkpoint|document|handoff");
} catch (error) { fail(error instanceof Error ? error.message : String(error)); }
