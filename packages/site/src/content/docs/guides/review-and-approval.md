---
title: Review and approval
description: Inspect current findings and use the available API boundaries for approval, obligation changes, and closure.
slug: docs/guides/review-and-approval
---

This page documents the current implementation. The Studio **Review center** is a read-only view in this version: it displays review records, but its **REJECT** and **APPROVE WITH RATIONALE** buttons have no action handlers. Do not assume that clicking either button changes canon, resolves a finding, or records a rationale.

## What the Review center reads

`GET /api/v1/books/:bookId/reviews` returns two kinds of records:

- reader feedback, mapped to `source: "reader"`, with a recommendation, severity, and open/resolved status;
- approval records, mapped to `source: "approval"`, with their kind, rationale, severity, and status.

The current client renders those records as cards. It does not filter them into separate queues, display a diff, show affected graph records, collect a rationale, or resolve reader feedback.

## Current API actions

### Resolve an approval

The API accepts an approval decision:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/approvals/<approval-id>/resolve \
  -H 'content-type: application/json' \
  -d '{"approved":true,"rationale":"The reviewed change preserves the approved story state."}'
```

The request requires a Boolean `approved` value and a non-empty `rationale`. In the current store implementation this generic route updates approval status and resolution time; it does not write the supplied resolution rationale into the approval row. The Charter-specific route is the authoritative path when resolving a Story Charter because it also records the decision as a book event:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/charters/<charter-id>/resolve \
  -H 'content-type: application/json' \
  -d '{"approved":true,"rationale":"This premise governs the first production version."}'
```

Rejecting a Charter changes only that proposed Charter to `rejected`. Approving it marks the current proposed Charter `approved`, supersedes an earlier approved Charter, records an attributable event, and creates chapter 1 titled `Opening` if the book has no chapters.

### Change an obligation

Closure checks hard obligations. The API accepts `resolved`, `deferred`, or `waived`:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/obligations/<obligation-id>/resolve \
  -H 'content-type: application/json' \
  -d '{"status":"resolved","rationale":"The stopped-clock contradiction is addressed in chapter 1."}'
```

A waiver must include non-empty rationale. The current route does not validate a separate deferral target; if you defer an obligation, put the target chapter or later decision in the rationale yourself. The Studio dashboard displays obligations but does not expose this action.

### Re-run a mystery audit

The Mystery workbench can call:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/books/<book-id>/mystery/validate
```

The current UI exposes this as **RUN VALIDATION**. It refreshes fair-play findings, but it does not resolve them. A Rule-Breaking-mode blocker can be waived through the Mystery workbench prompt, which calls the finding waiver route with the entered rationale. Other findings require a change to the relevant records or manuscript followed by another validation run.

## Safe review sequence

1. Read the review records and the originating finding. Do not approve a card merely because it is present.
2. Inspect the affected chapter, graph record, mystery record, or research item.
3. Make a surface edit through `PATCH /api/v1/chapters/:chapterId` with a specific reason, or use the relevant proposal/approval API for a canon change.
4. Re-run the relevant validation or audit.
5. Resolve the originating obligation or approval only after the new result shows that the issue is addressed.
6. Read `GET /api/v1/books/<book-id>/closure` and require `publishable: true` before treating the project as ready for export.

## Workflow review is external to the current UI

The Studio **DAG control** page can start and inspect a job. It does not execute nodes. A manual or external worker must use the job API:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/books/<book-id>/jobs \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"review-run-001","budgetCents":100}'

curl http://127.0.0.1:4567/api/v1/jobs/<job-id>/ready \
  -H 'x-novelgraph-capabilities: research,reader-view:read'
```

The worker then calls the node `begin`, `complete`, or `fail` routes with a capability header matching the node. Use the job event log to inspect blocked nodes. Use `resume` only for a blocked or failed job after the external cause is corrected; do not create a duplicate run solely because a worker stopped.

## Not available in the current implementation

- Review-card approval and rejection actions in the Studio UI.
- Reader-feedback resolution from the Studio UI or the current HTTP surface.
- A Studio form for approval rationale or obligation resolution.
- Automatic provider-backed node execution from **RUN WORKFLOW**.
- A complete diff, impact report, or rollback control in the Editor.

These are planned or integration-level behavior, not steps a new user can complete through the current Studio interface.
