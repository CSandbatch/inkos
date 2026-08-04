---
title: Hermes Agent development workflow
description: Use Hermes Agent with NovelGraph's repository instructions, task loop, memory boundaries, and verification gates.
slug: docs/guides/hermes-agent
---

VS Code/Codex is NovelGraph's development surface. [Hermes Agent](https://hermes-agent.nousresearch.com/) is the runtime operator for workers executing inside NovelGraph. Hermes discovers `AGENTS.md` from the repository root and progressively loads narrower files as it enters subdirectories. NovelGraph keeps those files as the project constitution and uses `.agent/` for generated task context and disposable session state.

## Install and check Hermes

On native Windows, install Hermes with the official PowerShell installer:

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

The installer places the runtime under `%LOCALAPPDATA%\\hermes`, adds the CLI to the user PATH, and creates a separate Hermes memory directory. In this environment the installed runtime is Hermes Agent `0.20.0`; browser and TUI npm extras remain optional and were not installed successfully by the installer.

Then run:

```bash
hermes setup --portal
corepack pnpm hermes:doctor
hermes doctor
```

`hermes:doctor` is safe to run when Hermes is not installed. It reports `Hermes unavailable` and exits nonzero; it does not claim that NovelGraph's unit tests executed Hermes. Hermes' own `hermes doctor` additionally checks its configuration, provider login, optional tools, and memory directory; provider setup is intentionally left to the operator.

Hermes selects the first matching context file in each directory using `.hermes.md`, `AGENTS.md`, `CLAUDE.md`, then `.cursorrules`. NovelGraph therefore keeps `AGENTS.md` authoritative and does not add `.hermes.md`. The root file is loaded at session startup; nested `AGENTS.md` files are discovered as Hermes enters those directories through tool calls.

## Start a task

From the repository root:

```bash
corepack pnpm agent:init -- --id task-123 --objective "Describe the task" --scope packages/core --acceptance "Test passes|Documentation updated"
corepack pnpm agent:context -- --scope packages/core --issue 123
corepack pnpm agent:check
```

Move through the task loop in order:

`discover → orient → plan → implement → verify → document → review → handoff`

Record transitions explicitly:

```bash
corepack pnpm agent:checkpoint -- --phase orient --next "Read the applicable ADRs"
corepack pnpm agent:verify -- --command "corepack pnpm test" --evidence "All automated tests passed"
corepack pnpm agent:document -- --path packages/site/src/content/docs/guides/hermes-agent.md
corepack pnpm agent:handoff -- --summary "Task context and loop tooling are ready" --next "Add runtime integration tests"
```

## Memory and authority

Hermes memory under `%LOCALAPPDATA%\\hermes\\memories` and skills are working context, not NovelGraph canon. `.agent/memory/` is disposable repository-session state. Durable engineering memory belongs in code, tests, migrations, ADRs, capability records, or documentation. Durable authoring state belongs in NovelGraph's governed SQLite, TEI, and graph layers.

Do not put credentials, prompts, manuscript text, model responses, or sealed mystery solutions in `.agent/memory/`, telemetry, or shared task context. Hermes may propose artifacts and findings, but only a human-approved NovelGraph transaction can change canon.

Each executable NovelGraph worker must have its own versioned Hermes profile. The profile records
the worker contract, provider/model, enabled skill versions, MCP server/tool allowlist, memory mode,
sandbox/backend, budget, and required NovelGraph capabilities. MCP servers and Hermes subagents must
be explicitly allowlisted. Start with read-only repository/context tools. Do not expose SQLite writes,
canonical commit operations, credentials, or sealed content to an unconstrained Hermes session.

NovelGraph issues the capability grant and records the resolved Hermes profile for every attempt.
Hermes may propose artifacts and findings; only the governed NovelGraph workflow can commit canon,
promote assertions, resolve approvals, waive findings, access sealed content, or export a book.

## Documentation gate

Every implementation task records its documentation updates in `.agent/task.json`. Changes to agent rules update `AGENTS.md`; changes to memory or task state update `.agent/README.md`; runtime or security changes require an ADR; shipped behavior requires capability-registry evidence and regenerated references.
