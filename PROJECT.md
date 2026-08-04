# NovelGraph project hub

This is the canonical link page for the current NovelGraph implementation work.

## Public surfaces

- [Repository](https://github.com/CSandbatch/novelgraph)
- [Live website](https://csandbatch.github.io/novelgraph/)
- [Documentation](https://csandbatch.github.io/novelgraph/docs/)
- [Fixture demo](https://csandbatch.github.io/novelgraph/demo/)
- [Capability status](https://csandbatch.github.io/novelgraph/docs/reference/capability-status/)

## Current implementation work

- [Draft pull request #6](https://github.com/CSandbatch/novelgraph/pull/6)
- [Implementation branch](https://github.com/CSandbatch/novelgraph/tree/agent/novelgraph-docs-readiness)
- [Branch commits](https://github.com/CSandbatch/novelgraph/commits/agent/novelgraph-docs-readiness/)

## Architecture and runtime

- [Hermes Agent workflow](https://csandbatch.github.io/novelgraph/docs/guides/hermes-agent/)
- [Hermes worker profile ADR](docs/architecture/decisions/0011-hermes-worker-profiles.md)
- [Capability registry](docs/engineering/capability-registry.yaml)
- Workspace plan audit: `plan/06-hermes-runtime-reconciliation.md` (maintained alongside this repository checkout)

## Operating boundary

VS Code/Codex is the development surface. Hermes Agent is the runtime operator for workers
executing inside NovelGraph. NovelGraph remains authoritative for canonical TEI, graph state,
approvals, provenance, sealed content, and export.

This page uses stable branch and pull-request links rather than hard-coded commit hashes, so a
history rewrite does not leave a misleading “latest commit” reference behind.
