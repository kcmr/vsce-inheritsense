# Share resolver traversal

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), REF-01

## Goal and scope

Share traversal for class/factory providers, class/file injectors, imports, and
reexports between individual lookup and inherited catalogs. Preserve observable
origin metadata, ordering, current-class defaults, shadowed catalog entries,
lookup early exit per root provider, and cycle detection. Preserve local/import
identities and strict/permissive behavior verified by FIX-01 through FIX-03.

No AST extraction consolidation (REF-02), provider UI changes (REF-04), cache
(PERF-01), dependency changes, or new resolution features.

## Acceptance criteria

- [x] Replace parallel find/collect traversal families with shared lazy traversal.
- [x] Compare lookup and catalog on shared graphs with declarations, injectors,
  aliases, multiple providers, cycles, and strict/permissive discovery.
- [x] Verify lookup stops before reading later branches after finding an origin.
- [x] Preserve metadata, precedence, deduplication, and current-class defaults.
- [x] Types, lint, full tests, and documentation checks pass; record warnings.

## Steps

- [x] Capture baseline behavior and add traversal contract tests.
- [x] Implement shared traversal preserving existing extraction differences.
- [x] Verify, update documentation, and perform one critical self-review.

## Verification

- Before implementation: `pnpm test` passed (79 tests, no TODOs).
- Seven new traversal contract tests passed against the original resolver before
  refactoring (`node --test test/traversal.test.mjs`).
- After implementation: `pnpm test` passed (86 tests, no TODOs).
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm lint`: passed, 10 existing complexity warnings, no errors.
- Relative documentation links and `git diff --check`: passed.
- Extension-host checks not run: no provider registration or UI code changed.

## Decisions and blockers

- Branch: `refactor/shared-resolver-traversal`.
- Use lazy origin traversal so lookup can stop without reading subsequent modules;
  catalogs consume all origins in the same order.
- Keep the lookup-only exported-initializer extraction fallback unchanged until
  REF-02; this task shares traversal without changing extraction contracts.

## Next step

None.

## Final result

REF-01 is complete: provider/injector imports and reexports share lazy generators,
and both public APIs select from the same ordered traversal. Lookup closes the
generator on the first match within each root provider; catalogs exhaust it.
Removed parallel find/collect traversal while retaining extraction fallback
behavior for REF-02. Seven contract tests passed on the original and refactored
resolver; all 86 tests pass, with no TODOs.

Critical self-review: completed once over the full diff and new files. Made the
parser options explicit instead of passing the whole traversal context. No
unresolved in-scope findings, new dependencies, or tracked generated output.
Remaining complexity warnings and extraction consolidation are REF-03/REF-02.

Proposed commit: `refactor(resolver): share lazy member traversal`.
