# ADR-0004 · Runtime and provider are separate concerns

**Status:** Accepted
**Date:** 2026-08-04

## Context

"Which model ran this" conflates four independent things that change on different schedules.

## Decision

Four records, four lifecycles.

| Record | Is | Examples |
|---|---|---|
| `worker_profiles` | A role definition | `scene.planner` |
| `runtime_profiles` | The execution harness | `native`, `hermes`, `codex` |
| `provider_profiles` | Endpoint + credential reference | `anthropic`, `openai-compatible` |
| `model_profiles` | A model, with capability and pricing **snapshots** | provider model ID |

`execution_resolutions` records, per attempt, what was requested, what resolved, the fallback
chain, and why — so routing is inspectable after the bill arrives.

Capability and pricing are snapshots because both change under you.

## Alternatives rejected

- **One "model config" object.** Cannot express "same worker, different runtime" or "same
  provider, different model", both of which are routine.
- **Provider SDK types in the domain.** Makes a detail structural.

## Consequences

- No provider SDK type may appear in `contracts` or `domain`; an architecture test enforces it.
- A pack may require a capability (structured output) but may not mandate a provider unless
  the operator configures that restriction.
- Adding a provider is additive.
