---
title: Local deployment
description: Run the current NovelGraph source alpha and understand its local boundaries.
slug: docs/operations/local-deployment
---

NovelGraph has two local surfaces with different stores. Studio serves the local authoring API and writes `.novelgraph/studio.sqlite`. The site is a static Astro build; it uses bundled fixture data and never connects to Studio.

This page describes the source alpha at commit `bac05e9`. The npm packages are not available from the registry: all three package records returned `E404` when checked on 2026-08-03. Use the checkout path until the release gates in [Release operations](/novelgraph/docs/operations/release/) pass.

## Repository prerequisites

The repository requires Node.js `22.13` or newer and pnpm `9` or newer. The pinned package manager is `pnpm@9.15.9` in the root `package.json`. Node 22.13 supplies the built-in SQLite module used by `packages/core/src/studio/store.ts`.

From the repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
```

`packages/core`, `packages/studio`, and `packages/cli` are the local application packages. `packages/site` is a private static documentation/demo package. SQLite is authoritative for Studio; Markdown and JSON are generated exports or compatibility data, not a second Studio source of truth.

## Start Studio from the checkout

Run the CLI from the project directory that should contain `.novelgraph/`. Build the checkout first, then choose a port explicitly for deterministic health checks:

```bash
node /absolute/path/to/novelgraph/packages/cli/dist/index.js studio --port 4567 --no-open
```

On Windows PowerShell, from the repository root:

```powershell
node .\packages\cli\dist\index.js studio --port 4567 --no-open
```

The CLI defaults to host `127.0.0.1`. Its `--port` option accepts `1` through `65535`; when omitted, the current CLI passes no port and the server asks the operating system for an available port. Therefore, the CLI does not currently guarantee port `4567`; pass `--port 4567` when using the documented health-check URL. The command uses the current working directory as the project root, creates `.novelgraph/`, and opens `studio.sqlite` through the store migrator.

The API has no account authentication. Keep the host on loopback. Passing a non-loopback `--host` is an explicit exposure of an unauthenticated API and prints a warning; the warning is not an access-control boundary.

The direct compiled server entry has a separate environment-variable path:

```powershell
$env:NOVELGRAPH_PROJECT_ROOT = (Resolve-Path .\my-project).Path
$env:NOVELGRAPH_STUDIO_PORT = "4567"
$env:NOVELGRAPH_STUDIO_HOST = "127.0.0.1"
node .\packages\studio\dist\server\server.js
```

`NOVELGRAPH_PROJECT_ROOT`, `NOVELGRAPH_STUDIO_PORT`, and `NOVELGRAPH_STUDIO_HOST` are read by this direct server entry. The current CLI does not read those variables; use its current working directory and `--port`/`--host` options instead.

Confirm the process before opening a browser:

```bash
curl http://127.0.0.1:4567/api/v1/health
curl http://127.0.0.1:4567/api/v1/bootstrap
```

Expected health response: `{"ok":true}`. A refused connection means the process did not bind; an address-in-use error means choose another explicit port, for example `--port 4568`.

## Configure a provider boundary

The source alpha exposes provider settings for project setup and future provider execution, but it does not currently make automatic LLM calls through the durable workflow. `WorkflowHarness` records durable node state; agent execution is supplied by the caller. The only implemented general outbound research path is the user-requested web research service, which stores an untrusted snapshot pending author approval.

The CLI can seed or edit local configuration:

```bash
node /absolute/path/to/novelgraph/packages/cli/dist/index.js init
node /absolute/path/to/novelgraph/packages/cli/dist/index.js config set llm.model MODEL_ID
node /absolute/path/to/novelgraph/packages/cli/dist/index.js config show
```

`novelgraph init` uses provider values already present in the process environment when it writes `novelgraph.json`. `config set` edits that project file. `config set-global` writes `~/.novelgraph/.env`, and `config show-global` masks the API key when displaying it. The current source alpha does not automatically parse project `.env` or global `.env` files at Studio startup, and `doctor` does not call a provider.

Keep `.env`, global configuration, API keys, manuscripts, and SQLite files outside version control. Do not treat a configured provider as proof that a workflow node will execute until provider-backed execution is implemented and verified.

## Start the documentation site

From the repository root:

```bash
corepack pnpm --filter @actalk/novelgraph-site dev
corepack pnpm --filter @actalk/novelgraph-site build
```

The site build runs `astro check` before producing `packages/site/dist`. It does not need provider credentials or a Studio process. The public demo uses immutable fixture data, performs no model calls, accepts no credentials, and does not write a local SQLite database.

## Common failure states

| Symptom | Evidence | Action | Authority boundary |
| --- | --- | --- | --- |
| SQLite cannot load | Node is below `22.13`, or the process reports an unavailable `node:sqlite` module | Upgrade Node, reinstall with the lockfile, and retry | `packages/core` owns schema access |
| Studio cannot start | The CLI was run from the wrong project directory, production assets are missing, or the port is occupied | Build first, run from the intended project root, pass `--port 4567` or another free port, and confirm `/api/v1/health` | The CLI uses its current working directory; the direct server can use `NOVELGRAPH_PROJECT_ROOT` |
| The health URL refuses connection | The CLI selected an OS-assigned port because `--port` was omitted, or the process failed to bind | Read the URL printed by Studio, or restart with `--port 4567 --no-open` | Port selection belongs to the launcher |
| Provider settings appear ignored | The source alpha has configuration storage but no automatic provider executor, or the process environment was not loaded | Treat the durable workflow as caller-driven; do not put secrets in issues; verify the local config file and process environment | Provider execution is not yet a shipped source-alpha capability |
| A book is locked | Error names `books/<book-id>/.write.lock` | Confirm no writer is active, then remove only that stale lock file | The lock protects one compatibility book, not the SQLite database |
| A workflow is blocked | Job state is `blocked`, or closure reports a critical finding | Inspect job events and findings, resolve the cause, then resume or rerun with a new idempotency key | Agents may propose; approval and closure remain explicit |
| A research URL is rejected | The target resolves to loopback, private, link-local, metadata, or another disallowed destination | Use a public source and treat its snapshot as untrusted until author approval | Research is an external input, not automatic canon |

## Canonical architecture

[Open the rendered local-architecture diagram](/novelgraph/diagrams/10-local-architecture.svg) · [Read the canonical Mermaid source](https://github.com/CSandbatch/novelgraph/blob/main/docs/diagrams/10-local-architecture.mmd)

Accessible equivalent: the browser and CLI call the loopback Hono API; discovery, workflow, and validation services read or write the local SQLite store; exports are Markdown and reports; model providers and research sources are optional external inputs. In the current source alpha, model-provider execution is not wired into the durable workflow.
