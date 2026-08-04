# ADR-0005 · Canonical commits require a human

**Status:** Accepted
**Date:** 2026-08-04

## Context

The product's claim is governed authorship. If a model can commit canon, there is no
governance — only automation with extra logging.

## Decision

**No path exists by which a worker commits canonical state.** Workers produce artifacts.
Validators produce findings. A human resolves an approval. Only an approved
`canonical_transaction` moves a current pointer.

`approval_events` distinguishes `approved` from `edited-and-approved`, preserving three
distinct objects: the worker artifact, the author-edited artifact, and the final revision.

## Alternatives rejected

- **Auto-approve below a confidence threshold.** Confidence is self-reported. This is the
  mechanism by which a plausible suggestion becomes canon.
- **Auto-approve mechanical changes.** The boundary is not stable enough to encode.

## Consequences

- Unattended full-book generation is out of scope by construction, not by omission.
- Approval is a first-class domain object, not a boolean.
- Attribution stays answerable: an author asked who wrote the book has a real answer.
