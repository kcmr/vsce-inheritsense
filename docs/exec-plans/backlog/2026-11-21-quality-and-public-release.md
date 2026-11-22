# Quality and public-release readiness

Review date: 2026-11-21.
Status: Backlog. TEST-01 through TEST-02, FIX-01 through FIX-03, and REF-01 through REF-02 completed; remaining tasks pending.

Check items only after implementation and verification. Follow
[the execution-plan workflow](../../agent-harness/workflows.md) when starting work.

## Goal

Prepare InheritSense for public release with consistent resolution,
less duplication, and reproducible checks.

## Context

The extension uses Babel to locate members supplied by classes, factories,
mixins, and injectors. It exposes a trace command, hover, definition navigation,
and inherited-member completion.

Relevant files:

- `src/parser/ast.ts`: Babel configuration.
- `src/parser/symbols.ts`: classes, members, imports, and injectors.
- `src/resolver/`: imports, inheritance, and member origins.
- `src/providers/`: VS Code integration.
- `src/commands/traceMemberOrigin.ts`, `src/ui/quickPick.ts`: command and selection.
- `test/`: Node parser/resolver tests and reproduction fixtures; see [test coverage](../../../test/README.md).
- `docs/extension-overview.md`: scope, behavior, settings, and architecture.
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`: tools and dependencies.

### Constraints

- Preserve `.js`, `.mjs`, and `.cjs` support and strict/permissive modes.
- Preserve the inheritance patterns covered by the fixtures.
- Distinguish static findings from failures reproduced by tests.
- Recheck package versions and compatibility before updating dependencies.
- Do not expand scope to TypeScript inference or full bundler module resolution.
- Preserve unrelated workspace changes.

## Task register

P1: correctness or public-release readiness. P2: maintainability, performance,
and tooling. These priorities are not security-severity ratings.

### Dependencies and compatibility

- [ ] **DEP-01 · P2 · Review declared ranges and installed versions.**
  Babel declares `^7.27.7`; the lockfile resolves parser, traverse, and types to
  `7.29.14`. `typescript-eslint` declares `^8.18.0` and resolves to `8.73.0`.
  Separate minimum-range updates from installed-version updates. Check registry
  versions and peer requirements for Babel, ESLint, `@eslint/js`,
  `typescript-eslint`, and `@vscode/vsce`.
  **Acceptance:** justified versions, compatible peers, and a consistent lockfile;
  old minimum ranges alone are not evidence of outdated installed packages.

- [ ] **DEP-02 · P2 · Remove or justify `@babel/traverse`.**
  It is a production dependency without imports in `src`.
  **Acceptance:** remove it if unused, or justify adopting it for AST traversal;
  verify types, lint, and resolution behavior.

- [ ] **DEP-03 · P2 · Evaluate the TypeScript major upgrade.**
  The lockfile contains `6.0.3`. During the review, the
  [official registry](https://registry.npmjs.org/typescript/latest) returned
  `7.0.2` as `latest`. This is a dated observation, not a migration requirement.
  **Acceptance:** review configuration and tooling compatibility, document the
  decision, and verify the selected version.

- [ ] **DEP-04 · P1 · Align VS Code types with the minimum supported version.**
  `engines.vscode` supports `^1.95.0`; `@types/vscode` declares `^1.95.0` but
  resolves to `1.146.0`, allowing compilation against newer APIs.
  **Acceptance:** establish a type/version policy that prevents unsupported API
  usage and verify the minimum supported VS Code environment.

- [ ] **DEP-05 · P2 · Align Node types and runtime support.**
  `@types/node` is `26.6.6`; `engines.node` supports Node 24 onward. Also review
  the minimum VS Code extension-host runtime, which is independent of the Node
  version used for development or packaging.
  **Acceptance:** type definitions and runtime APIs match supported environments.

### Duplication and complexity

- [x] **REF-01 · P2 · Share resolver traversal logic.**
  `src/resolver/memberResolver.ts` has parallel `find…` and `collect…` families
  for file/class injectors, providers, and imported members.
  **Acceptance:** share traversal while preserving early exit, precedence, and
  cycle detection; compare individual lookup and catalog behavior on shared cases.
  Completed 2026-11-22 on `refactor/shared-resolver-traversal`; see
  [Shared resolver traversal](../completed/2026-11-22-shared-resolver-traversal.md).
  Lazy traversal now serves lookup and catalogs across providers, injectors,
  imports, and reexports. Preserves lookup early exit per root provider, ordering,
  shadowed catalog origins, identities, and cycle guards. Seven contract tests
  passed before and after the refactor; `pnpm test`: 86 passing, no TODOs;
  types pass; lint passes with 10 accepted complexity warnings. Initializer
  extraction differences remain under REF-02.

- [x] **REF-02 · P2 · Consolidate AST helpers and member extraction.**
  `findClassFromExpression` is nearly duplicated between parser and resolver.
  Expression-to-`ProviderRef` conversion is repeated in parser and inheritance
  resolution. `symbols.ts` has two similar recursive walkers and repeated name,
  kind, and deduplication logic. The resolver's initializer-member extraction
  uses partially different rules from the parser.
  **Acceptance:** share equivalent behavior, document intentional differences,
  and preserve getters, setters, fields, literal keys, and strict/permissive modes.
  Completed 2026-11-22 on `refactor/shared-ast-member-extraction`; see
  [Shared AST and member extraction](../completed/2026-11-22-shared-ast-member-extraction.md).
  Shared AST traversal, class discovery, provider references, names, assignment
  kinds, and deduplication. Lookup and catalogs use parser declarations; removed
  the fallback that exposed constructors only in lookup. Eighteen new tests;
  `pnpm test`: 104 passing, no TODOs; types pass; lint passes with 6 legacy
  complexity warnings. New/extracted functions pass complexity checks at error
  severity with a limit of 15. Scope and deduplication differences remain explicit.

- [ ] **REF-03 · P2 · Bring remaining legacy functions within complexity 15.**
  Split responsibilities in import/export extraction, assignment and injector
  recognition, and hover JSDoc extraction/formatting. REF-02 already brought the
  new AST/member modules within the limit; this task covers the remaining legacy
  functions rather than creating another complexity workstream.
  **Acceptance:** every function in `src/` has ESLint cyclomatic complexity at
  most 15, with no suppressions or raised limits; preserve behavior with relevant
  parser/resolver coverage and extension-host tests when changing provider behavior.
  Run types, tests, normal lint, and a strict complexity check over `src/`.
  **Policy:** new/extracted/relocated functions must already meet the limit; see
  [agent instructions](../../../AGENTS.md). Legacy warnings remain pending here.

  Latest recorded baseline after REF-02 (2026-11-22): `pnpm lint` passed with
  6 complexity warnings and no errors. Recheck when starting implementation.

  | Location under `src/` | Function | Complexity |
  | --- | --- | ---: |
  | `parser/symbols.ts` | `extractFileSymbols` | 50 |
  | `parser/symbols.ts` | `collectDynamicBagInjectionMembers` callback | 26 |
  | `providers/memberOriginHoverProvider.ts` | `appendFormattedJsDoc` | 23 |
  | `parser/symbols.ts` | `collectFunctionInjectionMeta` callback | 20 |
  | `providers/memberOriginHoverProvider.ts` | `getOriginJsDoc` | 17 |
  | `parser/symbols.ts` | `collectInjectedMembersFromStatement` | 16 |

  Metrics identify review candidates; they do not replace readability assessment.

- [ ] **REF-04 · P2 · Share VS Code integration helpers.**
  Providers repeat JavaScript selectors, file-extension checks, and resolution
  setup. Hover and definition repeat symbol extraction. Three relative-path
  helpers exist; Quick Pick always uses the first workspace folder.
  **Acceptance:** share common behavior and resolve paths against the appropriate
  workspace root, including multi-root workspaces and external files.

### Correctness, performance, and diagnostics

- [x] **FIX-01 · P1 · Respect scopes when collecting assignments.**
  `collectThisAssignedFieldsFromNode` enters nested functions/classes without
  distinguishing the owner of `this`. Review injector/call detection similarly.
  **Acceptance:** reproduce and prevent incorrect attribution; distinguish arrow
  functions with lexical `this` from functions/classes with separate contexts.
  Completed 2026-11-21 on `fix/this-assignment-scopes`; see
  [Lexical this scope fix](../completed/2026-11-21-this-assignment-scopes.md).
  Promoted the TODO and added strict/permissive and injector lookup/catalog
  regressions. Preserves lexical arrows, class heritage, and computed keys.
  `pnpm test`: 27 passing, 4 remaining TODO reproductions; types and lint pass.

- [x] **FIX-02 · P1 · Traverse local-class inheritance.**
  Local-class branches in `resolveMemberOrigins`, `resolveInheritedMemberCatalog`,
  and provider helpers do not continue through superclasses like imported-class
  branches do.
  **Acceptance:** reproduce and resolve `C extends B`, `B extends A` locally,
  exposing `A` members through lookup and catalog; cover cycles and precedence.
  Completed 2026-11-21 on `fix/local-class-inheritance`; see
  [Local-class inheritance fix](../completed/2026-11-21-local-class-inheritance.md).
  Promoted both TODOs; covers local/imported transitions, factories, nearest-first
  precedence, injectors, strict/permissive modes, and cycles/current-class exclusion.
  `pnpm test`: 38 passing, 2 remaining FIX-03 TODOs; types and lint pass.

- [x] **FIX-03 · P1 · Preserve import and reexport identities.**
  `FileSymbols.imports` retains local names and paths but loses original imported
  names. Aliases can cause lookup of names that do not exist in the target file.
  **Acceptance:** cover renamed imports and aliased reexports; define and verify
  default-import and namespace-import behavior.
  Completed 2026-11-21 on `fix/import-export-identities`; see
  [Import/export identity fix](../completed/2026-11-21-import-export-identities.md).
  Imports and exports preserve separate local/exported identities. Lookup and
  catalogs cover aliases, local export lists, defaults, namespaces, injectors,
  metadata, modes, precedence, negative cases, and cycles. Both TODOs promoted.
  `pnpm test`: 79 passing, no TODOs; types and lint pass. Wildcard export discovery,
  nested/computed namespace chains, and CommonJS export inference remain outside scope.

- [ ] **PERF-01 · P2 · Avoid repeated reads and parsing.**
  Resolution performs synchronous reads and repeated extraction per request.
  Providers ignore cancellation. Hover's line cache lasts for one hover only.
  **Acceptance:** measure before/after, reuse analysis with correct invalidation,
  account for unsaved open documents, avoid stale results, and honor cancellation.

- [ ] **DIAG-01 · P2 · Make provider failures diagnosable.**
  Hover, definition, and completion catch all exceptions and return `undefined`,
  hiding the difference between missing results and internal failures.
  **Acceptance:** useful diagnostics without repetitive notifications while
  editing; preserve tolerance for incomplete JavaScript.

### Fixture contracts

- [ ] **FIXTURE-03 · P1 · Fix misleading example contracts.**
  `dedupingMixin` only wraps a factory and does not deduplicate. The overview
  explicitly documents this simplification.
  **Acceptance:** review wrapper naming or deduplication semantics if that
  behavior becomes part of the fixture coverage.

### Automated verification

- [x] **TEST-01 · P1 · Turn fixtures into reproducible tests.**
  Completed 2026-11-21 on `test/parser-resolver-coverage`; see
  [Parser and resolver tests](../completed/2026-11-21-parser-resolver-tests.md).
  `pnpm test` compiles sources and runs 23 passing tests plus 5 executable TODO
  reproductions for FIX-01 through FIX-03. Covers strict/permissive modes,
  composition, injectors, origin metadata, imports, catalogs, and cycles.
  Those five reproductions were subsequently fixed under FIX-01 through FIX-03.
  Extension-host integration tests are required when modifying provider behavior; see [test scope](../../../test/README.md).

- [x] **TEST-02 · P2 · Share on-disk test scenarios with extension debugging.**
  Move JavaScript source used by tests from inline strings into organized files
  under `test/fixtures/`, so the same scenarios can be opened in an Extension
  Development Host for manual hover, definition, completion, and trace checks.
  Tests should locate these fixtures and read their contents instead of duplicating
  source code or executing fixture modules just to obtain their source.
  **Acceptance:** migrate source scenarios while preserving assertions, origin
  metadata, strict/permissive modes, and isolated temporary module graphs where
  needed; retain parameterized variants and unsaved-document checks using fixture
  source. Document scenario entry files, relevant symbols, expected behavior, and
  debug steps in `test/README.md`. Clearly identify malformed, cyclic, or other
  static-analysis-only scenarios and keep them separate from runnable examples.
  Automated tests must exercise the same fixture source used for manual debugging;
  verify the test suite and representative scenarios in extension debug mode.
  Completed 2026-11-22 on `test/shared-debug-fixtures`; see
  [Shared debug fixtures](../completed/2026-11-22-shared-debug-fixtures.md).
  Migrated 87 source scenarios into shared fixtures; 104 tests pass, no TODOs;
  types, lint, and new-code complexity checks pass with 6 legacy lint warnings.
  The user checked the files with the extension in debug mode and confirmed the
  expected results on 2026-11-22.

## Proposed execution order

1. Fix scope handling, local inheritance, and import identity on separate branches,
   promoting their TODO reproductions to normal regression tests.
2. Move test sources into debug-friendly fixtures (TEST-02), then finish legacy
   complexity reduction (REF-03) and UI duplication cleanup (REF-04).
3. Review dependency and runtime compatibility in independent changes.
4. Review the wrapper contract separately (FIXTURE-03).
5. Measure performance, improve diagnostics, and update documentation.

## Overall acceptance criteria

- [ ] Fixture helper contracts are explicit and verified.
- [x] Recorded resolution failures are reproduced and fixed with regression tests.
- [x] Individual lookup and catalog use consistent, verified resolution rules.
- [ ] Dependencies are justified and compatible with supported environments.
- [ ] Types, lint, and relevant tests pass; remaining limitations are documented.
- [ ] Closed tasks include evidence, a completion date, and a change reference.

## Verification

### Review baseline

- `./node_modules/.bin/tsc --noEmit -p .`: passed.
- `./node_modules/.bin/eslint .`: passed.
- `./node_modules/.bin/eslint src --rule 'complexity: [warn, 15]' --rule 'max-depth: [warn, 4]'`:
  19 warnings, no errors; rules applied only for this command.
- Automated tests: unavailable.
- Manual extension-host checks: not performed during the review.
- Latest versions of other packages: unverified because registry queries failed.
  Do not classify them as outdated without checking.

### Check side effects

Use no-emit type checking and lint for read-only verification. `compile` writes
`dist/`; `package` runs `prepackage`, incrementing the version through
`npm version patch --no-git-tag-version` before compilation and linting.
Do not use packaging as a side-effect-free check.

## Decisions

- Keep tasks individually identifiable and verifiable for small implementation changes.
- Do not require a major upgrade solely because a newer version exists.
- Reproduce static correctness findings before closing them as fixed bugs.

## Progress

| Date | Status | Evidence |
| --- | --- | --- |
| 2026-11-21 | Review complete; implementation pending | Source, fixture, manifest, and lockfile inspection; types and lint; temporary complexity checks. |
| 2026-11-21 | TEST-01 completed | `pnpm test`: 23 passing, 5 TODO reproductions; types and lint pass; no runtime changes. |
| 2026-11-21 | FIX-01 completed | Lexical `this` traversal for assignments and class injector calls; 27 passing tests, 4 TODO reproductions; types and lint pass. |
| 2026-11-21 | FIX-02 completed | Recursive local-provider traversal; 38 passing tests, 2 FIX-03 TODO reproductions; types and lint pass. |
| 2026-11-21 | FIX-03 completed | Separate import/export identities; alias/default/namespace provider and injector resolution; 79 passing tests, no TODOs; types and lint pass. |
| 2026-11-22 | REF-01 completed | Shared lazy resolver traversal; seven contract tests pass before/after; 86 passing tests, no TODOs; types pass; lint has 10 accepted complexity warnings. |
| 2026-11-22 | REF-02 completed | Shared AST/member helpers and parser-only declarations; constructor inconsistency reproduced and fixed; 104 passing tests, no TODOs; types pass; new modules pass strict complexity checks; lint has 6 legacy warnings. |
| 2026-11-22 | TEST-02 completed | Shared on-disk scenarios and debug walkthrough; 104 passing tests, no TODOs; types/lint/complexity checks pass; user confirmed expected debug-mode results. |
