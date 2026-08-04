# ADR-0003 · No permanent product agents

**Status:** Accepted
**Date:** 2026-08-04

## Context

The inherited product named three agents — Sol, Terra, Luna — in code (`AgentRoleSchema`),
in database columns (`scratchpad_entries.agent_role`), and throughout the marketing surface.

Personas imply persistent entities with memory and identity. **The architecture has neither.**
Workers are ephemeral; everything durable lives in artifacts, context manifests, and the event
log. The copy described a system the architecture rejects.

## Decision

Named product agents are retired. Replaced by:

| Concept | Is |
|---|---|
| **Worker profile** | A versioned role definition: what work, what contract, what capabilities |
| **Task contract** | The typed input and output for one unit of work |
| **Node attempt** | One execution, with its own context manifest and capability grant |

Author-facing copy presents **one assistant**. Worker profiles surface only in the provenance
view, answering "what produced this proposal."

## Alternatives rejected

- **Keep the personas as a UI layer.** Tempting — the copy is good — but it re-describes
  ephemeral workers as persistent characters, which is the original error.
- **Keep them as first-class.** Would require the architecture to accommodate persistent agent
  identity and memory, which it deliberately does not have.

## Consequences

- The largest single copy rewrite in the programme. Retirement map: `plan/01` §6.
- `AgentRoleSchema` and both `agent_role` columns migrate to portable worker-profile IDs.
- Loss of a memorable brand hook. Accepted: accuracy outranks it.
