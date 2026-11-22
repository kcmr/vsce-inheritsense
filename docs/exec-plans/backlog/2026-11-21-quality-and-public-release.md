# Quality and public-release readiness

Review date: 2026-11-21.
Status: Backlog. TEST-01 through TEST-02, FIX-01 through FIX-04, REF-01 through REF-04, DEP-01 through DEP-05 completed. PERF-01 and DIAG-01 remain pending; FIXTURE-03 is excluded by scope decision.

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

- [x] **DEP-01 · P2 · Review declared ranges and installed versions.**
  **Acceptance:** justified versions, compatible peers, and a consistent lockfile;
  old minimum ranges alone are not evidence of outdated installed packages.
  Completed 2026-11-22 on `chore/dependency-review`; see the
  [focused plan](../completed/2026-11-22-dependency-review.md).
  Per the user's limited scope, reviewed installed metadata and raised four caret
  minima only to existing lock versions: parser/types 7.29.14, TypeScript 6.0.3,
  typescript-eslint 8.73.0. Peers and direct Node requirements are compatible;
  resolved packages/snapshots are byte-identical. No new pins or registry-latest
  upgrade research. The TypeScript-major decision remains DEP-03. Types, 139
  tests, lint, strict complexity, and frozen strict-peer installation pass.

- [x] **DEP-02 · P2 · Remove or justify `@babel/traverse`.**
  It is a production dependency without imports in `src`.
  **Acceptance:** remove it if unused, or justify adopting it for AST traversal;
  verify types, lint, and resolution behavior.
  Completed 2026-11-22 on `chore/remove-unused-babel-traverse`; see the
  [focused plan](../completed/2026-11-22-remove-unused-babel-traverse.md).
  Removed the unused direct dependency and 11 unneeded transitive packages.
  All 243 retained lockfile package/snapshot records are unchanged. Types,
  139 tests (no TODOs), lint, strict source complexity, frozen offline installation,
  and compiled parser loading pass. Node and remaining package versions stay unchanged.

