# ADR-0010 · OAuth device flow for provider authentication

**Status:** Accepted
**Date:** 2026-08-04

## Context

Provider authentication was requested and built ahead of its planned position (Phase 8). The
existing path wrote API keys in plaintext to `novelgraph.json` — a committed project file — and
to `~/.novelgraph/.env`. `config show` masked the key on display, hiding the problem rather
than fixing it.

Three options were considered, with materially different terms-of-service exposure.

## Decision

**OAuth 2.0 Device Authorization Grant (RFC 8628)**, with:

- **PKCE (RFC 7636) `S256` on every exchange.** Not required by RFC 8628; it costs nothing and
  binds the exchange to the process that began it, so an intercepted device code is not
  independently redeemable.
- **OIDC discovery.** Endpoints come from `<issuer>/.well-known/openid-configuration`. **No
  provider URL is hardcoded.**
- **No bundled client ID.** NovelGraph is not a registered OAuth client of any provider.
  Fabricating an ID or endpoint would produce code that fails against the wrong host while
  appearing configured.
- **OS-native credential storage** — Windows DPAPI, macOS Keychain, libsecret — with no native
  module. Where none is available, an unencrypted `0600` file is used and **reported as
  unprotected**.

## Alternatives rejected

| Option | Why not |
|---|---|
| **API keys, stored in the OS keychain** | Simpler and unambiguous on terms. Rejected as the *primary* path because pasted long-lived secrets are the weaker credential model. **Retained as a fallback** for providers with no device flow. |
| **Local CLI runtime adapter** (shell out to an authenticated provider CLI) | Cleanest terms posture — the credential never reaches NovelGraph — and matches the `codex` runtime profile in ADR-0004. Rejected for now; remains the fallback if no third-party client is obtainable (~2 sessions). |

## Known limitations

1. **Unusable until an operator registers a client.** `auth status` says so explicitly.
2. **Whether a provider permits third-party account use is the provider's decision.** Recorded
   as an operator responsibility in the sign-in guide and `SKILL.md`. The implementation
   asserts nothing about any provider's terms. Q12.
3. **Built before its dependencies.** Auth defines its own schemas rather than using
   `packages/contracts`; token access is not routed through capability grants; no invocation
   ledger or domain events. A 1–2 session reconciliation is scheduled — `plan/03`
   §Sequencing.

## Consequences

- `config set llm.apiKey` now **refuses**. Keys already written there should be rotated.
- The Studio browser never holds a credential: auth routes return only the user code and
  verification URI.
- `auth token` refuses to write to a TTY.
- The implementation is provider-agnostic and standards-conformant, so it works against any
  RFC 8628 provider — which limits the downside if a specific provider turns out to be
  unavailable.
