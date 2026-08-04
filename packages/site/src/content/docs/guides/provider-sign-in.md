---
title: Sign in to a model provider
description: Authenticate with the OAuth 2.0 device flow and understand where NovelGraph keeps your tokens.
slug: docs/guides/provider-sign-in
---

NovelGraph signs in to model providers with the **OAuth 2.0 Device Authorization Grant**
([RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628)). It is the same flow a television
app uses. You approve the request in a browser on any device. No long-lived secret is ever
pasted into a terminal or a project file.

## Before the first sign-in

**NovelGraph does not ship an OAuth client ID.** Registering a client is something the operator
of a NovelGraph installation does with the provider directly, because the client identifies
*your* installation to *them*.

Once you have one:

```bash
novelgraph auth configure \
  --provider chatgpt \
  --client-id <your-client-id> \
  --issuer https://issuer.example.com
```

The issuer is enough on its own: NovelGraph reads
`<issuer>/.well-known/openid-configuration` and takes the device-authorization and token
endpoints from there. If your provider publishes no discovery document, set them explicitly:

```bash
novelgraph auth configure --provider chatgpt \
  --device-endpoint https://example.com/oauth/device/code \
  --token-endpoint  https://example.com/oauth/token
```

Configuration is written to `~/.novelgraph/auth.json`. **No secret is ever written there.**
Tokens go to the credential store described below. Every field can also be supplied through the
environment as `NOVELGRAPH_CHATGPT_CLIENT_ID` or `NOVELGRAPH_CHATGPT_ISSUER`. Environment
values take precedence over the file.

:::caution[Check your provider's terms]
Providers decide whether their accounts may be used through third-party software. They also
decide whether a subscription covers programmatic use. Confirm that your client registration and
your plan permit it before signing in.
:::

## Signing in

```bash
novelgraph auth login --provider chatgpt
```

```text
Signing in to ChatGPT / OpenAI…

  1. Open  https://example.com/activate
  2. Enter code  WDJB-MJHT

  Code expires in 15 minutes.
  A browser window should have opened.

Signed in to ChatGPT / OpenAI.
  Tokens stored via: Windows DPAPI (user-scoped encryption)
  Access token expires 2026-08-03T17:42:11.000Z
```

Approve in the browser and the command completes on its own. Pass `--no-open` to suppress the
browser launch. The same flow is available in Studio under **Model access**.

## Where tokens are kept

NovelGraph uses the operating system's own credential store and tells you which one is in use:

| Platform | Backend | Protection |
| --- | --- | --- |
| Windows | DPAPI, via PowerShell | Encrypted to your user account; ciphertext is useless to another user or machine |
| macOS | Keychain (`security`) | Keychain access control |
| Linux | libsecret (`secret-tool`) | GNOME Keyring / KWallet |
| Anything else | File at `~/.novelgraph/credentials.json`, mode `0600` | **None — unencrypted** |

The fallback is reported honestly rather than dressed up. When `novelgraph auth status` says
storage is unprotected, tokens on that machine are readable by your user account. While
credentials are present, `novelgraph doctor` reports a failing check.

## Checking state

```bash
novelgraph auth status
```

```text
NovelGraph Authentication

  [OK] chatgpt   Signed in — expires in 58 min.
                 scopes: openid profile offline_access
  [--] codex     No OAuth client ID. NovelGraph does not ship one — …

  Credential storage: Windows DPAPI (user-scoped encryption)
```

Add `--json` for a machine-readable form.

| State | Meaning |
| --- | --- |
| `authenticated` | A valid access token is held |
| `refreshable` | The access token expired; the next call refreshes it automatically |
| `expired` | Expired with no refresh token. Sign in again. |
| `not-configured` | Ready to use, but not signed in |
| `no-client-id` | No OAuth client ID or endpoints configured yet |

## Refresh

Refresh is automatic. NovelGraph refreshes a token that expires within 60 seconds rather than
letting a call race the boundary. A provider may omit a new refresh token on refresh, which
[RFC 6749 §6](https://datatracker.ietf.org/doc/html/rfc6749#section-6) permits. The existing one
is then retained rather than discarded.

When a refresh token is finally rejected, NovelGraph reports it plainly and asks you to sign in
again rather than retrying a dead session.

## Signing out

```bash
novelgraph auth logout --provider chatgpt
novelgraph auth logout --all
```

Where the provider advertises a revocation endpoint, the token is revoked server-side. Local
tokens are deleted either way, and the command says which happened.

## Scripting

```bash
novelgraph auth token --provider chatgpt | your-tool
```

Prints a valid access token, refreshing first if required. It **refuses to print to a
terminal**. A token echoed into a scrollback buffer or onto a shared screen is a leaked token.
Pipe or redirect it.

## What the browser and the network see

- The Studio browser tab receives only the user code and verification URI. The device code,
  access token, and refresh token stay in the local NovelGraph process and the OS credential
  store, so a Studio tab cannot leak a credential.
- Every token request carries a **PKCE** ([RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636))
  `S256` challenge. PKCE is not required by RFC 8628, but it binds the exchange to the process
  that began it, so an intercepted device code cannot be redeemed independently.
- Sign-in reaches only the provider's own endpoints. NovelGraph has no server of its own.

## Once signed in, prompts leave your machine

Authentication exists so NovelGraph can call a model on your behalf. **When it does, the text in
that request is sent to your provider and handled under their terms.** That text may include
manuscript content.

Local-first describes where your project is stored: SQLite state, revisions, sealed solutions,
and research snapshots stay in your project directory. It does not mean model calls happen
locally. See [Privacy and telemetry](/novelgraph/docs/operations/privacy/).

## API keys

Providers without a device flow still use API keys via `NOVELGRAPH_LLM_API_KEY`. Two paths were
deliberately removed:

- **`novelgraph config set llm.apiKey` is refused.** It wrote a key into `novelgraph.json`, a
  project file normally committed to version control.
- **`novelgraph config set-global --api-key` still works but warns.** It writes a plaintext key
  to `~/.novelgraph/.env`.

Prefer `novelgraph auth login` wherever the provider supports it.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `No OAuth client ID` | Run `auth configure --client-id`. NovelGraph ships none. |
| `does not advertise a device authorization endpoint` | The issuer's discovery document has no `device_authorization_endpoint`; that provider may not support RFC 8628. Set endpoints explicitly or use an API key. |
| `access_denied` | The request was declined in the browser. |
| `expired_token` | The code expired before approval. Sign in again. |
| `invalid_client` | The client ID is wrong, or not registered for the device flow. |
| Storage shows unprotected on Linux | Install libsecret (`secret-tool`) and sign in again. |
