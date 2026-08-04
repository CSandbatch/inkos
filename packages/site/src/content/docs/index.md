---
title: NovelGraph documentation
description: Plan, draft, audit, revise, and close fiction through a local inspectable workflow.
slug: docs
---

NovelGraph documentation distinguishes the working local alpha from the promoted release target. Use the [Project hub](/novelgraph/docs/project-hub/) for the repository, live website, current implementation branch, commits, draft PR, runtime, and architecture links. Start with [Getting started](/novelgraph/docs/getting-started/) to build and launch Studio from source. Read [Capability status](/novelgraph/docs/reference/capability-status/) before depending on an alpha feature, and use [Shipping readiness](/novelgraph/docs/operations/shipping-readiness/) when preparing npm or GitHub releases.

## Choose a route

| Goal | Read first | Continue with |
| --- | --- | --- |
| Run Studio locally | [Getting started](/novelgraph/docs/getting-started/) | [Local deployment](/novelgraph/docs/operations/local-deployment/) and [CLI reference](/novelgraph/docs/reference/cli/) |
| Establish a book | [Discovery and Story Charters](/novelgraph/docs/concepts/discovery-and-charters/) | [Knowledge boundaries](/novelgraph/docs/concepts/knowledge-boundaries/) and [Scratchpads and handoffs](/novelgraph/docs/concepts/scratchpads-and-handoffs/) |
| Build a mystery | [Build a fair mystery](/novelgraph/docs/guides/mystery/) | [Evidence and reader trust](/novelgraph/docs/guides/evidence-and-trust/) and [fair-play rules](/novelgraph/docs/reference/fair-play-rules/) |
| Operate the workflow | [Supervised workflow](/novelgraph/docs/concepts/workflow/) | [Agent capabilities](/novelgraph/docs/reference/agent-capabilities/) and [Studio API](/novelgraph/docs/reference/api/) |
| Revise safely | [Review, approve, and revise](/novelgraph/docs/guides/review/) | [Revision, retcon, and rollback](/novelgraph/docs/guides/revision-retcon-rollback/) |
| Protect a project | [Backup and recovery](/novelgraph/docs/operations/backup-and-recovery/) | [Privacy and telemetry](/novelgraph/docs/operations/privacy/) |
| Contribute | [Development](/novelgraph/docs/contributing/development/) | [Public copy standard](/novelgraph/docs/contributing/public-copy/) |

NovelGraph keeps manuscripts, credentials, SQLite state, sealed solutions, and agent artifacts on the author's machine. The public demo uses immutable fixture data and never receives a real project.

The npm package names appear in release documentation because they define the intended installation contract. They are not available from the registry yet. Public setup instructions use the source build until canary verification succeeds.
