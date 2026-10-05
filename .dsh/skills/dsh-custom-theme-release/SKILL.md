---
name: dsh-custom-theme-release
description: Cut and publish a release of the dsh-custom-theme DSH plugin — pre-flight the suites, bump the version, write the CHANGELOG entry and a per-release note from the bundled template, publish to npm, tag, and create the GitHub release. Use when asked to release, publish, 发版 or 发布 dsh-custom-theme, or when a finished change in this repository should reach users.
---

# Releasing dsh-custom-theme

The repository is the workspace root and ships as npm `dsh-custom-theme` and GitHub
`Sparrived/dsh-custom-theme`. A release is four artefacts that must agree:

| Artefact | Where |
| --- | --- |
| The version | `package.json` → `version` |
| The changelog entry | `CHANGELOG.md` → `## [X.Y.Z] - YYYY-MM-DD` |
| The release note | `releases/vX.Y.Z.md`, filled from [`release-notes-template.md`](release-notes-template.md) |
| The tag | `vX.Y.Z` on the release commit |

The note is not a copy of the changelog: the changelog is for the repository, the note is
for the person upgrading. Fill the template — it asks for what a user notices, what it was
before, whether anything must be done after upgrading, and which command backs every claim.

## Before anything is published

Run these from the repository root. `node` and `npm` are not always on `PATH`; the full
paths below always work on this machine.

```powershell
& 'C:\Program Files\nodejs\npm.cmd' whoami                      # must name sparrived
& 'C:\Program Files\nodejs\npm.cmd' test                      # 74 tests
& 'C:\Program Files\nodejs\npm.cmd' run test:effects           # 6 steps, no DSH, no token
```

Check the token **first**: `whoami` reads the token in `%USERPROFILE%\.npmrc`, and if it
answers `401 Unauthorized` the token is dead or revoked, so a publish later would fail with
a misleading `E404` *after* the version, tag and note are already in place. A dead token is
the user's to replace — a new one has to be created in their npm account — so ask before
starting the release rather than discovering it at step 6.

If a DSH window with this plugin installed is available, run the live suites too; they need
a token from the user and are the only coverage for the transcript itself:

```powershell
$env:DCT_TOKEN = '<token>'; $env:DCT_BASE = 'http://127.0.0.1:3080'
& 'C:\Program Files\nodejs\npm.cmd' run test:working           # 10 steps
& 'C:\Program Files\nodejs\npm.cmd' run test:browser           # 38 steps
```

A red suite stops the release. So does a suite that was skipped: say in the note that it
was not run, rather than leaving it implied that it passed.

## The release

1. **Version.** Edit `package.json`. Before 1.0, a new feature is a minor bump and a fix
   only is a patch; never reuse a version, because npm refuses to republish one.
2. **Changelog.** Add `## [X.Y.Z] - YYYY-MM-DD` at the top of `CHANGELOG.md` (below the
   preamble), opening with one paragraph that says what the release is for, then `### Added`
   / `### Changed` / `### Fixed` / `### Notes` — only the sections that have content.
3. **Release note.** Copy `release-notes-template.md` to `releases/vX.Y.Z.md` and fill
   every section, deleting every comment. Take the tarball facts from
   `npm pack --dry-run --json`:
   ```powershell
   & 'C:\Program Files\nodejs\npm.cmd' pack --dry-run --json
   ```
   It also proves the tarball is right: `package.json` → `files` ships `src`,
   `lib/client.js`, `themes`, `cordis.patch.yml` and `README.md` (plus the licence npm adds
   itself). Tests, `releases/` and `.dsh/` must not appear in that listing.
4. **Commit and tag.** One commit for the release, in the repository's style — `feat:` for
   a feature, `fix:`, `docs:`, `test:`, `chore:` — then a lightweight tag, as the recent
   releases use:
   ```powershell
   git add -A; git commit -m 'feat: <what a user gets>'
   git tag vX.Y.Z
   ```
5. **Tarball.** `pnpm pack` (or `npm pack`) writes `dsh-custom-theme-X.Y.Z.tgz` beside the
   sources; `*.tgz` is ignored by git. It is attached to the GitHub release, not committed.
6. **Publish.**
   ```powershell
   & 'C:\Program Files\nodejs\npm.cmd' publish --access public
   & 'C:\Program Files\nodejs\npm.cmd' view dsh-custom-theme version
   ```
   The second command must print the version that was just published. It can lag: the
   registry index took three minutes to show 0.3.0 after npm printed `+ name@version`, so
   poll `https://registry.npmjs.org/<name>` (with a cache-busting query) rather than
   concluding the publish failed.
   The publish also prints the real package size, unpacked size and shasum. **Compare them
   with the note**: they drift whenever a document changed after the dry-run, in which case
   fix `releases/vX.Y.Z.md`, commit it, and refresh the release body with
   `gh release edit vX.Y.Z --notes-file releases/vX.Y.Z.md`.
7. **Push and release.**
   ```powershell
   git push origin HEAD --tags
   gh release create vX.Y.Z --title "vX.Y.Z — <headline>" `
     --notes-file releases/vX.Y.Z.md dsh-custom-theme-X.Y.Z.tgz
   ```
8. **Check the note against what shipped.** Open the release page and read it as a user
   would: every claim is either visible in the app or backed by a command in its
   Verification section.

## Rules

- Publish only from a clean tree whose suites are green. The version, the tag, the
  changelog and the note all name the same version; if one of them is off, fix it before
  step 6 rather than after.
- The note is written from the template every time. A release without one is incomplete,
  which is the point of the template: it asks the questions that get skipped.
- Never `npm unpublish` a version that works. To fix a broken *note* or `README`, publish
  the next patch; to warn about a broken *build*, use
  `npm deprecate dsh-custom-theme@X.Y.Z "<why>"`.
- `.dsh/skills/` and `releases/` are tooling and records: they belong in git, not in the
  npm tarball.

## When publishing is refused

- `whoami` answers `401 Unauthorized`, and a publish then fails with `E404 ... 404 Not
  Found - PUT https://registry.npmjs.org/<name>` — the token itself is rejected. The
  registry answers 404 rather than 403 for an unauthenticated write, so this is *not* a
  missing-package or wrong-name problem: read `%USERPROFILE%\.npmrc`, and ask the user for
  a token for the owning account (`npm view dsh-custom-theme maintainers` names it). Reading
  the registry works without a token, so a 401 is easy to miss.
- `E403 ... granular access token with bypass 2fa enabled is required` — the token is valid
  but the account needs 2FA on every publish, and a passkey (Windows Hello) has no code to
  type. Create a **Granular Access Token** with **Bypass two-factor authentication (2FA)**
  ticked and `Read and write` on packages, and put it in `%USERPROFILE%\.npmrc` as
  `//registry.npmjs.org/:_authToken=...`. Weakening the account's 2FA mode does not help.
- `EPUBLISHCONFLICT` / `cannot publish over the previously published versions` — the
  version is already on the registry. Bump it, do not retry.
- `gh release create` fails with an existing tag — the tag was pushed in an earlier
  attempt. Reuse it with `gh release create vX.Y.Z --verify-tag ...`.
