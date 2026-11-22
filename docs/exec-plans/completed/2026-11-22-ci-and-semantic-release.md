# CI and semantic release

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22

## Goal and scope

Configure two independent GitHub Actions workflows: lint/tests and release.
Use semantic-release with semantic-release-vsce for release versions and VSIX
publication. Preserve extension behavior and supported editor/runtime baselines.
Implementation starts on `ci/semantic-release`, created before this plan.
The release stage continues on `ci/release-workflow` after the approved CI merge.

## Acceptance criteria

- [x] Lint/test workflow runs for pull requests to main and pushes to main,
  with one stable check name, frozen pnpm installation, lint (including the
  configured source complexity ceiling), types, and the Node test suite.
- [x] The lint/test workflow passes on GitHub for the implementation branch
  before its changes are merged to main. Local checks and hosted runs are
  recorded separately.
- [x] Release workflow is separate, uses full Git history and semantic-release,
  and is first tested without publishing, pushing release commits, or creating
  remote tags/releases. A real publication is a later explicitly enabled action.
- [x] Release configuration analyzes Conventional Commits, generates release
  notes/changelog, packages the VSIX with semantic-release-vsce, and supports
  release assets without publishing to npm.
- [x] Package version resets to `0.0.0`; remove the manual patch increment.
  semantic-release selects the initial `1.0.0` from release history and owns
  subsequent versions. Build/package hooks do not increment versions themselves.
- [x] The release prepare order ensures that generated changelog and package
  version are included in the intended release commit and VSIX.
- [x] Configure the required main check and the owner-selected administrative
  exception. Record its actor-based scope accurately; it also applies to manual
  actions by administrators, not just automated commits.
- [x] Existing types, lint, tests, package/runtime compatibility, and changed
  workflow/configuration checks pass. All required staged validation is complete;
  the separately authorized first real publication is also verified below.

## Steps

- [x] Create the dedicated branch before writing this plan.
- [x] Inspect current scripts, pnpm version, compatibility policy, and workflow
  requirements. Preserve the existing dependency/runtime decisions.
- [x] Implement and locally verify only the lint/test workflow first.
- [x] Review that change once and obtain approval for its commit and branch
  publication so a pull request can exercise the hosted workflow.
- [x] Record the hosted lint/test result before merging the CI change.
- [x] Configure semantic-release dependencies, plugin order, package/build hooks,
  and the independent release workflow after the first CI stage is verified.
- [x] Validate the release calculation and packaging locally without publication.
- [x] Verify the independent release workflow on GitHub in simulation mode.
- [x] Record remaining operational follow-ups, complete verification, and perform
  the scoped review/commit handoff.

## CI-stage local verification

- No active plans existed at task start; the working tree was clean on main.
- Starting version was `0.0.16` with a manual patch increment. Release-stage
  changes set `0.0.0` and remove that increment.
- Installed pnpm is 12.21.0. CI will use this version and the supported Node 24
  development baseline; it does not change the local development runtime.
- Hosted release simulation, local release preparation, packaging, main
  protection, and the two CI stages are verified below.
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

## Hosted CI verification

