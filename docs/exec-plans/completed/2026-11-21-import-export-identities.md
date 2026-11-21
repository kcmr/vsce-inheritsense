# Preserve import and export identities

Status: Completed
Created: 2026-11-21
Completed: 2026-11-21
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), FIX-03

## Goal and scope

Preserve local and exported identities across named imports, aliased reexports,
local export lists, default imports/exports, and namespace member access. Apply
identity translation to class/factory providers and injector calls in lookup and
catalogs. Keep origin owners and locations attached to declarations.

Do not implement CommonJS export inference, wildcard export discovery, arbitrary
object property inference, or full bundler resolution. Preserve strict/permissive
modes, local inheritance, precedence, and cycle termination. No provider UI changes.

## Acceptance criteria

- [x] Promote both FIX-03 TODO reproductions to enforced regression tests.
- [x] Record imports and exports separately, preserving original names and kinds.
- [x] Verify alias chains, local export lists, defaults, and namespace member access
  in lookup and catalogs, including providers and injectors.
- [x] Reject missing/unexported symbols and unsupported namespace usage rather than
  matching an unrelated same-named declaration.
- [x] Preserve metadata, modes, precedence, and termination on alias cycles.
- [x] Types, lint, full tests, and documentation checks pass.

## Steps

- [x] Reproduce failures and inspect module identity consumers.
- [x] Implement identity-aware extraction and resolution with regression coverage.
- [x] Verify, document supported boundaries, and perform one critical self-review.

## Verification

- Before implementation: both promoted FIX-03 reproductions failed with no origin.
- `pnpm test`: passed, 79 tests, no failures or TODOs.
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm lint`: passed.
- Relative documentation links and `git diff --check`: passed.
- Extension-host checks not run: provider registration/UI code is unchanged.

## Decisions and blockers

- Branch: `fix/import-export-identities`.
- Module namespace objects are containers, not class/factory providers themselves.
- Imports retain source/exported name (`null` for namespace); exports separately
  identify local declarations or reexports. Module edges translate both identity
  and namespace qualifier; local traversal never searches an unrelated qualifier.
- Separate visited keys for local/exported provider/injector identities preserve
  cycle guards when aliases change and when an export maps to a same-named local.
- Anonymous default declarations use `default` as the origin owner; named default
  declarations retain their declared names.
- Support one namespace property (`ns.Root`, `ns.default`) and named namespace
  reexports, not nested/computed property chains, wildcard export discovery,
  arbitrary default-object properties, or CommonJS export inference.

## Next step

None.

## Final result

FIX-03 is implemented in parser metadata and a shared module-edge translator used
by provider and injector lookup/catalog traversal. Both TODO reproductions are
promoted; 39 additional module-identity tests cover positive and negative cases.
All 79 tests pass without TODOs. No dependencies or provider UI code changed.

One critical self-review completed over the full diff and new files. Found and
reproduced incorrect truthiness handling of empty namespace export names; fixed
with explicit undefined checks and an enforced regression. Removed redundant
receiver guards after narrowing supported namespace syntax. No unresolved
in-scope findings. Documented unsupported module-resolution patterns above.

Proposed commit: `fix(resolver): preserve import and reexport identities`.
