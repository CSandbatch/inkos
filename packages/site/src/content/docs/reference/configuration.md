---
title: Configuration
description: Environment variables, precedence, providers, and budgets.
slug: docs/reference/configuration
---

Project configuration overrides global InkOS configuration. Environment files must remain untracked.

| Variable | Meaning |
| --- | --- |
| `INKOS_LLM_PROVIDER` | `openai`, `anthropic`, or an OpenAI-compatible custom provider |
| `INKOS_LLM_BASE_URL` | Provider API base URL |
| `INKOS_LLM_API_KEY` | Local credential; never telemetry |
| `INKOS_LLM_MODEL` | Default model identifier |
| `INKOS_STUDIO_PORT` | Local Studio port; default `4567` |
| `INKOS_STUDIO_HOST` | Bind host; loopback is the safe default |
| `INKOS_PROJECT_ROOT` | Workspace containing `.inkos/studio.sqlite` |

Per-agent model routing can optimize quality and cost, but run and monthly budget caps are enforced independently of provider configuration.
