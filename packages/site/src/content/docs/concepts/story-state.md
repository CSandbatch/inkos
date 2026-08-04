---
title: Story state and closure
description: Typed canon, obligations, knowledge boundaries, and the definition of publishable.
slug: docs/concepts/story-state
---

The manuscript is one readable surface over a deeper record. NovelGraph stores characters, locations, objects, factions, world rules, relationships, knowledge, clues, promises, and causal dependencies as typed records. Revisions show how the surface changed; events show who proposed or applied a state change, the previous and next values, supporting evidence, rationale, and approval status.

## Claims and authority

Every knowledge claim has a scope, provenance, and status. An author statement is not interchangeable with an agent inference. Literary guidance can influence a proposal but does not become a fictional fact. Run scratchpads preserve working hypotheses without granting them authority.

The ordinary path is:

```text
observation -> working claim -> proposal -> author decision -> approved canon
```

Rejected and superseded claims remain available to the audit history. This prevents an abandoned direction from returning as if it had always been true.

## Obligations

An obligation represents something the book owes: a setup, clue, promise, dependency, character commitment, or reveal. It records an owner, deadline or target chapter, evidence links, dependencies, hardness, and status.

| Status | Meaning |
| --- | --- |
| Open | The obligation still requires action |
| Resolved | The narrative supplied an evidenced payoff |
| Deferred | The author deliberately postpones the obligation; the current database method does not yet require a later target |
| Waived | The applicable policy permits an author-approved exception with rationale |

An open hard obligation blocks closure. Good practice is to give every deferral a later target, although the present alpha does not enforce that field. A waiver records an exception; it does not erase the failed rule from the closure report.

## Knowledge boundaries

Character knowledge is tracked separately from author and solution knowledge. A scene can therefore be checked for impossible decisions or leaked information. Mystery reader projections add a second boundary: they expose only evidence available through a selected chapter and exclude sealed meanings or future deductions.

## Closure

The implemented closure report checks open hard obligations, blocking reader feedback, mystery audit state and findings, and recorded waivers. It does not yet perform a broad graph-invariant audit or include every pending approval. A book passes the current gate only when those implemented blockers have an allowed disposition.

“Publish-ready” has a narrow operational meaning: no unresolved hard story obligation remains under the selected policy. It does not certify literary quality, factual truth, market fit, legal clearance, or commercial success. The author must still inspect the manuscript and generated reports before distributing an export.

The current API can evaluate closure and resolve obligations. The Studio displays the report but does not yet provide complete controls for every resolution path. See [capability status](/novelgraph/docs/reference/capability-status/) before relying on the interface for an end-to-end production run.
