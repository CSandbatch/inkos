---
title: Migration from the v0 local store
description: Preserve and validate the numbered SQLite migration path for earlier NovelGraph Studio stores.
slug: docs/operations/migration-v0
---

This procedure covers an earlier alpha SQLite Studio store at `<project-root>/.novelgraph/studio.sqlite`. It does not convert a file-first project containing only `novelgraph.json`, `books/`, and Markdown into the Studio schema. The accepted local-first boundary keeps SQLite authoritative for Studio and leaves compatibility files under their existing commands.

## What opens and migrates

Studio runs migrations in `packages/core/src/studio/store.ts` when `openStudioStore()` opens the database. There is no standalone `novelgraph migrate` command.

| Version | Name in `schema_migrations` | Effect |
| --- | --- | --- |
| 1 | `studio-foundation` | Creates the series, books, chapters, graph, obligations, approvals, events, revisions, jobs, research, and supporting tables |
| 2 | `fair-play-detective-2026` | Adds policy, sealed solution, typed mystery records, validation, findings, waivers, workflow artifacts, and solution-access events; imports legacy mystery cases and clues |
| 3 | `novelgraph-discovery-knowledge` | Adds literary, series, and book knowledge bases, discovery sessions, turns, observations, candidates, charters, scratchpads, and dossiers |

Before version 2 or 3 changes an existing database, the store runs `PRAGMA wal_checkpoint(FULL)` and copies the main database into `.novelgraph/backups/` as `studio-pre-v2-<timestamp>.sqlite` or `studio-pre-v3-<timestamp>.sqlite`. Each numbered change runs inside `BEGIN IMMEDIATE`; an exception rolls the transaction back and closes the database.

## Preflight and backup

Stop Studio and every process using the project. From the project root, make a separate copy before opening the old store:

```bash
cp -R .novelgraph .novelgraph-pre-v0-migration
```

PowerShell equivalent:

```powershell
Copy-Item -LiteralPath .\.novelgraph -Destination .\.novelgraph-pre-v0-migration -Recurse
```

Confirm that the source contains `.novelgraph/studio.sqlite` and that the backup contains the same file. Do not copy only `studio.sqlite` while Studio is running; the store uses WAL mode and the checkpoint belongs to the open-store migration path.

## Run the migration

Open the project with the checkout build from the project root:

```bash
node /absolute/path/to/novelgraph/packages/cli/dist/index.js studio --no-open
```

After the first package release passes registry verification, the equivalent will be:

```bash
npx @actalk/novelgraph studio --no-open
```

The first successful open creates or updates `.novelgraph/studio.sqlite` and leaves migration records in `schema_migrations`. Confirm the process and store before using the workbench:

```bash
curl http://127.0.0.1:4567/api/v1/health
curl http://127.0.0.1:4567/api/v1/bootstrap
```

For a migrated mystery book, inspect the workbench and closure report. Legacy cases become a contemporary policy and a solution that is not locked and requires review. Legacy clues become typed evidence; reader-visible clues remain reader-visible, while other clues become solution-authorized.

## Rollback and failure handling

If opening Studio fails during migration:

1. Stop the failed process and keep every `studio-pre-v2-*` and `studio-pre-v3-*` backup.
2. Read the error and record the failed migration version.
3. Check that the source database still contains the pre-migration records; the transaction should have rolled back.
4. If the source is not usable, move the failed `.novelgraph/` directory aside and restore the verified directory copy `.novelgraph-pre-v0-migration`.
5. Reopen only the restored copy and validate the project before replacing the working directory.

Do not delete `schema_migrations`, remove newly created tables by hand, or edit a sealed solution directly in SQLite. A failed version 2 migration must not leave `schema_migrations.version = 2` or `mystery_policies`; the repository tests assert that behavior. Version 3 follows the same transaction and backup pattern.

The migration is intentionally conservative: it maps old fields, marks the imported solution unresolved, and leaves the original backup available. A successful migration is not approval of the migrated canon.

## File-first v0 boundary

If the old project has only this shape:

```text
novelgraph.json
books/<book-id>/
  book.json
  chapters/
  story/
```

there is no repository migration that imports those files into the Studio SQLite schema. Keep the file-first project intact, create a new Studio project through the local workbench, and move content through an explicit import or review process. Do not point Studio at `books/` and assume it is authoritative.

## Canonical migration diagram

[Open the rendered legacy-migration diagram](/novelgraph/diagrams/12-legacy-migration.svg) · [Read the canonical Mermaid source](https://github.com/CSandbatch/novelgraph/blob/main/docs/diagrams/12-legacy-migration.mmd)

Accessible equivalent: detect the old store → if both old and new stores exist, preserve the original → checkpoint WAL → create a timestamped backup → run a transaction → validate; on failure keep the original, and on success use the migrated SQLite store.