- CI commit: `1dae6479a24c3948e8c1cb53453fa12919bb24f6`.
- The owner approved branch publication and opening the pull request.
- [Pull request #1](https://github.com/kcmr/vsce-inheritsense/pull/1) targets main
  from `ci/semantic-release`; merged with owner approval as `3f69f31`.
- [Run 45061623092](https://github.com/kcmr/vsce-inheritsense/actions/runs/45061623092)
  completed successfully for the `pull_request` event on the exact commit above.
  Job `Lint and test` passed in 19 seconds; dependency installation, type check,
  lint, and tests all passed on the hosted Ubuntu/Node 24 configuration.
- This validates the CI workflow before merge. No release workflow was added or
  executed; hosted release validation remains a separate stage.
- [Main run 45061818148](https://github.com/kcmr/vsce-inheritsense/actions/runs/45061818148)
  passed after the merge on `3f69f31967a9a2c5357d87697b10ed89a467cd7c`.

## Decisions and blockers

- Test the lint/test workflow before merging it, then validate release separately.
- Keep the existing ESLint/TypeScript tooling and Node test runner. No provider,
  parser, or resolver feature changes belong in this workstream.
- The stable required check will be `Lint and test`; do not rename it casually
  after branch rules depend on it. Do not skip ordinary automation pull requests.
- Main protection requires the GitHub Actions `Lint and test` check and an
  up-to-date branch, with pull requests required and no manual approval count.
  The owner selected an administrative exception for automation. GitHub applies
  it to administrators as actors, including their manual actions; commit messages
  and bot authorship do not grant bypass.
- Initial validation must not publish. The owner later explicitly authorized
  the first real publication after both hosted workflows passed.
- Operational account setup instructions remain outside repository documentation.
- Use semantic-release 24.2.9 and compatible plugin majors to preserve the
  declared Node >=24 tooling floor. Current semantic-release 26 requires
  Node >=26.13; 25 requires >=24.10 on the Node 24 line. Release automation does
  not justify raising the development minimum in this workstream.
- Packaging reproduced a concrete npm/pnpm dependency traversal failure:
  vsce's default npm list treats pnpm's installed graph as invalid. Add esbuild
  for an extension-entry bundle targeting the minimum host's Node 20, with only
  vscode and Node built-ins external. Keep TypeScript compilation for tests and
  development. Disable vsce dependency discovery only for this bundled package;
  verify packaged activation and inherited resolution without node_modules.

## Release-stage verification

- Dependencies: semantic-release 24.2.9, semantic-release-vsce 6.1.8,
  commit-analyzer 13.0.1, release-notes-generator 14.1.1, changelog 6.0.3,
  git 10.0.1, GitHub 11.0.6, and esbuild 0.28.2. Existing direct dependency
  versions and Node/editor requirements are unchanged. An installed-engine
  audit found no package engine incompatible with Node 24.0.0.
- Structured lockfile comparison: all 243 pre-existing package records and all
  243 pre-existing snapshots are unchanged; 449 records are added in each section
  for the new release/build tooling and optional platform packages.
- `pnpm install --frozen-lockfile --strict-peer-dependencies`: passed. Explicit
  build policy permits esbuild and declines keytar, which is unnecessary for
  environment-based publishing. A temporary preparation run exposed ignored
  build scripts before that policy was corrected; the final rerun passes.
- `pnpm check:types`, `pnpm lint`, and `pnpm test`: passed; 139 tests, no TODOs.
- `pnpm build` and `pnpm package`: passed. Local package version remains 0.0.0.
  Bundled output is minified, targets Node 20, and keeps vscode external. Source
  compilation remains available for tests and development.
- Temporary `/private/tmp/inheritsense-release-verify.mjs` uses a disposable
  clone and a local bare Git destination with no credentials. Semantic-release
  dry-run selects initial 1.0.0 from history. Separately invoked prepare hooks
  generate changelog, package 1.0.0, then commit the changelog and package
  version in the temporary repository. No tags or releases were created on GitHub.
  The GitHub publishing plugin was omitted from this isolated check; it still
  needs hosted simulation with the normal workflow token.
- The candidate VSIX contains 11 entries, including bundled extension, package
  metadata at 1.0.0, generated changelog, license, README, and all images.
  Internal docs, source, tests, release configuration, and node_modules are absent.
  README image links are rewritten to HTTPS GitHub URLs.
- An extracted candidate with no node_modules loads and activates through the
  existing VS Code boundary double. Its bundled hover, definition, completion,
  and Trace callbacks resolve the shared integration fixture. This is a package
  smoke check, not a real editor UI check.
- Default, false, and explicitly enabled release configuration gates were checked.
  Default configuration is dry-run and disables Marketplace publishing. The
  workflow has an additional enablement gate and validates packaging during
  simulation. Publication was not enabled during initial verification.
- Main protection API confirms required `Lint and test`, GitHub Actions app 15368,
  strict branch freshness, required pull requests, disabled force-push/deletion,
  and the owner-selected administrative bypass. Personal repositories do not
  accept an individual-user restriction list; the configured role exception is
  stated explicitly rather than claimed to distinguish automated/manual use.
- Both workflow files pass actionlint 1.7.12. Hosted release simulation is
  verified below; real-editor bundle verification remains unperformed.
- At the end of non-publishing verification, GitHub had no release enablement
  variable set and reported zero tags and releases. No Marketplace credentials
  were used during those checks.

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

None for implementation or initial publication. Await approval of the
documentation-only closure commit. Automatic release is now enabled following
the owner's explicit publication authorization.

## Release pull-request CI

- The owner approved the release-stage commit, branch publication, and opening
  the pull request on 2026-11-22. Commit `27d765ef276b8031d8ae8eb37b3c064843b30f78`
  is published on `ci/release-workflow`.
- [Pull request #2](https://github.com/kcmr/vsce-inheritsense/pull/2) merged to
  main with owner approval as `63a7d4bf146b0a798bfff47ee5075605b3e003c9`.
- [Run 45064204095](https://github.com/kcmr/vsce-inheritsense/actions/runs/45064204095)
  passed for that exact head commit. This verifies the new dependency graph,
  types, lint, and tests in the hosted Ubuntu/Node 24 CI environment.
- The owner subsequently approved merge and hosted simulation. At that point,
  real publication was still disabled and not yet authorized.

## Bundle inspection and minification follow-up

- The owner requested verification of node_modules paths and a smaller bundle.
  esbuild metafiles confirm 110 bundled inputs and only four distinct external
  imports: vscode, node:fs, node:path, and node:module. The readable bundle's
  node_modules paths label embedded module wrappers; they are not external loads.
- Added esbuild minification to the build script. Bundle size falls from
  1,186,896 to 612,332 bytes (48.4%). The corresponding local VSIX falls from
  4,887,891 to 4,847,441 bytes; compression and the existing GIF account for the
  smaller archive-level reduction. No image assets were changed.
- `pnpm package` passes and preserves version 0.0.0. The extracted minified
  VSIX has no node_modules directory and passes the activation, hover, definition,
  completion, and Trace smoke checks against the existing VS Code boundary double.
  Its bundle matches the inspected minified output and has no node_modules path
  strings. Whitespace checks pass. Reused the recorded release-stage review for
  this requested follow-up and its verification; no new autonomous review pass.

## Release-stage critical self-review

One pass inspected the complete release-stage diff, new configuration/workflow,
and structured lockfile changes. Checked the successful-CI main-only trigger,
tested-commit checkout, full Git history, default simulation and explicit
enablement gates, credentials limited to the publishing step, absence of npm
publishing, plugin prepare order, administrative bypass scope, Node baseline,
bundled runtime dependencies, and package contents. Corrected stale packaging
side-effect guidance in the quality register. No unresolved local code findings.
The hosted workflow was subsequently verified as recorded below. Real-editor
verification remains unperformed; no second autonomous review was needed for
the documentation-only closure.

Proposed release-stage commit: `ci: configure guarded semantic releases`.
Scope: release workflow/configuration, release/build dependencies and lockfile,
bundle/package hooks and exclusions, pnpm build policy, current packaging
guidance, and this active plan. The owner approved creating this commit,
publishing the branch, and opening its pull request on 2026-11-22. Merge and
actual publication are not part of that approval.

## Final result

Completed CI and guarded semantic-release configuration on 2026-11-22. Both
pull requests passed CI before their approved merges, and the main CI and
independent release simulation passed afterward. The manifest was reset to
0.0.0 before semantic-release calculated and published 1.0.0; main now contains
version 1.0.0. Manual patch increments are removed.
The minified, self-contained package and prepare-hook ordering are verified.
Main protection requires the configured check with the stated administrative
exception. The first real publication was subsequently authorized and verified below.
Real-editor bundle inspection remains unperformed; hosted publication is verified.


## Hosted release verification and closure

- [Main CI run 45064477032](https://github.com/kcmr/vsce-inheritsense/actions/runs/45064477032)
  passed after merge on `63a7d4bf146b0a798bfff47ee5075605b3e003c9`.
- [Release run 45064516343](https://github.com/kcmr/vsce-inheritsense/actions/runs/45064516343)
  ran automatically from that successful main CI and completed successfully.
  Dependency installation, semantic-release simulation, and VSIX packaging
  passed; the real publication step was skipped.
- The hosted log confirms dry-run mode, initial version 1.0.0, skipped prepare,
  tag, and publishing hooks, and a minified package of approximately 4.62 MB.
  The packaging smoke step builds the unchanged development version; isolated
  local prepare-hook verification separately covers the 1.0.0 release package.
- GitHub reports zero tags and zero releases after this hosted check. No
  Marketplace publishing credentials were supplied or used.
- Moved this fully verified plan to completed and repaired the plan-index link.
  Reused the recorded critical reviews. Closure checks cover links, whitespace,
  acceptance criteria, and accurate remaining verification limits.

Proposed closure commit: `docs: finalize release verification and VSIX installation`.
Scope: this completed plan, the plan-index link, and the README's release-based
VSIX installation instructions. Await explicit approval before committing or
publishing the documentation closure branch.


## First authorized publication

- After hosted simulation passed, the owner explicitly authorized the first
  production release on 2026-11-22. Publication enablement was then activated.
- [Run 45066746055](https://github.com/kcmr/vsce-inheritsense/actions/runs/45066746055)
  completed successfully through manual dispatch. Type checking, lint, tests,
  authentication, packaging, and the real publishing step passed; simulation
  steps were skipped for this explicitly authorized run.
- [GitHub release v1.0.0](https://github.com/kcmr/vsce-inheritsense/releases/tag/v1.0.0)
  is published, neither draft nor prerelease, with `inheritsense-1.0.0.vsix`
  attached (4,847,989 bytes).
- Marketplace metadata confirms publisher `kuscamara`, extension `inheritsense`,
  and version 1.0.0 at the
  [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=kuscamara.inheritsense).
- Main advanced to `4fae45350df69451b61a468d86afcc76b7c0330b` with the generated
  `chore(release): 1.0.0 [skip ci]` commit. Its manifest is 1.0.0, confirming
  that the chosen administrative automation path works with branch protection.
- Operational credential instructions remain outside repository documentation.
  Publication configuration and evidence are complete; the final documentation
  closure still awaits its own commit approval.

## Final branch and documentation review

- Owner-requested review found no branch-only commits and one missing main
  commit: the generated 1.0.0 release commit. Fast-forwarded
  `docs/complete-ci-release-plan` to origin/main while preserving pending plan
  closure and index changes. The branch now includes CHANGELOG and version 1.0.0.
- Replaced the README's local-build requirement for VSIX installation with a
  link to the latest GitHub release, whose 1.0.0 VSIX asset was verified.
  The link follows future releases without hardcoding an asset version.
- Corrected stale present-tense statements about disabled publication and the
  manifest version; retained the chronology of simulation and actual publication.
- Reused the prior implementation reviews and performed this additional review
  at the owner's explicit request. Local links, content, and whitespace pass;
  no source/configuration changes or build/test reruns are required.
