---
title: Configuration
description: Current source-alpha configuration surfaces, precedence, providers, and budgets.
slug: docs/reference/configuration
---

NovelGraph configuration is local and untracked. The current source alpha stores provider settings, but it does not yet automatically load `.env` files at Studio startup or execute LLM-backed workflow nodes.

## Runtime and Studio settings

| Variable or option | Current behavior |
| --- | --- |
| `NOVELGRAPH_STUDIO_PORT` | Read by the direct compiled `packages/studio/dist/server/server.js` entry; defaults there to `4567`. The CLI launcher does not read it. |
| `NOVELGRAPH_STUDIO_HOST` | Read by the direct compiled server entry. The safe default is `127.0.0.1`; another host prints a warning but does not add authentication. The CLI uses `--host` instead. |
| `NOVELGRAPH_PROJECT_ROOT` | Read by the direct compiled server entry to select the workspace containing `.novelgraph/studio.sqlite`. The CLI uses its current working directory instead. |

Deterministic CLI startup uses explicit options:

```bash
node /absolute/path/to/novelgraph/packages/cli/dist/index.js studio --host 127.0.0.1 --port 4567 --no-open
```

When the CLI `--port` option is omitted, the current launcher asks the operating system for an available port. Do not assume the CLI selected `4567` unless the option was supplied.

Studio has no account authentication. Keep the server on loopback. A non-loopback host is an explicit exposure of an unauthenticated local API, and the warning is not a security boundary.

## Provider settings

| Setting | Meaning | Current source-alpha behavior |
| --- | --- | --- |
| `NOVELGRAPH_LLM_PROVIDER` | `openai`, `anthropic`, or an OpenAI-compatible custom provider | Used by `novelgraph init` when seeding `novelgraph.json`; no automatic Studio provider call is made |
| `NOVELGRAPH_LLM_BASE_URL` | Provider API base URL | Stored as project configuration; not loaded by the Studio launcher from `.env` |
| `NOVELGRAPH_LLM_API_KEY` | Local credential; never telemetry | Written to local configuration only through explicit setup; do not commit or report it |
| `NOVELGRAPH_LLM_MODEL` | Default model identifier | Stored as project configuration; no durable node invokes it automatically |
| `NOVELGRAPH_LLM_TEMPERATURE` | Optional generation setting | Written by the global-config command when provided; no current provider executor consumes it |
| `NOVELGRAPH_LLM_MAX_TOKENS` | Optional output budget | Written by the global-config command when provided; no current provider executor consumes it |
| `NOVELGRAPH_LLM_THINKING_BUDGET` | Optional Anthropic thinking budget | Written by the global-config command when provided; no current provider executor consumes it |
| `NOVELGRAPH_LLM_API_FORMAT` | `chat` or `responses` setup value | Written by the global-config command when provided; no current provider executor consumes it |

The generated project `.env` and global `~/.novelgraph/.env` are configuration files, not proof that a provider is active. `novelgraph config set` edits `novelgraph.json`; `novelgraph config set-global` writes the global file; `config show` and `config show-global` mask known API keys. The current source alpha has no automatic project-over-global `.env` loading path in Studio.

The durable `WorkflowHarness` records nodes, capabilities, budgets, artifacts, cancellation, failure, and resume state. Agent execution is deliberately supplied by the caller. Provider-backed Sol, Terra, Luna, and specialist execution remains an implementation boundary, not a current configuration outcome.

## Project configuration

Initialize a project from its intended directory:

```bash
node /absolute/path/to/novelgraph/packages/cli/dist/index.js init
node /absolute/path/to/novelgraph/packages/cli/dist/index.js config show
node /absolute/path/to/novelgraph/packages/cli/dist/index.js doctor
```

`doctor` checks Node, the English project configuration, environment-file locations, and whether the Studio database exists. It does not perform provider connectivity checks or transmit credentials.

The CLI compatibility tree and Studio SQLite store are separate boundaries. SQLite is authoritative for Studio; `novelgraph.json`, `books/`, Markdown, and JSON are used by compatibility commands or explicit exports.

## Model routing and budgets

The legacy `config set-model` and `remove-model` commands still expose compatibility agent names such as `writer`, `auditor`, `reviser`, `architect`, `radar`, and `chapter-analyzer`. They are not a current automatic execution route; do not build new provider automation around those names.

Run and node budgets are persisted in SQLite and enforced by the workflow job engine independently of the stored provider settings. A budgeted job still requires an approved Story Charter before production can begin.

## Mystery and prose policy

Mystery policy is stored in SQLite rather than environment variables. `contemporary` is the default mode; `strict-golden-age`, `hybrid`, and `rule-breaking` are accepted. A mode change creates an approval request and invalidates dependent audits.

`english-prose-patterns-2026@1` reports configured phrases and structural patterns as advisory editorial feedback. It never classifies authorship or rewrites prose automatically.

## Privacy boundary

Manuscripts, prompts, model responses, graph state, credentials, project names, paths, and research snapshots remain local and are prohibited from telemetry. The current source alpha validates an anonymous diagnostic schema but has no active telemetry transmission path. Do not infer collection from the presence of a configuration field or UI label.
