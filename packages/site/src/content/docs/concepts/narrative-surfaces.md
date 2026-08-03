---
title: Narrative surfaces
description: Treat chapters, reader projections, and canon as connected but different records.
slug: docs/concepts/narrative-surfaces
---

The manuscript is a narrative surface: the words and ordering a reader encounters. It is not the complete internal account of the story. NovelGraph stores chapters and immutable revisions alongside story state, then uses bounded projections when a task must reason from what a reader could know rather than from everything recorded about the book.

The canonical [knowledge-layers diagram](/diagrams/03-knowledge-layers.svg) shows book canon projecting toward narrative surfaces. The [reader-projection diagram](/diagrams/08-reader-projection.svg) shows the more specific mystery path.

Textual equivalent:

```text
Approved book canon → narrative surfaces
Narrative revision → reconciliation proposal → approved book canon, if the author accepts it

Sealed solution ───── excluded ────┐
Reader-visible records → filter → reader projection → drafting and solver work
```

## A chapter is a current surface with a history

Each chapter belongs to a book and has a number, title, Markdown content, status, and timestamps. Creating a chapter also saves an initial revision. Updating a chapter saves another revision before replacing the current title or content. Revisions record the book, optional chapter, content, reason, actor, and timestamp. Restoring a revision updates the chapter’s current content and records a restoration event; the original revision remains in the history.

This means a prose change has an attributable surface history even if it does not change a graph record. A chapter revision is not itself an approved assertion that every implication of its prose is canon. The current core does not parse each edit into automatic canon changes. When a revision materially changes a fact, causality, promise, character identity, or other governed state, it should be reconciled through an explicit proposal and the appropriate approval path rather than assumed to have rewritten the underlying record.

| Record | Answers | Does not automatically answer |
| --- | --- | --- |
| Chapter | What is currently on the page? | What the full fictional truth is |
| Revision | What surface text existed and why it changed | Whether its implications are approved canon |
| Story claim or charter | What has been approved as governing state | How it has been revealed to the reader |
| Reader projection | What a bounded reader-facing task may use | The sealed solution or future reveals |

## Reader projection is chapter-bounded

Mystery work makes the distinction concrete. `readerProjection(bookId, throughChapter)` requires a configured mystery policy and builds a reader-facing view through the selected chapter. It includes:

- The policy without its internal `bookId`.
- Suspects introduced on or before the chapter.
- Evidence marked `reader-visible` whose first appearance is on or before the chapter.
- Reader-visible timeline events whose first appearance is on or before the chapter.
- Reader-visible character-knowledge records whose chapter is on or before the chapter.

The projection does more than hide one solution field. Suspect private fields such as actual movements, hidden pressure, unrelated secrets, and reasons a suspect is not responsible are removed. Evidence is recursively sanitized for keys such as `trueMeaning`, `culprit`, `solution`, `secret`, `actualEvent`, and `actualMovements`. Its corroboration and contradiction lists are filtered to evidence that is already visible. Access records, hypotheses, and solution-authorized deductions do not enter this projection.

This is a data boundary, not an instruction asking an agent to pretend ignorance. A drafting node in the mystery workflow has `reader-view:read` and produces a reader-visible artifact. The adversarial solver also has `reader-view:read`, so it attempts a solution from the same limited material. The fairness auditor receives `solution:read` and can compare that reader-facing case with the sealed solution and the solver result.

## Artifact visibility controls workflow handoffs

Workflow artifacts also declare visibility. `reader-visible` artifacts can be read by an agent with `reader-view:read`, `story:read`, or `solution:read`. `solution-authorized` artifacts require `solution:read`. `author-only` artifacts are not returned to agent nodes through artifact reads; they belong in the author-facing Studio.

| Mystery workflow stage | Required capability | Typical visibility |
| --- | --- | --- |
| Policy setup and research | `canon:propose` or `research:web` | Author-only |
| Solution and evidence architecture | `solution:write` or `solution:read` | Solution-authorized |
| Scene planning and drafting | `reader-view:read` or `draft:write` | Reader-visible |
| Validation, fairness, realism, review | Varies by task | Author-only |

Visibility and capability are checked separately from the prose. A scene can mention a clue only if the author has chosen to place it in the narrative, but the projection mechanism is what prevents a downstream drafting or solver task from receiving the sealed answer as context.

## Surface and state meet at audit

For a fair-play mystery, required evidence must be reader-visible, have a first appearance, and appear before its reveal. Deductions must cite existing evidence. The validator also checks timeline ranges, documented access, alternative solutions, reader trust, and constraints on oracle-like evidence. These checks use records, not a claim that the prose is automatically semantically understood.

When those records change, the mystery engine marks existing validation runs stale and records an audit-invalidation event. Closure then requires a current validation run as well as resolution of hard obligations and blocking reader feedback. This is why it is useful to keep the narrative surface and story state distinct: revisions can be creative and reversible, while the claims that make a resolution fair remain inspectable and auditable.

## Writing with the distinction in mind

Use the chapter surface to control sequence, tone, narration, and disclosure. Use the book state to track what must remain possible, what the reader has been promised, and what another scene relies on. When a revision changes only expression, it may remain a surface revision. When it changes a premise, a causal link, a clue’s meaning, or a locked solution, make the change visible in the relevant state and rerun the affected checks.

The purpose is not to force prose into database-shaped language. It is to prevent a convenient paragraph from quietly solving, contradicting, or erasing the story that other scenes are still trying to tell.
