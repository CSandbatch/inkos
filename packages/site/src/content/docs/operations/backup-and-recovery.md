---
title: Backup and recovery
description: Protect and restore a local NovelGraph workspace.
slug: docs/operations/backup-and-recovery
---

Back up the complete `.novelgraph` directory while Studio is stopped, or use SQLite's online backup facilities while it is running. Keep exported Markdown and JSON in a separate versioned location for portability; they are not authoritative state.

Jobs are durable. After interruption, inspect the last node event, resolve any external cause, and resume rather than creating a duplicate run. Revision rollback restores chapter content and records a new attributable event—it does not erase history.
