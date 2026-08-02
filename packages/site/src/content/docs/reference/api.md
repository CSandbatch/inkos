---
title: Studio API v1
description: Stable local HTTP surface used by Studio and integrations.
slug: docs/reference/api
---

Studio serves JSON beneath `/api/v1` on the loopback address. Important resources include:

| Resource | Operations |
| --- | --- |
| `/bootstrap`, `/dashboard` | Workspace readiness and production summary |
| `/projects` | Create a series, book, opening chapter, and optional mystery ledger |
| `/books/:id` | Read book, chapters, and revision history |
| `/chapters/:id` | Save a chapter and immutable revision |
| `/books/:id/graph` | Read graph entities, edges, obligations, and clues |
| `/books/:id/jobs` | Start a budgeted workflow |
| `/jobs/:id` | Read nodes and durable events |
| `/books/:id/reviews` | Read persona feedback and approvals |
| `/books/:id/closure` | Evaluate publication readiness |
| `/books/:id/export` | Write the portable export bundle |

The API is local and currently unauthenticated, so it binds to loopback by default. Do not expose it to an untrusted network.
