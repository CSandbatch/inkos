---
title: Public copy
description: Edit, lint, and release public NovelGraph wording with repository evidence.
slug: docs/contributing/public-copy
---

Public copy is a release surface. Treat repository code, workflow files, package manifests, and canonical diagram sources as the evidence boundary. Do not add claims about a person, former project identity, hidden service behavior, or data collection that the repository cannot demonstrate.

## Scope

The public-copy checker scans tracked `README.md`, `SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md`, `.github`, `packages/site/src`, and selected CLI/core source files. It strips fenced code, inline code, HTML, frontmatter, and simple object literals before checking English prose patterns.

The relevant files are:

| Content | Path | Ground truth |
| --- | --- | --- |
| Documentation | `packages/site/src/content/docs/` | Starlight frontmatter and rendered routes |
| Landing pages | `packages/site/src/pages/` | Static fixture behavior and visible product claims |
| Copy rule pack | `packages/core/src/studio/prose-patterns.ts` | Pattern categories, locations, and suggestions |
| Checker | `scripts/lint-public-copy.mjs` | Tracked-file set, stripping rules, report, exit status |
| Temporary report | `copy-lint-report.json` | Local findings; do not commit it |

## Editing rules

- State the operation, path, command, response, or gate that proves the claim.
- Use “proposal”, “approval”, “finding”, “revision”, and “export” for the actual domain records. Do not describe a model as a person or assign it creative ownership.
- Do not claim that a closure pass proves literary quality, sales success, factual truth, or a particular source of writing.
- Do not claim hosted storage, accounts, collaboration, telemetry payloads, or provider behavior beyond the code and workflow configuration.
- Keep the public language in English. Preserve code identifiers exactly, including package names and capability strings.
- When a diagram is added, include descriptive alt text and a prose or table equivalent in the same document. The diagram sources under `docs/diagrams/` are canonical; `packages/site/public/diagrams/` contains derived SVG and PNG assets.
- Avoid broad benefit language when a concrete observation is available. Replace a speed or ease promise with a measured command, endpoint, file path, or failure state.

## Verification loop

From the repository root:

```bash
corepack pnpm --filter @actalk/novelgraph-core build
corepack pnpm copy:report
corepack pnpm copy:lint
corepack pnpm site:build
```

Use `copy:report` while exploring findings; it exits successfully even when findings remain. Use `copy:lint` for the release check; unresolved findings set a non-zero exit code.

The checker writes `copy-lint-report.json` at the repository root. Review each `REVIEW` line, change the copy when possible, and rerun the checker. If a phrase is required for a concrete technical reason, add a narrowly scoped entry to `copy-lint-allowlist.json` with a rationale and, when appropriate, an expiry. Do not silence a finding by moving it into code formatting or by adding an unbounded allowlist rule.

`site:build` runs `astro check` and `astro build`; it catches invalid Starlight frontmatter, broken content imports, and site compilation errors. It does not run the copy checker. The Pages workflow currently enforces the site build only, so run the copy check locally before merging.

## Review boundary

Review public copy against the implementation that owns the behavior:

| Claim type | Inspect |
| --- | --- |
| Local port, host, files, and routes | `packages/studio/src/server.ts`, CLI commands, `reference/configuration.md` |
| Store authority, revisions, migrations, and closure | `packages/core/src/studio/store.ts`, `docs/adr-001-sqlite-source-of-truth.md` |
| Agent access | `packages/core/src/studio/domain.ts`, `workflow.ts`, `discovery.ts` |
| Package and Pages gates | `.github/workflows/release.yml`, `.github/workflows/pages.yml`, root `package.json` |
| Diagram meaning | `docs/diagrams/*.mmd` and the paired accessible text |

When code does not expose an operation, say so. A documentation page must not invent a command, endpoint, release gate, restore button, or hosted service.

## Accessible copy contract

Use a useful image alternative, then explain the same relationship in text. For a workflow diagram, name the states and transitions. For a topology diagram, name the nodes, stores, and authority direction. For a release diagram, list the ordered gates and the failure branch. Readers must be able to complete the task without seeing the image.
