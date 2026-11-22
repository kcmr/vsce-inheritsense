# DEP-01: Align declared ranges with existing lockfile versions

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), DEP-01

## Goal and scope

Perform a brief installed-package compatibility review on `chore/dependency-review`.
Raise outdated manifest range minima only to versions already installed and
resolved in the lockfile, retaining their caret ranges. Preserve Node and all
resolved packages. Keep the existing VS Code minimum-API type policy unchanged.
No registry-latest upgrade, major migration, new version pins, added checks, or
broader dependency audit is requested.

## Acceptance criteria

- [x] Inspect relevant installed versions, peers, and engine requirements.
- [x] Change only range minima already covered by the lockfile; resolved graph stays identical.
- [x] Types, tests, lint, strict source complexity, and frozen installation pass.
- [x] Record scope limits, update DEP-01, review once, and propose a commit.

## Steps

- [x] Confirm clean main, read workflow/backlog, and create branch and plan.
- [x] Review installed package metadata and align stale range minima.
- [x] Verify the scoped diff and existing checks; close the plan after one review.

## Verification

- Updated only these caret minima, matching already installed/locked versions:
  Babel parser/types `^7.27.7` → `^7.29.14`; TypeScript `^6.0.0` → `^6.0.3`;
  typescript-eslint `^8.18.0` → `^8.73.0`.
- Other direct declarations already match installed versions: ESLint/@eslint/js
  9.39.5, vsce 4.1.1, Node types 26.6.6, VS Code types 1.95.0. No new pins;
  the existing VS Code type pin from DEP-04 remains unchanged.
- Installed metadata: Babel parser requires types `^7.29.14` (satisfied).
  typescript-eslint/parser/plugin 8.73.0 accept ESLint `^8.57.0 || ^9.0.0 ||
  ^10.0.0` and TypeScript `>=4.8.4 <6.1.0`; installed 9.39.5/6.0.3 satisfy these.
  The plugin's parser requirement `^8.73.0` is also satisfied. ESLint's `jiti`
  peer is optional; no missing mandatory direct peer was found.
- Installed direct engine requirements fit Node 26.13.1 and the declared >=24
  development floor. Production Babel parser/types require >=6.0.0/>=6.9.0;
  ESLint/typescript-eslint support >=21.1.0; vsce requires >=22; TypeScript >=14.17.
- Initial offline lock-only install stopped for missing pnpm policy metadata.
  One online retry, `pnpm install --lockfile-only --ignore-scripts
  --strict-peer-dependencies`, passed. No package upgrades were resolved.
- Exact before/after lockfile comparison permits only the four importer
  `specifier` replacements; resolved package and snapshot sections are byte-identical.
- `pnpm install --frozen-lockfile --ignore-scripts --strict-peer-dependencies --offline`:
  passed, already up to date.
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm test`: 139 passing, no TODOs/skips/failures.
- `pnpm lint`: passed, zero warnings/errors.
- Explicit complexity audit (limit 15, error severity) of `src`: passed.
- Node remains 26.13.1. No production/test source, package version, engine, or
  verification infrastructure changes. No packaging or UI checks performed.
- Closure checks: 20 local links resolve, `git diff --check` passes, and exactly
  the four scoped files changed.

## Decisions and blockers

- User prioritizes a quick, non-critical review and explicitly rejects new pins.
- Use installed metadata and prefer an offline update. One online policy-metadata
  retry was needed; registry-latest research and the separate TypeScript-major
  decision (DEP-03) remain outside this scope.

## Critical self-review

One pass inspected Git status, the full manifest/lock/register diff, and this new
plan. Confirmed four caret-only minimum updates, byte-identical resolved graph,
compatible installed peers/engines, no new pins, unchanged Node/VS Code baseline,
no source/generated artifacts or extra checks, and accurate scope/evidence.
Clarified the single online metadata retry after the offline attempt. No unresolved
findings within the requested brief review.

Proposed commit: `build(deps): align ranges with locked versions`.
Scope: `package.json`, importer specifiers in `pnpm-lock.yaml`, this plan, and the
quality register. Await manual diff review and explicit approval before staging
or committing.

## Next step

None. Await manual review and explicit commit approval.

## Final result

Completed DEP-01 with the user's limited scope: four caret minima now reflect
versions already installed and locked; peers/direct engines were checked without
package upgrades, new pins, or Node changes. The resolved lock graph is identical.
All 139 tests, types, lint, strict source complexity, and frozen strict-peer
installation pass. Registry-latest research and the TypeScript-major migration
are outside this result. No commit, merge, or push performed.
