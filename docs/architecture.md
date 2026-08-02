# Architecture

InkOS is a local single-author system. The React Studio and CLI call a versioned Hono API, which applies domain rules inside SQLite transactions. SQLite stores series, books, chapters, scenes, story entities, relationships, obligations, approvals, revisions, events, reader feedback, research provenance, and durable DAG jobs. Markdown and JSON are generated exports.

The `fair-play-detective-2026` pack adds policy, sealed solution, suspects, evidence, normalized chronology, physical and digital access, character knowledge, hypotheses, deductions, validation runs, stable findings, waivers, artifacts, and solution-access events. Numbered migrations checkpoint WAL and back up existing alpha databases before changing schema.

Drafting and reader nodes receive a chapter-bounded projection. Only solution-authorized nodes can retrieve sealed state. Legacy file-based agents consume compiled read-only projections and never create a second mystery source of truth.

The public Astro site reuses the Studio interaction model through a fixture data source. It does not connect to the local API or accept real project data.

Major invariants live in `packages/core`; UI controls are not security or consistency boundaries. Agent execution must use typed node contracts, idempotency keys, capability checks, hard budgets, and persistent events.
