# FIX-04: Avoid duplicate native and extension definition targets

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22
Source: [Quality register](../backlog/2026-11-21-quality-and-public-release.md), FIX-04

## Goal and scope

When native JavaScript navigation and InheritSense resolve the same declaration,
Cmd/Ctrl+Click should show a single destination. Preserve distinct declarations,
including multiple declarations in the same file, and the factory/mixin/injector
fallbacks that native JavaScript navigation cannot resolve.

## Acceptance criteria

- [x] Direct inherited methods resolved by both providers produce one equivalent destination in automated coverage.
- [x] Different declarations remain separate even when they share a file or line.
- [x] InheritSense-only factories, mixins, and injectors remain navigable in automated coverage.
- [x] Coverage checks precise definition ranges and native-provider coexistence.
- [x] Types, tests, lint, strict complexity, and user-run current-editor checks pass; minimum-runtime evidence and the minimum-UI limitation are recorded.

## Steps

- [x] Record the user reproduction and inspect native versus extension targets.
- [x] Create a dedicated branch and activate this plan before implementation.
- [x] Choose precise declaration ranges and a guarded native-provider query.
- [x] Add regressions, implement the correction, and verify the current editor plus minimum API/runtime compatibility.

## Verification

- User reproduced two destinations for `this.execute` in
  `test/fixtures/scenarios/static/integration/workspace/second/external-subject.js`,
  both in the isolated VS Code 1.95.0 and regular debug host. Both target
  `external/root.js`, where `ExternalRoot.execute` is on line 2.
- A non-UI reproduction used TypeScript 5.6.3 shipped with the verified 1.95.0
  archive and the current definition callback with the real parser/resolver.
  Native target: zero-based line 1, characters 2–9. Extension target: zero-based
  line 1, character 0, with an empty range. File paths match exactly.
- The [1.95.0 references model](https://github.com/microsoft/vscode/blob/1.95.0/src/vs/editor/contrib/gotoSymbol/browser/referencesModel.ts)
  compares URI and range when removing duplicate destinations. Matching only the
  filename in extension code would lose valid distinct declarations.
- Host assertions now require a single matching destination with the exact
  identifier selection, replacing the old column-zero expectation.
- Regression first failed against the old provider (column-zero Position versus
  exact Range), then passed with the correction.
- `pnpm test`: 139 passing, no TODOs. Coverage includes native TypeScript
  context/selection spans, probe reentry/failure, precise declarations, import/
  reexport traversal, unsaved source, same-line sites, and injector/factory fallbacks.
- User confirmed the fix works in their current VS Code: `this.execute` has one
  destination and extension-only `this.injected` navigation still works.
- `pnpm exec tsc --noEmit -p .`: passed against the pinned 1.95.0 API types.
- `pnpm lint`: passed with zero warnings/errors.
- `pnpm exec eslint src test/definition-ranges.test.mjs test/integration.test.mjs test/support test/extension-host --rule 'complexity: [error, 15]'`: passed.
- `pnpm exec eslint test/fixtures/scenarios/static --no-config-lookup --rule 'complexity: [error, 15]'`: passed.
- Host suite syntax check passed; it is updated for a single equivalent destination
  but has not been run as an automated editor suite after this correction.
- Console-only tests with the 1.95.0 editor's Node 20.18.0: 122 passing, no TODOs
  (all suites except the development-Node integration boundary suite).
- A separate native probe using TypeScript 5.6.3 from the 1.95.0 archive confirmed
  the new callback omits its outer equivalent result, retains the native target,
  and issues exactly one guarded query. No UI was launched by the agent.
- The user chose to test their current VS Code; a fresh 1.95.0 UI run is deferred
  and is not claimed. This limitation remains separate from API/runtime evidence.
- Closure documentation checks: 42 local links resolve, `git diff --check`
  passes, and no active plans remain after moving this plan to `completed/`.

## Implementation direction

- Carry exact declaration key ranges from Babel through resolution when requested
  by the definition provider. Keep the normal parser/resolver payload unchanged
  unless `includeMemberRanges` is enabled.
- Return full key ranges, not just starting columns. The native provider also
  returns a larger context range; exact identifier ranges alone do not cover all
  aggregation orders in VS Code's references model.
- Query the public `vscode.executeDefinitionProvider` command with a request-key
  reentry guard. Nested callbacks contribute precise Locations without querying
  again. Omit an outer extension result only when another provider explicitly
  selects that same file and full identifier range. On query failure, retain all
  extension fallbacks. Do not cache native results across requests.
- Preserve a line-position fallback if a source location is unavailable. Keep
  current traversal/precedence, strict/permissive policies, and distinct origins.
- Branch `fix/duplicate-definitions` is based on the approved DEP-04 commit
  `fd0c3ca`; no merge into `main` is performed here.

## Decisions and blockers

- The user prefers verifying this correction in their current VS Code. Keep
  minimum API/compiler and embedded-runtime checks, and disclose that a fresh
  1.95.0 UI run is not available for this correction.
- This affects both editor versions and predates the DEP-04 type pin. Keep the
  behavioral correction separate from the API compatibility change.
- Ranges cover the already-recognized literal keys, accessors, assignments, and
  multiple same-line sites. Unsupported computed-name inference stays unchanged;
  no filename-only deduplication is used.

## Critical self-review

One pass inspected the complete tracked diff and all new files, including range
propagation, opt-in payload compatibility, member/origin identity, native context
versus selection semantics, reentry, fallback/error cleanup, unsaved source,
minimum API usage, fixtures, host assertions, generated artifacts, and links.
Strengthened the native-filter test to cover two real declarations on the same
file line, proving that only the equivalent declaration is removed. Full tests
and strict lint passed afterward. No unresolved code findings. The post-fix
minimum-editor UI rerun and automated host suite remain unperformed as documented.

Proposed commit: `fix(definition): avoid duplicate native navigation targets`.
Scope: declaration ranges and resolver propagation, guarded definition-provider
coexistence, regression/host coverage and fixtures, and FIX-04 documentation.
Await manual review and explicit approval before staging or committing.

## Next step

None. Await manual diff review and explicit commit approval. Reuse the recorded
critical review; do not start another autonomous pass.

## Final result

Completed FIX-04 on `fix/duplicate-definitions`: exact opt-in declaration ranges
and a guarded provider query remove equivalent native destinations while
retaining distinct origins and injector/factory fallback navigation. The user
confirmed the corrected UI in their current editor. All 139 development-runtime
tests, 122 minimum embedded-runtime tests, types, lint, and strict complexity pass.
Minimum 1.95.0 UI and automated host reruns remain explicit limitations, not
claimed successes. DEP-04 was committed as `fd0c3ca`; this fix is not yet committed,
merged, or pushed.
