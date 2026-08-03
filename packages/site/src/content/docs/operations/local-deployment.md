---
title: Local deployment
description: Run NovelGraph Studio and the public site from a checkout or an installed package.
slug: docs/operations/local-deployment
---

NovelGraph has two local surfaces with different stores. Studio serves the local authoring API and writes `.novelgraph/studio.sqlite`. The site is a static Astro build; it uses the bundled fixture and never connects to Studio.

## Repository prerequisites

The repository requires Node.js `22.13` or newer and pnpm `9` or newer. Node 22.13 supplies the built-in SQLite module used by `packages/core/src/studio/store.ts`.

From the repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

`pnpm build` builds every workspace package. The package boundaries are:

| Path | Runtime responsibility | Durable data |
| --- | --- | --- |
| `packages/core` | SQLite store, migrations, validation, workflow harness | `.novelgraph/studio.sqlite` when opened by Studio |
| `packages/studio` | Hono API and React workbench | Uses the selected project root |
| `packages/cli` | `novelgraph` launcher and compatibility commands | `novelgraph.json` and `books/` for file-based commands |
| `packages/site` | Static documentation and fixture demo | Nothing from the local project |

The CLI compatibility tree and the Studio SQLite store are not interchangeable exports. SQLite is authoritative for Studio; Markdown and JSON are generated outputs.

## Start Studio from the checkout

Run this from the project directory that should contain `.novelgraph/`:

```bash
node /absolute/path/to/novelgraph/packages/cli/dist/index.js studio --no-open
```

On Windows PowerShell, from the repository root:

```powershell
node .\packages\cli\dist\index.js studio --no-open
```

The default listener is `http://127.0.0.1:4567`. The command creates `.novelgraph/` and opens `studio.sqlite` through the store migrator. To select a project root explicitly:

```powershell
$env:NOVELGRAPH_PROJECT_ROOT = (Resolve-Path .\my-project).Path
node .\packages\studio\dist\server\server.js
```

The server also accepts `NOVELGRAPH_STUDIO_PORT` and `NOVELGRAPH_STUDIO_HOST`. A host other than `127.0.0.1`, `localhost`, or `::1` prints a warning because the API is unauthenticated and has no cross-origin access control.

If the published package is available, the equivalent is:

```bash
npx @actalk/novelgraph studio --no-open
```

Check the process before opening a browser:

```bash
curl http://127.0.0.1:4567/api/v1/health
```

Expected response: `{"ok":true}`. A refused connection means the process did not bind; an address-in-use error means choose another port, for example `novelgraph studio --port 4568 --no-open`.

## Configure a provider

Configuration is loaded from the global NovelGraph environment first, then the project `.env` overrides it. Keep both files out of version control.

```dotenv
NOVELGRAPH_LLM_PROVIDER=openai
NOVELGRAPH_LLM_BASE_URL=https://api.openai.com/v1
NOVELGRAPH_LLM_API_KEY=replace-locally
NOVELGRAPH_LLM_MODEL=your-model
```

Initialize the directory and inspect its local boundary before opening Studio:

```bash
novelgraph init
novelgraph doctor
```

`doctor` checks Node, the English project configuration, environment-file locations, and whether the Studio database exists. It does not transmit credentials or make a provider call. Fresh 0.5 projects do not create the earlier radar state or autonomous-daemon schedule. A file export must not be treated as a second writable source of truth.

## Start the documentation site

From the repository root:

```bash
corepack pnpm site:dev
```

This runs the `packages/site` Astro development server. For a release-like check:

```bash
corepack pnpm site:build
```

The build runs `astro check` before producing `packages/site/dist`. It does not need provider credentials or a Studio process.

## Common failure states

| Symptom | Evidence | Action | Authority boundary |
| --- | --- | --- | --- |
| SQLite cannot load | Node is below `22.13`, or the process reports an unavailable `node:sqlite` module | Upgrade Node, reinstall with the lockfile, and retry | `packages/core` owns schema access |
| Studio cannot start | `novelgraph.json` is absent only when using compatibility commands; `.novelgraph/` is created by Studio | Run the command from the intended project root; do not create `studio.sqlite` by hand | The selected project root is the storage boundary |
| Port bind fails | `EADDRINUSE` or `ECONNREFUSED` | Stop the old process or use `--port 4568`; confirm `/api/v1/health` | Loopback is the default safety boundary |
| Provider check fails | `doctor` reports a missing key, `401`, `400`, or connection error | Correct the local `.env`, base URL, or model; never paste the key into an issue | Credentials stay local |
| A book is locked | Error names `books/<book-id>/.write.lock` | Confirm no writer is active, then remove only that stale lock file | The lock protects one compatibility book, not the SQLite database |
| A workflow is blocked | Job state is `blocked`, or closure reports a critical finding | Inspect job events and findings, resolve the cause, then resume or rerun with a new idempotency key | Agents may propose; approval and closure remain explicit |

## Canonical architecture

[Open the rendered local-architecture diagram](/novelgraph/diagrams/10-local-architecture.svg) · [Read the canonical Mermaid source](https://github.com/CSandbatch/novelgraph/blob/main/docs/diagrams/10-local-architecture.mmd)

Accessible equivalent: the browser and CLI call the loopback Hono API; discovery, workflow, and validation services read or write the local SQLite store; exports are Markdown and reports; model providers and research sources are optional external inputs.
