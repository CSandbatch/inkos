# Changelog

## Unreleased

- Added Hermes-aware repository instructions, scoped package context files, disposable agent memory boundaries, task-loop commands, and Hermes availability diagnostics.
- Added a canonical project hub linking the repository, live site, implementation branch, commits, draft PR, documentation, and Hermes runtime guidance.

All notable NovelGraph changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project is still pre-1.0 and may make breaking changes between minor releases.

## Unreleased

### Added

- OAuth 2.0 device-flow sign-in (RFC 8628) for model providers, with PKCE (RFC 7636) on every token exchange, OIDC endpoint discovery so no provider URL is hardcoded, automatic refresh, and best-effort revocation (RFC 7009) on logout.
- Credential storage in the operating system credential store: Windows DPAPI via PowerShell, macOS Keychain via `security`, and libsecret via `secret-tool`, with no native module dependency. Where no store is available, an unencrypted `0600` file is used and reported as unprotected rather than presented as secure.
- `novelgraph auth` commands: `configure`, `login`, `status`, `logout`, and `token`. `auth token` refuses to write to a terminal.
- Studio **Model access** route and `/api/v1/auth/*` endpoints. The device code, access token, and refresh token stay in the local server process; the browser receives only the user code and verification URI.
- `novelgraph doctor` now reports the credential-storage backend and provider sign-in state, failing only when tokens are stored on a machine with no OS credential store.
- Local SQLite Studio source of truth with typed story entities, obligations, approvals, revisions, reader feedback, mystery clues, budgets, and durable workflow records.
- React/Hono Studio alpha with project initialization, manuscript editing, story graph, DAG inspector, review center, and closure-aware exports.
- Astro/Starlight product site, documentation, and an interactive fixture-backed mystery demo.
- English-first literary guidance and explicit research provenance controls.

### Security

- `novelgraph config set llm.apiKey` is now refused. It wrote a credential into `novelgraph.json`, a project file normally committed to version control. Existing keys already written there should be rotated and removed.
- `novelgraph config set-global --api-key` is now optional and warns that it writes plaintext to `~/.novelgraph/.env`.

### Changed

- Repositioned NovelGraph from an autonomous file-first CLI to a supervised local agent production OS for fiction.
- Raised the supported runtime to Node.js 22.13 or newer, where the built-in SQLite API is available without an experimental flag.
- Made English the sole product, documentation, prompt, and generation language.
- Replaced legacy truth-file claims with SQLite transactions, immutable revisions, and attributable events.

### Removed

- Chinese locale branches, platform assumptions, prompt text, examples, notification integrations, and legacy project migration promises.

## 0.4.9 - Legacy CLI line

The 0.4.x releases established the original multi-agent CLI, provider routing, chapter generation, auditing, revision, import, export, and daemon workflows. These releases used file-first book state and included Chinese-language behavior that is not supported by the new Studio architecture.
