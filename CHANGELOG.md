# Changelog

All notable InkOS changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project is still pre-1.0 and may make breaking changes between minor releases.

## Unreleased

### Added

- Local SQLite Studio source of truth with typed story entities, obligations, approvals, revisions, reader feedback, mystery clues, budgets, and durable workflow records.
- React/Hono Studio alpha with project initialization, manuscript editing, story graph, DAG inspector, review center, and closure-aware exports.
- Astro/Starlight product site, documentation, and an interactive fixture-backed mystery demo.
- English-first literary guidance and explicit research provenance controls.

### Changed

- Repositioned InkOS from an autonomous file-first CLI to a supervised local agent production OS for fiction.
- Raised the supported runtime to Node.js 22.13 or newer, where the built-in SQLite API is available without an experimental flag.
- Made English the sole product, documentation, prompt, and generation language.
- Replaced legacy truth-file claims with SQLite transactions, immutable revisions, and attributable events.

### Removed

- Chinese locale branches, platform assumptions, prompt text, examples, notification integrations, and legacy project migration promises.

## 0.4.9 - Legacy CLI line

The 0.4.x releases established the original multi-agent CLI, provider routing, chapter generation, auditing, revision, import, export, and daemon workflows. These releases used file-first book state and included Chinese-language behavior that is not supported by the new Studio architecture.
