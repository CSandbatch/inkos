---
title: Backup and recovery
description: Back up and restore the authoritative local Studio database without mixing live SQLite files or exports.
slug: docs/operations/backup-and-recovery
---

## What must be backed up

For Studio, SQLite is authoritative. Back up the complete `.novelgraph` directory, including `studio.sqlite`, any SQLite sidecar files present at the time of the snapshot, the `backups` directory, and local exports. Markdown and JSON exports are useful for inspection and versioned portability, but they cannot restore the full story graph, revisions, approvals, jobs, or migration state.

The repository's project initializer adds `.novelgraph/` to `.gitignore`. A Git commit of the checkout therefore does not back up Studio state.

## Working method: stop Studio, then copy the directory

This is the supported operator procedure. Stop Studio with `Ctrl+C` in the terminal running it. Stop any external workflow worker that can write to the same project before copying.

From PowerShell, run the following from the project directory:

```powershell
$projectRoot = (Get-Location).Path
$source = Join-Path $projectRoot '.novelgraph'
$backupRoot = 'C:\NovelGraphBackups'
$backupName = 'novelgraph-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$destination = Join-Path $backupRoot $backupName

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
Copy-Item -LiteralPath $source -Destination $destination -Recurse
```

Verify that the destination contains `studio.sqlite` before considering the backup complete. Store the destination outside the project directory and protect it like the project: it may contain manuscript text, credentials in local configuration, research snapshots, and sealed solution data.

Do not copy only `studio.sqlite` while Studio is running. The repository does not provide a Studio backup command or an HTTP online-backup endpoint. SQLite online backup tooling is a manual external-operator option, not a NovelGraph UI feature; use it only if you understand how to obtain a consistent snapshot.

## Restore a workspace

1. Stop Studio and every external worker using the project.
2. Preserve the current project state by copying or renaming the current `.novelgraph` directory to a separate recovery location. Do not delete it.
3. Replace `.novelgraph` with a complete backup directory from the same snapshot. Do not mix `studio.sqlite` with unrelated `-wal` or `-shm` files.
4. Start Studio from the intended project root.
5. Check `GET /api/v1/health`, then inspect `/api/v1/bootstrap`, `/api/v1/dashboard`, and the affected book's `/closure` response.
6. Keep the restored copy separate until the database, revisions, job state, and closure report have been inspected.

There is no Studio restore button and no current `/restore` HTTP route. Do not edit `studio.sqlite` by hand. The core store contains an internal revision-restore method, but the current HTTP server does not expose it. To recover chapter text, preserve the database, retrieve the desired `revisions.content_markdown` with a read-only SQLite tool, and apply it through the normal chapter update route with a reason such as `Rollback to revision <id>`.

## Interrupted jobs

Jobs are durable, but node execution is supplied by a manual or external worker. Inspect the job before restarting work:

```bash
curl http://127.0.0.1:4567/api/v1/jobs/<job-id>
```

After correcting the external cause, resume a job only when it is `blocked` or `failed`:

```bash
curl -X POST http://127.0.0.1:4567/api/v1/jobs/<job-id>/resume
```

Do not start a duplicate job merely because a worker stopped. Use a new idempotency key only when intentionally abandoning the earlier run and starting a distinct run.

## Automatic migration backups

When the store migrator upgrades an existing database, it checkpoints the WAL and writes a timestamped pre-migration copy under `.novelgraph/backups/`. This protects the migration boundary; it is not a scheduled project backup and does not replace the operator procedure above.

## Current boundaries

- **Working UI:** Studio displays local state, revisions, job status, and closure findings. It has no backup, restore, or job-resume controls.
- **Working API:** health, bootstrap, dashboard, job inspection, node driving, cancellation, resume, closure, and export routes are available on the loopback API.
- **Manual/external operator:** directory copies, SQLite online snapshots, restore validation, read-only revision recovery, and worker execution.
- **Planned/unavailable:** an in-app backup/restore workflow and a UI for recovery actions.
