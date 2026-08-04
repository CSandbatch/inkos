---
title: Privacy and telemetry
description: Identify what the current local Studio stores, what the public demo does, and what telemetry code does not yet transmit.
slug: docs/operations/privacy-and-telemetry
---

This page describes the current source implementation. It distinguishes local storage, provider configuration, the public fixture, and the telemetry validation helper. It does not describe a hosted account or a completed telemetry service.

## Local Studio boundary

Studio is intended to bind to `127.0.0.1` by default. Its Hono API is unauthenticated and has no cross-origin access control. Passing a different host prints a warning, but the warning does not add authentication. Do not expose the API to an untrusted network.

The selected project directory contains `.novelgraph/studio.sqlite`. The SQLite store contains books, chapters, revisions, graph state, obligations, approvals, jobs, findings, research records, and mystery data. The project may also contain `.env` provider configuration. The project initializer adds `.env` and `.novelgraph/` to `.gitignore`; verify your own backup and publishing rules before sharing a checkout.

The export route writes files locally under `.novelgraph/exports/<bookId>`. Exports are not a second source of truth and may include manuscript text. No hosted sync or collaboration service is implemented in this repository.

## Provider credentials

The CLI and local configuration documentation recognize these variables:

```dotenv
NOVELGRAPH_LLM_PROVIDER=openai
NOVELGRAPH_LLM_BASE_URL=https://api.openai.com/v1
NOVELGRAPH_LLM_API_KEY=replace-locally
NOVELGRAPH_LLM_MODEL=your-model
```

Keep `.env` files local and do not paste keys into issues, review records, or exported documentation. `novelgraph doctor` checks local configuration without printing secrets and does not make a provider call.

The current Studio project-creation flow and job-start route do not make provider requests. Production node execution is supplied by a manual or external worker. If that worker uses a provider, the worker and provider account become additional external data-processing boundaries; this repository does not define their retention or logging policy.

## Public demo

The public demo uses `FixtureStudioDataSource`. It has a seeded fictional book, does not accept credentials, makes no model calls, and does not write to a server. Some browser-session interactions change in-memory fixture state, but the fixture is not a local project and demo exports are not written.

The demo should not be used to test privacy settings, provider behavior, backup recovery, or production execution.

## Telemetry implementation status

The core package contains `safeDiagnosticPayload`, which validates a strict anonymous-diagnostic shape. The allowlist is limited to:

- a random installation identifier;
- NovelGraph, Node.js, and operating-system versions;
- one of the declared operation names;
- a duration bucket;
- an outcome category; and
- an optional coarse error code.

The validator rejects additional fields, including manuscript text, prompts, paths, API keys, project names, model responses, and graph content. This is a validation function, not a network sender. The repository contains no current telemetry transport, endpoint, persistence mechanism, or payload-preview screen.

The **Share anonymous diagnostics** checkbox in the current New book form is not wired into the project-create request. Its value is local component state and cannot turn a sender on or off. Treat diagnostics as not transmitted by this implementation; do not treat the checkbox as a completed preference control.

## Working, manual, and unavailable behavior

- **Working UI:** local project creation, local Studio state, the privacy notice, and the demo's fixture-mode notice.
- **Working API/code:** loopback health/bootstrap routes, local SQLite storage, local export generation, and strict validation of a proposed anonymous diagnostic payload.
- **Manual/external operator:** protecting `.env`, restricting the Studio listener, choosing a provider, and reviewing the external worker or provider's logs and retention settings.
- **Planned/unavailable:** telemetry transmission, a persistent diagnostics preference, payload preview, hosted storage, account controls, and collaboration.

For backup scope and restore procedure, see [Backup and recovery](/novelgraph/docs/operations/backup-and-recovery/).
