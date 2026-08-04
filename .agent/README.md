# NovelGraph agent state

This directory separates disposable session state from durable project truth.

| Location | Authority | Purpose |
| --- | --- | --- |
| `AGENTS.md` | Durable | Repository constitution and engineering rules |
| `docs/architecture/decisions/` | Durable | Accepted architecture decisions |
| `plan/` | Durable | Programme and phase plans |
| `docs/engineering/` | Durable | Capability and provenance truth |
| `.agent/context.json` | Disposable | Generated, scoped context for one task |
| `.agent/task.json` | Disposable | Current task loop state |
| `.agent/memory/` | Disposable | Session notes, hypotheses, and handoff preparation |
| Hermes persistent memory | External/disposable | Hermes interaction memory and learned procedures, normally under `%LOCALAPPDATA%\\hermes\\memories` on native Windows |
| Code, tests, migrations, and ADRs | Durable | Executable engineering memory |
| NovelGraph SQLite, TEI, and graph state | Canonical | Author-approved project state |

Hermes memory, skills, subagents, and MCP results are never canon. They may propose work or
summarize evidence; only a governed NovelGraph transaction with human approval changes canon.
Do not put credentials, manuscript text, prompts, model responses, or sealed solution content
in shared agent memory or telemetry.

Hermes loads the first matching context file by priority (`.hermes.md`, `AGENTS.md`,
`CLAUDE.md`, `.cursorrules`) and discovers nested `AGENTS.md` files progressively as tools
enter directories. NovelGraph deliberately relies on `AGENTS.md` and does not add `.hermes.md`.

VS Code/Codex is the development surface. Hermes is the governed runtime operator: every
executable worker gets its own versioned Hermes profile with scoped skills, MCP tools, memory,
sandbox, provider/model, and NovelGraph capability policy.

## Loop

Every development task moves through:

`discover → orient → plan → implement → verify → document → review → handoff`

The current loop is recorded in `.agent/task.json`. Use the `agent:*` commands in the root
package to create, validate, checkpoint, document, and hand off work. A task is not complete
until its verification evidence and documentation updates are recorded.
