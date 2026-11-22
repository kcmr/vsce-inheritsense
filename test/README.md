# Tests and extension-host checks

Run `pnpm test` with the project's supported Node version and installed
dependencies. The command compiles current TypeScript sources into `dist/`, then
runs Node's built-in test runner. It does not package the extension or increment
its version, and no VS Code extension host is required.

## Node coverage

- `extraction.test.mjs`: shared class/factory extraction across eight expression
  forms in strict/permissive modes, member kinds and literal keys, source metadata,
  lookup/catalog parity, constructor exclusion, and class/injector deduplication.
- `parser.test.mjs`: member kinds and source locations, constructor/declarative
  fields, strict/permissive discovery, factories, injectors, providers, and JSDoc.
- `resolver.test.mjs`: individual lookup and completion catalogs, origin metadata,
  local-member inclusion, nested composition, imported injectors, reexports,
  cycles, missing members, and missing files.
- `traversal.test.mjs`: shared lookup/catalog contracts for ordering, origin
  metadata, strict/permissive modes, multiple root providers, shadowed origins,
  deduplication, and lazy lookup termination before malformed later branches.
- `integration.test.mjs`: provider registration contracts, cursor symbols, resource
  settings, inherited/local policies, completion source repair, trace selection
  and navigation, and multi-root/external paths. Only the VS Code API boundary is
  doubled; parser/resolver code is real. The synchronous module hook requires the
  supported Node 24+ runtime and is isolated to this test file's worker.
- `import-resolver.test.mjs`: relative files, extensions, directory indexes,
  package entry points, and missing paths.
- `regressions.test.mjs`: enforced FIX-01 lexical `this` scopes and injector calls;
  FIX-02 local ancestry, factories, imported transitions, precedence, cycles, and
  resolution modes; promoted FIX-03 alias reproductions.
- `module-identities.test.mjs`: FIX-03 import/export metadata, alias chains, local
  export lists, named/anonymous defaults, namespace members/reexports, provider
  and injector lookup/catalog agreement, modes, precedence, and cycles. Negative
  coverage rejects unexported symbols, bare namespaces, unrelated same-named local
  declarations, and unsupported nested access/wildcard discovery.

All current tests are enforced; there are no TODO tests. Future known-failure
reproductions may use Node's `todo` option temporarily, but must be reported
separately and promoted when fixed. A passing command with TODO failures does not
establish that the corresponding bugs are fixed.

Tests use the public component fixtures and isolated temporary module graphs.
Temporary files are removed after each test. Node's package resolver canonicalizes
symlinks, so temporary roots are canonicalized for portable path assertions.

The JSDoc suite checks comment extraction and exact Markdown append calls against
golden results captured from the original hover implementation. It covers summary
escaping boundaries, multiline tags, supported tags, and missing/ordinary comments.

