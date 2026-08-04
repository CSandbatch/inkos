---
title: Review, approve, and revise
description: Current review records, author decisions, and API-based resolution paths.
slug: docs/guides/review
---

The current Review Center reads reader feedback and generic approval records. Its **Reject** and **Approve with rationale** controls are presentational; they do not submit decisions. No current route resolves a reader-feedback card or dismisses a general finding.

Author decisions are available through narrower API operations. Story Charters use `/api/v1/charters/:id/resolve`. Generic approvals use `/api/v1/approvals/:id/resolve`. Obligations use `/api/v1/obligations/:id/resolve`. Rule-Breaking mystery waivers use the fair-play finding waiver route.

Do not treat an on-screen button or a changed manuscript as proof that the originating blocker is closed. Inspect the affected record, make the authorized change, run the relevant validation again, then read the closure report.

The complete current procedure, including `curl` examples and unavailable controls, is in [Review and approval](/novelgraph/docs/guides/review-and-approval/).
