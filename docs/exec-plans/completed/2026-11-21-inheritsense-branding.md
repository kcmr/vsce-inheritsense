# InheritSense branding

Status: Completed
Created: 2026-11-21
Completed: 2026-11-21

## Goal and scope

Use InheritSense consistently in extension metadata, visible UI, command and
configuration namespaces, and documentation. Use `inheritsense` as the package ID.
Keep technical names describing member-origin resolution where they remain accurate.

## Acceptance criteria

- [x] Metadata, visible labels, and documentation use InheritSense.
- [x] Command registration, activation, menus, and configuration access agree.
- [x] Type checking, lint, and compilation pass without changing the version.

## Steps

- [x] Inspect branding references and current workspace changes.
- [x] Update metadata, UI, namespaces, and documentation.
- [x] Verify consistency and regenerate compiled output.

## Verification

- `./node_modules/.bin/tsc --noEmit -p .`: passed.
- `./node_modules/.bin/eslint .`: passed.
- `./node_modules/.bin/tsc -p .`: passed; regenerated ignored build output.
- Consistency checks: metadata, activation, command registration and menus,
  setting keys/access, documentation links, and version `0.0.16` verified.
- Dependencies restored with `pnpm install --frozen-lockfile --ignore-scripts`
  after pnpm attempted automatic installation during verification; no version changes.
- Manual extension-host checks: not run.

## Decisions and blockers

The public package ID is `inheritsense`; commands and settings use `inheritSense`.
No dependency or resolver behavior changes are included.

## Next step

None.

## Final result

InheritSense branding is applied to the package, command label, configuration
title, hover, Quick Pick, support message, and documentation. Command and setting
namespaces consistently use `inheritSense`. Existing local settings or keybindings
using the previous namespace must be updated. Technical member-origin types,
functions, and source filenames retain their descriptive names.
