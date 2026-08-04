# ADR-0011 · Hermes is the governed worker runtime

**Status:** Accepted  
**Date:** 2026-08-04

## Context

NovelGraph is developed in VS Code. VS Code and Codex inspect, edit, test, and document the
repository; they are not the production operator for story workers.

Hermes Agent is the runtime operator for workers executing inside NovelGraph. A shared generic
Hermes installation is insufficient because workers require different skills, tools, memory
boundaries, sandbox settings, provider/model choices, and capability grants.

## Decision

Every executable NovelGraph worker has a versioned `worker_profile` bound to a fully configured,
versioned Hermes profile. A Hermes profile records:

- Hermes runtime version and profile identifier;
- provider and model profile references;
- explicitly enabled skills and their versions;
- explicitly allowlisted MCP servers and tools;
- memory mode and external memory location;
- sandbox/backend and tool policy;
- task contract, input/output schemas, budget, and required NovelGraph capabilities.

NovelGraph resolves the worker, Hermes runtime, provider, and model before an attempt. It records
the resolved configuration and grants scoped, expiring capabilities server-side. Hermes may
propose artifacts and findings, but cannot directly commit TEI, promote graph assertions, resolve
approvals, waive findings, export a book, or access sealed content without the corresponding
NovelGraph grant.

Hermes profile memory, skills, subagents, and MCP results are execution context. They are never
canonical authoring state. Canonical state remains governed NovelGraph SQLite, TEI, graph, event,
approval, and provenance state.

## Alternatives rejected

- **VS Code/Codex as the production worker runtime.** Development tooling and production
  execution have different trust, reproducibility, and provenance requirements.
- **One shared Hermes profile for every worker.** It over-grants skills, tools, memory, and
  sealed-content access, and makes execution provenance ambiguous.
- **Hermes memory as project canon.** External memory is mutable and runtime-owned; canon needs
  human-approved NovelGraph transactions and durable provenance.

## Consequences

- `worker_profiles` and Hermes profile definitions must be versioned and immutable once used.
- `runtime_profiles`, `provider_profiles`, `model_profiles`, and `execution_resolutions` record
  what actually ran, while the worker profile records what was intended.
- Profile creation and MCP/skill changes require reviewable configuration evidence.
- The first provider-backed vertical slice must execute through a dedicated Hermes worker profile.
