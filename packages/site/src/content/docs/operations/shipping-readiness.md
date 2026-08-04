---
title: Shipping readiness
description: What works now, what blocks the npm release, and how NovelGraph reaches the promoted alpha threshold.
slug: docs/operations/shipping-readiness
---

NovelGraph has two different release boundaries. The public repository, documentation, fixture demo, and source-built local Studio are live. The npm packages and complete provider-backed agent execution are not. This page keeps those boundaries explicit so an operator can tell whether a failure belongs to installation, local state, workflow execution, or publication.

## Current release state

| Surface | State | Evidence |
| --- | --- | --- |
| GitHub repository | Live | `CSandbatch/novelgraph` is public; `main` requires `build-test-and-pack` and resolved review conversations. |
| Documentation site | Live | GitHub Pages serves the homepage, documentation, diagrams, and fixture demo beneath `/novelgraph/`. |
| Source installation | Verified | Node 22, the pinned pnpm version, a frozen install, workspace build, and local Studio startup have passed. |
| Local application | Alpha | Studio binds to loopback, creates SQLite state, persists revisions and jobs, and serves `/api/v1`. |
| Public demo | Live fixture | The demo has immutable in-browser data. It performs no provider calls and stores no manuscript. |
| npm packages | Blocked externally | The three package records do not exist and the operator machine is not authenticated to npm. |
| Provider-backed agents | Incomplete | The DAG, capabilities, artifacts, budgets, and state transitions exist. Every Sol, Terra, and Luna node does not yet invoke a configured model automatically. |
| Promoted `v0.5.0` release | Not created | No release tag should be pushed before npm ownership and trusted publishing are configured. |

## Make the local alpha run

Use the source path while npm is blocked:

```bash
git clone https://github.com/CSandbatch/novelgraph.git
cd novelgraph
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
node packages/cli/dist/index.js init my-novel
cd my-novel
node ../packages/cli/dist/index.js doctor
node ../packages/cli/dist/index.js studio
```

The relative CLI path in the last three commands assumes `my-novel` was created inside the checkout. For a workspace elsewhere, use the absolute path to `packages/cli/dist/index.js`.

Confirm the server before entering story data:

```bash
curl http://127.0.0.1:4567/api/v1/health
curl http://127.0.0.1:4567/api/v1/bootstrap
```

The first response must contain `{"ok":true}`. The second describes whether a project exists. Studio creates `.novelgraph/studio.sqlite` inside the selected project. Keep the server on loopback unless every client on the target network is trusted; the local API has no account authentication.

## Repository-resolvable release work

These items do not require an external credential and should remain green on every merge:

1. Keep builds, typechecks, tests, generated fair-play reference, diagrams, copy review, tarball inspection, and public identity scans in CI.
2. Replace the remaining legacy model-routing names in `novelgraph config set-model` with Sol, Terra, Luna, and typed production-node identifiers.
3. Connect provider calls to the durable node lifecycle. A worker must request ready work, receive a capability-filtered dossier, record usage, complete or fail the node, and leave enough state to resume after interruption.
4. Add browser acceptance coverage for discovery, charter approval, chapter revision, mystery workbench, DAG execution, finding resolution, closure, and export.
5. Extend the built-site link checker to validate external documentation URLs and Studio help targets without making routine CI depend on transient third-party outages.
6. Split the graph-heavy Studio and demo bundles by route. The current build succeeds but reports a chunk-size warning.
7. Replace transient fixture-only controls with clear empty, loading, error, retry, and no-provider states.
8. Verify backup restoration against a copied project, not only backup creation.

Provider execution is the largest functional gap. The current state machine can demonstrate permissions and persistence, but the promoted vertical slice requires a configured provider to move real work through the inspected DAG.

## npm owner actions

An owner of the `@actalk` npm organization must perform the first package setup:

1. Authenticate interactively with `npm login` and keep two-factor authentication enabled.
2. Create public records for `@actalk/novelgraph-core`, `@actalk/novelgraph-studio`, and `@actalk/novelgraph`.
3. Configure `.github/workflows/release.yml` in `CSandbatch/novelgraph` as the trusted publisher for each record. If npm asks for an environment, use `npm-release`.
4. Remove any long-lived automation token after trusted publishing is confirmed.
5. Push `v0.5.0` only after the records and trust relationships exist.

The tag workflow builds and packs one set of tarballs, publishes those exact files under `canary`, and verifies a clean registry installation. It does not rebuild between verification and publication.

npm trusted publishing does not authorize the interactive dist-tag change used by this release design. After canary verification, an authenticated maintainer runs:

```bash
npm dist-tag add @actalk/novelgraph-core@0.5.0 latest
npm dist-tag add @actalk/novelgraph-studio@0.5.0 latest
npm dist-tag add @actalk/novelgraph@0.5.0 latest
```

Then dispatch **Promote npm release** with `0.5.0`. That workflow verifies that `canary` and `latest` resolve to the same version, installs from the registry, and creates the GitHub release.

## Public launch actions

GitHub's repository social-preview uploader is available in repository Settings rather than the release API. Upload `packages/site/public/assets/signal-grid-social.png`. The Pages homepage already uses the same file for Open Graph cards.

After npm promotion, replace the source-first installation copy with `npx @actalk/novelgraph studio`. Update the README, homepage, Getting Started guide, local deployment guide, and migration guide in one pull request. Test the command from a clean directory before merging that copy change.

## Promoted-alpha gate

The promoted alpha is ready only when all of the following are true:

- a clean registry installation launches Studio without the monorepo or pnpm;
- the author can complete discovery and approve a Story Charter;
- a configured provider can execute the production DAG with visible costs and artifacts;
- restart, retry, cancellation, rollback, and approval remain durable;
- the seeded mystery reaches closure only after its blocking findings are resolved;
- the export bundle contains the manuscript, metadata, citation report, and closure report;
- Pages, repository metadata, npm tags, and the GitHub release identify the same version;
- no critical security, accessibility, test, documentation, or privacy finding remains.

Stars, traffic, and generated prose do not satisfy this gate. The operative acceptance event is a completed sample workflow whose state can be inspected and resumed.
