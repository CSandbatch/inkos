---
title: Agent capabilities
description: Capability strings, artifact visibility, and authority boundaries in the durable workflow.
slug: docs/reference/agent-capabilities
---

Capabilities are checked at the workflow boundary. A node declares one required capability; the caller supplies a set in `x-novelgraph-capabilities`. The harness filters ready nodes, checks `begin`, `complete`, and `fail`, and records denied access as an error. Capabilities are permissions, not evidence that a proposed result is canon.

## Capability registry

The registry is the `AgentCapabilitySchema` enum in `packages/core/src/studio/domain.ts`.

| Capability | Boundary |
| --- | --- |
| `research` | General research node |
| `write` | General drafting, validation, audit, reader, and revision nodes |
| `canon` | General outline, scene-plan, and graph-update nodes |
| `publish` | General approval node |
| `story:read` | Read story state needed by validation or prose analysis |
| `reader-view:read` | Read the chapter-bounded reader projection |
| `solution:read` | Read sealed mystery solution data and solution-authorized artifacts |
| `solution:write` | Write the sealed mystery solution |
| `research:web` | Use the research-source boundary in a mystery workflow |
| `draft:write` | Write a mystery draft from the reader-visible projection |
| `canon:propose` | Propose policy, canon, or revision changes; it does not approve them |
| `approval:request` | Request an approval record |
| `publish:export` | Complete the mystery closure/export node |
| `discovery:read` | Read discovery session state |
| `discovery:write` | Write discovery turns or observations |
| `scratchpad:read` | Read run scratchpad entries |
| `scratchpad:write` | Add run scratchpad entries |
| `literary:read` | Read cited literary guidance |
| `series:read` | Read linked series knowledge |
| `book:read` | Read approved book knowledge |
| `charter:propose` | Propose a Story Charter |

The broader `research`, `write`, `canon`, and `publish` values remain in the general workflow for compatibility. The narrower values are used by discovery and the Fair-Play Detective workflow.

## Role dossiers

`DiscoveryEngine.dossier()` exposes these role-specific sets:

| Role | Granted capabilities | Explicitly not granted |
| --- | --- | --- |
| `sol-orchestrator` | Discovery read/write, scratchpad read, literary/series/book read, charter and canon proposal, approval request | `solution:read`, `solution:write`, `publish:export` unless separately supplied to a job |
| `terra-specialist` | Discovery read, scratchpad read/write, literary/series/book read, charter proposal | Discovery write and canon approval |
| `luna-worker` | Discovery read, scratchpad read/write, literary/book read | Series read, charter proposal, canon proposal, approval request |

The role name does not bypass the header or the harness. The caller must still provide the capability required by the node.

## Mystery workflow boundaries

The current `MYSTERY_WORKFLOW` assigns capabilities in this order:

| Nodes | Required capability | Artifact visibility |
| --- | --- | --- |
| Policy setup | `canon:propose` | Author-only |
| Research | `research:web` | Author-only |
| Solution architect | `solution:write` | Solution-authorized |
| Evidence and timeline/access | `solution:read` | Solution-authorized |
| Solution approval | `approval:request` | Author-only |
| Scene plan | `reader-view:read` | Reader-visible |
| Draft | `draft:write` | Reader-visible |
| Deterministic validation | `story:read` | Author-only |
| Adversarial solver | `reader-view:read` | Author-only |
| Fairness audit | `solution:read` | Author-only |
| Realism audit | `research:web` | Author-only |
| Reader panel | `reader-view:read` | Author-only |
| Prose analysis | `story:read` | Author-only |
| Mystery revision | `canon:propose` | Author-only |
| Re-audit | `solution:read` | Author-only |
| Closure approval | `publish:export` | Author-only |

Artifact reads are separate from node execution. `reader-visible` can be read with `reader-view:read`, `story:read`, or `solution:read`; `solution-authorized` requires `solution:read`; `author-only` artifacts are not returned to agent nodes by `WorkflowHarness.readArtifacts()`.

## API examples and failure states

A worker asks what it can run:

```bash
curl http://127.0.0.1:4567/api/v1/jobs/<job-id>/ready \
  -H 'x-novelgraph-capabilities: reader-view:read'
```

The same header is required to begin or complete the returned node:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/jobs/<job-id>/nodes/<node-id>/begin \
  -H 'content-type: application/json' \
  -H 'x-novelgraph-capabilities: reader-view:read' \
  -d '{"input":{}}'
```

An absent header, an unknown capability, or a capability that does not match the node produces a request error such as `Capability denied: solution:read`. A cancelled job rejects further node work. A completed job cannot be driven as running work. A budget overrun is rejected inside the transaction.

The solution routes use a separate singular header, `x-novelgraph-capability`, and require exactly `solution:read` for `GET` or `solution:write` for `PUT`. Write permission does not imply read permission. Ordinary book, graph, workbench, and reader-projection routes must not expose the sealed solution.

## Accessible boundary diagram

[Open the rendered agent-boundaries diagram](/novelgraph/diagrams/02-agent-boundaries.svg) · [Read the canonical Mermaid source](https://github.com/CSandbatch/novelgraph/blob/main/docs/diagrams/02-agent-boundaries.mmd)

Accessible equivalent: the author supplies intent; Sol coordinates; Terra performs bounded specialist analysis; Luna performs bounded extraction and scratchpad work; the dossier carries selected context; an approval decision is required before material enters approved canon. The run scratchpad is not canon, and a reader projection is not sealed solution data.
