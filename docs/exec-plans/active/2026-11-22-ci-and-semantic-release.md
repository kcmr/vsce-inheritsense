# CI and semantic release

Status: Active
Created: 2026-11-22
Completed: —

## Goal and scope

Configure two independent GitHub Actions workflows: lint/tests and release.
Use semantic-release with semantic-release-vsce for release versions and VSIX
publication. Preserve extension behavior and supported editor/runtime baselines.
Implementation starts on `ci/semantic-release`, created before this plan.

## Acceptance criteria

- [ ] Lint/test workflow runs for pull requests to main and pushes to main,
  with one stable check name, frozen pnpm installation, lint (including the
  configured source complexity ceiling), types, and the Node test suite.
- [ ] The lint/test workflow passes on GitHub for the implementation branch
  before its changes are merged to main. Local checks and hosted runs are
  recorded separately.
- [ ] Release workflow is separate, uses full Git history and semantic-release,
  and is first tested without publishing, pushing release commits, or creating
  remote tags/releases. A real publication is a later explicitly enabled action.
- [ ] Release configuration analyzes Conventional Commits, generates release
  notes/changelog, packages the VSIX with semantic-release-vsce, and supports
  release assets without publishing to npm.
- [ ] Package version resets to `0.0.0`; remove the manual patch increment.
  semantic-release selects the initial `1.0.0` from release history and owns
  subsequent versions. Build/package hooks do not increment versions themselves.
- [ ] The release prepare order ensures that generated changelog and package
  version are included in the intended release commit and VSIX.
- [ ] Define the required main check and narrowly scoped automation exception.
  Applying main protection is a separately scheduled follow-up at the owner's
  chosen rollout; do not claim enforcement before it is actually configured.
- [ ] Existing types, lint, tests, package/runtime compatibility, and changed
  workflow/configuration checks pass. Keep this plan active until all required
  staged validation is finished.

## Steps

- [x] Create the dedicated branch before writing this plan.
- [x] Inspect current scripts, pnpm version, compatibility policy, and workflow
  requirements. Preserve the existing dependency/runtime decisions.
- [x] Implement and locally verify only the lint/test workflow first.
- [ ] Review that change once and obtain approval for its commit and branch
  publication so a pull request can exercise the hosted workflow.
- [ ] Record the hosted lint/test result before merging the CI change.
- [ ] Configure semantic-release dependencies, plugin order, package/build hooks,
  and the independent release workflow after the first CI stage is verified.
- [ ] Validate the release calculation and packaging without publication.
- [ ] Record remaining operational follow-ups, complete verification, and perform
  the scoped review/commit handoff.

## Verification

- No active plans existed at task start; the working tree was clean on main.
- Current package version is `0.0.16`; `prepackage` runs a manual patch increment.
- Installed pnpm is 12.21.0. CI will use this version and the supported Node 24
  development baseline; it does not change the local development runtime.
- Hosted workflow results, release calculation, packaging, and main enforcement
  are not yet verified.
- `pnpm install --frozen-lockfile --strict-peer-dependencies --offline`: passed;
  package metadata and lockfile are unchanged.
- `pnpm check:types`: passed with the new script, without generated output.
- `pnpm lint`: passed with no warnings/errors.
- `pnpm test`: 139 passing, no TODOs/skips/failures on local Node 26.13.1.
  An initial sandbox run could not write ignored dist output; the permitted
  rerun compiled and passed. This does not establish a hosted Linux/Node 24 pass.
- Official actionlint 1.7.12 archive checksum verified; validation of
  `.github/workflows/lint-test.yml` passes. The dedicated complexity step was
  removed after the project rule became an error by default.
- `git diff --check`: passed. No release workflow or publishing path exists
  in this first stage; version and dependencies are unchanged. The new
  `check:types` script is used by CI, and lint enforces complexity directly.

## Decisions and blockers

- Test the lint/test workflow before merging it, then validate release separately.
- Keep the existing ESLint/TypeScript tooling and Node test runner. No provider,
  parser, or resolver feature changes belong in this workstream.
- The stable required check will be `Lint and test`; do not rename it casually
  after branch rules depend on it. Do not skip ordinary automation pull requests.
- Automation bypass must be tied to a designated actor, not commit messages or
  a broad exemption for all bots. Final enforcement is a scheduled follow-up.
- Validate release behavior without enabling actual publication during this task.
- Operational account setup instructions remain outside repository documentation.

## CI-stage critical self-review

One pass inspected the complete tracked diff and new workflow/plan. Checked
pull-request and main triggers, stable job name, read-only permissions,
unpersisted checkout credentials, pnpm-before-cache ordering, frozen dependency
installation, supported Node baseline, concurrency, timeout, and the distinction
between passing local checks and outstanding hosted validation. Confirmed no
release/versioning changes, unrelated files, or claimed protection enforcement.
No unresolved findings in the original CI-only change. Reuse this review for its handoff;
release implementation requires its own scoped review when ready.

Proposed CI-stage commit: `ci: enforce project checks in lint and test workflow`.
Scope: the lint/test workflow, the configured complexity rule and type-check
script, agent/test guidance, historical audit descriptions, this active plan,
and the plan index.

## Manual-review follow-up

The owner promoted complexity to error severity at 15 in the source ESLint
configuration, removed the duplicate CI step, and added `check:types`. Use
`pnpm lint` and `pnpm check:types` as the verification entry points. Updated
guidance and replaced historical command overrides with descriptions of the
original audits, preserving their results and scopes. Fixture data remains
excluded from normal lint and is not claimed to inherit the source-only rule.
Correction checks pass: `pnpm check:types`, `pnpm lint`, all 139 tests,
actionlint, and whitespace validation. An in-memory ESLint check using the
project configuration accepts complexity 15 and rejects 16 at error severity;
no rule overrides or permanent test files were used. No complexity command-line
overrides remain in repository guidance or audit records. Local links in changed
documents resolve. Reused the recorded critical review for these requested
corrections; no additional autonomous review. Final owner edits to agent
guidance are preserved; the workflow and documentation checks still pass.

## Next step

The owner approved the CI-stage commit on 2026-11-22. After committing, publish
the branch and open a pull request once authorized, then record the hosted
workflow result before any merge.

## Final result

Pending staged implementation and hosted verification.
