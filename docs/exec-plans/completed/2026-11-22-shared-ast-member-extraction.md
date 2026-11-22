# Share AST helpers and member extraction

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), REF-02

## Goal and scope

Share class-expression discovery, expression-to-provider conversion, AST walking,
and equivalent member extraction helpers. Use parser member declarations for both
lookup and catalogs, removing the lookup-only initializer fallback. Preserve member
kinds, literal keys, metadata, ordering, lazy lookup, and strict/permissive modes.
Document intentional differences in lexical-this and receiver-identifier traversal,
assignment kinds, and deduplication. No provider UI, dependencies, cache, new syntax
support, or general cleanup of existing complexity warnings (REF-03). New/extracted
functions must have complexity at most 15.

## Acceptance criteria

- [x] All new/extracted functions have ESLint complexity at most 15.

- [x] Characterize factory/class extraction and lookup/catalog member contracts.
- [x] Share equivalent AST, name, kind, and deduplication behavior.
- [x] Remove divergent initializer extraction; reproduce any observable correction.
- [x] Preserve getters/setters, fields, literal keys, modes, scopes, and metadata.
- [x] Full tests, no-emit types, lint, and documentation checks pass.

## Steps

- [x] Capture baseline and add focused characterization/regression coverage.
- [x] Consolidate helpers and route all member resolution through parser symbols.
- [x] Verify, update documentation, and perform one critical self-review.

## Verification

- Baseline `pnpm test`: 86 passing, no TODOs.
- Before refactoring: `node --test test/extraction.test.mjs`: 17 passing and one
  expected failing TODO. The lookup-only fallback incorrectly exposes an inherited
  constructor as a method; catalogs exclude it.
- Final `pnpm test`: 104 passing, no failures or TODOs.
- `pnpm exec tsc --noEmit -p .`: passed.
- Final `pnpm lint`: passed, 6 legacy complexity warnings, no errors.
- Explicit complexity audit (limit 15, error severity) of `src/parser/astHelpers.ts src/parser/members.ts`:
  passed with no warnings or errors; all new/extracted functions meet the limit.
- Relative documentation links and `git diff --check`: passed.
- Extension-host checks not run: no provider registration or UI changes.

## Decisions and blockers

- Branch: `refactor/shared-ast-member-extraction`.
- Include the branch-per-backlog-item instruction in the agent workflow.
- New/extracted/relocated functions must have complexity at most 15. Class discovery
  separates returned-class and call analysis; member extraction separates explicit,
  declarative, and assigned members while retaining phase order and deduplication.
- Existing generic traversal already supports pruning; lexical-this traversal is a
  scope-aware wrapper, not an equivalent walker to merge indiscriminately.
- Class declarations deduplicate by name/kind; injectors retain distinct source
  lines. Preserve this difference.

## Next step

None.

## Final result

REF-02 is complete. Extracted shared AST and member helpers, removed divergent
lookup-only extraction, and promoted the constructor reproduction to an enforced
regression. Seventeen other characterization tests passed before and after the
refactor. Existing traversal, identity, scope, and early-exit tests remain green.
The branch-per-backlog-item rule is now explicit in AGENTS.md and the workflow.

One critical self-review completed over the full diff and new files. Strengthened
lookup assertions to reject extra origins, documented receiver-identifier traversal
boundaries, and removed a stray import separator. No unresolved in-scope findings.
Verified the review correction against the full suite and strict complexity checks;
new modules have no complexity warnings. The limit and verification command are
recorded in AGENTS.md. Legacy complexity reduction remains REF-03; no dependencies
or provider UI changes.

Proposed commit: `refactor(parser): share AST helpers and member extraction`.
