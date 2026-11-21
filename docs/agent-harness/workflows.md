# Task and execution-plan workflow

## Start and resume

At the start of every task, list `docs/exec-plans/active/` and read all active
plans. If the directory contains no plans, use the current request and relevant
backlog entries. Do not activate unrelated backlog work automatically.

After an interruption or context reset, reread the relevant active plan and
inspect the workspace before continuing. Use the plan's next step and evidence
to avoid repeating completed work.

## Plan lifecycle

- `backlog/`: recorded work that has not started.
- `active/`: work currently being implemented, including blocked or partial work.
- `completed/`: finished plans with final results and verification evidence.

For multi-step implementation, bug fixes, or risky changes, create a plan from
[the template](exec-plan-template.md) or move the relevant backlog plan to
`active/` before implementation. Use `YYYY-MM-DD-short-name.md` filenames.
Small, low-risk edits and read-only reviews do not require a new plan, but still
require reading active plans and updating one if the task belongs to its scope.

Keep one active plan per coherent workstream. When selecting only part of a
large backlog register, create a focused active plan referencing its task IDs;
leave the register in backlog and update those entries as work is verified.
Move the whole register only when its entire scope is being undertaken.

## During work

- Maintain scope, acceptance criteria, checked tasks, decisions, verification,
  blockers, and one concrete next step in the active plan.
- Mark work complete only with evidence. Distinguish static findings from
  reproduced failures and unrun checks from passing checks.
- Update the plan after meaningful milestones and before handing work back.
- Record durable engineering decisions, not a transcript of user requests.
- If scope changes, update the plan explicitly and retain outstanding work in
  the appropriate plan or backlog entry.

## Finish

1. Check every acceptance criterion and run the relevant verification.
2. Record the outcome, completion date, changed behavior, and actual check results.
3. Leave unresolved required work active with a blocker or next step. A partial
   result, handoff, failed check, or stopped session does not complete a plan.
4. Once the full scope is complete, set status to `Completed` and move the plan
   from `active/` to `completed/` in the same change. Repair links affected by
   the move and update any source backlog entries.
5. Follow [review and commit](review-and-commit.md): perform one critical
   self-review, prepare a Conventional Commit message, and hand off for manual
   review. Create the commit only after explicit user approval.

A completed plan records implementation and verification; it does not imply
approval to commit, merge, or publish.

If work is cancelled, move the plan to `backlog/` with status `Cancelled` and a
brief reason; do not describe it as completed.
