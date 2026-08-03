---
title: Configuration
description: Environment variables, precedence, providers, and budgets.
slug: docs/reference/configuration
---

Project configuration overrides global NovelGraph configuration. Environment files must remain untracked.

| Variable | Meaning |
| --- | --- |
| `NOVELGRAPH_LLM_PROVIDER` | `openai`, `anthropic`, or an OpenAI-compatible custom provider |
| `NOVELGRAPH_LLM_BASE_URL` | Provider API base URL |
| `NOVELGRAPH_LLM_API_KEY` | Local credential; never telemetry |
| `NOVELGRAPH_LLM_MODEL` | Default model identifier |
| `NOVELGRAPH_STUDIO_PORT` | Local Studio port; default `4567` |
| `NOVELGRAPH_STUDIO_HOST` | Bind host; loopback is the safe default |
| `NOVELGRAPH_PROJECT_ROOT` | Workspace containing `.novelgraph/studio.sqlite` |

Per-agent model routing can trade cost against output quality, but run and monthly budget caps are enforced independently of provider configuration.

Mystery policy is stored in SQLite rather than environment variables. `contemporary` is the default mode; `strict-golden-age`, `hybrid`, and `rule-breaking` are also accepted. A mode change creates an approval request and invalidates dependent audits.

`english-prose-patterns-2026@1` is enabled by default for mystery projects. It reports every configured phrase and structural pattern as advisory editorial feedback. It never classifies authorship or rewrites prose automatically.
