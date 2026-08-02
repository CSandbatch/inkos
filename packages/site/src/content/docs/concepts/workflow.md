---
title: Supervised workflow
description: The durable agent DAG, capabilities, budgets, retries, and author gates.
slug: docs/concepts/workflow
---

The general-fiction workflow is:

`research → outline → scene plan → draft → validate → graph update → audit → reader panel → revise → approval`

Nodes declare typed inputs, outputs, dependencies, and one restricted capability: research, writing, canon mutation, or publishing. A job records timestamps, events, costs, cancellation, retry, and structured errors. Idempotency keys prevent duplicate runs after a crash or retry.

Generative nodes do not bypass deterministic validation. Canon and publication operations are separately permissioned, and the author remains the final authority for retcons, character identity or death, major arc changes, admitted research, and hard-gate waivers.

Mystery projects use:

`policy → research → sealed solution → evidence/timeline/access → solution approval → scene plan → draft → deterministic validation → adversarial solver + fairness/realism audits → reader panel + prose analysis → revise → re-audit → closure`

Artifacts are `reader-visible`, `solution-authorized`, or `author-only`. Capabilities such as `reader-view:read`, `solution:read`, and `solution:write` are checked before an artifact is returned. Every sealed-solution access attempt is recorded.
