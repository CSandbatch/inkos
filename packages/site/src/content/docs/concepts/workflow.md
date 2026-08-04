---
title: Supervised workflow
description: Discovery, durable jobs, capabilities, budgets, retries, and author gates.
slug: docs/concepts/workflow
---

NovelGraph begins with an author interview rather than a generation request. Sol records one consequential question and answer at a time. Luna extracts bounded observations and organizes the run scratchpad. Terra tests the emerging material against genre contracts, character pressure, and cited literary guidance. Their output remains proposed material until the author approves a Story Charter.

```text
book shell -> discovery -> candidate thrusts -> Story Charter approval -> production job
```

The approved Charter fixes the current premise, reader promise, dramatic engine, principal conflict, genre policy, and important exclusions. A material Charter change creates an impact analysis and requires another approval.

## General production graph

The intended general-fiction workflow is:

```text
research -> outline -> scene plan -> draft -> deterministic validation
         -> graph update proposal -> audit -> reader panel -> revise -> approval
```

Nodes declare inputs, outputs, dependencies, artifacts, and restricted capabilities. A job records timestamps, state changes, cost, cancellation requests, retries, and structured failures. An idempotency key prevents duplicate job creation when a client retries after losing a response.

The job engine distinguishes persistence from execution. `POST /api/v1/books/:bookId/jobs` writes the graph and budget to SQLite. A worker then requests ready nodes, begins one with its declared capabilities, performs the work, and reports completion or failure. The current alpha repository implements the durable contract but not the automatic provider-backed worker. The Studio's workflow button starts a record; it does not yet run model calls.

## Mystery production graph

Mystery books add solution and reader-knowledge boundaries:

```text
policy -> research -> solution architecture -> evidence/timeline/access
       -> solution approval and lock -> scene plan -> draft -> validation
       -> adversarial solver -> fairness and realism audits -> reader panel
       -> revise -> re-audit -> closure
```

Artifacts carry one of three visibility labels: `reader-visible`, `solution-authorized`, or `author-only`. A drafting or reader node receives a chapter-bounded reader projection. The sealed culprit, true clue meanings, and future deductions are absent unless the node holds an explicit solution capability. Access attempts are logged.

## Author decisions

Deterministic validation can identify contradictions and due obligations, but it cannot approve a creative retcon. The author remains responsible for:

- approving or rejecting the Story Charter;
- admitting research claims into the project knowledge graph;
- accepting major outline or character-arc changes;
- changing a locked mystery solution, decisive clue, timeline, or responsibility model;
- resolving, deferring, or waiving hard obligations under the selected policy;
- authorizing export after reading the closure report.

The API already exposes approval and obligation-resolution operations. Some corresponding Studio controls remain unwired. Use the [shipping-readiness guide](/novelgraph/docs/operations/shipping-readiness/) to distinguish the current operator path from the promoted workflow.

## Failure and recovery

Node failure is stored with a retryable flag. Cancellation is requested at the job level so a cooperative worker can stop at a safe boundary. Resume returns an eligible stopped job to active processing. Because job state and artifacts live in SQLite, restarting the Studio does not erase the graph. External workers must use stable idempotency keys and avoid repeating side effects when reporting after a network interruption.

Budget enforcement occurs before and during node transitions. A worker reports cost with each completion. The job engine blocks work that would exceed the run cap. Provider credentials and calls belong to the missing worker layer; they are not implemented by the current Studio client.
