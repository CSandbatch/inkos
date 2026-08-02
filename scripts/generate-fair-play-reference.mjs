import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FAIR_PLAY_2026_CONTRACT, FAIR_PLAY_RULE_CATALOG, MODE_POLICIES } from "../packages/core/dist/studio/mystery-spec.js";

const target = resolve("packages/site/src/content/docs/reference/fair-play-rules.md");
const rows = FAIR_PLAY_RULE_CATALOG.map((rule) => `| \`${rule.code}\` | ${rule.suite} | ${rule.defaultSeverity} | ${rule.title} |`).join("\n");
const modes = Object.entries(MODE_POLICIES).map(([mode, policy]) => `| \`${mode}\` | ${policy.murderRequired ? "yes" : "no"} | ${policy.principalInvestigatorRequired ? "yes" : "no"} | ${policy.singleResponsiblePartyRequired ? "yes" : "no"} | ${policy.waiverAllowed ? "yes" : "no"} |`).join("\n");
const output = `---
title: Fair-play rule reference
description: Generated rule codes, modes, capabilities, and closure behavior for fair-play-detective-2026.
slug: docs/reference/fair-play-rules
---

This page is generated from the executable \`${FAIR_PLAY_2026_CONTRACT.id}@${FAIR_PLAY_2026_CONTRACT.version}\` contract. Edit the shared schema and regenerate this page instead of changing the table by hand.

## Modes

| Mode | Murder required | Principal investigator | Single culprit | Blocker waiver |
| --- | --- | --- | --- | --- |
${modes}

## Stable findings

| Code | Validation suite | Default severity | Meaning |
| --- | --- | --- | --- |
${rows}

## Required capabilities

${FAIR_PLAY_2026_CONTRACT.requiredCapabilities.map((capability) => `- \`${capability}\``).join("\n")}

Blockers prevent progression and publication. Major findings require author review before publication. Moderate, minor, and prose-pattern findings remain advisory unless a project policy explicitly promotes them.
`;

if (process.argv.includes("--check")) {
  const current = await readFile(target, "utf8").catch(() => "");
  if (current !== output) { process.stderr.write("Fair-play rule reference is stale. Run pnpm docs:generate.\n"); process.exit(1); }
} else {
  await writeFile(target, output, "utf8");
  process.stdout.write(`Generated ${target}\n`);
}
