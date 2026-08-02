<p align="center"><img src="assets/logo.svg" width="78" alt="InkOS geometric ink mark"></p>

<h1 align="center">InkOS</h1>
<p align="center"><strong>A local agent production OS for fiction.</strong></p>
<p align="center">Plan, draft, audit, and close a novel through an inspectable workflow you control.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@actalk/inkos"><img src="https://img.shields.io/npm/v/@actalk/inkos.svg?color=42d9ef" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f1f3ef" alt="MIT license"></a>
  <a href="https://github.com/CSandbatch/inkos/actions/workflows/ci.yml"><img src="https://github.com/CSandbatch/inkos/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/status-alpha-f0b64d" alt="Alpha status">
</p>

<p align="center">
  <a href="https://csandbatch.github.io/inkos/">Website</a> ·
  <a href="https://csandbatch.github.io/inkos/demo/">Interactive demo</a> ·
  <a href="https://csandbatch.github.io/inkos/docs/getting-started/">Documentation</a> ·
  <a href="https://csandbatch.github.io/inkos/docs/roadmap/">Roadmap</a>
</p>

![InkOS Signal Grid: a manuscript connected to causal and workflow nodes](packages/site/public/assets/signal-grid-hero.png)

> InkOS is alpha software. The transactional core, Fair-Play Detective 2026 rule pack, and Studio vertical slice are usable, while end-to-end autonomous node execution and advanced graph views remain active development.

## Start in one command

Requires Node.js 22.13 or newer. That is the first Node 22 release where the built-in SQLite module is enabled without an experimental flag.

```bash
npx @actalk/inkos studio
```

Studio opens on `127.0.0.1`, creates a local `.inkos/studio.sqlite`, and guides you through series, book, genre, budget, and privacy setup. A real npm release containing Studio is required for the `npx` command; contributors can currently run `pnpm --filter @actalk/inkos-studio dev` from this checkout.

Want to inspect the product first? The [seeded mystery demo](https://csandbatch.github.io/inkos/demo/) uses fixture data, makes no model calls, asks for no credentials, and writes no manuscript data.

## The first production loop

```text
research → outline → scene plan → draft → deterministic validation
         → story-graph proposal → continuity/mystery audit
         → reader panel → revise → author approval
```

1. Create a series and book in Studio.
2. Draft the opening; every save creates an immutable revision.
3. Inspect character knowledge, relationships, clues, and obligations.
4. Start a budgeted, durable workflow.
5. Review evidence-backed findings and approve canon changes.
6. Export only when the closure report has no critical finding.

## Why InkOS is different

| Capability | What InkOS guarantees |
| --- | --- |
| Transactional story state | SQLite—not prompt context or Markdown files—is authoritative. |
| Inspectable agents | Nodes have typed dependencies, capabilities, costs, events, cancellation, and resume state. |
| Attributable canon | Every material state change records actor, before/after values, source, and rationale. |
| Plot closure | Hard setups, clues, promises, and commitments block publication until resolved, deferred, or explicitly waived. |
| Fair mysteries | Culprit and solution logic are established before the reveal; decisive retroactive clues require a retcon. |
| Human authority | Major creative changes, research admission, and gate waivers require author approval. |
| Local privacy | Manuscripts, credentials, graph state, and model responses remain on your machine. |

## Architecture

```text
React Studio / CLI / fixture demo
              │
         Hono API v1
              │
      SQLite transaction boundary
   ┌──────────┼───────────┬──────────────┐
 revisions  story graph  obligations   durable DAG jobs
   │           │             │              │
 Markdown   continuity    closure gate   artifacts + budgets
 exports      audits       + approvals      + retries
```

The monorepo contains:

- `packages/core`: domain schemas, SQLite store, story graph, mystery ledger, knowledge retrieval, research provenance, and workflow harness.
- `fair-play-detective-2026`: four mystery modes, sealed solutions, reader projections, evidence/timeline/access matrices, specialist validation, and auditable waivers.
- `english-prose-patterns-2026`: aggressive advisory prose-pattern locations without AI-authorship classification or automatic rewriting.
- `packages/cli`: command-line client and local Studio launcher.
- `packages/studio`: React authoring/control interface and Hono API.
- `packages/site`: Astro/Starlight website, documentation, and fixture-backed demo.

## Current boundaries

- English-only, fresh projects, local single-author use.
- No accounts, collaboration, cloud sync, or managed manuscript hosting.
- Markdown and JSON are portability exports, not authoritative state.
- Web research is untrusted until the author approves it into canon.
- Generated prose still requires human editorial judgment; a passing closure gate is not a quality or sales guarantee.

## Develop

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm site:dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [development guide](https://csandbatch.github.io/inkos/docs/contributing/development/).

## License

[MIT](LICENSE). Original InkOS code and explicitly identified project assets are distributed under this license; supplied reference works and research snapshots retain their own rights and are never silently incorporated into the project library.
