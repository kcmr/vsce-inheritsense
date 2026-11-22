# README, license, and package metadata

Status: Completed
Created: 2026-11-22
Completed: 2026-11-22

## Goal and scope

Prepare `README.md`, `LICENSE`, and the descriptive metadata in `package.json`
for InheritSense. These three files are the entire implementation scope.

Use the supplied [icon](../../../images/icon.png) in package metadata. Keep the
asset unchanged; README presentation follows the owner's edits.

## Inputs

- Product name: `InheritSense`; extension identifier: `inheritsense`.
- Repository URL for metadata: `https://github.com/kcmr/vsce-inheritsense`.
- Author/copyright holder: Kus Cámara. Intended Marketplace publisher:
  `kuscamara`, confirmed by the owner on 2026-11-22.
- `package.json` declares MIT; author, repository, bugs, homepage, keywords,
  and icon metadata are absent, and its category is `Other`.
- Supported behavior and settings are described in the
  [extension overview](../../extension-overview.md). Development and debugging
  instructions are in the [test guide](../../../test/README.md).

## Acceptance criteria

- [x] `README.md` explains the problem InheritSense solves, supported JavaScript
  files and factory/mixin patterns, and hover, definition, inherited completion,
  and Trace usage, with a concise and accurate example.
- [x] README includes installation/use instructions, requirements, both settings
  with their defaults, known limitations, issue-reporting links, and license.
  Instructions distinguish end-user requirements from development tooling.
  Trace is documented through the editor context menu, not the hidden Command
  Palette entry. Links and claims describe actual supported behavior.
- [x] Package metadata references `images/icon.png` correctly. README uses only
  existing assets if images are included; no additional assets are required.
- [x] `LICENSE` contains the MIT license and correct copyright attribution;
  README and `package.json` agree on licensing.
- [x] `package.json` describes the author, intended publisher, repository, bugs,
  homepage, keywords, appropriate VS Code category, and icon consistently.
  Any gallery styling is appropriate for the supplied icon.
- [x] Changes in `package.json` are limited to descriptive metadata. Version,
  scripts, engines, dependencies, entry points, activation events, commands,
  and settings remain unchanged.
- [x] Markdown links, image references, JSON syntax, and documentation/manifest
  consistency are verified. No implementation acceptance is inferred merely
  from completing this plan document.

## Steps

- [x] Move this plan to `active/` when implementation starts, repairing its links.
- [x] Confirm publisher identity and inspect the supplied icon and the source
  needed to verify the documented behavior.
- [x] Write README and MIT LICENSE in English with neutral, accurate examples.
- [x] Align descriptive metadata in `package.json`, referencing the existing icon.
- [x] Check links, JSON, settings/command names, defaults, and scope of the diff.
- [x] Review the complete change once, record results, and propose the commit.
  Complete this plan only when all scoped criteria are verified.

## Verification

Verification completed on 2026-11-22:

- JSON parses. Structured comparison with `HEAD:package.json` confirms all
  non-metadata fields are identical, including version, scripts, engines,
  dependencies, entry points, activation events, commands, and settings.
- README command names, setting names/defaults, minimum VS Code version, and
  development Node requirement match the manifest and inspected source.
- Ten local documentation links/image references resolve across README, plan,
  and plan index. Repository URLs use `kcmr/vsce-inheritsense` consistently.
- Supplied icon is a 1024×1024 PNG; SHA-256 remains
  `dba890883c74e1e78db0682171c72e81df5cb3d41bc08a0d49704975427cbfb4`.
- README JavaScript example passes `node --check --input-type=module` via stdin.
  An optional Babel parse attempt could not load the locally unavailable
  `@babel/parser`; the dependency-free Node syntax check passed instead. No
  dependency installation or build was needed for this change.
- Final README shell commands pass syntax checking; `git diff --check` passes.
- Reviewed metadata category, icon, keywords, and gallery fields against the
  [official manifest reference](https://code.visualstudio.com/api/references/extension-manifest).
- Builds, runtime tests, packaging, and editor checks were not run: only
  documentation and descriptive metadata changed. Product behavior is unchanged.
- Implementation scope is README, LICENSE, and package metadata; the plan/index
  are bookkeeping, and the unchanged owner-supplied icon and two demonstration
  images are included so their references resolve in a checkout.

Verification checklist:

- Validate Markdown links and image paths, including their resolution from the
  root README.
- Parse `package.json` and compare its descriptive fields with README and LICENSE.
- Confirm that product-file edits cover only the three scoped files and that
  non-metadata manifest fields are preserved; retain plan bookkeeping and the
  owner-supplied icon as supporting files.
- Run `git diff --check`. Builds, runtime tests, and packaging are unnecessary
  for documentation and descriptive metadata changes.

## Decisions and blockers

- Reuse the existing icon without generating or modifying images.
- Link to existing development documentation instead of creating CONTRIBUTING
  or CHANGELOG files in this task.
- Preserve product behavior and the current build configuration. Packaging,
  versioning, and ignore-rule changes are outside this scope.
- The owner confirmed `kuscamara` as the Marketplace publisher on 2026-11-22.

## Next step

None. The owner approved completion and creating the scoped commit on 2026-11-22.

## Final result

Completed README, MIT LICENSE, and descriptive package metadata. The confirmed
publisher is `kuscamara`; author is Kus Cámara; repository/support links,
keywords, Programming Languages category, supplied icon, and dark gallery banner
are set. README covers usage, configuration, limits, Marketplace/local VSIX installation, and
development. No changes to scripts, version, dependencies, or runtime behavior.

## Critical self-review

One pass inspected the complete diff and all new files, including README,
LICENSE, metadata, plan bookkeeping, and the supplied icon. Checked scope,
source-backed behavior and defaults, metadata compatibility, attribution,
references, and unchanged functional fields. Corrected the VSIX placeholder
command by quoting the path to prevent shell redirection interpretation. The
corrected command passes shell syntax checking. No unresolved in-scope findings.

Manual-review follow-up on 2026-11-22: preserved the owner's README wording,
removed README icon, and additional package keywords. Made Marketplace
installation primary using `kuscamara.inheritsense`. At the owner's request,
the alternative VSIX instructions are brief: clone, build locally with Node.js
and pnpm, then use Install from VSIX. Build commands are omitted to avoid
coupling the README to scripts that may change. Link targets and unchanged
package contents were checked; no packaging or installation was performed.
The Marketplace listing's availability is not verified. Reused the existing
critical review for these requested corrections and their checks.

Proposed commit: `docs: add README, license, and extension metadata`.
Scope: README, LICENSE, descriptive package metadata, owner-supplied icon and
screenshots, completed execution plan, and plan index. The owner approved
completion and creating this commit on 2026-11-22.

Final manual-review correction: the owner replaced the two screenshot HTML tags
with Markdown images. Both local image targets exist and have nonempty alt text.
Preserved that syntax and the final README wording. Final link, JSON,
non-metadata manifest comparison, shell syntax, and whitespace checks pass.
No live GitHub/Marketplace rendering or packaging run is claimed.
