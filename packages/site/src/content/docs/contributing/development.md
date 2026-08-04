---
title: Development
description: Build, test, and extend NovelGraph locally.
slug: docs/contributing/development
---

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm site:dev
pnpm site:build
pnpm site:links
```

The monorepo contains the transactional core, CLI, local Studio, and static public site. Add graph invariants to the core before adding UI affordances that depend on them. Agent nodes require typed contracts, explicit capabilities, durable events, idempotency behavior, and budget tests.

Documentation changes must update executable examples and fixture evidence. User-visible changes need keyboard and error states as well as the happy path.
