<p align="center"><img src="assets/logo.svg" width="78" alt="NovelGraph geometric graph mark"></p>

<h1 align="center">NovelGraph</h1>
<p align="center"><strong>The manuscript is the surface. The story is the system beneath it.</strong></p>
<p align="center">A local production environment for planning, drafting, auditing, and closing fiction through an inspectable workflow.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f1f3ef" alt="MIT license"></a>
  <a href="https://github.com/CSandbatch/novelgraph/actions/workflows/ci.yml"><img src="https://github.com/CSandbatch/novelgraph/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <img src="https://img.shields.io/badge/status-source%20alpha-f0b64d" alt="Source alpha status">
</p>

<p align="center">
  <a href="https://csandbatch.github.io/novelgraph/">Website</a> &middot;
  <a href="https://csandbatch.github.io/novelgraph/demo/">Fixture demo</a> &middot;
  <a href="https://csandbatch.github.io/novelgraph/docs/getting-started/">Documentation</a> &middot;
  <a href="https://csandbatch.github.io/novelgraph/docs/reference/capability-status/">Capability status</a>
</p>

<p><a href="PROJECT.md">Project hub: repository, website, branch commits, draft PR, runtime, and plan links in one place.</a></p>

![NovelGraph Signal Grid: a manuscript surface connected to causal and workflow nodes](packages/site/public/assets/signal-grid-hero.png)

> NovelGraph 0.5 is source alpha software. SQLite story state, conversational discovery records, Story Charter approval, the Fair-Play Detective rule pack, durable job state, and a local Studio are implemented. Automatic provider-backed Sol, Terra, and Luna execution, complete review and closure controls, browser acceptance coverage, and published npm packages are not yet available.

## Start with a conversation

NovelGraph begins with a Discovery Room, not a generation request. The intended Sol coordinator asks one consequential question at a time: what experience the book promises, what pressure can sustain its scenes, what the protagonist cannot admit, and what the ending must make newly legible.

Terra's declared role covers genre, structure, character pressure, contradictions, and possible story engines. Luna's declared role covers bounded extraction, retrieval, comparison, and validation. Working notes remain in run-scoped scratchpads. Context dossiers carry approved claims, selected series records, and cited literary guidance into later work.

The schemas, scratchpads, Story Charter lifecycle, and capability-filtered dossiers are implemented. Provider calls that perform the Sol, Terra, and Luna roles automatically remain active development. Current project creation seeds a discovery record, and the author can record turns, choose a candidate, and approve a Charter in Studio.

```text
book shell -> discovery conversation -> candidate thrusts
           -> Story Charter approval -> genre policy -> production DAG
```

Creative assertions remain proposals until author approval promotes them into book or series canon.

## Run the source alpha

NovelGraph requires Node.js 22.13 or newer. On August 3, 2026, npm returned `404` for each planned package name. Run the public alpha from source:

```bash
git clone https://github.com/CSandbatch/novelgraph.git
cd novelgraph
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
node packages/cli/dist/index.js doctor
node packages/cli/dist/index.js studio --port 4567
```

Studio binds to `127.0.0.1`, creates `.novelgraph/studio.sqlite` inside the selected project, and opens the browser. Omit `--port` to let the CLI select an available ephemeral port. `doctor` checks Node, local project files, the credential-storage backend, and provider sign-in state; it does not make a provider call.

## Sign in to a model provider

NovelGraph authenticates with the OAuth 2.0 device flow ([RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628)), with PKCE on every exchange. You approve in a browser on any device; no long-lived secret is pasted into a terminal or a project file.

NovelGraph ships **no OAuth client ID**. Register a device-flow client with your provider, then:

```bash
novelgraph auth configure --provider chatgpt --client-id <id> --issuer <url>
novelgraph auth login --provider chatgpt
novelgraph auth status
```

Endpoints are read from the issuer's `/.well-known/openid-configuration`, so no provider URL is hardcoded. Studio offers the same flow under **Model access**.

