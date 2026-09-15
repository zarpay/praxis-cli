---
description: Ship this branch — run the gates, write the changelog entry, bump the version, merge to main, tag, and cut the GitHub release that publishes to npm.
---

Release what is on the current branch. Every step below is a gate: a failure stops the release, it is never noted and passed.

## Arguments

`$ARGUMENTS` takes the version to release (`2.3.0`). Without one, derive it from the commits — a `BREAKING CHANGE` footer or a `!` type means major, a `feat` means minor, otherwise patch — and confirm it before writing anything. `--draft` cuts the GitHub release as a draft so nothing reaches npm until a human publishes it.

## 1. Gates

From `cli/`, all four, before anything is written:

```bash
npm run lint && npm run typecheck && npm test && npm run format:check
```

If `format:check` fails the branch is not ready — fix it in its own commit, do not run `npm run format` as part of the release.

## 2. Changelog

Write the release's section at the top of `cli/CHANGELOG.md`, under the heading `## [X.Y.Z] - YYYY-MM-DD`:

- an opening paragraph naming what the release is *for*, in plain words
- `### Added` / `### Changed` / `### Fixed` / `### Removed` as the work requires
- each entry a bold claim, then why it matters — the reason a reader cares, not the diff
- anything breaking says what disappears and what replaces it

Write it from `git log --oneline main..HEAD`, not from memory. The existing sections are the house style; match their register, and do not narrate the branch's own history.

## 3. Version

Set `version` in `cli/package.json` to the release version — the publish workflow refuses a tag that disagrees with it. Update the **Current release** line in the root `README.md` in the same breath; it is the one place a version is stated by hand, and it silently missed a whole release once. Commit the changelog, the bump and the README together as `chore(release): X.Y.Z`.

## 4. Merge

```bash
git push -u origin <branch>
git checkout main && git pull --ff-only
git merge --no-ff <branch>
git push origin main
```

Pushing `main` also deploys the docs site, so `site/` must already match the code.

## 5. Tag and release

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
gh release create vX.Y.Z --title "Praxis vX.Y.Z" --notes-file <notes>
```

Release notes are the changelog section rewritten for someone who has not been following: the bold claims, no `###` scaffolding.

Publishing the release triggers `.github/workflows/release.yml` — it re-runs lint, typecheck and tests, verifies the tag against `cli/package.json`, and publishes to npm with provenance. Watch it land (`gh run watch`). The release exists whether or not the publish succeeded, so a red run is fixed by a new patch version, never by moving a tag.

## Report

The version and release URL, the publish run's outcome, and one line on what shipped. If anything stopped the release, say what and at which step.
