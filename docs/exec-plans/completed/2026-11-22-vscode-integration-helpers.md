# REF-04: Share VS Code integration helpers

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), REF-04

## Goal and scope

Consolidate JavaScript selectors/file checks, cursor symbol extraction, resolution
input, and workspace-relative paths on `refactor/vscode-integration-helpers`.
Fix Quick Pick paths to use each origin's workspace folder; keep external paths
absolute. Declare both resource-read settings with resource scope so folder overrides
actually apply. Retain automated host coverage for maintainers and provide a manual
inspection launch without automatic tests. Preserve provider filters, completion source repair, command selection,
local-member policies, error handling, and Markdown output.

## Acceptance criteria

- [x] Providers and trace command share relevant integration helpers.
- [x] Hover, completion, and Quick Pick share workspace-relative path handling;
  multi-root origins use their containing folder and external paths stay absolute.
- [x] Automated coverage protects context, settings, resolution, and path behavior;
  extension-host coverage is provided for actual VS Code integration.
- [x] Manual real extension-host and visual Quick Pick checks pass; user results are recorded.
- [x] Types, tests, lint, and strict source complexity at most 15 pass.
- [x] One critical self-review and an English commit proposal are recorded.

## Steps

- [x] Inspect existing integration and identify duplication and Quick Pick defect.
- [x] Add focused shared helpers and refactor callers.
- [x] Cover integration contracts and provide extension-host verification.
- [x] Run checks, update documentation/backlog, and perform one critical review.

## Verification

- Reproduced the original Quick Pick with its pre-refactor implementation:
  second-folder and external details were `../second/subject.js:3` and
  `../../outside/root.js:3` relative to the first root. The new Node regression
  requires the containing-root path and unchanged absolute external path.
- Initial `pnpm test`: 124 passing, no TODOs (11 integration tests).
- Manifest regression reproduced missing resource scope before the correction.
- After the host-failure correction, `pnpm test`: 127 passing, no TODOs;
  manifest contract and success/failure report persistence are enforced.
- Follow-up `pnpm lint` and strict complexity checks for source, integration tests,
  report tests, and the runner: passed, zero warnings/errors.
- Shared helpers and all source functions passed strict complexity checks.
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm lint`: passed, zero warnings/errors.
- Explicit complexity audit (limit 15, error severity) of `src test/integration.test.mjs test/support test/extension-host`: passed.
- Explicit complexity audit (limit 15, error severity) of `test/fixtures/scenarios/static` with isolated configuration: passed.
- `node --check test/extension-host/index.cjs` and `node --check test/extension-host/suite.mjs`: passed (syntax only).
- Documentation validation: 34 local links resolve; debug/workspace JSON parses;
  `git diff --check` passed.
- One critical review completed; host-assertion corrections passed syntax and strict lint checks.
- User-run host tests reached `checkDocumentInput` and failed with `false !== true`.
  Read-only inspection of the latest VS Code renderer/extension-host logs confirmed
  the assertion and the warning that the permissive setting had window scope.
  This is a real host failure; Node boundary-double results did not establish the
  manifest's folder-setting contract. A manifest regression and resource scopes
  are now enforced, with persistent reports to make automatic test-window exit clear.
- User confirmed on 2026-11-22 that pressing Esc closes Quick Pick without
  navigating; the current file and cursor position remain unchanged.
- User confirmed on 2026-11-22 that the remaining manual checks passed using
  **Inspect InheritSense integration**: `subject.js:3` for the local origin,
  `root.js:3` for the other workspace folder, and an absolute `external/root.js:2`
  path for the external origin. Selecting a result navigates to the correct file
  and line; hover/completion show the same origins; `dynamic` completion appears
  in permissive `second` and is absent in strict `first`.
- The automated host suite has no passing post-correction run recorded. Manual
  host results above satisfy this task's real-editor verification; the retained
  suite is not reported as passing. Node checks, syntax checks, and manual host
  checks remain separate evidence.
- Closure documentation check: 33 local links resolve, launch JSON parses,
  `git diff --check` passes, and the active plan has moved to `completed/`.

## Decisions and blockers

- Share resolver input rather than merging lookup/catalog control flow. The trace
  command includes current-class members; providers explicitly exclude them.
- Preserve completion's synthetic identifier for temporarily incomplete `this.`.
- Added a dependency-free extension-host suite loadable with
  VS Code's `--extensionTestsPath`, plus reproducible user-run instructions.
- Both settings now declare `scope: "resource"`; their existing defaults stay the
  same. This fixes the real multi-root manifest contract that a boundary double
  alone cannot validate. The dedicated regression guards the declarations.
- The runner writes status, progress, and failures to ignored
  `.test-results/ref04-extension-host.json`; a separate **Inspect InheritSense
  integration** launch has no test entry and remains open for visual checks.
- Removed **Test InheritSense integration** from `launch.json` at the user's
  request: automatic test exit was confusing in an interactive debug workflow.
  Keep the automated suite for maintainers; the user validates behavior through
  the inspection launch and does not need to inspect an automated report.

## Critical self-review

One pass inspected the full tracked diff and every new file for behavior changes,
workspace roots/external paths, setting scope, local-member policy, unsaved-source
repair, errors, testing gaps, complexity, generated output, and documentation.
Strengthened real-host definition assertions to require column zero so native
JavaScript navigation cannot satisfy them by itself. Added a guard before the
unsaved edit to verify it removes only the expected identifier. No unresolved code
findings. User-reported manual host checks now pass; the retained automated host
suite has not been rerun successfully after the manifest correction.

Proposed commit: `refactor(integration): share VS Code helpers and correct workspace paths`.
Scope: shared integration helpers/callers, Node and extension-host tests/fixtures,
debug configuration, manifest resource scopes, report exclusions, and REF-04 documentation. Do not stage or commit before manual
review and explicit approval.

## Next step

None. Await manual diff review and explicit approval before staging or committing.

## Final result

Completed REF-04 on `refactor/vscode-integration-helpers`: JavaScript selectors,
file checks, cursor symbols, document resolution input, and per-origin workspace
paths are shared. Quick Pick handles multiple roots and external files correctly;
both settings support folder overrides. Node coverage has 127 passing tests with
no TODOs; types, lint, and strict complexity pass. The user confirmed manual
real-host paths, navigation, cancellation, hover/completion, and resolution modes.
The automated host suite remains available for maintainers, with its unverified
post-correction execution stated above. No commit, merge, or push performed.
