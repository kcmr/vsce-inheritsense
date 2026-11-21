# Traverse local-class inheritance

Status: Completed
Created: 2026-11-21
Completed: 2026-11-21
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), FIX-02

## Goal and scope

Resolve all ancestors of local classes in member lookup and inherited catalogs,
including local providers encountered inside imported modules. Preserve nearest
member lookup precedence, catalog ordering, injector discovery, resolution modes,
and termination on cycles. Do not change import identities (FIX-03), provider UI,
or undertake the general traversal refactor (REF-01).

## Acceptance criteria

- [x] Promote both FIX-02 TODO reproductions and verify grandparent origins.
- [x] Cover local/imported ancestor transitions and local factory providers.
- [x] Verify cycles terminate without reintroducing the excluded current class.
- [x] Verify nearest declarations/injectors precede ancestors and strict/permissive
  options reach every ancestor.
- [x] Types, lint, and the full test suite pass; FIX-03 TODOs remain separate.

## Steps

- [x] Reproduce both failures and inspect traversal entry points.
- [x] Implement recursive local traversal and regression tests.
- [x] Verify and update documentation; perform one critical self-review.

## Verification

- Before implementation: both promoted FIX-02 tests failed (no grandparent origin).
- `pnpm test`: passed, 38 passing tests and 2 expected FIX-03 TODO failures.
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm lint`: passed.
- Relative documentation links and `git diff --check`: passed.
- Extension-host checks not run: provider registration/UI code is unchanged.

## Decisions and blockers

- Branch: `fix/local-class-inheritance`.
- Reuse provider traversal over already extracted symbols, so local recursion
  retains the current document source instead of reading its saved version.
- Mark the current class visited at each entrypoint, including imported branches,
  to prevent cycle traversal from bypassing `includeCurrentClass`.
- Catalogs retain distinct shadowed origins in nearest-first order, matching the
  existing imported traversal; completion already selects the first per name.

## Next step

None.

## Final result

FIX-02 resolves deep local ancestors through shared symbol-based provider helpers.
Both reproductions are enforced, with nine additional tests for mixed file chains,
local factories, declaration/injector precedence, modes, and cycles. The remaining
FIX-03 reproductions still fail as TODOs. No provider UI changes or dependencies.

Critical self-review: completed once over the full diff and new plan. Strengthened
origin metadata assertions and added a regression for local ancestors edited only
in the current document source. No unresolved in-scope findings; generated output
and unrelated files are excluded. Remaining import identity bugs are FIX-03.

Proposed commit: `fix(resolver): traverse local-class inheritance chains`.
