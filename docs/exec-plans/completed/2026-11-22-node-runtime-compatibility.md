# DEP-05: Verify Node compatibility without changing the development runtime

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), DEP-05

## Goal and scope

Use `chore/node-runtime-compatibility` for a temporary internal compatibility
audit. Keep the current Node 26.13.1 runtime, `@types/node`, declared development
engine, and package lock unchanged. Prefer a documented decision over additional
production code, permanent verification scripts, CI infrastructure, or test suites.
Separate extension-runtime requirements from development/test tooling.

## Acceptance criteria

- [x] Inventory production Node APIs and check availability in the minimum editor runtime.
- [x] Verify current source against an appropriate older Node type surface using temporary tooling where practical.
- [x] Establish development-versus-extension runtime evidence without downgrading the project.
- [x] Record the decision, limits, exact commands/results, and any follow-up.
- [x] Only execution-plan files change; one critical review and a commit proposal are recorded.

## Steps

- [x] Confirm a clean `main`, inspect the existing runtime policy, and create the branch.
- [x] Audit source imports and perform temporary checks.
- [x] Record the decision, update DEP-05, verify documentation, and review once.

## Verification

- Development runtime: Node 26.13.1; `engines.node`: `>=24`;
  `@types/node`: declared `^26.6.6`, installed 26.6.6.
- Minimum VS Code 1.95.0 includes Node 20.18.0; its isolated archive/runtime is
  already available from DEP-04. No application UI needs to be opened for this audit.
- Production Node imports currently use `node:fs`, `node:path`, and
  `createRequire` from `node:module`.

## Verification results

- Audited source commit `7391366`. Production Node calls are
  `fs.existsSync`, `fs.statSync`, `fs.readFileSync`, `path.resolve`, `path.dirname`,
  `path.join`, `path.relative`, and `module.createRequire`; additionally the code
  uses `Stats.isFile`, `Stats.isDirectory`, and the returned require's `resolve`.
- Temporary `/tmp/dep05-node-api-check.cjs` asserts these functions/methods and
  successfully loads/parses with the project's Babel parser. It passed on the
  current Node 26.13.1, isolated Node 24.0.0, and minimum-editor Node 20.18.0.
- Temporary package setup, outside the repository:
  `pnpm --dir <audit-temp> add --save-exact --ignore-scripts @types/node@20.17.0 @types/vscode@1.95.0`.
  This installed comparison declarations only; it did not change project versions.
- Temporary `tsconfig.json` extends the project's config, keeps its normal
  strictness and ES2022 target, sets `noEmit`, and redirects `typeRoots` to the
  comparison directory. `pnpm exec tsc --noEmit -p <audit-temp>/tsconfig.json`
  passed for all production source.
- A temporary TypeScript program inspection confirmed all 60 Node declaration
  files came from the isolated 20.17.0 package, not a mixture with project Node
  26 types. This is a conservative type-surface check, separate from runtime tests.
- Downloaded official Node 24.0.0 macOS arm64 into the temporary directory;
  verified its SHA-256 against the official release's `SHASUMS256.txt`.
- With that binary (not a PATH change), ran:
  `<node24> node_modules/typescript/bin/tsc -p .`, then
  `<node24> --test test/*.test.mjs`: 139 passing, zero TODOs/skips/failures.
  The full suite, including module-hook integration tests, works at the declared
  development minimum. Compilation produced only ignored `dist/` output.
- Reused FIX-04 evidence for the identical source commit: 139 tests passed on
  development Node 26, and 122 non-boundary tests passed in the minimum editor's
  Node 20.18.0. The boundary suite deliberately needs the development runtime.
- Current installed package engines also fit the intended runtimes: Babel parser
  7.29.14 requires Node >=6.0.0; Babel types/traverse 7.29.14 require >=6.9.0.
  Tooling inspected here includes TypeScript 6.0.3 (>=14.17), ESLint 9.39.5
  (^18.18.0 || ^20.9.0 || >=21.1.0), and vsce 4.1.1 (>=22).
  This is not a broader dependency/peer audit or a packaging run.
- `node --version` still returns `v26.13.1`. `git diff -- package.json
  pnpm-lock.yaml tsconfig.json` is empty. No production files, permanent scripts,
  tests, dependency declarations, lockfiles, or existing runtime installations were changed.
- No UI checks or packaging performed. The audit uses console-only checks.
- Documentation verification: 18 local links resolve; `git diff --check` passes;
  exactly two execution-plan files changed and no active plan remains.

## Decision and maintenance boundary

Keep Node 26.13.1 and `@types/node` 26.6.6 for the current development environment;
keep the declared development/tooling minimum `>=24`. Current source is also
compatible with the minimum editor's embedded Node 20.18.0 by the isolated type,
API, runtime-test, and previously recorded editor evidence.

The development types intentionally describe Node 26 rather than acting as a
permanent Node 20/24 API ceiling. Future production Node API changes require
another internal baseline check; do not infer compatibility merely from a normal
compile with newer types. No permanent second type configuration or automated
guard is introduced at the user's request. Tests/tooling can use development-only
APIs that are not available inside the extension host.

## Decisions and blockers

- The user prioritizes preserving the current development Node version and asks
  for an internal check instead of adding permanent verification code.
- No downgrade or project dependency changes. Any older type package used for
  comparison belongs only in a temporary directory.

## Critical self-review

One pass inspected the full register diff and new plan, separating fresh audit
results from reused FIX-04 evidence. Checked the actual type resolution (no Node
26 contamination in the temporary baseline), runtime/version distinctions,
point-in-time limitations, preservation of project versions, changed-file scope,
and documentation links. Clarified that temporary comparison tools do not change
existing runtime installations. No unresolved findings.

Proposed commit: `docs: record Node runtime compatibility audit`.
Scope: this completed execution plan and the DEP-05 quality-register update only.
Await manual diff review and explicit approval before staging or committing.

## Next step

None. Await manual review and explicit commit approval. Future production Node
API additions should repeat the documented internal compatibility check.

## Final result

Completed DEP-05 without changing project code or Node versions. Retain current
Node 26.13.1 and Node 26 type definitions, with the existing >=24 development
floor. All production source passes an isolated Node 20 type-surface check;
production Node APIs pass smoke checks on 20.18.0, 24.0.0, and 26.13.1; all 139
tests pass on the isolated Node 24.0.0 minimum. Only execution-plan documentation
changes. No permanent verification code, UI checks, packaging, commit, merge, or
push performed. The decision is a verified snapshot, not a permanent API ceiling
for future source changes.
