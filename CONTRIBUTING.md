# Contributing to InkOS

InkOS welcomes focused fixes, documentation, test fixtures, genre-pack rules, and proposals for typed agent nodes.

## Local setup

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Create a branch from `main`, keep each pull request centered on one outcome, and include tests for changes to state, approvals, budgets, or closure behavior. UI work must include loading, empty, blocked, keyboard, and reduced-motion behavior where relevant.

## Architecture rules

- SQLite is authoritative; do not create a second writable story-state store.
- Canon changes require attributable events and the existing approval boundaries.
- Agent tools receive only their declared capabilities.
- Retrieved or web-sourced material does not become canon automatically.
- Documentation examples must be executable and English-only.
- Do not add prompts that imitate a living author or store copyrighted reference text without an explicit author-controlled provenance path.
- Add mystery rules to the versioned shared catalog, not directly to UI copy or one agent prompt.
- Run `pnpm docs:generate` after changing the fair-play contract; CI rejects stale generated references.
- Preserve sealed-solution capability tests whenever adding an agent, artifact, API route, or export.

Use an issue before introducing a new package, hosted dependency, public API, or schema migration. Security problems belong in the private reporting process in [SECURITY.md](SECURITY.md).
