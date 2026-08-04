# ADR-0008 · BYO-key first; metered gateway is a reserved seam

**Status:** Accepted
**Date:** 2026-08-04

## Context

A hosted gateway with a token markup was proposed as the revenue path. It requires accounts,
billing, egress policy, and a retention posture — and it contradicts the current "no accounts,
no cloud" positioning.

Modelled economics: about **$0.63 of model spend per governed chapter**, roughly **$16 per
novel pass**. A 25% markup yields about **$4 of gross margin per novel**.

## Decision

**Authors bring their own credentials.** NovelGraph authenticates to the provider on the
author's behalf and calls it directly. No NovelGraph account exists; NovelGraph runs no server.

The gateway is **designed for and not built**. Its seams — `provider_profiles`,
`model_invocations`, a cost ledger, `workspace_id` throughout — exist by Phase 8.

## Alternatives rejected

- **Gateway first.** Builds billing before anything worth billing for.
- **Gateway only.** Abandons local-first, which is most of the pitch.

## Consequences

- Prompts travel to the author's chosen provider. Copy must say so — local storage is not
  local inference.
- **$4 per novel does not fund a business.** If the gateway is the revenue mechanism, either
  the markup is not slight or the product is priced on the platform. Q8.
- Zero-retention must be designed in, not retrofitted: logs already written cannot be unwritten.