- [x] **DEP-03 · P2 · Evaluate the TypeScript major upgrade.**
  The lockfile contains `6.0.3`. During the review, the
  [official registry](https://registry.npmjs.org/typescript/latest) returned
  `7.0.2` as `latest`. This is a dated observation, not a migration requirement.
  **Acceptance:** review configuration and tooling compatibility, document the
  decision, and verify the selected version.
  Completed 2026-11-22 on `chore/typescript-major-evaluation`; see the
  [focused evaluation](../completed/2026-11-22-typescript-major-evaluation.md).
  Retain TypeScript 6.0.3 and the existing `^6.0.3` range. Official registry
  metadata still reports 7.0.2, but installed typescript-eslint 8.73.0 and its
  [official support policy](https://typescript-eslint.io/users/dependency-versions/)
  support only `>=4.8.4 <6.1.0`. FIX-04's native-definition test helper also
  depends on the classic compiler/language-service API. Current Node16/ES2022
  configuration needs no change for the selected version. Types, 139 tests,
  lint, strict complexity, and frozen lockfile-only strict-peer checks pass.
  Full offline installation could not complete because a tarball was absent
  from the sandbox-local store; no dependency/configuration changes were made.
  Revisit when both lint tooling and API-dependent tests support the replacement;
  a newer major alone does not justify a second compiler toolchain.

- [x] **DEP-04 · P1 · Align VS Code types with the minimum supported version.**
  `engines.vscode` supports `^1.95.0`; `@types/vscode` declares `^1.95.0` but
  resolves to `1.146.0`, allowing compilation against newer APIs.
  **Acceptance:** establish a type/version policy that prevents unsupported API
  usage and verify the minimum supported VS Code environment.
  Completed 2026-11-22 on `chore/vscode-api-compatibility`; see the
  [completed plan](../completed/2026-11-22-vscode-api-compatibility.md) and
  [compatibility policy](../../vscode-compatibility.md). Types are pinned to
  1.95.0 and a manifest/installed-version guard is enforced. Compilation, 128
  development-runtime tests, 116 tests on the minimum editor's embedded runtime,
  lint, complexity, and frozen offline installation pass. The user confirmed
  operation in the isolated VS Code 1.95.0. Duplicate native/extension definition
  destinations also occur in the current editor and are tracked as FIX-04.

- [x] **DEP-05 · P2 · Align Node types and runtime support.**
  `@types/node` is `26.6.6`; `engines.node` supports Node 24 onward. Also review
  the minimum VS Code extension-host runtime, which is independent of the Node
  version used for development or packaging.
  **Acceptance:** type definitions and runtime APIs match supported environments.
  Completed 2026-11-22 on `chore/node-runtime-compatibility`; see the
  [internal audit](../completed/2026-11-22-node-runtime-compatibility.md).
  Keep the current Node 26.13.1, Node 26 types, and development minimum >=24.
  Production source passes a temporary Node 20 type-surface check; actual Node
  APIs pass on 20.18.0/24.0.0/26.13.1; all 139 tests pass on isolated Node 24.0.0.
  No project dependency/configuration or permanent verification code changes.
  The newer development types are not a permanent minimum-runtime API ceiling;
  future production Node API changes require another internal check.

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

- [x] **REF-03 · P2 · Bring remaining legacy functions within complexity 15.**
  Split responsibilities in import/export extraction, assignment and injector
  recognition, and hover JSDoc extraction/formatting. REF-02 already brought the
  new AST/member modules within the limit; this task covers the remaining legacy
  functions rather than creating another complexity workstream.
  **Acceptance:** every function in `src/` has ESLint cyclomatic complexity at
  most 15, with no suppressions or raised limits; preserve behavior with relevant
  parser/resolver coverage and extension-host tests when changing provider behavior.
  Run types, tests, normal lint, and a strict complexity check over `src/`.
  **Policy:** new/extracted/relocated functions must already meet the limit; see
  [agent instructions](../../../AGENTS.md). All source functions now meet the limit.

  Historical baseline after REF-02 (2026-11-22): `pnpm lint` passed with
  6 complexity warnings and no errors.

  | Location under `src/` | Function | Complexity |
  | --- | --- | ---: |
  | `parser/symbols.ts` | `extractFileSymbols` | 50 |
  | `parser/symbols.ts` | `collectDynamicBagInjectionMembers` callback | 26 |
  | `providers/memberOriginHoverProvider.ts` | `appendFormattedJsDoc` | 23 |
  | `parser/symbols.ts` | `collectFunctionInjectionMeta` callback | 20 |
  | `providers/memberOriginHoverProvider.ts` | `getOriginJsDoc` | 17 |
  | `parser/symbols.ts` | `collectInjectedMembersFromStatement` | 16 |

  Completed on 2026-11-22 in
  [the focused plan](../completed/2026-11-22-legacy-complexity.md).
  Module binding extraction and injector recognition now use focused helpers;
  hover JSDoc processing is isolated with golden output coverage. Types, lint
  (zero warnings), strict source complexity, and all 113 tests pass (no TODOs).
  Before/after extraction matched for 502 fixture/mode results.

  Metrics identify review candidates; they do not replace readability assessment.

- [x] **REF-04 · P2 · Share VS Code integration helpers.**
  Providers repeat JavaScript selectors, file-extension checks, and resolution
  setup. Hover and definition repeat symbol extraction. Three relative-path
  helpers exist; Quick Pick always uses the first workspace folder.
  **Acceptance:** share common behavior and resolve paths against the appropriate
  workspace root, including multi-root workspaces and external files.
  Completed 2026-11-22 on `refactor/vscode-integration-helpers`; see the
  [completed plan](../completed/2026-11-22-vscode-integration-helpers.md).
  Shared helpers and 127 passing Node tests cover integration contracts. A real
  host failure exposed missing resource scopes; both settings now support folder
  overrides. Types, lint, and strict complexity pass. The user confirmed manual
  multi-root/external paths, navigation/cancellation, hover/completion, and modes.
  The automated host suite is retained but has no passing post-correction run;
  manual host verification is recorded separately.

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

- [x] **FIX-04 · P2 · Avoid duplicate native and extension definition targets.**
  User reproduced two Cmd/Ctrl+Click destinations for one inherited method in
  both VS Code 1.95.0 and the current debug host. The native provider targets the
  identifier range; InheritSense targets column zero with an empty range.
  **Acceptance:** show one equivalent destination while preserving different
  declarations (including in the same file) and extension-only factory/mixin/
  injector navigation. See the [completed plan](../completed/2026-11-22-duplicate-definition-targets.md)
  for the fixture, reproduced ranges, and native-coexistence coverage.
  Completed 2026-11-22 on `fix/duplicate-definitions`: opt-in key ranges and a
  guarded public-provider query preserve distinct sites and extension fallbacks.
  139 Node tests and 122 minimum embedded-runtime tests pass; types, lint, and
  complexity pass. The user confirmed the current-editor correction; minimum UI
  and automated host reruns were deferred and are not claimed.

- [ ] **PERF-01 · P2 · Avoid repeated reads and parsing.**
  Resolution performs synchronous reads and repeated extraction per request.
  Hover, definition, and completion callbacks do not consume VS Code's
  `CancellationToken`; the resolver has no cancellation input. Hover's line
  cache lasts for one hover only.
  Review 2026-11-22: REF-04 verified Esc dismissing Trace's Quick Pick without
  navigation (Node tests and user-confirmed editor checks), not cancellation of
  provider analysis. FIX-04's pending-query guard prevents recursive native
  definition queries; it does not cancel them. Provider cancellation remains
  unimplemented. Synchronous work also blocks delivery of new cancellation
  events; meaningful interruption needs yielding/asynchronous boundaries rather
  than token checks only at the end.
  **Acceptance:** measure before/after, reuse analysis with correct invalidation,
  account for unsaved open documents, avoid stale results, and honor cancellation.

- [ ] **DIAG-01 · P2 · Make provider failures diagnosable.**
  Hover, definition, and completion catch all exceptions and return `undefined`,
  hiding the difference between missing results and internal failures.
  **Acceptance:** useful diagnostics without repetitive notifications while
  editing; preserve tolerance for incomplete JavaScript.
  Clarification 2026-11-22: distinguish a normal empty lookup from an unexpected
  parser/resolver, file-access, rendering, or native-provider query failure.
  A possible implementation is a disposable Output/Log channel recording the
  provider, file/request context, and error/stack, with repeated failures deduplicated
  or throttled. Expected incomplete-source parse errors should remain quiet or
  trace-level; no-match results and cancellation are not internal failures.
  Keep existing safe fallbacks, including extension definitions when the native
  query fails. Include asynchronous failures in the diagnostic boundary: the
  definition callback currently returns `omitNativeDefinitions` without awaiting
  it, so its synchronous catch does not cover arbitrary promise rejections;
  the helper separately catches native-query failures. This is clarification,
  not an implemented diagnostic design or evidence of a new reproduced bug.

### Fixture contracts

- **FIXTURE-03 · P1 · Fix misleading example contracts — Cancelled / excluded.**
  `dedupingMixin` only wraps a factory and does not deduplicate. The overview
  explicitly documents this simplification.
  Scope decision 2026-11-22: do not implement deduplication or rename
  `dedupingMixin`. Keep the explicit simplification documented in the overview.
  This item is excluded from release acceptance, not completed or verified as a
  deduplicating helper.

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
3. Review remaining dependency and runtime compatibility items in independent changes.
4. Measure performance, improve diagnostics, and update documentation.

FIXTURE-03 is excluded from the agreed scope.

## Overall acceptance criteria

- ~~Fixture helper contracts are explicit and verified.~~ Excluded for
  `dedupingMixin` by the 2026-11-22 scope decision (FIXTURE-03); the documented
  simplification is retained without claiming deduplication verification.
- [x] Recorded resolution failures are reproduced and fixed with regression tests.
- [x] Individual lookup and catalog use consistent, verified resolution rules.
- [x] Dependencies are justified and compatible with supported environments.
  DEP-01/02 justify the graph, DEP-03 retains the supported compiler, and
  DEP-04/05 record minimum API/runtime compatibility and maintenance limits.
- [x] Types, lint, and relevant tests pass; remaining limitations are documented.
  DEP-03 reran all 139 Node tests (no TODOs), types, lint, and strict complexity.
  REF-04/FIX-04 distinguish user editor checks from the unrun post-correction
  automated host suite and deferred minimum-editor UI rerun; these are not
  claimed as passing. PERF-01/DIAG-01 remain open work.
- [x] Closed tasks include evidence, a completion date, and a change reference.
  Completed plans and register entries supply dated verification plus their
  dedicated branch/change references. This does not imply commit or publication
  approval. Cancelled FIXTURE-03 is a scope decision, not a completed change.

## Verification

### Review baseline

- `./node_modules/.bin/tsc --noEmit -p .`: passed.
- `./node_modules/.bin/eslint .`: passed.
- Explicit source audit (complexity limit 15 and nesting depth limit 4, warning severity):
  19 warnings, no errors; rules applied only for this command.
- Automated tests: unavailable.
- Manual extension-host checks: not performed during the review.
- Latest versions of other packages: unverified because registry queries failed.
  Do not classify them as outdated without checking.

### Check side effects

Use `pnpm check:types` and `pnpm lint` for read-only verification. `compile`
writes `dist/`; `package` builds the extension bundle and creates a VSIX without
incrementing the manifest version. Release version selection belongs to
semantic-release. Packaging still writes artifacts and is not a read-only check.

## Decisions

- Keep tasks individually identifiable and verifiable for small implementation changes.
- Do not require a major upgrade solely because a newer version exists.
- DEP-03 retains TypeScript 6.0.3 until lint peers and compiler-API consumers
  support a replacement. Do not add parallel compilers without a measured need.
- FIXTURE-03 is excluded from release scope; preserve its documented simplification.
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
| 2026-11-22 | REF-03 completed | Focused parser/JSDoc helpers; 113 passing tests, no TODOs; types, lint, and strict source complexity pass with zero warnings. |
| 2026-11-22 | TEST-02 completed | Shared on-disk scenarios and debug walkthrough; 104 passing tests, no TODOs; types/lint/complexity checks pass; user confirmed expected debug-mode results. |
| 2026-11-22 | REF-04 completed | Shared VS Code integration helpers and per-origin paths; resource setting scopes; 127 passing Node tests; types/lint/complexity pass; user confirmed manual real-host checks. Automated host suite retained without a passing post-correction run. |
| 2026-11-22 | DEP-04 completed; FIX-04 reproduced | Exact minimum API types and version guard; 128 development/116 embedded-runtime tests pass; user confirmed actual 1.95.0 operation. Native/extension duplicate target ranges reproduced and tracked separately. |
| 2026-11-22 | FIX-04 completed | Precise opt-in declaration ranges and guarded native-provider coexistence; 139 development/122 minimum-runtime tests pass; types/lint/complexity pass; user confirmed current-editor navigation. Fresh minimum UI and automated host reruns deferred. |
| 2026-11-22 | DEP-05 completed | Internal Node API/type audit; retain Node 26/types and >=24 development floor; 139 tests pass on isolated Node 24.0.0. Only execution-plan documentation changes; future API additions require renewed baseline verification. |
| 2026-11-22 | DEP-02 completed | Removed unused @babel/traverse and 11 unneeded transitive packages; all remaining lock entries unchanged; 139 tests, types, lint, strict complexity, and frozen offline installation pass. |
| 2026-11-22 | DEP-01 completed | Brief installed-version/peer review; four caret minima aligned with existing lock versions; resolved graph unchanged; no new pins or Node changes; 139 tests and standard checks pass. |
| 2026-11-22 | DEP-03 completed; acceptance reconciled | Retain TypeScript 6.0.3 for lint/API compatibility; 139 tests and standard checks pass. Completed-plan evidence supports three further overall checkboxes. Provider cancellation remains PERF-01; DIAG-01 clarified; FIXTURE-03 excluded. |
