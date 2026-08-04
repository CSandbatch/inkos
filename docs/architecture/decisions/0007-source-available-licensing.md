# ADR-0007 · Source-available licensing

**Status:** **Proposed** — not agreed
**Date:** 2026-08-04

## Context

The product is not open source. It should be readable: its core claim is that its work is
inspectable and auditable, and a system asking to be trusted with a novel benefits from being
readable.

The repository currently declares **MIT** while carrying **AGPL-3.0** lineage. Both facts are
problems, and the second is the serious one: AGPL-derived code cannot be relicensed
proprietary.

## Decision (proposed)

Adopt a source-available licence — FSL or BUSL 1.1 with a conversion date — permitting reading,
modification, and non-competing use while blocking a hosted competitor.

**This ADR is `Proposed`, not `Accepted`.** The licence is unchosen, and the clean-room
question in `plan/05-open-questions.md` Q1 is unresolved. Marking it accepted would assert a
decision nobody has made.

## Alternatives

| Option | Trade |
|---|---|
| **FSL / BUSL 1.1** | Readable, competitor-blocking, conversion date required |
| **Elastic 2.0** | No conversion date; least permissive |
| **Fully proprietary** | Loses the inspectability the product's thesis leans on |
| **Open source** | Rejected — D5 |

## Blocked on

- Which licence (Q1b).
- Whether `inkos/` is the real repository or a prototype (Q1a). The AGPL lineage travels with
  it, and MIT is wrong **today**, not merely at release.

## Consequences while unresolved

Every source file added here accrues provenance risk. The provenance ledger mitigates by
recording what is post-fork and carryable; it does not resolve.
