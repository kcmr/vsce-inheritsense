# DEP-04: Align VS Code types with the supported API baseline

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), DEP-04

## Goal and scope

On `chore/vscode-api-compatibility`, compile against VS Code 1.95.0, the
minimum declared by `engines.vscode`, and prevent type dependency drift from
silently enabling newer APIs. Audit production API usage and document how to
maintain the baseline. Preserve extension behavior and supported versions.
Dependency upgrades, Node/runtime policy, and TypeScript migration are separate
DEP-01/DEP-03/DEP-05 tasks unless a concrete compatibility blocker requires a
documented scope decision.

## Acceptance criteria

- [x] VS Code types are pinned to the declared minimum, with a consistent lockfile.
- [x] A regression check prevents manifest/type baseline drift and verifies the installed version.
- [x] All production code compiles against the minimum API; manifest features are checked against that release.
- [x] Manual 1.95.0 compatibility checks pass; distinguish API/runtime checks from actual host execution.
- [x] Types, tests, lint, and strict source complexity pass; documentation is current.
- [x] One critical self-review and an English commit proposal are recorded.

## Steps

- [x] Confirm REF-04 is merged on clean `main`; create the dedicated branch.
- [x] Inspect the minimum-version policy and current API use; reproduce the drift.
- [x] Pin types and add a focused compatibility guard.
- [x] Verify source/API compatibility and the minimum embedded runtime; prepare manual editor verification.
- [x] Update documentation/backlog, complete one critical review, and propose a commit.

## Verification

- Baseline: `engines.vscode` is `^1.95.0`, type range is `^1.95.0`, lockfile and
  installed `@types/vscode` are `1.146.0`.
- The new guard failed before pinning (`^1.95.0` versus exact `1.95.0`).
- npm confirms `@types/vscode@1.95.0`; its registry integrity matches the new
  lockfile. `pnpm add --save-dev --save-exact @types/vscode@1.95.0 --ignore-scripts`
  changed only this resolved dependency (one package replaced).
- `pnpm exec tsc --noEmit -p .`: passed against installed 1.95.0 types.
- `pnpm test`: 128 passing, no TODOs.
- `pnpm lint`: passed, zero warnings/errors.
- `pnpm exec eslint src test/vscode-compatibility.test.mjs --rule 'complexity: [error, 15]'`: passed.
- Official 1.95.0 declarations and configuration schema confirm the production
  API groups and manifest resource scopes; see [policy evidence](../../vscode-compatibility.md).
- `pnpm install --frozen-lockfile --ignore-scripts --offline`: passed; lockfile
  stayed unchanged and no dependency resolution was needed.
- Documentation checks: 39 local links resolve, manifest JSON parses, and
  `git diff --check` passes.
- Downloaded the official macOS arm64 1.95.0 archive into a temporary directory;
  SHA-256 `f749e23465007df991c16a047c1be8bc2e9b7916434cfe7b3e5fd71194ca968f`
  matched the official update response. Extracted application metadata is 1.95.0.
- `ELECTRON_RUN_AS_NODE=1 <minimum-editor>/Contents/MacOS/Electron --version`:
  `v20.18.0`. In that console-only runtime, `--test` ran parser, resolver,
  regressions, traversal, module-identities, extraction, import-resolver, JSDoc,
  VS Code baseline, and host-report tests: 116 passing, no TODOs. The Node
  integration boundary suite needs the development Node 24+ module hook and was
  excluded; all 128 tests pass on the development runtime.
- `/tmp/dep04-open-minimum.sh` passes `sh -n`; it opens the existing integration
  workspace with the isolated minimum editor and separate profile/extension
  directories. Automatic updates are disabled only in that temporary profile.
  The agent has not executed this UI launcher.
- User confirmed Trace, hover, completion, and navigation work in the isolated
  VS Code 1.95.0. The regular installed editor is 1.147.0; the same duplicate
  definition symptom occurs in both. This confirms baseline operation without
  claiming that all editor behavior is defect-free.
- Separately reproduced duplicate definition ranges with TypeScript 5.6.3 from
  the minimum archive and the real extension callback: native line 1, characters
  2–9 versus extension line 1, character 0 (zero-based), identical target file.
  The pre-existing coexistence issue is tracked as
  [FIX-04](2026-11-22-duplicate-definition-targets.md), not changed here.

## Decisions and blockers

- Prefer exact types at the supported minimum over raising the minimum to match
  whatever version the dependency resolver installs.
- Do not add an automatic test launch configuration to the manual debug menu.

## Critical self-review

One pass inspected Git status, the full diff, and every new file. Checked the
range/pin/installed-type invariant, scoped lockfile change, compilation against
minimum declarations, production API/manifest evidence, regression usefulness,
unrelated dependency churn, generated output, documentation links, and minimum
runtime versus actual editor claims. Restored package ordering after pnpm's
automatic reordering. No unresolved DEP-04 code findings. The user subsequently
confirmed minimum-editor operation and reported a separate definition coexistence
bug; its evidence and outstanding correction are recorded under FIX-04.

Proposed commit: `build(vscode): pin API types to the minimum supported version`.
Scope: exact type dependency and lockfile, compatibility regression, policy,
coverage/overview links, DEP-04 plan/register evidence, and the newly reported
FIX-04 backlog reproduction. Await manual review
and explicit approval before staging or committing.

## Next step

None for DEP-04. Await manual diff review and explicit commit approval. Implement
FIX-04 separately on its dedicated branch after this handoff.

## Final result

Completed DEP-04: exact 1.95.0 type pin and matching lockfile prevent drift beyond
the supported API minimum, reinforced by an installed-version regression and a
maintenance policy. All production code compiles against the baseline; 128
current-runtime tests and 116 embedded-minimum-runtime tests pass. Types, lint,
strict complexity, and reproducible offline installation pass. The user confirmed
operation in the actual minimum editor. Duplicate native/extension definitions
remain a separately reproduced FIX-04 follow-up. No commit, merge, or push made.
