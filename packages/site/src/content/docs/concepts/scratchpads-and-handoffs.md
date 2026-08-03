---
title: Scratchpads and handoffs
description: Preserve exploratory work without allowing it to become canon by accumulation.
slug: docs/concepts/scratchpads-and-handoffs
---

A scratchpad is where discovery work can stay provisional. It is not a smaller canon database and not a disposable chat transcript. NovelGraph stores it as a time-ordered record tied to one discovery session, so hypotheses, conflicts, alternatives, and questions can inform the next handoff without silently becoming a decision.

The canonical [agent-boundaries diagram](/novelgraph/diagrams/02-agent-boundaries.svg) describes the route from author input through Sol, Terra, and Luna to a context dossier and author decision.

Textual equivalent:

```text
Author → Sol coordinator → Terra deep analysis or Luna bounded work
                           ↓                         ↓
                     session scratchpad ←─────────────┘
                           ↓
                   role-specific dossier → author approval or revision
```

## What belongs in a scratchpad

Every scratchpad entry has an agent role, kind, content, optional confidence, source references, and timestamp. Its permitted kinds are deliberately modest:

| Kind | Appropriate use |
| --- | --- |
| `observation` | A compact statement noticed in a turn or source |
| `hypothesis` | A possible explanation, pressure, or story mechanism |
| `question` | A decision that needs author input or further evidence |
| `contradiction` | Two claims or directions that cannot both remain true as stated |
| `alternative` | A distinct route worth comparing, not merely a restatement |
| `digest` | A traceable summary of earlier exploratory material |

Source references matter even for internal material. An entry can point back to the turn, claim, prior entry, or other identifier that motivated it. Confidence is optional because an agent should be able to say “this is a question worth asking” without inventing numerical precision. When confidence is used, the input accepts values from 0 through 1.

The store keeps scratchpad entries in creation order. It does not deduplicate them, automatically promote them, or erase them when a later entry disagrees. A good handoff can refer to a contradiction and explain its resolution; it should not overwrite the fact that the contradiction existed.

## Roles create different kinds of handoff

Sol is the coordinator for the author’s conversation. It can read discovery, scratchpad, literary, series, and book material; it can write discovery records, propose charters and canon changes, and request approval. Its job is to choose the next consequential question and return decisions to the author, not to approve them.

Terra is the specialist route for structural judgment. It can read the same discovery, literary, series, and book context and can add scratchpad material or propose a charter. It does not receive the canonical-promotion or approval-request capability. That separation makes a useful review pattern: Terra can expose a weak character engine, a genre obligation, or an ending risk; Sol can present the resulting proposal; the author decides whether it governs the book.

Luna is a bounded worker. It can read discovery, scratchpad, literary, and book context, then write scratchpad entries. Its capability set excludes series reading and charter proposals. That is suitable for tasks such as extracting named entities from a turn, locating an explicit constraint, comparing two supplied alternatives, or identifying an unresolved observation. A smaller assignment should not arrive with unrelated continuity or authority.

| Handoff | Include | Do not imply |
| --- | --- | --- |
| Luna to scratchpad | Extracted observations, source references, uncertainty | That an extraction is a book fact |
| Terra to Sol | Structural analysis, alternatives, risks, charter-ready language | That Terra can approve or promote it |
| Sol to author | The decision, supporting context, and consequences | That a pending approval is already canon |
| Author decision to system | Approval or rejection with rationale | That rejected material disappears from history |

## What a dossier actually contains

`DiscoveryEngine.dossier(bookId, agentRole)` assembles a role-labeled snapshot and stores it in `context_dossiers`. Its content includes the latest approved charter, the knowledge bases available to the book, all approved claims from those bases, the current session’s scratchpad entries, unresolved discovery observations, and the capabilities for the requested role.

The important qualification is “approved claims.” A dossier does not promote a working note just because it is present in the session. At the same time, it includes unresolved observations so an agent can identify the question that needs attention rather than treating the approved charter as an exhaustive account of the book.

The current implementation gathers approved claims from the bases owned by the book or linked to it. It writes a new dossier record whenever a session exists. Dossiers are snapshots, not a live view that can be silently changed after a handoff. If a proposal later needs audit, the stored content shows what information and permissions framed it at that point.

## Turning exploration into a decision

The canonical [canon-promotion diagram](/novelgraph/diagrams/04-canon-promotion.svg) shows the intended route from conversation through extraction and synthesis to a typed proposal, author review, and either approved canon or a rejected direction.

Textual equivalent:

```text
Conversation → extraction → scratchpad → synthesis → typed proposal
                                                        │
                                      author approves ──┼── author rejects
                                                        ↓
                                                   approved claim
```

There are two formal decision routes in the discovery core. A proposed Story Charter creates a pending approval and requires a rationale on resolution. A proposed knowledge claim is promoted through `promoteClaim`, which also requires a rationale and records an approval identifier. Neither route turns scratchpad content into canon automatically.

That last rule matters most when an idea is repeated. Repetition may make a hypothesis more interesting; it does not change its provenance or status. A `digest` can make a long investigation readable, but it should link back to the entries it summarizes and preserve rejected alternatives when they explain why the chosen route was preferred.

## Implementation boundary

The scratchpad is persisted by the discovery API at `/api/v1/discovery/:sessionId/scratchpad`; it is not an execution queue. The current Studio room asks a fixed set of questions, records the author reply, and can write a Luna observation directly. No provider-backed Sol, Terra, or Luna worker is invoked by that interaction. The workflow job engine can persist caller-supplied handoff state, but the caller remains responsible for role execution.

The role capability lists are dossier metadata rather than route-level authorization. A caller integrating the API must apply the intended role boundary when reading a dossier or submitting a handoff. Charter approval and claim promotion remain explicit approval routes, so a scratchpad entry or repeated digest does not become canon merely because it has been stored.

## Practical handoff discipline

Before giving a task to another role, state the decision it is meant to inform, the sources it may use, and the status of each important statement. Return a result that separates facts, inferences, options, and questions. If a new premise is proposed, state what it would constrain or foreclose. If a contradiction is found, name both sides rather than quietly selecting one.

This produces a trail that remains useful after a draft changes direction. The scratchpad is where a book can think in public to its own project history. Canon is where it commits.
