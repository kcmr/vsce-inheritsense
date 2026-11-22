# VS Code API compatibility

## Version policy

`package.json` declares the supported editor range with `engines.vscode` and a
caret range such as `^1.95.0`. Pin `devDependencies.@types/vscode` to that exact
minimum (`1.95.0`, without a range prefix), and commit the matching lockfile.
This keeps compilation against APIs available to the oldest supported editor.
VS Code documents the installation range in its
[compatibility guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#visual-studio-code-compatibility).

`test/vscode-compatibility.test.mjs`, included in `pnpm test`, checks the manifest
range policy, exact type declaration, and installed type version. A newer type
package must not be installed independently of an intentional minimum-version
change. The version checks complement compilation; they do not prove runtime or
editor behavior.

When changing the minimum:

1. Update `engines.vscode` and the exact `@types/vscode` version together.
2. Run pnpm to update the lockfile, preserving unrelated dependency versions.
3. Run types, tests, lint, and strict source complexity checks.
4. Verify behavior in the new minimum editor using an isolated installation and
   profile, then record the exact version and results in the execution plan.

## API baseline audit

All production source compiles against the published 1.95.0 declarations. The
baseline includes the APIs used for provider registration, document/range access,
Markdown hover/completion content, Quick Pick/navigation, workspace-folder paths,
and resource-scoped configuration. See the official
[1.95.0 declarations](https://github.com/microsoft/vscode/blob/1.95.0/src/vscode-dts/vscode.d.ts).

The manifest's `scope: "resource"` is also supported in the
[1.95.0 configuration contribution schema](https://github.com/microsoft/vscode/blob/1.95.0/src/vs/workbench/api/common/configurationExtensionPoint.ts).
This schema check covers a manifest feature outside TypeScript's API checks.

## Minimum-editor verification

Use an isolated copy of the exact minimum version and separate user-data and
extension directories. Do not replace the regular VS Code installation or reuse
its settings. Launch the development extension with the existing
`test/fixtures/scenarios/static/integration/workspace/integration.code-workspace`.
Use the [manual checks](../test/README.md#manual-verification) for paths, navigation,
cancellation, hover/completion, and strict/permissive modes. The user performs UI
checks; record their results separately from automated checks.

No automatic test launch entry is needed in `launch.json`. The retained
extension-host suite can be used by maintainers, but is not required for this
manual workflow. Compiling against 1.95.0 and passing tests on a current editor
must not be described as a successful 1.95.0 host run.

The development Node version, Node type baseline, production dependency engines,
and editor's embedded runtime are separate concerns tracked under DEP-05 and the
other dependency items in the [quality register](exec-plans/backlog/2026-11-21-quality-and-public-release.md).
