# Architecture Decision Records

Why the system is built the way it is. An ADR captures a decision, the alternatives that lost,
and what would have to change for it to be revisited.

**An agent may propose an ADR. Changing an accepted one is reviewed like code.**

## Status vocabulary

| Status | Meaning |
|---|---|
| `Proposed` | Written, not agreed. Do not build on it. |
| `Accepted` | Binding. Code that contradicts it is a defect. |
| `Superseded` | Replaced. Names its replacement. |

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-tei-is-authoritative.md) | TEI is authoritative for manuscript content | Accepted |
| [0002](0002-separate-story-and-literary-graphs.md) | Story and literary graphs are separate | Accepted |
| [0003](0003-no-permanent-product-agents.md) | No permanent product agents | Accepted |
| [0004](0004-runtime-provider-separation.md) | Runtime and provider are separate concerns | Accepted |
| [0005](0005-human-canonical-commit.md) | Canonical commits require a human | Accepted |
| [0006](0006-hybrid-event-history.md) | Hybrid event history, not full event sourcing | Accepted |
| [0007](0007-source-available-licensing.md) | Source-available licensing | **Proposed** |
| [0008](0008-byo-key-first.md) | BYO-key first; metered gateway is a reserved seam | Accepted |
| [0009](0009-genre-neutral-platform.md) | Genre-neutral platform, mystery as reference pack | Accepted |
| [0010](0010-oauth-device-flow.md) | OAuth device flow for provider authentication | Accepted |
| [0011](0011-hermes-worker-profiles.md) | Hermes is the governed worker runtime | Accepted |

## Superseded

`docs/adr-001-sqlite-source-of-truth.md` is superseded by 0001. SQLite is authoritative for
*operational* state; it is not authoritative for manuscript content.
