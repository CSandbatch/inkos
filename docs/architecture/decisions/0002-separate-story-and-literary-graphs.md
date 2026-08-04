# ADR-0002 · Story and literary graphs are separate

**Status:** Accepted
**Date:** 2026-08-04

## Context

Two kinds of knowledge look similar and behave differently. *Story* knowledge is what is true
inside one book. *Literary* knowledge is craft technique and criticism — true about writing,
never about the story.

Conflating them lets a retrieved critical claim become a fictional fact.

## Decision

Two datasets with different lifecycles.

| | Story graph | Literary graph |
|---|---|---|
| Scope | One work, series, or world | Shared across workspaces |
| Versioning | Revisions, per project | **Releases**, pinned per workspace |
| Authority | `canonical` down to `sealed` | `interpretive` only |
| May become canon | Yes, by approval | **Never** |

A workspace *pins* a literary release, so craft advice does not change because a shared corpus
was updated overnight. A private overlay holds user-supplied material with distinct rights.

## Alternatives rejected

- **One graph, separated by named graph membership.** Named graphs are one axis; authority and
  assertion class are two more. Overloading one axis loses the others.
- **Literary knowledge as prompt text.** Unversioned, uncitable, unpinnable.

## Consequences

- Composition packets are stored artifacts, so an analysis stays reproducible after the
  literary graph advances.
- Literary retrieval logs which records were supplied, enabling "this recommendation drew on
  these four techniques."
- The literary corpus is an acquisition problem, not a schema problem — Q3.
