---
title: Studio API v1
description: Stable local HTTP surface used by Studio and integrations.
slug: docs/reference/api
---

Studio serves JSON beneath `/api/v1` on the loopback address. Important resources include:

| Resource | Operations |
| --- | --- |
| `/bootstrap`, `/dashboard` | Workspace readiness and production summary |
| `/projects` | Create a series and book shell; the opening chapter is created after Story Charter approval |
| `/books/:id/discovery`, `/discovery/:sessionId/turns` | Start or inspect discovery and add attributed conversation turns |
| `/discovery/:sessionId/{scratchpad,thrusts}` | Add run-scoped observations or proposed story-thrust candidates |
| `/books/:id/charters`, `/charters/:charterId/resolve` | Propose and approve or reject a Story Charter |
| `/knowledge/claims`, `/books/:id/knowledge/claims/:claimId/promote` | Record a scoped claim and request its promotion into book canon |
| `/books/:id/dossiers/:agentRole` | Build a capability-filtered context dossier for Sol, Terra, or Luna |
| `/books/:id` | Read book, chapters, and revision history |
| `/chapters/:id` | Save a chapter and immutable revision |
| `/books/:id/graph` | Read graph entities, edges, obligations, and clues |
| `/books/:id/mystery/workbench` | Read policy, evidence matrices, hypotheses, deductions, and findings without the sealed solution |
| `/books/:id/mystery/policy` | Read or update fair-play mode and policy |
| `/books/:id/mystery/solution` | Read or write sealed state with an explicit solution capability header |
| `/books/:id/mystery/{suspects,evidence,timeline,access,knowledge,hypotheses,deductions}` | Add typed fair-play records |
| `/books/:id/mystery/reader-projection` | Preview evidence available through a chapter |
| `/books/:id/mystery/validate` | Persist deterministic fair-play findings |
| `/books/:id/mystery/findings/:findingId/waive` | Record a Rule-Breaking-mode author waiver |
| `/prose-patterns/analyze` | Return advisory English prose-pattern locations and context |
| `/books/:id/research`, `/books/:id/research/:researchId/approve` | Capture untrusted research and explicitly admit a cited claim |
| `/books/:id/jobs` | Start a budgeted workflow |
| `/jobs/:id`, `/jobs/:id/ready` | Read nodes, durable events, and capability-filtered ready work; NovelGraph does not yet ship an automatic model worker |
| `/jobs/:id/nodes/:nodeId/{begin,complete,fail}` | Drive a node through the local worker contract with `x-novelgraph-capabilities` |
| `/jobs/:id/{cancel,resume}` | Request cancellation or resume a durable job |
| `/approvals/:id/resolve`, `/obligations/:id/resolve` | Resolve approvals and closure obligations; these API operations are not yet wired into every Studio control |
| `/books/:id/reviews` | Read persona feedback and approvals |
| `/books/:id/closure` | Evaluate publication readiness |
| `/books/:id/export` | Write the portable export bundle |

The solution endpoint requires `solution:read` for `GET` and `solution:write` for `PUT` in `x-novelgraph-capability`; write permission never implies read permission. Ordinary book, graph, workbench, and reader-projection routes never return sealed solution content.

The API is local and currently unauthenticated, so it binds to loopback by default and refuses cross-origin browser access. Do not expose it to an untrusted network.

## Execution boundary

Starting a job persists its DAG, budget, node states, and events. It does not call a model. A worker must poll `ready`, begin a node, perform authorized work, and complete or fail that node through the worker contract. The current Studio can create and inspect jobs but does not provide that worker. This boundary is deliberate in the API and remains a release blocker for automatic Sol, Terra, and Luna execution.
