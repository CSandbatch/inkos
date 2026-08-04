---
title: Release operations
description: Run the package and GitHub Pages release gates from the repository configuration.
slug: docs/operations/release
---

NovelGraph releases the site and npm packages independently. A push to `main` can deploy the static site through `pages.yml`. A tag matching `v*` starts the npm package workflow.

## Current registry state

As verified against `https://registry.npmjs.org` on **2026-08-03**, each intended public package record returns npm `E404`:

```text
@actalk/novelgraph-core
@actalk/novelgraph-studio
@actalk/novelgraph
```

The source alpha is therefore the only supported installation path today. These commands are expected to fail with `E404` until the owner creates and publishes the records:

```bash
npm view @actalk/novelgraph-core version
npm view @actalk/novelgraph-studio version
npm view @actalk/novelgraph version
```

Do not advertise `npx @actalk/novelgraph studio` as available before canary publication, clean registry installation, manual dist-tag promotion, and the promotion workflow all pass.

## Local preflight

Run these commands from a clean, reviewed checkout before pushing a release tag:

```bash
git status --short --branch
git diff --check
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
corepack pnpm -r typecheck
corepack pnpm -r test
corepack pnpm --filter @actalk/novelgraph-site build
corepack pnpm docs:check
corepack pnpm diagrams:check
corepack pnpm copy:lint
```

`copy:lint` writes the ignored `copy-lint-report.json`; inspect it before changing public prose. The generated fair-play reference must be checked with `corepack pnpm docs:check`, not edited by hand. A successful source build does not prove that provider-backed agent execution exists; the current durable workflow still accepts execution from a caller.

## GitHub Pages gate

The Pages workflow runs on `main` for changes under `packages/site`, selected Studio client/shared fixtures, or the workflow itself. A maintainer can also start it with `workflow_dispatch`.

The build job checks out the reviewed commit, installs pnpm and Node 22.13, builds the Astro site beneath `/novelgraph/`, and uploads `packages/site/dist`. The deploy job uses the protected `github-pages` environment with `pages: write` and `id-token: write`; the build job receives only `contents: read`.

Verify the deployment URL and the generated site after the workflow succeeds. A passing package release does not prove that Pages deployed, and a Pages deployment does not prove that npm packages exist.

## Exact-artifact package release

The package workflow uses Node 22.14 and npm 11.18. It derives the version from a `v*` tag, rewrites workspace package versions in the runner, packs one immutable set of tarballs, computes SHA-256 checksums, and carries those exact artifacts between jobs.

| Stage | Required evidence | Blocks |
| --- | --- | --- |
| `verify-and-pack` | Frozen install, builds, typechecks, tests, docs/diagram/copy checks, exact tarballs, checksums, and a local tarball install | Canary publish |
| `publish-canary` | The three uploaded tarballs pass checksum verification and publish under `canary` with npm trusted publishing/OIDC | Canary verification |
| `verify-canary` | Every canary tag resolves to the tagged version and a clean registry install runs the CLI | Maintainer promotion |
| Maintainer promotion | One authenticated maintainer moves those exact versions from `canary` to `latest` | Promotion workflow |
| `verify-and-release` | `latest` and `canary` identify the same versions and a clean latest install succeeds | GitHub release |

The source manifests intentionally use `workspace:*`. The `prepack` hook replaces those references in packed manifests, and `postpack` restores the source manifests. A `workspace:` string in a tarball is a hard failure.

The canary tag points to the final semantic version; it is not a separate prerelease. After canary verification, an authenticated maintainer runs the three dist-tag commands shown below. npm trusted publishing does not authorize this interactive dist-tag operation.

```bash
npm dist-tag add @actalk/novelgraph-core@0.5.0 latest
npm dist-tag add @actalk/novelgraph-studio@0.5.0 latest
npm dist-tag add @actalk/novelgraph@0.5.0 latest
```

Replace `0.5.0` with the exact tag version. Then dispatch `Promote npm release` with that version. The workflow checks both `latest` and `canary`, performs another clean install, and creates the GitHub release from the existing tag.

## First-release owner gate

Before pushing `v0.5.0`, an owner of the `@actalk` npm organization must:

1. Authenticate interactively with `npm login` and keep two-factor authentication enabled.
2. Create public records for `@actalk/novelgraph-core`, `@actalk/novelgraph-studio`, and `@actalk/novelgraph`.
3. Configure `CSandbatch/novelgraph` as the trusted GitHub publisher for each package in `release.yml`.
4. Bind the npm trust record to the `npm-release` GitHub environment if npm requests an environment.
5. Remove any long-lived npm automation token after trusted publishing succeeds.

These actions require npm and GitHub organization/repository authority. The workflow does not fall back to a long-lived npm token.

## Failure states and authority

- A dirty checkout, wrong tag version, stale generated reference, failed prerequisite, workspace protocol leak, checksum mismatch, or failed clean install blocks publication.
- A missing npm package record or incorrect trusted-publisher relationship fails at `npm publish`.
- A failed dist-tag promotion leaves a verified canary without creating a GitHub release; correct the registry state and rerun promotion.
- A passing package release does not prove Pages deployed.
- A passing package release does not prove automatic provider-backed Sol, Terra, Luna, or specialist execution; that remains an implementation boundary in the source alpha.

The Git tag selects the source commit. The uploaded tarballs define the package bytes. npm defines what installers receive. The promotion workflow records that the exact canary versions became `latest` before it creates the public GitHub release.

## Accessible release-pipeline equivalent

[Open the rendered release-pipeline diagram](/novelgraph/diagrams/14-release-pipeline.svg) · [Read the canonical Mermaid source](https://github.com/CSandbatch/novelgraph/blob/main/docs/diagrams/14-release-pipeline.mmd)

The Pages sequence starts on a feature branch. Checks precede the pull request and merge to `main`, then the reviewed commit enters Pages deployment. The package sequence runs from a `v*` tag through verification, immutable tarball packing, npm canary publication, clean installation, maintainer dist-tag promotion, and the GitHub release.
