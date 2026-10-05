# dsh-custom-theme vX.Y.Z — YYYY-MM-DD

<!--
Release notes for one version. Copy this file to `releases/vX.Y.Z.md`, fill every
section, delete every comment, and use it as the GitHub release body:

    gh release create vX.Y.Z --title "vX.Y.Z — <headline>" \
      --notes-file releases/vX.Y.Z.md dsh-custom-theme-X.Y.Z.tgz

Two rules decide what belongs here:

- Write for the person upgrading, not for the person who wrote it. If it cannot be seen
  in the app, read in the README, or acted on after an upgrade, it does not belong here.
- Every claim points at a command in Verification. Anything not covered by one is marked
  as verified by hand, or dropped.
-->

<!-- One paragraph: what this release is for, and what a user will notice. Two or three
     sentences at most; no file names, no test names, no internal reasoning. -->

**本次更新**：<!-- 一句话中文概述，供中文用户阅读。 -->

## Added

<!-- New surfaces: controls, tokens, effects, routes. One line each, user-visible first. -->

## Changed

<!-- Behaviour that moved. Say what it was before and what it is now, so an upgrade is
     not a surprise. Omit the section when nothing moved. -->

## Fixed

<!-- What was broken, for whom, and what it looks like now. Omit when there is nothing. -->

## Upgrade notes

<!-- Anything to do (or not to do) after upgrading: settings worth revisiting, features
     that changed meaning, a minimum DSH version. "Nothing: upgrade and restart" is a
     complete answer, and the usual one. -->

## Verification

<!-- The commands that were run, and their result. Keep the honest split: the suites that
     need a live DSH window are named as such rather than implied to have passed. -->

- `npm test` — <!-- n --> tests, passing.
- `npm run test:effects` — <!-- n/n --> steps, passing; needs no DSH and no token.
- `npm run test:working` / `npm run test:browser` — <!-- run, or say they need a live
  window and a DCT_TOKEN and were not run here -->
- By hand: <!-- what was looked at in the app, and what it looked like -->

## Published

- npm: [`dsh-custom-theme@X.Y.Z`](https://www.npmjs.com/package/dsh-custom-theme/v/X.Y.Z)
- git: tag `vX.Y.Z` on the release commit
- release: https://github.com/Sparrived/dsh-custom-theme/releases/tag/vX.Y.Z
- tarball: `dsh-custom-theme-X.Y.Z.tgz`, <!-- files --> files, <!-- packed size --> packed
  (<!-- unpacked size --> unpacked) — from `npm pack --dry-run --json`

## 中文摘要

<!-- 2–5 条要点，与上面 Added / Changed / Fixed 一一对应，写给中文用户。 -->
