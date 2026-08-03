---
title: Knowledge boundaries
description: Keep guidance, canon, exploratory material, and reader-visible information distinct.
slug: docs/concepts/knowledge-boundaries
---

NovelGraph does not treat all information about a book as equally authoritative or equally visible. A craft note, a series fact, an unapproved hypothesis, the sealed explanation of a mystery, and a sentence on the page may all concern the same event. They must not therefore travel together or acquire the same permissions.

The canonical [knowledge-layers diagram](/diagrams/03-knowledge-layers.svg) gives the broad shape. The [agent-boundaries diagram](/diagrams/02-agent-boundaries.svg) and [reader-projection diagram](/diagrams/08-reader-projection.svg) show the corresponding context and visibility boundaries.

| Layer | What it holds | Authority | How it reaches a book |
| --- | --- | --- | --- |
| Literary | Craft material and cited guidance | Advisory | Linked as literary guidance during discovery |
| Series | Continuity claims for a series | Canon only when approved | Linked to books in that series |
| Book | Claims and charter for one book | Canon only when approved | Owned by that book |
| Run | Scratchpad observations and alternatives | Noncanonical | Attached to one discovery session |
| Narrative surface | Chapters and revisions | Manuscript record | Separate from a claim’s approval path |

## Claims have provenance and status

Scoped knowledge claims are stored as a subject, predicate, JSON value, provenance, status, source references, and optional approval identifier. The available scopes are `literary`, `series`, `book`, and `run`. Claim provenance is one of `author-stated`, `agent-inferred`, `literary-guidance`, or `agent-proposed`; status is one of `working`, `unresolved`, `proposed`, `rejected`, `approved`, or `superseded`.

The distinction is operational. `DiscoveryEngine.addClaim` refuses an incoming claim whose status is already `approved`. Creative claims enter as proposals. `promoteClaim` requires a nonblank rationale, requests a `canon-promotion` approval, resolves that approval, and only then changes the claim to `approved` with the approval identifier. This is a narrow protection, but a useful one: an agent does not write its own conclusion directly into approved story state.

Only approved claims are gathered into a discovery dossier. Working and unresolved observations remain separately visible as unresolved material. A dossier may therefore tell an agent both “this is established for the book” and “this still needs a decision,” without presenting either as the other.

## Context is role-bounded

The discovery roles do not receive the same capabilities.

| Role | Read/write boundary in discovery |
| --- | --- |
| Sol orchestrator | Reads discovery, scratchpad, literary, series, and book context; can write discovery; can propose charters and canon changes; can request approval |
| Terra specialist | Reads discovery, scratchpad, literary, series, and book context; can write scratchpad entries and propose charters |
| Luna worker | Reads discovery, scratchpad, literary, and book context; can write scratchpad entries; does not receive series-reading or charter-proposal capability |

Capabilities are not a claim that a role is wiser or less creative. They define which system action a role may take. In particular, Terra can produce a charter proposal but not a canon-promotion action; Luna’s current capability set omits both `series:read` and `charter:propose`. Sol can request approval, but an approval remains a separate author decision.

NovelGraph persists the assembled context dossier with its session, book, agent role, content, and creation time. That stored record is useful when a proposal needs review: it makes the supplied charter, approved claims, scratchpad entries, unresolved observations, and capabilities inspectable rather than reconstructing them from an unrecorded prompt.

## Mystery boundaries add reader visibility

Mystery records use a second, stricter boundary. Evidence, timelines, character knowledge, deductions, and workflow artifacts carry one of three visibility values:

| Visibility | Who may receive it |
| --- | --- |
| `reader-visible` | A reader-view agent; agents with broader story or solution capability |
| `solution-authorized` | Agents with `solution:read` |
| `author-only` | The author-facing Studio, not agent nodes through artifact reads |

The sealed solution does not enter the reader projection. A reader projection through a chapter includes the policy without its `bookId`, suspects introduced by that chapter, reader-visible evidence first appearing by that chapter, reader-visible timeline items, and reader-visible character-knowledge records. Private suspect fields, true meanings, culprits, secret or actual-event fields, access records, hypotheses, and solution-authorized deductions are excluded or sanitized. Evidence links are also filtered so an exposed record does not point to an undisclosed one.

This is why a drafting agent and an adversarial solver can receive the same chapter-bounded reader projection while a fairness auditor may read the sealed solution and compare the two. The boundary supports fair-play testing; it does not prove that generated prose has followed it. Deterministic validation separately checks, among other rules, that required evidence is reader-visible and appears before its reveal.

## Boundaries are not hierarchy by prestige

Literary guidance can be excellent and still not establish that a character owns a house. A series fact can matter to continuity and still not resolve this book’s local conflict. A reader-visible clue can be real on the page while its true meaning remains unavailable to the drafter. A scratchpad idea can be the best answer and still require approval before it becomes canon.

When reviewing a proposal, ask three questions: What layer did this come from? What is its status and provenance? Who was permitted to see it? Those questions expose most accidental authority leaks. They also make a later change legible: the author can revise a premise or admit a claim without pretending that the previous version was never considered.
