---
title: Capability status
description: Exact boundaries between working alpha behavior, fixture behavior, active implementation, and planned work.
slug: docs/reference/capability-status
---

NovelGraph uses four status labels in public documentation.

| Label | Meaning |
| --- | --- |
| Working alpha | Implemented in the local application and covered by automated tests, but still subject to breaking alpha changes. |
| Fixture demonstration | Operates against the immutable public demo data, not a model provider or persistent browser database. |
| Active implementation | A schema, interface, or partial UI may exist; the complete user outcome is not available. |
| Planned | Design intent only. Do not depend on it. |

## Working alpha

- Local Hono server bound to loopback by default.
- SQLite migrations, pre-migration backups, transactions, revisions, attributable events, approvals, and exports.
- Series, book, chapter, graph, obligation, discovery, charter, scratchpad, and context-dossier records.
- Book-scoped canon with optional series and literary knowledge links.
- Story Charter approval gate before production workflow creation.
- Durable jobs, node dependencies, idempotency keys, capability checks, costs, cancellation requests, failure records, and resume.
- Fair-play mystery policy, sealed solution capability boundary, suspects, evidence, chronology, access, knowledge, hypotheses, deductions, findings, reader projection, waivers, and closure checks.
- Advisory English prose-pattern inspection without authorship classification.
- Static Pages site, generated diagrams, documentation search, and fixture-backed Studio demo.
- OAuth 2.0 device-flow sign-in (RFC 8628) with PKCE, OIDC endpoint discovery, automatic token refresh, and best-effort revocation on logout.
- Credential storage in the operating system credential store — Windows DPAPI, macOS Keychain, or libsecret — with an honestly labelled unencrypted fallback and a `doctor` check.
- Studio **Model access** route and `/api/v1/auth/*` routes, which keep the device code and tokens in the local server process rather than the browser.
- CLI commands: `init`, `auth`, `config`, `doctor`, `inspect-prose`, and `studio`.
- Hermes-aware development task loop and optional `hermes:doctor` environment diagnostics.

## Fixture demonstration

The public demo shows the Studio route structure and a seeded case. UI transitions occur in memory. It does not write a local SQLite database, invoke Sol, Terra, or Luna through a provider, accept credentials, or import a manuscript. Refreshing restores the fixture.

The demo proves component behavior and information architecture. It does not prove local persistence or model output quality.

## Active implementation

- Provider-backed inference. Sign-in is implemented and tokens are obtainable. **No production node calls a model yet.** Authentication establishes access that nothing yet consumes.
- A bundled OAuth client ID. NovelGraph registers no client with any provider, so each installation supplies its own before signing in.
- Automatic provider-backed execution for every Sol, Terra, Luna, and specialist node.
- Complete conversational question policy, candidate generation, and handoff compaction through configured models.
- Rich side-by-side revision diffs and one-action rollback in Studio.
- Full character-state timeline, relationship editing, subplot board, alibi matrix, and clue-access map.
- Configurable reader-panel personas, weights, thresholds, and blocking rules.
- EPUB-oriented metadata validation and publication-quality ebook packaging.
- Automated browser coverage for the complete promoted workflow.
- Route-level code splitting for the graph and editor bundles.

## Planned

- Additional executable genre packs beyond the mystery foundation.
- Author-facing genre-pack and workflow-node editors.
- Deeper cross-book series conflict analysis.
- Signed desktop packaging if Node onboarding remains a material barrier.

## Explicit exclusions

NovelGraph does not currently provide accounts, cloud manuscript storage, multi-author collaboration, managed model hosting, or unattended publication. Prose inspection does not determine whether a person or model wrote a passage. Closure means the configured story obligations and gates are clear; it is not a claim of artistic or commercial quality.

When a capability changes status, update this page, the roadmap, homepage limitations, README capability matrix, and relevant guide in the same pull request.
