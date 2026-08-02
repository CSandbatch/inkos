# ADR 001: SQLite is authoritative

**Status:** Accepted

InkOS uses local SQLite as the transactional source of truth. Markdown and JSON remain portable exports. This provides atomic state changes, referential integrity, crash recovery, queryable story state, and durable revisions without requiring a cloud service. Legacy file-first projects are not migrated automatically.
