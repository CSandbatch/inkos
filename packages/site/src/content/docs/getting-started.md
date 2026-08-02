---
title: Getting started
description: Launch a private InkOS Studio workspace and complete the first production loop.
slug: docs/getting-started
---

InkOS requires Node.js 22.13 or newer. This is the first Node 22 release where the built-in SQLite module is enabled without an experimental flag. Manuscripts, credentials, revisions, and story state remain in the project directory on your machine.

## Launch Studio

From the directory that should contain the novel workspace:

```bash
npx @actalk/inkos studio
```

Studio binds to `127.0.0.1`, creates `.inkos/studio.sqlite`, and opens the local workbench. Use `--no-open` when running without a desktop browser. Binding to another host is an explicit, security-sensitive choice.

## Complete the first loop

1. Create a series and book in **New project**.
2. Select the Mystery pack and seed its fairness ledger.
3. Draft the opening in **Manuscript**; each save creates a revision.
4. Inspect characters, clues, and obligations in **Story graph**.
5. Start a budgeted run in **DAG control**.
6. Resolve findings in **Review center**.
7. Export only after **Publication gate** reports ready.

:::caution[Alpha software]
Studio is an active vertical slice. Keep normal backups and inspect generated work before admitting it to canon.
:::

## Provider configuration

Set provider credentials in a project `.env` or the existing InkOS global configuration. Never commit `.env` files. The public demo makes no provider calls and accepts no credentials.

```dotenv
INKOS_LLM_PROVIDER=openai
INKOS_LLM_BASE_URL=https://api.openai.com/v1
INKOS_LLM_API_KEY=replace-locally
INKOS_LLM_MODEL=your-model
```

Run `inkos doctor` when provider setup fails. It reports connectivity and configuration errors without printing secrets.
