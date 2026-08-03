---
name: novelgraph
description: Operate the local-first NovelGraph fiction production Studio for conversational discovery, story knowledge, supervised workflows, mystery fairness, review, and export.
version: 0.5.0
metadata: { "openclaw": { "requires": { "bins": ["novelgraph", "node"], "env": [] }, "primaryEnv": "", "homepage": "https://github.com/CSandbatch/novelgraph", "install": [{ "id": "npm", "kind": "node", "package": "@actalk/novelgraph", "label": "Install NovelGraph from npm" }] } }
---

# NovelGraph

NovelGraph treats a manuscript as the visible narrative surface of a structured story knowledge base. It is local-first, English-only, and designed for an author who wants inspectable agent work instead of an unrestricted prose generator.

## Use this skill when

- An author wants to discover a book through conversation.
- A book needs an approved Story Charter before planning or drafting.
- Canon, series context, literary guidance, and agent scratchpads must remain distinct.
- A mystery needs sealed-solution permissions, clue fairness, and alternative-solution checks.
- An author needs review, revision, rollback, closure, or export operations.
- A developer needs to inspect the local Studio, API, SQLite state, or workflow DAG.

## Product boundaries

- Sol is the only conversational coordinator.
- Terra performs literary, structural, thematic, and deep-audit work.
- Luna performs bounded extraction, retrieval, comparison, and deterministic validation.
- Agent output is a proposal until the author approves canon promotion.
- Each book is self-contained. A book may reference an optional series knowledge base.
- The literary knowledge base contains criticism and craft guidance, never fictional canon.
- Run scratchpads are durable and auditable but noncanonical.
- Manuscript prose and outlines are revisioned surfaces over the book graph.
- Manuscript prose-pattern findings are advisory and never claims about authorship.

## Start the local Studio

From a project directory:

```bash
npx @actalk/novelgraph studio
```

For a locally installed CLI:

```bash
novelgraph studio
```

The server binds to loopback by default. Do not expose it to a LAN unless the author explicitly requests that change and understands the warning.

## Discovery workflow

1. Create or open a book shell in Studio.
2. Enter the Discovery Room.
3. Let Sol ask one consequential question at a time.
4. Inspect the current understanding, provenance, contradictions, open questions, and delegated scratchpad work.
5. Compare the Core, Stretch, and Wild story-thrust candidates.
6. Select, combine, edit, or reject the candidates.
7. Approve the Story Charter.
8. Start the production DAG only after approval.

Do not bypass the charter gate with a legacy write command. Material charter changes require impact analysis and renewed author approval.

## Knowledge handling

Build a task-specific context dossier before agent work. Include only:

- approved Story Charter fields relevant to the task;
- required book claims;
- selected series claims with visible provenance;
- cited literary guidance;
- the compact scratchpad digest and unresolved questions;
- the permitted reader or sealed-solution projection;
- explicit capabilities for that node.

When a book claim conflicts with its linked series, create a series-impact proposal. Never resolve the conflict silently. Keep rejected directions and superseded claims available for audit so resumed work does not repeat abandoned reasoning.

## Production workflow

The standard supervised path is:

```text
discovery -> charter approval -> policy setup -> research -> planning -> draft
-> deterministic validation -> graph update proposal -> specialist audits
-> reader panel -> revision -> re-audit -> author approval -> closure -> export
```

Inspect blocked nodes in the DAG control room. Retry only idempotent work, resume from persisted artifacts, and preserve the original error record. Canon retcons, major arc changes, sealed-solution changes, mode changes, and hard-gate waivers require author approval.

## Mystery work

Use the Mystery Workbench to lock the actual event, apparent event, responsibility, motive, method, concealment, and chronology before drafting. Evidence must record reader visibility, first appearance, apparent meaning, true meaning, reliability, provenance, custody, corroboration, and dependencies.

Drafting and reader-panel nodes receive the reader projection. They must not receive the culprit, future deductions, hidden true meanings, or author-only material. The adversarial solver works from the same reader-visible record. A viable competing solution blocks closure in modes that require fair play.

## Prose inspection

Run advisory inspection with:

```bash
novelgraph inspect-prose <path>
```

Interpret matches as places for human review. Do not describe them as evidence that a person or model wrote the text. Do not rewrite prose automatically from a pattern match.

## Verification and export

Before marking a book publish-ready, confirm:

- no hard obligation remains unresolved;
- every deferral and waiver has an author rationale;
- character knowledge, state, and chronology are consistent;
- reveals and deductions link to visible evidence;
- all required audits remain valid after the latest revision;
- the closure report states any permitted rule-breaking plainly.

Exported Markdown is portable output, not the authoritative state. SQLite, revision snapshots, events, approvals, and graph records remain authoritative.

## Documentation

Use the hosted manual at `https://csandbatch.github.io/novelgraph/docs/getting-started/` for installation and recovery. Architecture, discovery, knowledge boundaries, agent capabilities, mystery rules, privacy, deployment, and release operations have dedicated pages linked from the site navigation.
