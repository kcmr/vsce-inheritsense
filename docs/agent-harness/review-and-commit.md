# Review and commit

Apply this workflow automatically when finishing a task that changes repository
files, including small edits without an execution plan. The user can also request
it for an existing diff. Read-only tasks need no commit proposal.

## One critical self-review

After implementation and verification, perform exactly one review pass:

1. Inspect Git status and the task's full diff, including new files and any staged
   changes. Separate unrelated work and identify the intended commit scope.
2. Look critically for behavioral bugs, edge cases, weak or missing tests,
   compatibility issues, accidental dependencies, generated artifacts, and stale
   documentation. Check acceptance criteria and distinguish TODO tests from
   passing coverage.
3. Fix concrete findings within scope and run the checks affected by those fixes.
   Record material unresolved findings and their impact. Do not fix unrelated
   issues silently.

Do not start a second autonomous review pass or loop on speculative improvements.
Checking a correction or rerunning a relevant test is verification, not another
review. On resumption, reuse the recorded review result. Repeat a review only
when the user explicitly requests it.

## Prepare the commit message

Use an English Conventional Commit subject:

```text
type(scope): imperative summary
```

Choose the type from the actual change: `feat`, `fix`, `refactor`, `test`, `docs`,
`build`, `ci`, `perf`, or `chore`. Use a scope such as `parser`, `resolver`,
`providers`, or `harness` when it clarifies the affected area; otherwise omit it.
Describe the concrete outcome. Add a body only when motivation, compatibility,
or verification needs explanation. Flag breaking changes with `!` and explain
them in a `BREAKING CHANGE:` footer when applicable.

Prepare one message per coherent change. Exclude unrelated pending edits from
the proposal. Do not stage files unless the user has authorized staging or has
approved creating the scoped commit.

## Manual review handoff

Before committing, present:

- A concise result and the relevant plan or changed-file links.
- The self-review outcome, including any unresolved findings.
- Verification results and material limitations.
- The exact proposed commit message and its scope.
- A clear request for the user to review the changes manually and approve the commit.

Then stop. Finishing implementation, permission to start work, approval of a
plan, or permission to stage files is not approval to commit. Wait for explicit
approval covering the proposed scope and message. This rule also applies when
the user invokes this workflow for an already completed task.

After approval, inspect status and the staged diff to confirm they still match
the reviewed scope, stage only the approved changes, and commit with the agreed
message. If the scope or message needs a material change, explain it and obtain
approval for the revised proposal. Report the commit hash after success. Do not
push, merge, or publish without separate authorization.
