# Parser and resolver tests

Run `pnpm test` with the project's supported Node version and installed
dependencies. The command compiles current TypeScript sources into `dist/`, then
runs Node's built-in test runner. It does not package the extension or increment
its version, and no VS Code extension host is required.

## Coverage

- `parser.test.mjs`: member kinds and source locations, constructor/declarative
  fields, strict/permissive discovery, factories, injectors, providers, and JSDoc.
- `resolver.test.mjs`: individual lookup and completion catalogs, origin metadata,
  local-member inclusion, nested composition, imported injectors, reexports,
  cycles, missing members, and missing files.
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

These tests cover the shared resolution APIs, not VS Code provider registration,
hover formatting, cursor-context detection, cancellation, or extension-host UX.
Add extension-host integration tests when changing those behaviors. Keep runtime
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
