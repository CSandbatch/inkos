#!/usr/bin/env node
/**
 * Provenance ledger check.
 *
 * Every tracked source file must have a disposition recorded in
 * docs/engineering/provenance-ledger.md. This repository descends from an
 * AGPL-3.0 fork; the ledger is the audit trail distinguishing code written after
 * the fork (carryable) from code derived from the upstream tree (must be
 * re-derived from a written specification before it moves anywhere).
 *
 * Cheap to maintain from now on. Impossible to reconstruct later.
 *
 *   node scripts/check-provenance.mjs            # report
 *   node scripts/check-provenance.mjs --check    # exit 1 on gaps
 */

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = resolve(root, "docs/engineering/provenance-ledger.md");
const VALID = new Set(["CARRY", "RE-DERIVE", "SPEC-SOURCE", "RETIRE"]);
const check = process.argv.includes("--check");

// `--others --exclude-standard` includes new, not-yet-committed files. A file
// that escapes the ledger simply by being untracked would defeat the point.
const tracked = execFileSync(
  "git",
  [
    "ls-files", "--cached", "--others", "--exclude-standard",
    "packages/*/src/**/*.ts", "packages/*/src/**/*.tsx",
    "scripts/**/*.mjs", "tools/**/*.mjs",
  ],
  { cwd: root, encoding: "utf8" },
).split(/\r?\n/u).filter(Boolean).sort();

const ledgerText = await readFile(LEDGER, "utf8");

// Rows look like: | `path` | DISPOSITION | basis | ...
const rows = new Map();
for (const line of ledgerText.split(/\r?\n/u)) {
  const match = /^\|\s*`([^`]+)`\s*\|\s*([A-Z-]+)\s*\|/u.exec(line.trim());
  if (match) rows.set(match[1], match[2]);
}

const missing = [];
const badDisposition = [];
for (const path of tracked) {
  const disposition = rows.get(path);
  if (!disposition) { missing.push(path); continue; }
  if (!VALID.has(disposition)) badDisposition.push(`${path} → "${disposition}"`);
}

// A ledger row for a file that no longer exists is stale, not fatal.
const trackedSet = new Set(tracked);
const stale = [...rows.keys()].filter((path) => !trackedSet.has(path) && !path.includes("*"));

if (missing.length || badDisposition.length) {
  console.error("Provenance ledger is incomplete.\n");
  if (missing.length) {
    console.error(`  ${missing.length} tracked source file(s) with no ledger row:`);
    for (const path of missing.slice(0, 40)) console.error(`    ${path}`);
    if (missing.length > 40) console.error(`    … and ${missing.length - 40} more`);
  }
  if (badDisposition.length) {
    console.error(`\n  Invalid dispositions (expected ${[...VALID].join(" | ")}):`);
    for (const entry of badDisposition) console.error(`    ${entry}`);
  }
  console.error(`\nAdd rows to ${LEDGER}`);
  if (check) process.exit(1);
} else {
  const counts = {};
  for (const path of tracked) {
    const disposition = rows.get(path);
    counts[disposition] = (counts[disposition] ?? 0) + 1;
  }
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ");
  console.log(`Provenance ledger verified — ${tracked.length} tracked source files (${summary}).`);
}

if (stale.length) {
  console.warn(`\nWarning: ${stale.length} ledger row(s) reference files that no longer exist:`);
  for (const path of stale.slice(0, 10)) console.warn(`  ${path}`);
}
