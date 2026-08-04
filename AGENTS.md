# AGENTS.md

Constitutional instructions for any agent or human working in this repository.

**This file contains only stable rules.** It is not a sprint board, a bug list, or a place for
speculative architecture. If something here is true only this week, it belongs somewhere else —
see [Where to find more context](#where-to-find-more-context).

---

## 1. What this project is

NovelGraph is a **governed production system for long-form fiction**. A novel is treated as a
system of commitments — promises, planted clues, character knowledge, causal dependencies — not
as a stream of prose to generate.

The thesis in one sentence:

> **Canonical content is versioned. Operational state is relational. Execution history is
> append-only. Derived indexes are disposable.**

Most design questions resolve by asking which of those four a thing is.

**Current state, so you do not assume more than exists:** this is a source alpha. Provider
authentication works. **Nothing calls a model.** The workflow engine records durable topology
and does not execute. Read `docs/engineering/capability-registry.yaml` before believing any
capability is available.

---

## 2. Authority boundaries

These are the rules that make the product what it is. Violating one is a design defect, not a
style preference.

1. **Workers propose; validators check; humans approve.** There is no path by which a model
   commits canon. If you are adding one, stop.
2. **Approved manuscript text is immutable and versioned.** Not a mutable column.
3. **Every canonically significant assertion carries provenance and authority** — where it came
   from, at what confidence, and whether the reader knows it.
4. **Sealed content requires an explicit capability.** A mystery's solution must never reach a
   drafting worker. Access is logged.
5. **Capabilities are issued by the server**, scoped, and expiring. A caller may never assert
   its own authority. *(The legacy `x-novelgraph-capability` header violates this. It is a
   known defect, not a pattern to copy.)*
6. **Credentials never enter project files.** Not `novelgraph.json`, not a committed `.env`,
   not a prompt, not a log. Tokens belong in the OS credential store.
7. **Closure is a checked claim, never a quality claim.** Closure means the configured
   obligations are discharged. It never means the book is good, publishable, or true.

---

## 3. Dependency direction

Dependencies point inward. Nothing inner may import anything outer.

```
contracts / domain      ← no dependencies; no provider SDK types, ever
  ↑
core (store, packs, auth, validation)
  ↑
studio (Hono transport) · cli (commander transport)
  ↑
site (documentation and marketing)
```

Rules that follow:

- **No provider SDK type may appear in `contracts` or `domain`.** A provider is a detail.
- **UI is never a security or consistency boundary.** If a rule can only be enforced in React,
  it is not enforced.
- **Transports are thin.** `server.ts` and CLI commands call application code. *(Existing
  routes issue SQL directly. That is legacy, and new routes must not.)*

---

## 4. Required commands

Run before claiming anything is done. All must pass.

```bash
corepack pnpm -r build          # compile every package
corepack pnpm typecheck         # tsc --noEmit across packages
corepack pnpm -r test           # unit + integration
corepack pnpm lint              # typecheck + copy lint + docs + diagrams
corepack pnpm capabilities:check   # registry drift + evidence exists
corepack pnpm provenance:check     # every source file has a ledger row
```

Site changes additionally need:

```bash
corepack pnpm site:build && corepack pnpm site:links
```

**`vite build` does not typecheck.** A green Studio build means nothing on its own; run
`typecheck`.

---

## 5. Prohibited shortcuts

Each of these has been hit before. They are not hypothetical.

| Never | Why |
|---|---|
| Write a credential to `novelgraph.json` or a committed `.env` | That file ships to every clone. `config set llm.apiKey` refuses for this reason. |
| Invent a provider endpoint URL, client ID, or API shape | Code that points at a wrong host fails obscurely. Discover endpoints, or require configuration. |
| Trust a capability supplied by the caller | Cooperative metadata is not a security boundary. |
| Describe unbuilt behaviour in the present tense | The landing page already does this. Do not add more. §7. |
| Add an allowlist entry for copy you just wrote | The allowlist records exceptions to a standard. Fix the prose. |
| Delete a validation finding | Findings resolve, waive, or go obsolete. They do not disappear. |
| Overwrite a failed attempt on retry | Attempts are the diagnostic record. |
| Put manuscript text, prompts, or graph content in telemetry or metrics | Prohibited outright. |
| Add a native dependency for something the OS already does | See `auth/secret-store.ts` for the shape of the alternative. |
| Bypass a failing gate with `--no-verify` or a skipped test | Fix the cause or say plainly that you did not. |

---

## 6. Change classification

What a change touches determines the loop it must run.

| If the change touches… | Then it requires |
|---|---|
| Canonical authority, dependency direction, schema ownership, capability semantics, runtime/provider interfaces, pack composition, migration policy | An **ADR** — new or amended. `docs/architecture/decisions/` |
| A database schema | The **migration loop**: fixture → backup → migrate → validate → inject failure → verify rollback → migrate twice → verify idempotence |
| A rule or genre pack | The **pack loop**: compile → check conflicts → validators → fixtures → **diff findings against the previous version** → bump version |
| A public claim about what the product does | A **capability-registry** entry with test evidence, then regenerate docs |
| Any new source file | A **provenance-ledger** row |
| An escaped defect | **Executable memory** — a regression fixture, migration fixture, pack evaluation case, or architecture check. A prose note is insufficient. |

---

## 7. Writing about the product

Public copy is a gated surface. `corepack pnpm copy:lint` enforces part of this; the rest is on you.

- **Present tense means shipped.** Anything unbuilt is future tense or carries a phase tag.
- **No agent personas.** Sol, Terra, and Luna are retired. Say *worker profile*, *task
  contract*, *node attempt*. Author-facing copy says *the assistant*.
- **Never describe NovelGraph as open source or MIT-licensed.** The licence is unsettled.
- **Every quantitative claim carries its source or its status.** "22 rules" links to the
  generated catalog. A modelled number says *modelled*.
- **Distinguish local storage from local inference.** Manuscripts stay on the machine; model
  calls do not. Say so.

## 7.1 VS Code development surface and Hermes worker runtime

VS Code/Codex is the development surface for inspecting, editing, testing, and documenting this
repository. Hermes Agent is the runtime operator for workers executing inside NovelGraph. Every
executable worker must use a versioned, fully configured Hermes profile with an explicit provider,
model, skill set, MCP allowlist, memory mode, sandbox/backend, task contract, and capability
policy. Hermes memory, skills, subagents, and MCP results are working context only; they never
become NovelGraph canon. Run `corepack pnpm hermes:doctor` before relying on Hermes-backed work,
and report Hermes as unavailable when it is not installed. Use the validated `.agent/task.json`
loop and record documentation updates before handoff.

---

## 8. Definition of done

A change is done when **all** hold:

1. Required commands pass.
2. One invariant is stated, and a test would fail if it broke.
3. New source files have provenance-ledger rows.
4. New or changed capabilities have registry entries with real test evidence.
5. Documentation regenerates without drift.
6. Public copy passes the lint, with no new allowlist entries.
7. Anything left undone is stated plainly rather than implied complete.

---

## 9. Where to find more context

| Question | Look |
|---|---|
| Why is it built this way? | `docs/architecture/decisions/` |
| What actually works today? | `docs/engineering/capability-registry.yaml` |
| Where did this file come from? | `docs/engineering/provenance-ledger.md` |
| What is the plan? | `../plan/` — programme documents, phases, whitepaper, open questions |
| What is undecided? | `../plan/05-open-questions.md` |
| What am I working on right now? | `.agent/task.json` — session-local, gitignored, no authority |

Build a portable context bundle for a scoped task:

```bash
corepack pnpm agent:context --scope packages/core --issue 17
```

It writes `.agent/context.json` — this file, applicable ADRs, registry entries for the scope,
branch and diff state, and the required commands. Use it so every runtime gets the same
context instead of relying on each tool's own memory.

---

## 10. Session start

Before editing anything:

1. Read this file and any nested `AGENTS.md` in the package you are touching.
2. Load the task and architectural context (`agent:context`).
3. Inspect the current branch and diff.
4. Run the focused tests for your scope to establish a baseline.
5. **State which invariant the change affects.**
6. Write `.agent/task.json`.

**Do not begin editing because you recognise a filename.** Recognising a file is not
understanding what it is for.
