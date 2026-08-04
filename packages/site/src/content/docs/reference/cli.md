---
title: CLI reference
description: Commands available in the NovelGraph 0.5 alpha source build.
slug: docs/reference/cli
---

The CLI is a client of the local NovelGraph core. The `0.5.0` npm package is not published yet, so examples on this page use `novelgraph` as shorthand for the built executable:

```bash
node /absolute/path/to/novelgraph/packages/cli/dist/index.js
```

After npm publication, `npx @actalk/novelgraph` will provide the same command surface.

## `novelgraph init [name]`

Create `novelgraph.json`, `.env`, `.gitignore`, and the initial project directories. Omitting `name` initializes the current directory. Supplying a name creates a child directory.

```bash
novelgraph init my-novel
novelgraph init --lang en
```

English is the only accepted language. The generated `.env` contains placeholders and is ignored by Git. Initialization stops when `novelgraph.json` already exists.

## `novelgraph auth`

Sign in to a model provider with the OAuth 2.0 device flow (RFC 8628). Full walkthrough:
[Sign in to a model provider](/novelgraph/docs/guides/provider-sign-in/).

### `novelgraph auth configure`

Record the OAuth client ID and endpoints for a provider. NovelGraph ships no client ID; register a device-flow client with the provider first.

```bash
novelgraph auth configure --provider chatgpt --client-id <id> --issuer <url>
```

| Option | Purpose |
| --- | --- |
| `--provider <id>` | Provider id (`chatgpt`, `codex`, or one you define) |
| `--client-id <id>` | OAuth client identifier issued to this installation |
| `--client-secret <secret>` | Confidential clients only; public clients use PKCE |
| `--issuer <url>` | OIDC issuer; endpoints are discovered from it |
| `--device-endpoint <url>` | Explicit device authorization endpoint, skipping discovery |
| `--token-endpoint <url>` | Explicit token endpoint, skipping discovery |
| `--revocation-endpoint <url>` | Explicit revocation endpoint |
| `--scopes <list>` | Space- or comma-separated scopes |
| `--api-base-url <url>` | Base URL used for inference after sign-in |
| `--model <name>` | Default model |

Settings are written to `~/.novelgraph/auth.json`. No secret is stored there. Matching `NOVELGRAPH_<PROVIDER>_*` environment variables take precedence.

### `novelgraph auth login`

Start the device flow. Prints a verification URI and a user code. A browser opens unless `--no-open` is passed. The command completes when the request is approved.

```bash
novelgraph auth login --provider chatgpt
```

### `novelgraph auth status`

Show sign-in state per provider and name the credential-storage backend in use.

```bash
novelgraph auth status
novelgraph auth status --json
```

States: `authenticated`, `refreshable`, `expired`, `not-configured`, `no-client-id`.

### `novelgraph auth logout`

Revoke where the provider supports it, then delete stored tokens. `--all` covers every provider.

### `novelgraph auth token`

Print a valid access token for scripting, refreshing it first if required. It refuses to write to a terminal. Pipe or redirect it.

```bash
novelgraph auth token --provider chatgpt | your-tool
```

## `novelgraph doctor`

Check Node version, the English project boundary, project and global environment files, the Studio database location, the credential-storage backend, and provider sign-in state.

```bash
novelgraph doctor
```

The command exits nonzero when a required check fails. A missing database is informational until Studio has been launched once. Credential storage fails only when tokens are actually stored on a machine with no OS credential store; an unauthenticated project has nothing at risk.

## `novelgraph studio`

Start the production Hono server and serve the built React client.

```bash
novelgraph studio
novelgraph studio --no-open
novelgraph studio --port 4568
novelgraph studio --host 127.0.0.1
```

The default host is `127.0.0.1`. Binding to a LAN address exposes an unauthenticated local API and prints a warning. The selected port must be an integer from 1 through 65535.

## `novelgraph config`

Read or change project and global provider configuration.

```bash
novelgraph config show
novelgraph config set llm.model MODEL_ID
novelgraph config set llm.temperature 0.4
novelgraph config set-global \
  --provider openai \
  --base-url https://api.openai.com/v1 \
  --model MODEL_ID
novelgraph config show-global
```

`novelgraph config set llm.apiKey` is **refused**. It wrote a credential into `novelgraph.json`, which is normally committed to version control. Use `novelgraph auth login` instead. Providers with no device flow can set `NOVELGRAPH_LLM_API_KEY` in an ignored `.env`.

`config set-global --api-key` still accepts a key for those providers but is now optional and warns: it writes plaintext to `~/.novelgraph/.env`.

`show` and `show-global` mask API keys. Project settings live in `novelgraph.json`; global provider settings live in the user-level `.novelgraph/.env`. OAuth provider settings live in `~/.novelgraph/auth.json` and contain no secrets. Project environment values override the global file.

The source build still exposes model-override subcommands with legacy worker names. Treat them as compatibility-only until they are replaced by Sol, Terra, Luna, and typed DAG-node routing. Do not build new automation around those names.

## `novelgraph inspect-prose <path>`

Inspect one text file or recursively inspect a directory of Markdown and plain-text files.

```bash
novelgraph inspect-prose manuscript/
novelgraph inspect-prose chapter-01.md --json
```

Findings identify category, location, matched construction, context, and a suggested inspection. They are advisory. The command never labels prose as model-written and does not rewrite the file.

## Exit and error behavior

- Argument and validation errors exit nonzero and print a direct message.
- `doctor` exits nonzero when required checks fail.
- `inspect-prose` reports findings without treating them as proof of authorship.
- Studio startup errors identify invalid ports, missing production assets, and bind failures.
- Commands mask known credentials but cannot protect secrets deliberately placed in filenames, shell history, or unrelated configuration fields.

Run `novelgraph --help` or `novelgraph help <command>` for the command metadata built into the current executable.
