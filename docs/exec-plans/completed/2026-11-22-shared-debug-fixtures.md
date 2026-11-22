# Share test fixtures with extension debugging

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), TEST-02

## Goal and scope

Move source scenarios from test strings into organized on-disk fixtures read by
both tests and the extension during debugging. Preserve assertions, modes, metadata,
parameterized variants, unsaved-document checks, and isolated temporary graphs.
Document entry files, symbols, expected results, and debug steps. Keep static-only
and malformed scenarios distinct from executable examples. No resolver/provider
behavior changes, dependency updates, or legacy complexity cleanup (REF-03).

## Acceptance criteria

- [x] Test source scenarios live in fixtures and tests read the same source files.
- [x] Parameterized and unsaved-document cases retain their behavior and assertions.
- [x] Fixture organization distinguishes runnable, static-only, and malformed cases.
- [x] Debug instructions identify entry files, symbols, settings, and expected origins.
- [x] Full tests, types, lint, new-code complexity, and documentation checks pass.
- [x] Representative scenarios are checked in extension debug mode.

## Steps

- [x] Capture baseline and inventory inline sources and debug facilities.
- [x] Extract scenarios and adapt test helpers without weakening assertions.
- [x] Verify automation, document, and perform one critical self-review.
- [x] Verify representative scenarios in the Extension Development Host.

## Verification

- Baseline and migrated `pnpm test`: 104 passing, no failures or TODOs.
- `pnpm exec tsc --noEmit -p .`: passed.
- `pnpm lint`: passed with 6 unchanged legacy complexity warnings.
- Explicit complexity audit (limit 15, error severity) of `test/helpers.mjs test/*.test.mjs`: passed.
- Explicit complexity audit (limit 15, error severity) of `test/fixtures/scenarios/static` with isolated configuration: passed.
- Complexity checks also pass for the valid files in malformed graphs, excluding
  only deliberately unparseable `broken.js` and `invalid.js`.
- Migration audit: 87 scenarios, 240 files; 233 preserve source apart from trailing
  whitespace/newline normalization. Five entry files add debug references and two
  `.cjs` files use CommonJS syntax. No missing or unused extracted fixtures.
- Assertion audit: all 114 assertion calls retained; the syntax-error input is now
  read from its fixture instead of a string literal.
- Direct resolver smoke checks on four on-disk debug entries (without temporary
  copies): expected owners found for aliases, namespace injectors, local ancestry,
  and traversal precedence.
- Relative documentation links, new-file whitespace, and `git diff --check`: passed.
- User-reported debug verification (2026-11-22): the user checked the files with
  the extension in debug mode and confirmed the expected results. Agent UI checks
  were not performed; manual verification is attributed to the user.

## Decisions and blockers

- Branch: `test/shared-debug-fixtures`.
- UI manipulation and Computer Use require an explicit user request. The user runs
  manual UI checks; record their confirmation separately from agent-run checks.
- Read fixture source without importing/executing it, including intentionally invalid
  syntax and static graphs that cannot run as JavaScript modules.
- Mock package dependencies are stored as `package-dependencies/` and renamed in
  temporary copies, keeping fixture source tracked without a node_modules tree.
- Normal lint excludes scenario data, not test modules/helpers. Valid static source
  is checked separately for complexity without runtime-code lint assumptions.
- The two `.cjs` path-resolution inputs use CommonJS syntax. Five representative
  entry files add non-assigning this-member references for manual editor checks.

## Next step

None.

## Final result

TEST-02 is complete: test sources are shared on-disk fixtures, automated checks
pass, and the user confirmed expected results in extension debug mode. No provider
or resolver production source changed. AGENTS.md records the shared-fixture
convention and assigns UI checks to the user unless they explicitly request agent
UI interaction. Test instructions link entry files and expected origins.

One critical self-review covered the full diff, new fixture source migration and
assertion audits, helpers, lint exclusions, and documentation. Normalized trailing
whitespace in extracted files, removed a stray blank line, and renamed the shared
mode scenario to avoid implying it is strict-only. Corrections verified; no
unresolved findings. User confirmation satisfies the remaining debug verification;
reused the recorded review when closing the plan. Documentation-only closure checks
passed without rerunning the unchanged implementation checks. No commit has been created.

Proposed commit: `test: share source fixtures with extension debugging`.
