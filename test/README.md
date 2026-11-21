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
- `regressions.test.mjs`: executable TODO reproductions linked to FIX-01 through
  FIX-03 in the [quality register](../docs/exec-plans/backlog/2026-11-21-quality-and-public-release.md).

TODO tests run assertions for the intended behavior and currently fail as
expected. Node reports them separately and excludes them from the passing test
count; they do not make the command fail. When implementing a corresponding
fix, remove its `todo` option so that these assertions become enforced regression
coverage. Do not mark a bug fixed merely because the overall test command succeeds.

Tests use the public component fixtures and isolated temporary module graphs.
Temporary files are removed after each test. Node's package resolver canonicalizes
symlinks, so temporary roots are canonicalized for portable path assertions.

These tests cover the shared resolution APIs, not VS Code provider registration,
hover formatting, cursor-context detection, cancellation, or extension-host UX.
Add extension-host integration tests when changing those behaviors. Keep runtime
composition examples distinct from resolver tests: static analysis may intentionally
accept module graphs that cannot execute, such as cyclic class inheritance.

For a focused run after compilation, use
`node --test test/parser.test.mjs` (or another test file). For the baseline
without known-failure reports, run
`node --test test/parser.test.mjs test/resolver.test.mjs test/import-resolver.test.mjs`.