The Node integration suite exercises provider callbacks against a VS Code API
boundary double. It does not establish real extension-host registration, editor
behavior, or UI correctness. Use the [extension-host suite](#extension-host-suite)
when changing integration behavior. Keep runtime
composition examples distinct from resolver tests: static analysis may intentionally
accept module graphs that cannot execute, such as cyclic class inheritance.

For a focused run after compilation, use
`node --test test/parser.test.mjs` (or another test file). For the original baseline
without the regression and module-identity test files, run
`node --test test/parser.test.mjs test/resolver.test.mjs test/import-resolver.test.mjs`.

For enforced scope regressions after compilation, run
`node --test --test-name-pattern="FIX-01" test/regressions.test.mjs`.

For local-inheritance regressions after compilation, run
`node --test --test-name-pattern="FIX-02" test/regressions.test.mjs`.

For module-identity coverage after compilation, run
`node --test test/module-identities.test.mjs`.

For resolver traversal contracts after compilation, run
`node --test test/traversal.test.mjs`.

## Shared source fixtures

Parser/resolver source scenarios belong in `test/fixtures/`, not in strings inside
test modules. Isolated JSDoc snippets and their expected Markdown calls are inline
in `jsdoc.test.mjs`; they do not need extension-debugging fixture files.
`fixtureSource(relativePath)` reads a file as text without executing it.
`fixtureGraph(context, relativeDirectory)` copies a whole scenario into a temporary
root and returns a function for resolving its file paths. The copied bytes are the
same sources you open in the editor; assertions remain in the test modules.
Temporary copies preserve isolation and are removed after each test.

Each directory under `fixtures/scenarios/` holds one source file or one complete
module graph, grouped by suite and behavior. Parameterized tests select concrete
fixture variants rather than constructing source strings. Mode-only variants can
share a graph. The unsaved-document regression starts with its saved fixture and
renames `savedMember` in memory, leaving the on-disk fixture unchanged.

The fixture categories have different purposes:

- The existing [sample component](fixtures/components/sample-component.js), core,
  mixin, and base fixtures are executable composition examples. `SampleComponent()`
  returns a class; editor features can be inspected without instantiating it.
- [Static scenarios](fixtures/scenarios/static/) are inputs for source analysis.
  They include inheritance cycles, unsupported module bindings, undeclared names,
  and factories whose inferred shape need not be executable. Open them for editor
  inspection; do not import the whole collection as a runnable application.
- [Malformed scenarios](fixtures/scenarios/malformed/) intentionally contain
  unrecoverable JavaScript. They exercise parse failures and lazy traversal. They
  are separate from the executable examples and ordinary static scenarios.

Scenario sources are excluded from normal application lint because they are data
under test, including invalid syntax and deliberately unresolved names. The test
modules and helpers remain linted. Check complexity in valid scenario source with:

```sh
pnpm exec eslint test/fixtures/scenarios/static --no-config-lookup --rule 'complexity: [error, 15]'
```

The package-main import fixture stores its mock dependency in `package-dependencies/`;
`fixtureGraph` renames that directory to `node_modules/` only in the temporary copy.
It is a path-resolution fixture, not an installed dependency or a direct debug graph.

## Debugging the same scenarios

1. Run `pnpm test` to build the current extension and verify its fixture assertions.
2. In VS Code, select **Run InheritSense** in Run and Debug and press F5. Open this
   repository as a folder in the Extension Development Host, then open an entry
   file from the table below. No fixture needs to be executed to inspect origins.
3. Place the cursor on an inherited member reference inside `inspect()` (or the
   sample component's methods). Use hover, Go to Definition, or the editor context
   menu **InheritSense: Trace Selected Symbol**. The trace command is hidden from
   the Command Palette. Hover intentionally omits local class members.
4. For completion, type `this.` inside that method and invoke suggestions. Inherited
   entries include their owner and file location. Undo the temporary edit afterward.
5. Compare strict mode with the workspace setting
   `inheritSense.resolution.includeMethodAssignedFields` set to `true` in the debug
   host. `inheritSense.completion.enableInheritedSuggestions` must be enabled.
   Restore the setting and source edits when finished.

Paths below are relative to `test/`. The five static entries with `this.member`
references are the same files copied by their automated tests.

| Behavior | Entry file | Member and expected origin |
| --- | --- | --- |
| Nested factories and mixins | [sample-component.js](fixtures/components/sample-component.js) | `loadResource` → `ConfigurableComponent`; `handleEvent` → `eventMixin`; `_resource` appears only in permissive mode. |
| Local grandparent | [local ancestors](fixtures/scenarios/static/regressions/lookup-and-catalog-traverses-all-local-ancestors/subject.js) | `this.execute` → `Root.execute` in the same file. |
| Import and reexport aliases | [alias chain](fixtures/scenarios/static/module-identities/classes/import-and-reexport-alias-chain/subject.js) | `this.execute` → `Root.execute` in `root.js`, through the alias in `barrel.js`. |
| Namespace injector reexport | [namespace injector](fixtures/scenarios/static/module-identities/injectors/namespace-reexport/subject.js) | `this.injected` → `install` in `root.js`, with the runtime-injector note. |
| Precedence, accessors, and modes | [shared traversal](fixtures/scenarios/static/traversal/precedence-and-modes/subject.js) | `execute` → `Base`; `injected` → `install`; `value` → the getter in `Base`; `dynamic` appears only in permissive mode. |
| Unsaved document | [saved source](fixtures/scenarios/static/regressions/local-recursion-uses-the-current-document-source-before-saving/subject.js) | `savedMember` → `Root`. Rename its declaration to `editedMember` without saving, then change the reference: the edited name should resolve from the unsaved document. Undo both edits. |
| Negative module binding | [unexported declaration](fixtures/scenarios/static/module-identities/negative/unexported-declaration/subject.js) | Type `this.execute` inside `inspect()`: InheritSense must return no origin, since `Root` is not exported. |
| Cyclic inheritance | [ancestor cycle](fixtures/scenarios/static/regressions/cycles-ancestors/subject.js) | Type `this.inherited`: resolution should terminate and locate `Root.inherited`. This graph cannot execute. |
| Lazy lookup before parse failure | [early exit](fixtures/scenarios/malformed/traversal/early-exit-declaration/subject.js) | Type `this.execute`: lookup finds `Base.execute` before `broken.js`; a complete catalog reaches the malformed file and fails safely in the provider. |

Native JavaScript navigation or completion can contribute additional results.
Check the InheritSense owner/location or trace result when comparing expectations.
The Node suite verifies resolver outcomes; visual debug-host checks are separate
and must be recorded explicitly in the execution plan.

## Extension-host suite

### Manual verification

1. Run `pnpm test` to compile the current extension and verify the Node suite.
2. Choose **Inspect InheritSense integration** in Run and Debug and press F5.
   It opens [integration.code-workspace](fixtures/scenarios/static/integration/workspace/integration.code-workspace)
   with two folders and stays open for inspection. It does not run automated tests.
3. Check the scenarios below and report the observed results for the active plan.

The workspace sets strict mode globally and permissive mode only in `second`.
Both extension settings declare `resource` scope so folder overrides apply.
The agent does not launch or manipulate the UI; the user performs these checks.

- Trace `this.own` in `second/subject.js`: detail must be `subject.js:3`, with the
  local-member note, rather than `../second/subject.js:3`.
- Trace `this.execute` in that file: detail must be `root.js:3` from `Root` in `first`.
- Trace `this.execute` in `second/external-subject.js`: detail must contain the
  absolute path to `external/root.js:2`, because `external` is not a workspace folder.
- Select a result and verify navigation. Open the picker again and press Esc:
  it must close without changing the current file or cursor position.
- Hover and completion should show the same origin paths. InheritSense omits
  local members from hover and inherited completion. Its `dynamic` completion
  appears in `second/subject.js` (permissive) and not in `first/subject.js` (strict).

### Automated host coverage for maintainers

`test/extension-host/index.cjs` remains a dependency-free entry for an automated
VS Code test runner through `--extensionTestsPath`. It checks workspace-folder
selection, resource settings, registered hover/definition/completion providers,
external origins, and unsaved `this.` completion. Native JavaScript results may
coexist; assertions identify InheritSense output. See VS Code's
[testing guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
and [provider execution commands](https://code.visualstudio.com/api/references/commands).

It is deliberately absent from `launch.json`: automatic test completion closes
the host and is unsuitable for manual inspection. The manual workflow above does
not require running this entry or reading its report.

When invoked by an automated runner, results are persisted to
`.test-results/ref04-extension-host.json`: status, completed checks, and the error
stack on failure. The report is overwritten at startup and excluded from Git and
extension packages. The suite briefly edits `second/subject.js` in memory and
restores its original text in `finally`; it never saves the edit. No user workspace
settings are changed. Report actual automated runs separately from manual results;
passing the Node suite does not establish an automated host pass.
