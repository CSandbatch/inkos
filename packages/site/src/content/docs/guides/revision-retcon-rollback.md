---
title: Revision, retcon, and rollback
description: Keep chapter changes attributable, require approval for canon changes, and recover from a bad revision.
slug: docs/guides/revision-retcon-rollback
---

NovelGraph separates narrative surface from approved story state. A chapter edit changes the current chapter content, creates a row in `revisions`, and records an author event. A retcon changes an established fact or commitment and therefore needs an approval decision before it becomes canon. A rollback restores earlier chapter content; it does not erase the event history.

## Classify the proposed change

| Change | Required authority | Gate |
| --- | --- | --- |
| Typo, wording, or local continuity repair | Author edit | Save a revision, inspect the diff, rerun relevant audit |
| Outline or scene-plan change | Author decision | Approval kind `outline-change`, then rerun dependent work |
| Identity, death, major arc, or established fact change | Author decision | Approval kind `character-major-change` or `canon-retcon`, rationale, then re-audit |
| Research admission | Author decision | Approval kind `research-admission`; retain source and rationale |
| Hard-gate exception | Author decision | Approval kind `gate-waiver`; closure records the waiver as a warning |

Agents can propose a change through `canon:propose` or a review finding. They cannot silently promote the proposal. The core schema carries approval kinds, but the current Studio HTTP surface exposes approval resolution, not a generic approval-creation route. Do not describe a review-card click or an agent completion as approval unless the approval record exists.

## Save a chapter revision

The Studio editor sends a `PATCH` to `/api/v1/chapters/:chapterId`. The payload accepts an optional `title`, optional `contentMarkdown`, and a non-empty `reason`:

```bash
curl -X PATCH http://127.0.0.1:4567/api/v1/chapters/<chapter-id> \
  -H 'content-type: application/json' \
  -d '{"contentMarkdown":"Updated chapter text","reason":"Repair stopped-clock testimony"}'
```

The store operation is transactional: it saves the new content in `revisions`, updates the chapter, and records `chapter.updated`. `GET /api/v1/books/<book-id>` returns current chapters plus revision metadata (`id`, chapter, reason, actor, and timestamp). The current route does not return revision content.

After a canon-affecting change:

1. Capture the current book and the approval rationale.
2. Apply the approved chapter or graph change with a specific reason.
3. Mark dependent audit results stale when the owning service supports invalidation; a mystery policy, solution, or typed mystery record change does this in `MysteryEngine`.
4. Run validation and the relevant audit again.
5. Resolve the originating finding only after the re-audit shows that the issue is gone.
6. Check `/api/v1/books/<book-id>/closure` before export.

## Roll back safely

The core store has `StudioStore.restoreRevision(revisionId)`. It updates the chapter from the selected revision and records `revision.restored` with actor `author`. It does not delete old rows. It also does not create a new `revisions` row, and the current HTTP server does not expose this method as a restore route.

Therefore the supported operational boundary today is:

- use the editor or `PATCH` route to apply a known-good chapter body with a reason such as `Rollback to revision <id>`;
- preserve the original database backup before any direct recovery work;
- do not edit `studio.sqlite` by hand or invent `/restore` API calls;
- rerun audits and closure after the rollback.

If the only copy of the desired old content is inside SQLite, stop Studio and use a read-only SQLite inspection tool to retrieve `revisions.content_markdown`. Keep the original `.novelgraph/studio.sqlite` unchanged, write the recovered text to a controlled local file, then apply it through the normal chapter update path. A database-level restore is a recovery operation, not a canon approval.

For an interrupted workflow, cancel the job and inspect its durable event log:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/jobs/<job-id>/cancel
curl http://127.0.0.1:4567/api/v1/jobs/<job-id>
```

After resolving the external cause, resume only a blocked or failed job:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/jobs/<job-id>/resume
```

Do not start a duplicate run with a new idempotency key merely because a worker stopped. Use a new key only when the prior run is intentionally abandoned and the new run has a distinct reason.

## Failure states

| State | Meaning | Next action |
| --- | --- | --- |
| `Capability denied` | The caller lacks the node's declared capability | Narrow or correct the worker capability set; do not grant solution access as a shortcut |
| `Job cancellation was requested` | The job cannot accept more node work | Inspect events, then resume after the cause is resolved |
| `Node is not pending` or `Node is not running` | A duplicate or out-of-order transition was attempted | Read job state and use the durable node status |
| `validation_runs.status = stale` | A mystery policy, solution, or typed record changed after validation | Run `/mystery/validate` and inspect new findings |
| Closure `publishable: false` | A critical finding or unresolved hard obligation remains | Resolve, defer with a target, or waive with rationale; then recheck closure |
| Missing chapter content for recovery | The public API exposes revision metadata only | Stop, preserve the database, recover through a read-only local SQLite inspection path |

## Canonical invalidation diagram

[Open the rendered revision-invalidation diagram](/novelgraph/diagrams/09-revision-invalidation.svg) · [Read the canonical Mermaid source](https://github.com/CSandbatch/novelgraph/blob/main/docs/diagrams/09-revision-invalidation.mmd)

Accessible equivalent: a proposed change enters Studio; the system calculates affected records; the user reviews the diff and consequences; approval appends the new version; dependent audits become stale; downstream workflow nodes block until re-audit.
