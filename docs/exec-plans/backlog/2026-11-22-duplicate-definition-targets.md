# FIX-04: Avoid duplicate native and extension definition targets

Status: Backlog
Created: 2026-11-22
Completed: —
Source: [Quality register](2026-11-21-quality-and-public-release.md), FIX-04

## Goal and scope

When native JavaScript navigation and InheritSense resolve the same declaration,
Cmd/Ctrl+Click should show a single destination. Preserve distinct declarations,
including multiple declarations in the same file, and the factory/mixin/injector
fallbacks that native JavaScript navigation cannot resolve.

## Acceptance criteria

- [ ] Direct inherited methods resolved by both providers produce one equivalent destination.
- [ ] Different declarations remain separate even when they share a file or line.
- [ ] InheritSense-only factories, mixins, and injectors remain navigable.
- [ ] Coverage checks precise definition ranges and native-provider coexistence.
- [ ] Types, tests, lint, strict complexity, and user-run minimum/current editor checks pass.

## Steps

- [x] Record the user reproduction and inspect native versus extension targets.
- [ ] Create a dedicated branch and activate this plan before implementation.
- [ ] Choose precise declaration ranges or another safe coexistence mechanism.
- [ ] Add regressions, implement the correction, and verify both editor versions.

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
- Existing host assertions explicitly accept the extension's column-zero result;
  update those assertions when precise/coalesced navigation is implemented.
- No correction has been implemented and no passing deduplication result is claimed.

## Decisions and blockers

- This affects both editor versions and predates the DEP-04 type pin. Keep the
  behavioral correction separate from the API compatibility change.
- Inspect computed keys, accessors, assignments, and multiple members on one line
  before choosing range extraction; avoid a filename-only deduplication heuristic.

## Next step

After the DEP-04 handoff, create `fix/duplicate-definitions` and activate this plan.

## Final result

Pending.
