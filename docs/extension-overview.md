# InheritSense: Extension Overview

Scope, behavior, settings, architecture, and current development priorities.

## 1. Purpose

Build and maintain a VS Code extension that identifies where a class member (method, getter, setter, or field) is defined when default navigation does not fully resolve factory-based inheritance and mixin composition.

Target patterns include:

- class extends a factory call: `class X extends ConfigurableComponent(superClass)`
- nested mixin composition: `class X extends mixinA(mixinB(superClass))`
- exported factories returning classes: `export const ConfigurableComponent = dedupingMixin(superClass => class extends eventMixin(ComponentCore(superClass)) {})`

The extension should answer:

- Is this member defined locally?
- Is it inherited from a base class?
- Is it injected by a mixin?
- Where is the origin file and line?

## 2. Current scope and status

Implemented:

- Command `InheritSense: Trace Selected Symbol`
- JavaScript support: `.js`, `.mjs`, `.cjs`
- Member origin resolution for methods, getters, setters, and fields
- Resolution of direct and nested provider chains across local imports
- Multi-level local-class inheritance, with cycle guards and nearest-first origins
- Named import/reexport aliases, local export lists, default exports, and namespace
  members (`ns.Root`, `ns.default`) for providers and injector calls
- Quick Pick result list with navigation to selected origin
- Hover provider showing inherited origins (local class members are filtered out in hover)
- Definition provider enabling Cmd/Ctrl+Click navigation to inherited origins
- Completion provider for `this.` suggesting inherited members
- Completion documentation includes owner class/mixin and file:line
- JSDoc extraction and formatted rendering in hover
- Configurable permissive mode for method-assigned fields

Out of scope (still pending):

- TypeScript type-level inference
- Full module resolution parity with bundlers/tsconfig paths/package exports
- Wildcard export discovery (`export * from`), nested/computed namespace access,
  arbitrary default-object properties, and CommonJS export inference
- Runtime-only injected members
- CodeLens decorations
- Workspace-level AST cache/invalidation

## 3. User-facing behaviors

### 3.1 Command

- Context menu command: `InheritSense: Trace Selected Symbol`
- Command is intentionally hidden from Command Palette in current UX
- Resolves symbol under cursor/selection and opens selected origin from Quick Pick

### 3.2 Hover

- Hover appears for inherited/injected members
- Includes origin metadata, optional JSDoc summary/tags, and syntax-highlighted snippet
- Local class members are omitted in extension hover to avoid overlap with native editor navigation

### 3.3 Go to definition

- Cmd/Ctrl+Click resolves inherited origins using the extension resolver

### 3.4 Completion

- On `this.` context, inherited members are suggested
- Each suggestion tooltip includes origin owner and location
- Feature is configurable by settings

## 4. Settings

- `inheritSense.completion.enableInheritedSuggestions` (default: `true`)
  - Enables/disables inherited completion suggestions on `this.`

- `inheritSense.resolution.includeMethodAssignedFields` (default: `false`)
  - Permissive mode.
  - When enabled, assignments like `this.someField = ...` inside non-constructor methods are treated as field declarations for origin/completion resolution.
  - This improves discoverability in dynamic code, with a trade-off in strictness/precision.

## 5. Architecture and modules

- `src/commands/traceMemberOrigin.ts`
  - command entrypoint and Quick Pick navigation

- `src/parser/ast.ts`
  - Babel parsing

- `src/parser/astHelpers.ts`
  - shared class discovery, provider references, and prunable AST traversal
  - lexical-this traversal wraps the generic walker with scope boundaries
  - receiver-identifier injector analysis uses the generic walker across nested
    functions, where identifiers can be captured; binding/shadowing inference is deferred

- `src/parser/members.ts`
  - shared class member names, kinds, declarations, and deduplication
  - class assignments remain fields; function-valued injector assignments are methods
  - classes retain the first member per name/kind; injectors retain distinct lines

