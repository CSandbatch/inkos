---
title: Getting started
description: Launch a private NovelGraph Studio workspace and complete the first production loop.
slug: docs/getting-started
---

NovelGraph requires Node.js 22.13 or newer. This is the first Node 22 release where the built-in SQLite module is enabled without an experimental flag. Manuscripts, credentials, revisions, and story state remain in the project directory on your machine.

## Launch the public alpha

The `0.5.0` npm records have not been published. Run the verified source build until the release gate clears:

```bash
git clone https://github.com/CSandbatch/novelgraph.git
cd novelgraph
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
node packages/cli/dist/index.js studio
```

Studio binds to `127.0.0.1`, creates `.novelgraph/studio.sqlite`, and opens the local workbench. Use `--no-open` when running without a desktop browser. Binding to another host is an explicit, security-sensitive choice.

Once npm canary verification and promotion are complete, `npx @actalk/novelgraph studio` will replace the source-build sequence. The documentation will not mark that command available before the registry does.

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

Set provider credentials in a project `.env` or the existing NovelGraph global configuration. Never commit `.env` files. The public demo makes no provider calls and accepts no credentials.

```dotenv
NOVELGRAPH_LLM_PROVIDER=openai
NOVELGRAPH_LLM_BASE_URL=https://api.openai.com/v1
NOVELGRAPH_LLM_API_KEY=replace-locally
NOVELGRAPH_LLM_MODEL=your-model
```

Run `novelgraph doctor` when provider setup fails. It reports connectivity and configuration errors without printing secrets.
