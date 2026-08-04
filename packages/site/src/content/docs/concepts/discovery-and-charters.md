---
title: Discovery and Story Charters
description: Turn an exploratory conversation into an approved premise that can govern production.
slug: docs/concepts/discovery-and-charters
---

Discovery is the interval before NovelGraph is allowed to treat a book idea as a production premise. It records what the author says, what an agent has inferred, what remains unresolved, and the alternatives considered. Its output is not a manuscript or an outline. Its decisive output is an approved Story Charter.

The lifecycle is shown in the canonical [discovery-state diagram](/novelgraph/diagrams/01-discovery-state.svg) and [charter-lifecycle diagram](/novelgraph/diagrams/05-charter-lifecycle.svg).

## Implementation boundary

The discovery model is implemented as a stateful core and Studio API, not as a provider-backed conversation runner. The current Studio discovery room uses a fixed sequence of questions. An author reply is recorded and the current UI can add a Luna observation to the session scratchpad; it does not invoke Sol, Terra, or Luna through an external provider. The workflow job engine can persist a durable DAG supplied by its caller, but it does not execute those roles by itself.

The API exposes discovery start/read and turn routes at `/api/v1/books/:bookId/discovery` and `/api/v1/discovery/:sessionId/turns`, plus scratchpad, thrust, charter, approval, claim, and dossier routes. Role capabilities are included in dossiers as context metadata; the discovery and knowledge routes do not independently enforce those capabilities. Treat the role tables below as the intended handoff contract and the current dossier shape, not as an authorization boundary.

Textual equivalent:

```text
Book shell → active discovery → charter proposed → author decision
                                     │                 ├─ approve → approved charter → production
                                     │                 ├─ revise → active discovery
                                     │                 └─ reject → keep exploring
                                     └─ material change after approval → impact review → replacement or keep current
```

## What a discovery session records

Starting discovery for a book first ensures that its literary, series, and book knowledge bases exist. If there is already an `active` or `charter-proposed` session for that book, NovelGraph reuses the most recently updated one. Otherwise it creates a new active session with the opening question: “What experience should remain with the reader after the final page?”

Turns are deliberately small records: an `author` or `sol` role, an ordinal, content, and timestamp. A turn may carry observations. An observation has a key and a JSON value, but it also carries the distinction that matters during discovery:

| Field | Meaning |
| --- | --- |
| Provenance | `author-stated`, `agent-inferred`, `literary-guidance`, or `agent-proposed` |
| Confidence | Optional number from 0 through 1 |
| Status | `working`, `unresolved`, `proposed`, `rejected`, `approved`, or `superseded` |

That metadata prevents a useful interpretation from being presented as something the author actually decided. “The reader should suspect the sister” can be author-stated; “the sister is the cleanest suspect because she carries the family obligation” is an inference; “a cited craft source recommends a competing suspect” is guidance. All three can inform discussion, but they have different authority.

## Candidate thrusts are alternatives, not hidden commitments

A discovery session can contain three kinds of story-thrust candidate: `core`, `stretch`, and `wild`. These labels do not rank a candidate as correct. They provide a disciplined way to compare the most direct reading of the conversation, a version that intensifies an existing pressure, and a neighboring possibility that may reveal a preference through contrast.

Each candidate is a typed proposal with a title, main thrust, reader promise, character engine, central conflict, thematic pressure, genre obligations, ending shape, risks, and foreclosures. The last two fields are particularly useful in a charter discussion. A candidate should name what it makes harder to write, what it may rule out, and what promise it asks the author to keep. Proposing a candidate changes the session status to `charter-proposed`; it does not approve a premise and does not create canon.

## The Charter is the production contract

The Story Charter is a versioned record attached to one book. Its required core is a `mainThrust`, at least one `readerPromise`, a structured `protagonist` value, and a `centralConflict`. It can also record:

- `genreContract`
- `thematicQuestions`
- `narrativeForm`
- `endingHorizon`
- `constraints`
- `productiveUnknowns`
- `rejectedDirections`

This is a charter, not a full synopsis. `productiveUnknowns` make room for discovery that should happen during planning and drafting. `rejectedDirections` preserve a deliberate “no,” so a later suggestion can be evaluated against a decision rather than rediscovered as an apparently fresh idea. The charter’s `narrativeForm` is a record rather than a fixed enumerated schema, so it can hold the form decisions a project actually needs without inventing one template for every book.

| Charter field | The question it holds still |
| --- | --- |
| Main thrust | What is this book fundamentally doing? |
| Reader promise | What experience, pressure, or payoff does the book owe? |
| Protagonist and central conflict | Whose choices drive the work, and against what force? |
| Genre contract | Which genre obligations are accepted for this book? |
| Ending horizon | What kind of resolution must the ending move toward? |
| Constraints and rejected directions | What is out of bounds, even if it later seems expedient? |

## Approval changes the system state

When a charter is proposed, NovelGraph assigns the next version number and creates a pending approval record. Resolving that decision requires a non-empty author rationale. On approval, any previously approved charter for the same book becomes `superseded`, the proposed version becomes `approved`, and non-superseded discovery sessions for the book are marked approved. The decision is also recorded as an attributable event with the charter content and the author’s rationale.

If the book has no chapters, approval creates chapter 1, titled “Opening,” with empty content. That is a practical transition into writing; it is not evidence that an opening scene has been designed or drafted. Rejection marks only the proposed charter as rejected and leaves the author able to continue the conversation.

Production has a hard gate here. `WorkflowHarness.start` checks for an approved charter before it creates a job or inserts workflow nodes. An outline, drafting run, or review pass therefore cannot begin merely because a candidate is persuasive or an agent has produced a polished description.

## Revision after approval

A charter is not immutable, but changing it should be explicit. The lifecycle diagram represents the path from an approved version through impact review to either a superseding replacement or retention of the current version. In the current core implementation, approving a later charter version supersedes the earlier approved version; the system does not yet calculate a complete dependency impact set for charter edits. Treat a proposed replacement as a premise-level change and inspect its consequences for existing scenes, obligations, mystery records, and audits before approving it.

The useful question is not whether a charter makes the book rigid. It is whether a later change is visible enough to revise the work that depended on the earlier choice. Discovery gives the author a record of why the governing premise was adopted. The charter gives production a stable premise until the author decides that premise has changed.
