---
title: Architecture
description: How SQLite, knowledge scopes, revisions, and the supervised DAG fit together.
slug: docs/concepts/architecture
---

NovelGraph separates author-approved story state from proposals, operational records, and rendered prose. A book is not a folder of manuscript files with incidental metadata. It is a transactional knowledge base whose manuscript surfaces can be revised without erasing the facts and decisions that produced them.

```text
Browser Studio / CLI
          |
      Hono API v1
          |
 SQLite transaction boundary
  |-- series and book knowledge
  |-- chapters, scenes, and immutable revisions
  |-- graph entities, relationships, and obligations
  |-- discovery turns, charters, and approvals
  |-- mystery policy, evidence, and sealed solution
  `-- durable jobs, nodes, artifacts, events, and budgets
```

The local Studio process binds to loopback and serves both the React client and the versioned API. SQLite is authoritative. Markdown and JSON are generated exports for portability and inspection; editing an export does not alter canon.

## Knowledge scopes

NovelGraph keeps four scopes distinct:

| Scope | Purpose | Canonical? |
| --- | --- | --- |
| Literary | Criticism, genre theory, craft guidance, and cited research | Guidance only |
| Series | Shared chronology, recurring entities, terminology, and cross-book obligations | Yes, after author approval |
| Book | The Story Charter, cast, world state, obligations, and book-specific facts | Yes, after author approval |
| Run | Scratchpads, hypotheses, unresolved questions, and handoff summaries | No |

A task-specific context dossier selects records from these scopes according to the receiving agent's role and capabilities. Retrieval does not promote a claim. A contradiction between a book and its linked series creates an explicit proposal rather than silently overwriting either record.

## Discovery and production boundaries

Book creation first produces a shell. Discovery turns, observations, and candidate thrusts accumulate until the author approves a Story Charter. Charter approval creates the initial chapter and permits production work to begin.

The durable job engine persists a production graph and exposes ready nodes through the API. At this alpha stage, the repository does not ship an automatic model worker. Starting a workflow therefore records the job but does not cause Sol, Terra, or Luna to execute. An external worker must claim ready work through the node API. The [capability status](/novelgraph/docs/reference/capability-status/) records this distinction for every public feature.

## Invariants

- Every book belongs to a series record, even when no wider series continuity is used.
- Every chapter save creates an immutable, attributable revision.
- Creative proposals enter book or series canon only through author approval.
- Hard obligations block publication until resolved, deliberately deferred, or waived under the applicable policy.
- A mystery solution is established before its reveal, and significant clues link to their appearances and payoffs.
- Sealed solution fields are excluded from drafting and reader projections unless the caller holds an explicit solution capability.
- Fair-play policy, evidence, chronology, access, knowledge, hypotheses, deductions, findings, and waivers are versioned SQLite records.
- Job events survive process restart, and a job cannot exceed its configured budget.

## Trust boundary

The current local API has no account authentication. Loopback binding and browser-origin checks are therefore security boundaries, not conveniences. Do not expose the Studio port to a LAN or public network. Manuscripts, SQLite files, exports, and credentials stay under the chosen project root unless an operator deliberately copies or transmits them.

See [local deployment](/novelgraph/docs/operations/local-deployment/) for the process layout and [Studio API v1](/novelgraph/docs/reference/api/) for the executable surface.
