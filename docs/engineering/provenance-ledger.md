# Provenance ledger

Every source file in this repository, with its disposition for a clean-room transfer.

## Why this exists

This repository descends from a fork of `Narcooo/inkos`, licensed **AGPL-3.0**. Commit
`0bc35db` rewrote or deleted 111 of the 139 inherited files and replaced `LICENSE` with MIT.
AGPL-derived code **cannot** be relicensed proprietary, so if this code is ever to move to a
closed or source-available repository, the distinction between *written here* and *derived from
upstream* has to be recorded — and it has to be recorded as the code is written, because it
cannot be reconstructed afterwards.

This is a provenance record, not legal advice. See `../../../plan/01-migration-and-merge.md` §1
for the full protocol and `../../../plan/05-open-questions.md` Q1 for what is still undecided.

## Dispositions

| Disposition | Meaning | Bar |
|---|---|---|
| `CARRY` | May be copied as-is into a clean repository | Provably authored post-fork, contains no upstream expression |
| `RE-DERIVE` | Behaviour is kept; code is rewritten from a written specification | A spec is written first; the implementer does not open the original |
| `SPEC-SOURCE` | Read to write a specification; the file itself does not move | — |
| `RETIRE` | Not carried in any form | — |

**`RE-DERIVE` is the default for anything commit `0bc35db` touched.** That commit is by
definition a modification of upstream files rather than independent authorship. The question is
not "did the text change a lot" but "was this written by starting from their file".

## Summary

| Disposition | Files |
|---|---|
| `CARRY` | 11 |
| `RE-DERIVE` | 18 |
| `RETIRE` | 3 |
| `SPEC-SOURCE` | 10 |
| **Total** | **42** |

Verified by `pnpm provenance:check`, which fails when a source file has no row here.

## Ledger

| File | Disposition | Basis |
|---|---|---|
| `packages/cli/src/__tests__/cli-integration.test.ts` | SPEC-SOURCE | Test assertions are the behavioural record for re-derivation |
| `packages/cli/src/__tests__/publish-package.test.ts` | SPEC-SOURCE | Test assertions are the behavioural record for re-derivation |
| `packages/cli/src/commands/auth.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/cli/src/commands/config.ts` | RE-DERIVE | Renamed, not rewritten. Still declares upstream agents `radar` and `chapter-analyzer` |
| `packages/cli/src/commands/doctor.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/cli/src/commands/init.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/cli/src/commands/inspect-prose.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/cli/src/commands/studio.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/__tests__/auth-device-flow.test.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/core/src/__tests__/auth-session.test.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/core/src/__tests__/tei.test.ts` | CARRY | Authored 2026-08-04 as the immutable manuscript revision contract |
| `packages/core/src/__tests__/workflow-kernel.test.ts` | CARRY | Authored 2026-08-04 as the governed attempt and grant contract |
| `packages/core/src/__tests__/discovery.test.ts` | SPEC-SOURCE | Test assertions are the behavioural record for re-derivation |
| `packages/core/src/__tests__/mystery-engine.test.ts` | SPEC-SOURCE | Test assertions are the behavioural record for re-derivation |
| `packages/core/src/__tests__/prose-patterns.test.ts` | SPEC-SOURCE | Test assertions are the behavioural record for re-derivation |
| `packages/core/src/__tests__/studio-store.test.ts` | SPEC-SOURCE | Test assertions are the behavioural record for re-derivation |
| `packages/core/src/__tests__/telemetry.test.ts` | SPEC-SOURCE | Test assertions are the behavioural record for re-derivation |
| `packages/core/src/auth/device-flow.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/core/src/auth/index.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/core/src/auth/providers.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/core/src/auth/secret-store.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/core/src/auth/session.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/core/src/auth/types.ts` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `packages/core/src/studio/discovery.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/domain.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/index.ts` | RETIRE | Barrel for a package shape that does not survive |
| `packages/core/src/studio/knowledge.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/mystery-compat.ts` | RETIRE | Compatibility shim for a system that will not exist |
| `packages/core/src/studio/mystery-engine.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/mystery-spec.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/mystery.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/prose-patterns.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/research.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/seed.ts` | RETIRE | Reseeded from the new fixture set |
| `packages/core/src/studio/store.ts` | SPEC-SOURCE | 47-table schema splits across three stores; transaction discipline is the spec |
| `packages/core/src/studio/telemetry.ts` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/core/src/studio/workflow.ts` | SPEC-SOURCE | Conflates node with execution; specifies the kernel it is replaced by |
| `packages/site/src/components/DemoStudio.tsx` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/studio/src/client/StudioApp.tsx` | RE-DERIVE | Route structure inherited; the Access component is post-fork |
| `packages/studio/src/client/main.tsx` | RE-DERIVE | Present in or modified by commit 0bc35db |
| `packages/studio/src/shared/fixture.test.ts` | SPEC-SOURCE | Test assertions are the behavioural record for re-derivation |
| `packages/studio/src/shared/index.ts` | RE-DERIVE | Fixture data source; auth methods added post-fork |
| `scripts/lib/mini-yaml.mjs` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `tools/dev-agent/build-context.mjs` | CARRY | Authored 2026-08-04, post-fork, no upstream antecedent |
| `tools/dev-agent/hermes-doctor.mjs` | CARRY | Authored 2026-08-04 as optional Hermes Agent environment diagnostics |
| `tools/dev-agent/task-loop.mjs` | CARRY | Authored 2026-08-04 as the validated development-agent task loop |
| `tools/dev-agent/task-loop.test.mjs` | CARRY | Authored 2026-08-04 as executable coverage for agent framework contracts |

## Adding a row

Any new source file needs one before CI passes. If you wrote it here, without an upstream file
open, it is `CARRY`. If you adapted something that existed before commit `0bc35db`, it is not.
