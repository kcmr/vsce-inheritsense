# Respect lexical this scopes

Status: Completed
Created: 2026-11-21
Completed: 2026-11-21
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), FIX-01

## Goal and scope

Prevent nested functions, object methods, and classes from contributing assignments
or injector calls belonging to another `this`. Preserve lexical arrows and
strict/permissive member discovery. Review injector traversal without expanding
into general identifier binding analysis or other correctness tasks.

## Acceptance criteria

- [x] Promote the FIX-01 TODO reproduction to an enforced regression test.
- [x] Cover function declarations/expressions, object methods, nested classes,
  lexical arrows, strict/permissive modes, and class injector calls.
- [x] Preserve outer-this expressions in computed keys and class heritage.
- [x] Types, lint, and tests pass; remaining TODO failures are reported separately.

## Steps

- [x] Reproduce the failure and review assignment/injector walkers.
- [x] Implement scope-aware traversal and regression coverage.
- [x] Verify, update the register and test documentation, and perform one critical review.

## Verification

- Before implementation: promoted FIX-01 test failed with `foreignFunction` and
  `foreignClass` incorrectly included.
- `pnpm test`: passed, 27 passing tests and 4 expected TODO failures (FIX-02/03).
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm lint`: passed.
- Extension-host checks not run: no provider registration or UI code changed.

## Decisions and blockers

- Branch: `fix/this-assignment-scopes`.
- No provider UI behavior changes; verification targets the shared parser/resolver APIs.
- Assignment and class injector traversal share a lexical-this walker. The generic
  walker permits pruning; receiver-identifier injector analysis keeps its existing
  traversal because identifiers can be captured across functions. General binding
  and shadowing analysis remains outside FIX-01.
- Static analysis still does not prove whether an arrow is invoked, or infer
  explicit `call`/`bind` receiver changes.

## Next step

None.

## Final result

FIX-01 is implemented with four enforced regression tests. Nested function/class
bodies are excluded while arrows, heritage, and computed keys retain lexical this.
FIX-02 and FIX-03 remain tracked in the quality register.

Critical self-review: completed once across the full diff and new plan. No
unresolved in-scope findings; removed one stray blank line. Remaining binding
analysis and runtime invocation limits are recorded above. No generated artifacts
are tracked. The user approved the commit and inclusion of their
`.vscode/launch.json` debug configuration; its JSON syntax was validated.
The pre-existing untracked `.vscode/settings.json` remains outside this change.

Proposed commit: `fix(parser): respect lexical this scopes during member discovery`.
