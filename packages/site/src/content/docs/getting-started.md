---
title: Getting started
description: Launch Studio, approve the first Story Charter, and identify the current production and recovery boundaries.
slug: docs/getting-started
---

This guide describes the current source checkout. It does not describe a completed unattended production loop: the Studio UI can create and inspect local state, but production nodes require a separately supplied worker and review actions are not wired to the current UI.

NovelGraph requires Node.js 22.13 or newer and pnpm 9 or newer. Node 22.13 supplies the built-in SQLite module used by the Studio store. The authoritative Studio database is `.novelgraph/studio.sqlite` in the selected project directory.

## Launch the public alpha

The `0.5.0` npm packages are not available from the registry. Run the source build from a checkout:

```bash
git clone https://github.com/CSandbatch/novelgraph.git
cd novelgraph
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
node packages/cli/dist/index.js studio --no-open
```

Studio binds to `127.0.0.1`, creates `.novelgraph/studio.sqlite`, and serves the local workbench. The API is local and unauthenticated. Keep the listener on loopback unless you are deliberately operating a protected local network.

Check that the process is available before using the browser:

```bash
curl http://127.0.0.1:4567/api/v1/health
```

The expected response is `{"ok":true}`. A refused connection means Studio did not bind. An address-in-use error means choose another port, for example:

```bash
node packages/cli/dist/index.js studio --port 4568 --no-open
```

The future npm command is not a current installation path. Do not use `npx @actalk/novelgraph studio` until the package release has been verified and promoted.

## Create the first book and Story Charter

1. Open **New book** and submit a series title, book title, premise, genre pack, and (for a mystery) Fair-Play mode. The default form also seeds a mystery obligation when **Seed the mystery fairness ledger** is checked. Project creation writes the series, book, discovery session, and initial candidate thrusts through `POST /api/v1/projects`.
2. Continue to **Discovery**. The current Studio client uses a fixed list of questions. Each response is recorded as an author turn and a scratchpad observation; this flow does not make a provider call.
3. Select one of the displayed Core, Stretch, or Wild candidates. The current UI selects one candidate and submits a derived Charter. It does not currently provide controls to combine, edit, reject, or review the complete Charter before approval.
4. Select **APPROVE STORY CHARTER**. The current client submits the Charter and immediately resolves it with a built-in rationale. The core requires a non-empty rationale and records the approval event, but the current UI does not ask you to write that rationale.
5. Confirm that **Discovery** shows **OPEN MANUSCRIPT**. Charter approval creates chapter 1 titled `Opening` if the book has no chapters. Before approval, the workflow API rejects production starts with `An approved Story Charter is required before production can begin`.

The detailed Charter fields and lifecycle are documented in [Discovery and Story Charters](/novelgraph/docs/concepts/discovery-and-charters/). The current UI limitation is an implementation boundary, not a reason to treat a candidate as a complete author-reviewed Charter.

## Edit and inspect the manuscript

1. Open **Manuscript**. The editor displays the current chapter and its status.
2. Type in the chapter body. Changes are marked unsaved and autosaved after a short delay. **SAVE REVISION** sends `PATCH /api/v1/chapters/:chapterId` with the current content and reason; the store writes a revision before updating the chapter.
3. Use **INSPECT PROSE** for the advisory prose-pattern response. It does not change the chapter.
4. Use **Story graph** to inspect the current graph, obligations, and clue count. The current graph view is visual only; it has no table or outline alternative.

The current Editor does not expose comments, citations, diffs, or a rollback button. For a controlled rollback, preserve the database and apply the recovered chapter body through the normal chapter update route with a reason such as `Rollback to revision <id>`. See [Backup and recovery](/novelgraph/docs/operations/backup-and-recovery/) for the recovery boundary.

## Production workflow: UI, API, and external worker

**Working UI:** **DAG control** displays a workflow graph, node status, events, artifacts, and a budget after a job is selected. **RUN WORKFLOW** submits a job with a fixed budget of 100 cents. It does not provide a budget field, node execution controls, cancellation, or resume controls.

**Working API:** `POST /api/v1/books/:bookId/jobs` creates a durable job only after Charter approval. `GET /api/v1/jobs/:jobId` reads its nodes, events, artifacts, and solution-access events. `GET /api/v1/jobs/:jobId/ready` returns capability-filtered ready nodes. The node routes `POST /api/v1/jobs/:jobId/nodes/:nodeId/begin`, `complete`, and `fail` drive a node when the caller supplies the required `x-novelgraph-capabilities` header. `POST /api/v1/jobs/:jobId/cancel` and `resume` change durable job state.

**Manual/external worker:** A separate process must perform the work represented by each node and call those API routes. The repository contains the durable job engine and worker contract, but the current Studio server does not start such a worker. A job started from the UI can therefore remain `running` or `blocked` until an external worker or direct API caller advances it.

Do not treat a newly created job as a completed draft. Inspect node events and capability decisions before moving to review. The workflow contract is described in [Supervised workflow](/novelgraph/docs/concepts/workflow/), and the operational review boundary is described in [Review and approval](/novelgraph/docs/guides/review-and-approval/).

## Review, closure, and export

The current **Review center** reads persona feedback and approval records. Its **REJECT** and **APPROVE WITH RATIONALE** buttons are display-only in this version; they do not change server state. Use the API or a separate integration for approval resolution and obligation changes as documented in [Review and approval](/novelgraph/docs/guides/review-and-approval/).

**Exports** reads `GET /api/v1/books/:bookId/closure`. The UI disables **GENERATE EXPORT** when the report contains a critical finding. When enabled, it calls `POST /api/v1/books/:bookId/export` and writes `manuscript.md`, `closure-report.json`, and `book.json` under `.novelgraph/exports/<bookId>`. The current server export route itself does not enforce the closure result, so callers using the API must check `publishable` before exporting.

`book.json` and the other exports are portable outputs, not a replacement for SQLite. Back up the complete `.novelgraph` directory before production or migration; follow [Backup and recovery](/novelgraph/docs/operations/backup-and-recovery/).

## Provider sign-in

NovelGraph authenticates to model providers with the OAuth 2.0 device flow (RFC 8628). Tokens are held in the operating system credential store — Windows DPAPI, macOS Keychain, or libsecret — and never in project files.

NovelGraph ships no OAuth client ID. Register a device-flow client with your provider, then:

```bash
novelgraph auth configure --provider chatgpt --client-id <id> --issuer <url>
novelgraph auth login --provider chatgpt
novelgraph auth status
```

`login` prints a verification URI and a user code; approve the request in a browser on any device. Studio offers the same flow under **Model access**.

For storage backends and troubleshooting see [Sign in to a model provider](/novelgraph/docs/guides/provider-sign-in/).

Providers with no device flow still use an API key in a project `.env`. Never commit `.env` files.

```dotenv
NOVELGRAPH_LLM_PROVIDER=chatgpt
NOVELGRAPH_LLM_BASE_URL=https://api.openai.com/v1
NOVELGRAPH_LLM_MODEL=your-model
# Only for providers without a device flow:
# NOVELGRAPH_LLM_API_KEY=replace-locally
```

`novelgraph config set llm.apiKey` is refused. It wrote a credential into `novelgraph.json`, which is normally committed.

Signing in does not by itself start any production work. Discovery and the Studio job-start route still make no provider calls in this alpha, and the public demo uses fixture data and accepts no credentials.

Run `novelgraph doctor` when setup fails. It checks local configuration, the credential-storage backend, and sign-in state, and reports errors without printing secrets; it does not make a provider call.
