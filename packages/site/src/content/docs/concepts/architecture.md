---
title: Architecture
description: How SQLite, the story graph, revisions, and the supervised DAG fit together.
slug: docs/concepts/architecture
---

InkOS separates creative proposals from authoritative story state.

```text
Studio / CLI
     │
Hono API v1
     │
SQLite transaction boundary
 ├── series → books → chapters → scenes
 ├── graph entities and relationships
 ├── obligations, clues, and approvals
 ├── immutable revisions and attributable events
 └── durable jobs, nodes, artifacts, and budgets
```

SQLite is authoritative. Markdown and JSON are export formats. Agents retrieve context and propose state changes, but retrieved knowledge never silently becomes canon.

### Invariants

- Every book belongs to a series.
- Every chapter revision is immutable and attributable.
- Major canon changes require an approval record.
- A hard obligation must be resolved, deliberately deferred, or waived with rationale.
- A mystery solution is established before the reveal and significant clues have documented payoffs.
- Jobs are resumable and cannot spend beyond their run or monthly caps.
