# Quality and public-release readiness

Review date: 2026-11-21.
Status: Backlog. Review complete; implementation pending.

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
- `test/fixtures/`: reproduction examples; no automated tests yet.
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

- [ ] **REF-01 · P2 · Share resolver traversal logic.**
  `src/resolver/memberResolver.ts` has parallel `find…` and `collect…` families
  for file/class injectors, providers, and imported members.
  **Acceptance:** share traversal while preserving early exit, precedence, and
  cycle detection; compare individual lookup and catalog behavior on shared cases.

- [ ] **REF-02 · P2 · Consolidate AST helpers and member extraction.**
  `findClassFromExpression` is nearly duplicated between parser and resolver.
  Expression-to-`ProviderRef` conversion is repeated in parser and inheritance
  resolution. `symbols.ts` has two similar recursive walkers and repeated name,
  kind, and deduplication logic. The resolver's initializer-member extraction
  uses partially different rules from the parser.
  **Acceptance:** share equivalent behavior, document intentional differences,
  and preserve getters, setters, fields, literal keys, and strict/permissive modes.

- [ ] **REF-03 · P2 · Split functions with high complexity.**
  Separate imports/exports, explicit members, declarative properties,
  assignments, and injector recognition. Review hover JSDoc extraction/formatting.
  **Acceptance:** reduce responsibilities, branches, and nesting with behavior
  coverage; decide whether to enforce complexity limits in ESLint.

  Baseline using `complexity: [warn, 15]` and `max-depth: [warn, 4]`:

  | Location under `src/` | Function | Complexity |
  | --- | --- | ---: |
  | `parser/symbols.ts` | `toMemberDeclarations` | 48 |
  | `parser/symbols.ts` | `extractFileSymbols` | 38 |
  | `parser/symbols.ts` | `collectDynamicBagInjectionMembers` callback | 26 |
  | `providers/memberOriginHoverProvider.ts` | `appendFormattedJsDoc` | 23 |
  | `parser/symbols.ts` | `collectFunctionInjectionMeta` callback | 22 |
  | `parser/symbols.ts` | `visit` | 19 |
  | `parser/symbols.ts` | `collectInjectedMembersFromStatement` | 18 |
  | `resolver/memberResolver.ts` | `findClassFromExpression` | 18 |
  | `parser/symbols.ts` | `collectBagMembers` | 17 |
  | `parser/symbols.ts` | `findClassFromExpression` | 17 |
  | `providers/memberOriginHoverProvider.ts` | `getOriginJsDoc` | 17 |

  Total: 19 warnings, including nesting up to six levels. Metrics identify
  review candidates; they do not replace readability assessment.

- [ ] **REF-04 · P2 · Share VS Code integration helpers.**
  Providers repeat JavaScript selectors, file-extension checks, and resolution
  setup. Hover and definition repeat symbol extraction. Three relative-path
  helpers exist; Quick Pick always uses the first workspace folder.
  **Acceptance:** share common behavior and resolve paths against the appropriate
  workspace root, including multi-root workspaces and external files.

### Correctness, performance, and diagnostics

- [ ] **FIX-01 · P1 · Respect scopes when collecting assignments.**
  `collectThisAssignedFieldsFromNode` enters nested functions/classes without
  distinguishing the owner of `this`. Review injector/call detection similarly.
  **Acceptance:** reproduce and prevent incorrect attribution; distinguish arrow
  functions with lexical `this` from functions/classes with separate contexts.

- [ ] **FIX-02 · P1 · Traverse local-class inheritance.**
  Local-class branches in `resolveMemberOrigins`, `resolveInheritedMemberCatalog`,
  and provider helpers do not continue through superclasses like imported-class
  branches do.
  **Acceptance:** reproduce and resolve `C extends B`, `B extends A` locally,
  exposing `A` members through lookup and catalog; cover cycles and precedence.

- [ ] **FIX-03 · P1 · Preserve import and reexport identities.**
  `FileSymbols.imports` retains local names and paths but loses original imported
  names. Aliases can cause lookup of names that do not exist in the target file.
  **Acceptance:** cover renamed imports and aliased reexports; define and verify
  default-import and namespace-import behavior.

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

- [ ] **TEST-01 · P1 · Turn fixtures into reproducible tests.**
  There is no automated suite or `test` script.
  **Acceptance:** parser/resolver tests cover strict/permissive modes,
  composition, injectors, and FIX-01 through FIX-03 regressions. Add extension-host
  integration checks for hover, definition, and completion where needed.

## Proposed execution order

1. Review the wrapper contract separately (FIXTURE-03).
2. Add characterization tests and failure reproductions.
3. Fix scope handling, local inheritance, and import identity.
4. Share traversal/extraction and reduce complexity and UI duplication.
5. Review dependency and runtime compatibility in independent changes.
6. Measure performance, improve diagnostics, and update documentation.

## Overall acceptance criteria

- [ ] Fixture helper contracts are explicit and verified.
- [ ] Recorded resolution failures are reproduced and fixed with regression tests.
- [ ] Individual lookup and catalog use consistent, verified resolution rules.
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
