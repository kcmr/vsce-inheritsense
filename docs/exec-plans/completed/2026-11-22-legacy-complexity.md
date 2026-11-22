# REF-03: Reduce legacy parser and hover complexity

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), REF-03

## Goal and scope

Separate module binding extraction, injector recognition, and hover JSDoc
processing while preserving behavior. Work on `refactor/legacy-complexity`.
Do not change provider registration, resolution, Markdown output, or settings.

## Acceptance criteria

- [x] Every function in `src/` has complexity at most 15, without suppressions or raised limits.
- [x] Parser/resolver behavior and hover JSDoc output remain unchanged, backed by characterization coverage.
- [x] Types, tests, normal lint, and strict complexity checks pass.
- [x] One critical self-review is recorded and a commit is proposed for manual approval.

## Steps

- [x] Inspect baseline: six strict complexity errors (16, 26, 20, 50 in symbols; 17, 23 in hover).
- [x] Capture baseline fixture results and JSDoc calls; add characterization coverage.
- [x] Extract focused helpers preserving traversal, ordering, guards, and formatting.
- [x] Verify all source functions and update the quality register.
- [x] Perform one critical self-review and hand off without committing.

## Verification

- Baseline explicit complexity audit (limit 15, error severity) of `src`: six errors, as expected.
- Baseline `pnpm test`: 104 passing, no TODOs.
- Final `pnpm test`: 113 passing, no TODOs.
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm lint`: passed, zero warnings/errors.
- Explicit complexity audit (limit 15, error severity) of `src`: passed.
- Explicit complexity audit (limit 15, error severity) of `test/jsdoc.test.mjs test/parser.test.mjs`: passed.
- Explicit complexity audit (limit 15, error severity) of `test/fixtures/scenarios/static` with isolated configuration: passed.
- Review correction: `node --test test/jsdoc.test.mjs test/parser.test.mjs`:
  17 passing; strict lint for the changed hover import/test passed.
- Documentation check: 31 local links resolve; `git diff --check` passed.
- Before/after serialized parser results (maps included) matched across 502
  fixture/mode combinations; comparison ignores object property order.
- Inline-fixture follow-up: `node --test test/jsdoc.test.mjs`: 8 passing;
  strict ESLint for the test and `git diff --check` passed.
- Seven JSDoc golden cases capture the original implementation's append calls;
  added cache/boundary and injector recognition coverage.
- No UI or extension-host checks performed: provider registration/orchestration
  is unchanged; JSDoc output is checked through the isolated helpers.

## Decisions and blockers

- Preserve existing computed-key policies and injector traversal, including unsupported-pattern guards.
- Characterize JSDoc extraction/formatting independently of VS Code; keep provider orchestration unchanged.
- Keep isolated JSDoc snippets and expected calls inline in `test/jsdoc.test.mjs`,
  as requested during manual review; parser/resolver scenarios remain on disk.

## Critical self-review

One pass over the full tracked diff and all new files checked recognition guards,
computed-key policies, traversal/order, export identities, Markdown calls, fixture
coverage, generated artifacts, and documentation links. Replaced the cache-boundary
test's source placement and removed stale backlog wording. The subsequent manual
review requested inline JSDoc cases; all seven sources and golden expectations
now live together in the test module, with the cache-boundary test reusing one case.
No unresolved findings. No unrelated changes or dependency/configuration changes.

Proposed commit: `refactor: reduce parser and hover complexity to 15`. Scope:
parser helpers, isolated JSDoc processing, characterization fixtures/tests, and
REF-03 documentation. Await manual review and explicit approval before staging
or committing.

## Next step

None.

## Final result

Separated import/export bindings, declaration collection, assignment recognition,
Object.entries callback matching, and JSDoc scanning/formatting. All six legacy
warnings are eliminated. Provider orchestration and Markdown append calls are
preserved. Commit remains subject to manual review and explicit approval.
