---
title: Release operations
description: Run the package and GitHub Pages release gates from the repository configuration.
slug: docs/operations/release
---

NovelGraph releases the site and npm packages independently. A push to `main` can deploy the static site through `pages.yml`. A tag matching `v*` starts the npm package workflow.

## Local preflight

Run these commands from the repository root before pushing a release tag:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
corepack pnpm site:build
corepack pnpm docs:check
corepack pnpm diagrams:check
corepack pnpm copy:lint
```

Build core before running the copy rule pack because the linter imports its compiled prose analyzer. `copy:lint` writes `copy-lint-report.json`. Inspect the report before changing prose. Use a reviewed allowlist entry only when the flagged construction is technically necessary.

## GitHub Pages gate

The Pages workflow runs on `main` for site changes. Changes to the selected Studio fixtures also trigger it. A maintainer can start it with `workflow_dispatch`.

The job checks out the reviewed commit, installs pnpm and Node, builds the Astro site beneath `/novelgraph/`, uploads `packages/site/dist`, and deploys through the protected `github-pages` environment. The deploy job receives `pages: write` and `id-token: write`; the build job receives only `contents: read`. General CI runs tests, copy review, diagram validation, and site checks before a change reaches `main`.

## Exact-artifact package release

Push a tag such as `v0.5.0` only after the changelog and working tree are ready. The package workflow uses Node 22.14 or newer and npm 11.18 because trusted publishing requires a recent npm client.

| Stage | Required evidence | Blocks |
| --- | --- | --- |
| `verify-and-pack` | Frozen install, builds, typechecks, tests, documentation checks, copy review, exact tarballs, checksums, and a local tarball install | Canary publish |
| `publish-canary` | The three uploaded tarballs pass checksum verification and publish under `canary` with npm OIDC provenance | Canary verification |
| `verify-canary` | Every canary tag resolves to the release version and a clean registry install runs the CLI | Maintainer promotion |
| Maintainer promotion | One authenticated maintainer moves those same versions from `canary` to `latest` with three `npm dist-tag add` commands | Promotion workflow |
| `verify-and-release` | `latest` and `canary` identify the same versions; a clean latest install succeeds | GitHub release |

The workflow derives the version from the Git tag, rewrites workspace package versions, and packs one immutable set of tarballs. `scripts/prepare-package-for-publish.mjs` removes `workspace:*` from packed manifests. The package `postpack` hook restores each source manifest. The tarballs and their SHA-256 manifest move between jobs as one Actions artifact; no publish job rebuilds them.

The `canary` tag points to the final semantic version. It does not point to a separate prerelease build. After a clean registry installation succeeds, an authenticated maintainer runs:

```bash
npm dist-tag add @actalk/novelgraph-core@0.5.0 latest
npm dist-tag add @actalk/novelgraph-studio@0.5.0 latest
npm dist-tag add @actalk/novelgraph@0.5.0 latest
```

Replace `0.5.0` with the tagged version. npm does not authorize dist-tag changes through an OIDC trusted-publisher token. Interactive promotion supplies proof of presence without creating another build.

Dispatch `Promote npm release` after the commands succeed. The workflow compares the registry tags and performs another clean installation. It then creates the GitHub release from the existing tag.

## First-release credential gate

Before the first publication, an owner of the `@actalk` organization must create these public package records:

- `@actalk/novelgraph-core`
- `@actalk/novelgraph-studio`
- `@actalk/novelgraph`

Configure `release.yml` from `CSandbatch/novelgraph` as the trusted GitHub publisher for each package. Permit `npm publish`. If the npm trust record names an environment, bind it to `npm-release`. Keep two-factor authentication enabled for interactive promotion. Remove any long-lived automation token after OIDC publication succeeds.

NovelGraph does not hide this dependency. Pages and the repository may be public while npm remains at this gate, but installation copy must not claim the new packages are available until registry verification passes.

## Failure states and authority

- A failed prerequisite job prevents every dependent release job from running.
- A `workspace:` string in a tarball is a hard failure, even if the checkout builds.
- A checksum mismatch means the file presented for publication is not the file produced by the pack job.
- A missing package record or incorrect trusted-publisher relationship fails at `npm publish`; the workflow does not fall back to a long-lived npm token.
- A failed dist-tag promotion leaves a verified canary available without creating a GitHub release. Correct the registry state and rerun the promotion workflow.
- A passing package release does not prove Pages deployed. Check the separate Pages workflow and deployment URL.

The Git tag selects the source commit. The uploaded tarballs define the package bytes. npm defines what installers receive. The promotion workflow records that the exact canary versions became `latest` before it creates the public GitHub release.

## Accessible release-pipeline equivalent

[Open the rendered release-pipeline diagram](/novelgraph/diagrams/14-release-pipeline.svg) · [Read the canonical Mermaid source](https://github.com/CSandbatch/novelgraph/blob/main/docs/diagrams/14-release-pipeline.mmd)

The Pages sequence starts on a feature branch. Checks precede the pull request and merge to `main`. The reviewed commit then enters Pages deployment.

The package sequence runs from a `v*` tag through verification, immutable tarball packing, npm canary publication, clean installation, maintainer dist-tag promotion, and the GitHub release.