- `src/parser/symbols.ts`
  - imports/classes/member extraction
  - includes support for:
    - class members
    - `static get properties()` keys
    - constructor-assigned fields (`this.x = ...`)
    - optional permissive extraction from non-constructor methods
    - separate import/export identities, including defaults and namespace reexports

- `src/resolver/inheritanceResolver.ts`
  - provider chain extraction from extends expressions

- `src/resolver/importResolver.ts`
  - local relative import path resolution

- `src/resolver/moduleBindings.ts`
  - translates local/exported identities and namespace qualifiers at module edges
  - preserves declared origin names; anonymous default owners are named `default`

- `src/resolver/memberResolver.ts`
  - origin resolution for a specific member
  - inherited member catalog for completion
  - shared lazy traversal through providers, injectors, imports, and reexports;
    lookup stops at the first match within each root provider, while catalogs
    retain all origins in traversal order
  - both APIs consume parser member declarations; constructors are excluded

- `src/providers/memberOriginHoverProvider.ts`
  - inherited origin hover UI

- `src/providers/memberOriginDefinitionProvider.ts`
  - definition navigation to resolved origins

- `src/providers/memberOriginCompletionProvider.ts`
  - inherited completion suggestions on `this.`

- `src/config/settings.ts`
  - typed accessors for extension settings

## 6. Acceptance criteria (updated)

1. Extension activates and resolves origins in supported JavaScript files.
2. Command returns one or more origins or a safe, clear fallback message.
3. Hover/definition/completion features work for inherited/mixin members.
4. Resolver handles common local factory/mixin chains without crashes.
5. Behavior is configurable via extension settings for completion and permissive resolution.

## 7. Fixtures for reproducibility and debugging

Minimal component fixtures have no external project dependencies. They use a
core factory, an event-handling mixin, a configurable component factory, and a
sample component factory. `SampleComponent()` returns an instantiable class;
an optional superclass can be supplied to preserve custom base behavior.

Fixture files:

- `test/fixtures/utils/deduping-mixin.js`
- `test/fixtures/core/component-core.js`
- `test/fixtures/mixins/event-mixin.js`
- `test/fixtures/base/configurable-component.js`
- `test/fixtures/components/sample-component.js`

These fixtures cover:

- mixin-injected method (`handleEvent`) with JSDoc
- core-factory method (`emitSignal`)
- static property declarations (`isEnabled`, `needsRefresh`)
- constructor-initialized fields (`_taskState`, `needsRefresh`) in strict mode
- method-assigned fields (`_label`, `_lastEvent`) in permissive mode
- asynchronous loading (`loadResource`) with a promise-assigned `_resource` field
- factory-returned classes, nested composition, getters, and inherited member usage

`deduping-mixin.js` is a simplified fixture wrapper: it applies the supplied
factory without caching or deduplication. It is not a production implementation.
Its contract follow-up remains in the
[quality register](exec-plans/backlog/2026-11-21-quality-and-public-release.md).

Additional parser/resolver scenarios now live under `test/fixtures/scenarios/`.
Tests read the same files that can be opened in the Extension Development Host;
see [shared fixture categories and debug walkthrough](../test/README.md#shared-source-fixtures).
Static-only and malformed inputs are separated from the executable component examples.

## 8. Development plan (next steps)

Parser/resolver tests and strict/permissive coverage run with `pnpm test`;
see [test instructions and coverage](../test/README.md). The five recorded
correctness reproductions (FIX-01 through FIX-03) are now enforced regressions;
there are no remaining TODO tests.

1. Reduce parser and hover function complexity (REF-03 in the quality register).
2. Add hover/definition/completion extension-host tests when changing provider behavior.
3. Improve confidence scoring with explicit strict/permissive markers.
4. Add optional cache invalidation for repeated parsing and workspace-size scalability.

## 9. Related documentation

- [Agent instructions](../AGENTS.md)
- [Execution-plan workflow](agent-harness/workflows.md)
- [Quality register](exec-plans/backlog/2026-11-21-quality-and-public-release.md)
