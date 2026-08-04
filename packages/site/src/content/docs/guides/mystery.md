---
title: Build a fair mystery
description: Lock the solution, maintain the clue ledger, and audit solvability.
slug: docs/guides/mystery
---

NovelGraph includes the versioned `fair-play-detective-2026@1` and `english-prose-patterns-2026@1` packs. Select Strict Golden Age, Contemporary Fair-Play, Hybrid, or Rule-Breaking before planning. Contemporary is the default. Rule-Breaking is the only mode that permits a blocker waiver, and every waiver requires author rationale. The fair-play pack supplies policy and rule metadata to the mystery validator; it should not be read as proof that every cataloged rule is currently emitted or that prose is automatically interpreted.

Before drafting, record the actual event, apparent event, responsible parties, motive layers, method, opportunity, concealment, and reconstruction. Then build suspects, evidence, normalized chronology, access, character knowledge, hypotheses, and deductions. Lock the solution after author approval.

Each canonical evidence record records its source, kind, reliability, visibility, first appearance, reveal chapter, apparent meaning, true meaning, required status, red-herring status, and corroboration or contradiction links. Access, dependencies, payoff, and interpretation may need to be represented by the associated chronology, character-knowledge, deduction, or legacy clue-ledger records; they are not all fields on the canonical evidence schema. A later clue may clarify earlier evidence, but planting new decisive evidence retroactively requires an approved retcon.

Drafting and reader agents receive a chapter-bounded reader projection rather than the sealed solution. The adversarial solver uses that same projection and attempts an independent solution before the fairness auditor compares it with the sealed truth.

Publication remains blocked when decisive evidence is hidden or late, deductions lack evidence, access or chronology is impossible, the solution is unlocked, or narration withholds an indispensable fact. Major realism and character findings require author review. Prose-pattern findings remain advisory.

## Implementation boundary

The Studio API provides routes for mystery state, workbench views, validation, and reader projections under `/api/v1/books/:bookId/mystery/...`. Changing the mystery mode requires an approved outline-change request. Changing a locked solution requires an approved canon-retcon request, and such changes invalidate affected audits. The workflow describes drafting, solving, and fairness-review stages, but the current job engine persists caller-supplied transitions; it does not execute provider-backed Sol, Terra, or Luna workers.

The current editor can request prose-pattern analysis separately from mystery validation. That analysis is advisory and is not an automatic publication decision. Treat the structured mystery records and validation result as the implemented audit surface, and review the prose and any research admission separately.
