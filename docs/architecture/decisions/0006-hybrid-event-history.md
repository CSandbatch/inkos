# ADR-0006 · Hybrid event history, not full event sourcing

**Status:** Accepted
**Date:** 2026-08-04

## Context

Full event sourcing would reconstruct the manuscript by replaying events, making the one thing
that must never be lost the thing most dependent on correct replay — across XML documents, RDF
datasets, and a decade of schema migrations.

## Decision

**Canonical artifacts are the truth; events explain how it changed.**

- TEI revisions and graph revisions are canonical immutable documents.
- SQLite holds current operational state.
- An append-only event log records significant transitions.
- Derived views rebuild from canonical content plus events.

A **transactional outbox** writes events in the same transaction as the current-pointer update,
so no state change can exist without its event.

## Alternatives rejected

- **Full event sourcing.** Above.
- **State only, no events.** Loses causality: which user operation caused which change.

## Consequences

- If the event log were destroyed, every approved revision survives.
- Events are immutable; corrections are new events.
- `(aggregate_type, aggregate_id, aggregate_sequence)` is unique, making ordering deterministic.
