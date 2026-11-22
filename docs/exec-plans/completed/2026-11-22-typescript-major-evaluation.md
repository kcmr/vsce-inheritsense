# DEP-03: Evaluate the TypeScript major upgrade

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), DEP-03

## Goal and scope

Review TypeScript configuration and tooling compatibility on
`chore/typescript-major-evaluation`; select and verify a supported compiler.
Reconcile overall acceptance with completed plans, distinguish provider cancellation
from Quick Pick dismissal, and clarify DIAG-01 without implementing it.
Exclude FIXTURE-03 from the agreed release scope; retain its documented fixture
simplification without implementing deduplication or renaming the helper.

## Acceptance criteria

- [x] Record current official version/support evidence and configuration findings.
- [x] Document the compiler decision and verify the selected version.
- [x] Reconcile acceptance, PERF-01, DIAG-01, and excluded FIXTURE-03 with evidence.
- [x] Check documentation, perform one critical self-review, and propose a commit.

## Steps

- [x] Inspect clean main, workflow, register, relevant completed plans, and source.
- [x] Establish the dedicated branch and focused plan before updating the register.
- [x] Verify the selected toolchain and update the register.
- [x] Complete documentation checks and one review, then close this plan.

## Verification

Selected-version checks on 2026-11-22:

- `pnpm exec tsc --version`: 6.0.3.
- `pnpm exec tsc --noEmit -p .`: passed without deprecation diagnostics.
- `pnpm test`: 139 passing, zero failures/skips/TODOs.
- `pnpm lint`: passed, zero warnings/errors.
- `pnpm exec eslint src --rule 'complexity: [error, 15]'`: passed.
- `pnpm install --frozen-lockfile --ignore-scripts --strict-peer-dependencies
  --offline`: failed with `ERR_PNPM_NO_OFFLINE_TARBALL` for
  `@azure/logger@1.4.0` in the sandbox-local store. This is a cache limitation,
  not a reproduced compiler/peer incompatibility. No online reinstall needed
  for this evaluation of the unchanged installed toolchain.
- `pnpm install --lockfile-only --frozen-lockfile --ignore-scripts
  --strict-peer-dependencies --offline`: passed. This validates the frozen
  lockfile path; it is not a successful full clean installation.
- No TypeScript 7 installation, compilation, lint, or runtime test was attempted;
  it is rejected as a direct replacement by supported-peer evidence. The
  selected and tested version is 6.0.3. No packaging or UI checks performed.
- Documentation checks: all 28 local links in the three changed documents
  resolve, `git diff --check` passes, and no active plans remain.

Configuration and tooling evidence:

- Official [registry latest metadata](https://registry.npmjs.org/typescript/latest)
  returned 7.0.2 (Node >=16.20.0). Its root export points to `lib/version.cjs`
  and API exports are under `unstable/*`; do not assume classic API parity.
- Installed typescript-eslint 8.73.0 declares TypeScript `>=4.8.4 <6.1.0`;
  the [official support page](https://typescript-eslint.io/users/dependency-versions/)
  confirms the same range. TypeScript 6.0.3 satisfies it; 7.0.2 does not.
- `eslint.config.mjs` uses typescript-eslint's recommended configuration even
  without type-aware linting. A supported parser dependency is still required.
- `test/support/native-definitions.mjs` imports `typescript` and uses
  `createLanguageService`, `ScriptTarget`, `ModuleKind`, `ScriptSnapshot`, and
  `sys` for FIX-04 regression coverage. Any replacement must preserve or adapt
  that contract, not merely succeed at CLI compilation.
- `tsconfig.json` explicitly sets Node16 module/resolution, ES2022 target/lib,
  rootDir, node/vscode types, strict mode, and CommonJS-compatible output through
  the package's absent `type: module`. It has no baseUrl, paths, node10/classic
  resolution, ES5 target, or ignoreDeprecations setting. Compared against the
  [official 6.0 migration notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html),
  no migration edit is needed for the retained compiler. This is not a claim
  that a 7.x build was run. Existing compile/watch/test scripts use the tsc CLI;
  production parsing uses Babel and does not import TypeScript.

Completed-plan reconciliation:

- DEP-01/02 establish dependency ownership, ranges, peers, and graph consistency;
  DEP-04/05 establish supported VS Code API/runtime evidence and its maintenance
  boundary. Together with this decision they satisfy dependency acceptance.
- TEST-01/02, FIX-01 through FIX-04, and REF-01 through REF-04 record regression,
  extraction/traversal, fixture, integration, and complexity evidence. The fresh
  139-test/types/lint run supports checks acceptance. REF-04's unrun corrected
  automated host suite and FIX-04's deferred minimum UI rerun remain explicit.
- Completed register tasks have dated verification and branch/plan references;
  change references do not require claiming an unapproved commit exists.
- REF-04 and `test/integration.test.mjs` cover Quick Pick selection/dismissal,
  including user-confirmed Esc behavior. All three provider callbacks omit the
  token parameter; resolver input and native-query guard do not implement
  cancellation. PERF-01 remains open.
- Fixture helper acceptance is explicitly excluded for dedupingMixin, following
  the scope decision; it is not checked off as implemented.

## Decisions and blockers

- Installed TypeScript 6.0.3 satisfies typescript-eslint 8.73.0's declared
  `>=4.8.4 <6.1.0` peer range; TypeScript 7.0.2 does not.
- Retain `^6.0.3` and locked 6.0.3. Revisit when lint support and API-dependent
  regression tooling support the replacement. A dual-compiler setup adds
  dependency/script complexity without an established build bottleneck here.
- Provider behavior, dependencies, configuration, and fixtures remain unchanged.
- DIAG-01 is clarified, not implemented: preserve quiet no-match/incomplete-code
  handling and safe fallbacks while making unexpected failures inspectable.
- FIXTURE-03 is cancelled/excluded, not marked completed. The overview and
  register now agree that dedupingMixin remains an intentional simplification.

## Critical self-review

One pass inspected Git status, the full tracked diff, and this new plan. Checked
peer/API evidence versus untested 7.x behavior, current configuration, source
cancellation paths, completed-plan acceptance evidence, explicit fixture exclusion,
and documentation links. Confirmed no dependency, lockfile, source, fixture, or
tracked generated-output changes. Preserved the failed full-offline-install and
unrun editor checks as limitations. Clarified the branch/plan step wording.
No unresolved findings within scope.

Proposed commit: `docs: record TypeScript upgrade decision and reconcile quality criteria`.
Scope: this completed plan, the quality register, and the overview's fixture
scope note. Await manual review and explicit approval before staging or committing.

## Next step

None. Await manual diff review and explicit approval of the proposed commit.

## Final result

Completed DEP-03 by retaining the supported and verified TypeScript 6.0.3.
Marked three further overall acceptance checkboxes using completed-plan evidence;
excluded the dedupingMixin criterion by scope decision. Clarified outstanding
provider cancellation and diagnostics. Only this plan, the quality register,
and the overview change; no commit, merge, or push performed.
