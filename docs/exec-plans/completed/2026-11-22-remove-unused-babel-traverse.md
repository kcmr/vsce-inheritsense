# DEP-02: Remove unused Babel traversal dependency

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), DEP-02

## Goal and scope

On `chore/remove-unused-babel-traverse`, remove the unused direct production
dependency and its unneeded lockfile graph. Preserve Node, other package
versions, and extension behavior. Limit changes to the manifest, lockfile, and
execution plans unless verification finds an issue within scope.

## Acceptance criteria

- [x] Verify no repository code or tooling uses the direct dependency.
- [x] Remove it and prune unneeded lockfile entries without unrelated version changes.
- [x] Types, tests, lint, strict source complexity, and frozen installation pass.
- [x] Record evidence, complete one critical self-review, and propose a commit.

## Steps

- [x] Read repository workflow and relevant backlog; create branch and plan.
- [x] Inspect source imports and dependency ownership; remove the package.
- [x] Run checks, update DEP-02, and review once.

## Verification

- Initial source search found only the manifest and backlog references outside
  generated output, installed packages, and the lockfile.
- Before removal, `pnpm why @babel/traverse` identified the project itself as its
  sole consumer. Parser and types do not require traverse; traversal uses
  `visitNode`, `visitThisScope`, and `@babel/types.VISITOR_KEYS`.
- `pnpm remove @babel/traverse --ignore-scripts`: removed the direct dependency
  and 11 now-unneeded transitive packages (12 packages total).
- Manifest comparison confirms only that dependency declaration changed; the
  original property order is preserved. Remaining package versions,
  Node engines/types, scripts, and package version are identical.
- Structured lock-section comparison: exactly 12 records removed from both
  `packages` and `snapshots`; all 243 retained records in each section are
  unchanged, including integrity hashes and dependency mappings.
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm test`: 139 passing, no TODOs/skips/failures.
- `pnpm lint`: passed, zero warnings/errors.
- `pnpm exec eslint src --rule 'complexity: [error, 15]'`: passed.
- `pnpm install --frozen-lockfile --ignore-scripts --offline`: passed without
  dependency resolution or changes to the resulting lockfile.
- After removal, `pnpm why @babel/traverse` is empty and resolving the package
  throws `MODULE_NOT_FOUND`. The compiled parser still loads and extracts the
  sample component fixture.
- Node remains 26.13.1. No production source/tests changed, no new tests added,
  no UI checks run, and packaging was not run (avoids its version bump).
- Closure checks: 19 local documentation links resolve, manifest JSON parses,
  `git diff --check` passes, and exactly the four scoped files changed.

## Decisions and blockers

- Retain existing AST walkers; do not adopt a library to justify an unused package.
- Do not change Node, upgrade dependencies, add tests, or run packaging.

## Critical self-review

One pass inspected Git status, the complete tracked diff, and this new plan.
Checked import and dependency ownership evidence, all 12 pruned package/snapshot
records, byte-identical retained lock records, manifest/version scope, package
loading without the removed dependency, verification results, generated output,
and documentation links. No unrelated dependency or runtime changes, added tests,
or unresolved findings.

Proposed commit: `build(deps): remove unused Babel traverse dependency`.
Scope: `package.json`, `pnpm-lock.yaml`, this plan, and the quality register.
Await manual diff review and explicit approval before staging or committing.

## Next step

None. Await manual review and explicit commit approval.

## Final result

Completed DEP-02: removed unused `@babel/traverse` and 11 unneeded transitive
packages; the remaining 243 records in each lock section are unchanged. Types,
139 tests, lint, strict source complexity, frozen offline installation, and
compiled parser loading pass. Node, package version, and remaining dependencies
are unchanged. No source/test changes, UI checks, packaging, commit, merge, or
push performed.
