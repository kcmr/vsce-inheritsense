# Parser and resolver tests

Status: Completed
Created: 2026-11-21
Completed: 2026-11-21
Branch: `test/parser-resolver-coverage`
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), TEST-01

## Goal and scope

Provide a reproducible parser/resolver test command before correctness fixes and
refactoring. Cover the component fixtures, member kinds and locations, factory
and mixin composition, injectors, catalogs, strict/permissive modes, and safe
failure cases. Add executable TODO reproductions for FIX-01 through FIX-03.

Use Node's built-in test runner and the existing TypeScript compiler; introduce
no dependencies. Tests consume freshly compiled modules without loading VS Code.
No extension behavior changes, bug fixes, or extension-host UI tests are included.

## Acceptance criteria

- [x] `pnpm test` compiles current sources and runs tests without an extension host.
- [x] Passing tests verify observable parser/resolver behavior and origin metadata.
- [x] Known failures have executable TODO tests linked to their pending fix IDs.
- [x] Types and lint pass; test assets are excluded from the extension package.
- [x] Test instructions, limitations, and backlog status are current.

## Steps

- [x] Inspect code, fixtures, tooling, and current branch; create the task branch.
- [x] Add the runner command, tests, and packaging exclusions.
- [x] Verify and document results, then move this plan to completed.

## Verification

- `pnpm test`: exit 0; 28 tests, 23 passing, 5 TODO reproductions, no ordinary
  failures or skipped tests. All TODO assertions fail on the recorded bugs as
  expected; they are not passing coverage.
- `./node_modules/.bin/tsc --noEmit -p .`: passed.
- `./node_modules/.bin/eslint .`: passed, including test modules.
- `git diff --check`: passed.
- Documentation links and `test/**` packaging exclusion: checked.
- No changes to `src/`, existing fixtures, dependency versions, or lockfile.
- Manual extension-host checks: not run; provider behavior is outside this scope.

## Decisions and blockers

JavaScript ESM tests import compiled CommonJS modules. The test command runs the
existing compiler first, preventing reliance on stale generated sources.
Temporary module graphs are isolated per test and removed with test cleanup hooks.
Known-failure TODO tests assert the intended behavior; they are not counted as
passing coverage. Their corresponding fix branches must promote them to normal tests.
Extension-host integration is deferred because this task changes no providers;
the suite covers the shared resolution APIs used by hover, definition, and completion.

## Next step

None. FIX-01 is the next correctness workstream; promote its TODO reproduction
and expand scope-focused coverage when implementing that fix.

## Final result

Added a dependency-free Node test suite, isolated temporary module graphs,
fresh-build test command, packaging exclusion, and test documentation. TEST-01
is complete. FIX-01, FIX-02, and FIX-03 remain open with executable failure
reproductions; extension-host integration remains conditional on provider changes.
