#!/usr/bin/env node
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const localHermes = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "hermes", "hermes-agent", "venv", "Scripts", "hermes.exe") : null;
const paths = ["AGENTS.md", "CLAUDE.md", ".agent/README.md", "tools/AGENTS.md", "packages/core/AGENTS.md", "packages/studio/AGENTS.md", "packages/cli/AGENTS.md", "packages/site/AGENTS.md", "docs/AGENTS.md"];
function run(executable, args) { try { return execFileSync(executable, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); } catch { return null; } }
const executable = process.env.HERMES_EXECUTABLE ?? "hermes";
const pathVersion = run(executable, ["--version"]);
const localVersion = localHermes ? run(localHermes, ["--version"]) : null;
const version = pathVersion ?? localVersion;
const hermesHome = process.env.HERMES_HOME ?? (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "hermes") : process.env.USERPROFILE ?? process.env.HOME ?? null);
const result = { root, hermes: version ? { available: true, version, executable: pathVersion ? executable : localHermes } : { available: false, message: "Hermes unavailable; install Hermes Agent before running Hermes-backed tasks." }, contextFiles: paths.map((path) => ({ path, exists: existsSync(join(root, path)) })), hermesHome, generatedContext: existsSync(join(root, ".agent/context.json")), workspaceMemoryDirectory: existsSync(join(root, ".agent/memory")), hermesMemoryDirectory: hermesHome ? existsSync(join(hermesHome, "memories")) : false, sandbox: process.env.HERMES_BACKEND ?? "not reported by local environment" };
console.log(JSON.stringify(result, null, 2));
process.exitCode = version ? 0 : 1;