Tokens are held in the operating system credential store — Windows DPAPI, macOS Keychain, or libsecret — and `auth status` names which backend is in use. Where none is available, NovelGraph falls back to a `0600` file and says so rather than implying protection it does not provide. Refresh is automatic; `logout` revokes server-side where the provider supports it and always clears local tokens.

`novelgraph config set llm.apiKey` is refused. It wrote a credential into `novelgraph.json`, which is normally committed to version control. API keys remain available through an ignored `.env` for providers with no device flow.

Signing in establishes access; it does not start production work. No node calls a model in this alpha. Whether a given provider account may be used through third-party software is set by that provider — confirm your client registration permits it. See the [sign-in guide](https://csandbatch.github.io/novelgraph/docs/guides/provider-sign-in/).

After maintainers publish and verify the exact `0.5.0` artifacts, the intended command is:

```bash
npx @actalk/novelgraph studio
```

That command does not work until the npm records exist. The [shipping-readiness guide](https://csandbatch.github.io/novelgraph/docs/operations/shipping-readiness/) separates repository work from npm-owner actions.

The [public demo](https://csandbatch.github.io/novelgraph/demo/) uses immutable fixture data. It asks for no credentials, performs no model calls, writes no export, and never receives a manuscript. Workflow transitions shown there are simulations.

## One book, several kinds of knowledge

Each book is self-contained. It can select records from an optional series knowledge base without surrendering its own boundary.

| Scope | Contents | Authority |
| --- | --- | --- |
| Literary | Criticism, theory, craft, genre rules, citations, and provenance | Guidance only |
| Series | Shared chronology, recurring entities, terminology, world rules, and cross-book obligations | Approved series canon |
| Book | Story Charter, characters, events, knowledge, clues, obligations, and accepted decisions | Authoritative for one book |
| Run | Agent hypotheses, contradictions, questions, comparisons, and handoff notes | Noncanonical scratch space |
| Narrative surface | Outlines, scenes, chapters, synopses, and exports | Revisioned expression of book state |

If a proposed book fact conflicts with selected series records, NovelGraph creates a series-impact proposal instead of selecting a winner. Literary retrieval behaves differently: criticism may guide analysis, but retrieval never turns guidance into fictional truth.

![Knowledge scopes and their authority boundaries](packages/site/public/diagrams/03-knowledge-layers.svg)

## Production is a supervised graph

The intended graph after Charter approval is:

```text
research -> outline and scene plan -> draft -> deterministic validation
         -> story-graph proposal -> continuity or mystery audit
         -> reader panel -> revision -> re-audit -> approval -> closure
```

Jobs persist node dependencies and capability requirements. They also retain timestamps, costs, artifacts, cancellation state, and resumable failures. The current job engine validates caller-supplied node transitions but does not execute a model. An external worker can request ready nodes and report results through `/api/v1`; Studio can create and inspect the job record.

A drafting worker need not receive permission to rewrite canon. A reader worker can receive a chapter-bounded projection without sealed mystery facts. A research worker may collect a source without admitting its claims into the book graph.

![The discovery-to-publication production graph](packages/site/public/diagrams/06-production-dag.svg)

## Closure accounts for the book's debts

NovelGraph records setups, clues, promises, dependencies, deadlines, character commitments, and other story obligations. The implemented closure report checks open hard obligations, blocking reader feedback, mystery audit state and findings, and waivers. It does not yet perform every planned graph-invariant or pending-approval check.

The Fair-Play Detective 2026 pack adds a sealed solution, evidence ledger, chronology, access matrix, character-knowledge boundaries, hypotheses, false solutions, clue distribution, and deterministic audits. Decisive clues must appear before their deductions. Technical evidence records provenance, custody, reliability, and interpretation instead of serving as an unexplained oracle.

The independent English Prose Patterns 2026 pack identifies phrases and structural tendencies for inspection. It does not infer authorship, label prose as machine-generated, or rewrite passages. Manuscript findings are advisory; project-owned public copy uses the catalog as a reviewed release gate.

## Current Studio routes

- **Model access** configures provider sign-in and shows where tokens are stored.
- **Overview** shows books, blockers, budgets, and recent work.
- **New book** creates a series and book shell and seeds discovery.
- **Discovery** records turns and candidates, then proposes and resolves a Story Charter.
- **Manuscript** edits the chapter created after Charter approval and stores revisions.
- **Story graph** displays graph records and obligations.
- **Mystery** displays policy, evidence, reader projection, and validation material.
- **DAG control** creates and inspects durable jobs; it does not yet run provider calls.
- **Review center** displays review records; its approve and reject controls are not wired yet.
- **Exports** evaluates closure and can request the current Markdown/JSON export bundle through the API.

The planned Knowledge Workbench, complete revision diff and rollback controls, graph table alternatives, and full keyboard/accessibility pass remain roadmap work.

## Repository map

- `packages/core`: schemas, SQLite migrations, discovery, knowledge scopes, mystery rules, provenance, budgets, and workflow state.
- `packages/cli`: the `novelgraph` command and packaged Studio launcher.
- `packages/studio`: Hono API, React application, local data source, and fixture data source.
- `packages/site`: Astro/Starlight website with its documentation. It also builds the static demo.
- `docs/diagrams`: canonical Mermaid sources for architecture, state, sequence, and release diagrams.
- `scripts`: reference generation, copy review, diagram rendering, package checks, and release support.

## Develop and verify

```bash
corepack pnpm install
corepack pnpm -r build
corepack pnpm -r test
corepack pnpm -r typecheck
corepack pnpm copy:lint
corepack pnpm docs:check
corepack pnpm diagrams:check
corepack pnpm site:build
corepack pnpm site:links
```

## Develop in VS Code; run workers through Hermes

VS Code/Codex is the development surface for NovelGraph. Hermes Agent is the runtime operator for
agents executing inside the product. Each executable worker will use its own versioned Hermes
profile with scoped skills, MCP tools, memory mode, sandbox, provider/model, and NovelGraph
capability policy. The repository constitution is `AGENTS.md`, with scoped instructions under each
major package. The task loop records disposable session state in `.agent/task.json` and keeps Hermes
memory separate from canonical NovelGraph state:

```bash
corepack pnpm hermes:doctor
corepack pnpm agent:init -- --id task-123 --objective "Describe the task" --scope packages/core --acceptance "Tests pass|Docs updated"
corepack pnpm agent:context -- --scope packages/core
corepack pnpm agent:check
```

Hermes is not required for repository development checks, but it is the intended runtime operator
for governed NovelGraph workers. See the [Hermes Agent workflow](/novelgraph/docs/guides/hermes-agent/)
for profile, memory, MCP, security, and documentation rules.

Package smoke scripts pack the three planned artifacts and install them into temporary projects. A complete Playwright acceptance suite has not yet been added; unit and component tests do not prove the full browser workflow.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Report security defects through [SECURITY.md](SECURITY.md). Never put a vulnerability in a public issue. The [architecture guide](https://csandbatch.github.io/novelgraph/docs/concepts/architecture/) explains the transaction and knowledge boundaries.

## Boundaries

NovelGraph is English-only, local-first, single-author software. It has no account system of its own, no cloud manuscript sync, and no collaborative editing. Provider sign-in authenticates you to a third party; it does not create a NovelGraph account, and NovelGraph operates no server. Markdown and JSON are exports; SQLite is authoritative.

Local-first describes where your project lives — SQLite state, revisions, sealed solutions, and research snapshots stay in the project directory. It does not mean model calls happen locally: once a provider-backed node exists, request content, which may include manuscript text, is sent to the provider you configured and handled under their terms. Open-web research remains untrusted until the author approves a cited claim. Research URL handling still requires additional SSRF hardening before promoted release. A passing closure gate establishes only the checks implemented in this alpha, not literary merit, market fit, factual truth, or legal clearance.

## License

[MIT](LICENSE). Original NovelGraph code and identified project assets use this license. Supplied reference works and captured research retain their own rights and are not folded into the literary library without provenance and permission.
