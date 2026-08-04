# ADR-0001 · TEI is authoritative for manuscript content

**Status:** Accepted
**Date:** 2026-08-04
**Supersedes:** `docs/adr-001-sqlite-source-of-truth.md` (partially)

## Context

The alpha stores chapter text in `chapters.content_markdown`, a mutable SQLite column. That
makes "what did the author approve" unanswerable: an update overwrites the previous state, and
revisions are a parallel table rather than the thing itself.

Annotations, validation findings, and graph assertions all need to target durable positions in
the text. A mutable column offers nothing to target.

## Decision

Approved manuscript content is an **immutable, content-addressed TEI document**. SQLite holds
a pointer (`works.current_revision_id`); the bytes live at
`works/<work-id>/revisions/<content-hash>.tei.xml`.

`chapters` survives as a **regenerable projection**, with a test proving it can be rebuilt
from TEI.

Revision ID and content hash are deliberately distinct: the revision ID identifies a
governance event, the hash identifies bytes. Two approvals may yield identical content.

## Alternatives rejected

- **Markdown + revision table.** What exists. No schema, no validation, no stable identifiers.
- **A custom JSON AST.** Cheaper, and loses standards conformance, interchange, and the
  digital-humanities positioning that motivates the choice.
- **TEI-per-genre schema forks.** Every pack combination becomes a schema-composition problem.
  Genre structure lives in `<standOff>`, typed `<note>`, and `<interp>` instead.

## Consequences

- An ODD, generated Relax NG, and Schematron are required (Phase 2).
- **Editing is the unsolved problem.** Authors will not edit XML, and a rich-text editor
  round-tripping to TEI churns the `xml:id`s everything targets. `tei_identifier_mappings`
  records the damage; it does not prevent it. See `plan/05-open-questions.md` Q2.
- Migrated Markdown becomes a *migration artifact*, never a TEI revision, until validated.

## Revisit if

TEI editing proves unsolvable at acceptable cost, and block-level editing is rejected as a
product constraint.
