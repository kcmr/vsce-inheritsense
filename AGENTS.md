# Agent instructions

## Start every task

1. Read [the plan workflow](docs/agent-harness/workflows.md).
2. List `docs/exec-plans/active/` and read each active plan before changing files.
   Follow the relevant plan's scope, acceptance criteria, decisions, and next step.
3. Read [the extension overview](docs/extension-overview.md) and source files only
   as needed. Read backlog or completed plans when relevant; do not load all docs.

## Repository map

- `src/parser/`: Babel parsing and symbol extraction.
- `src/resolver/`: import, inheritance, and member-origin resolution.
- `src/providers/`: VS Code hover, definition, and completion providers.
- `src/commands/`, `src/ui/`: trace command and origin selection.
- `test/`: Node parser/resolver tests and JavaScript fixtures; see [test coverage](test/README.md).
- `docs/agent-harness/`: agent workflow and execution-plan template.
- `docs/exec-plans/`: backlog, active, and completed work.

## Working agreements

- Write documentation, agent files, code comments, and public-facing text in English.
- Keep instructions concise; link to the source of truth instead of duplicating it.
- Use neutral, public-shareable examples. Preserve the technical patterns under test.
- Use pnpm and preserve unrelated workspace changes. Do not edit generated `dist/` directly.
- Do not use Computer Use or manipulate application UIs unless the user explicitly
  requests it. The user performs UI checks; provide reproducible steps and record
  their reported results. Use non-UI tools for automated verification.
- Before implementing each new backlog item, create a dedicated branch and an
  active plan following [the plan workflow](docs/agent-harness/workflows.md).
- Keep plans current during work. Move a plan to `completed/` only when its full
  scope is finished and verified; completing one checklist item is not enough.
- Turn recurring mistakes into a focused instruction, test, or tooling check.
- New functions, including extracted or relocated code, must have ESLint
  cyclomatic complexity at most 15. Refactor before handoff; do not suppress the
  rule or raise the limit. The project ESLint configuration enforces this ceiling
  for all functions in `src/**/*.ts`.
- Finish each change with [one critical self-review and a proposed commit](docs/agent-harness/review-and-commit.md).
  Wait for the user's manual review and explicit approval before committing.

## Verification

- Types without generated output: `pnpm check:types`.
- Lint: `pnpm lint`.
- Tests: `pnpm test` compiles current sources and runs the Node suite. Report
  TODO reproductions separately from passing tests; promote them when fixing bugs.
- Keep test source scenarios in `test/fixtures/` and read them from tests so they
  can also be opened for extension debugging; see [test instructions](test/README.md).
- `pnpm compile` writes `dist/`. `pnpm package` also increments the package
  version through `prepackage`; use it only for an intended packaging task.
- Report checks run, outcomes, and material limitations. Documentation-only work
  needs link/content checks, not a build.
