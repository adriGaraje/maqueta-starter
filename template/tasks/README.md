# /tasks — local backlog

A lightweight, in-repo mirror of the Jira board (project **STARTERSLUG**, board <id>) — **no MCP
dependency**. Tasks are markdown files here; the board index is [`backlog.md`](./backlog.md).
Everything follows [`docs/jira-workflow.md`](../docs/jira-workflow.md) so it maps 1:1 to Jira
and can be synced any time.

## Files

- **`backlog.md`** — the board: one row per task + sprints. Start here.
- **`_TEMPLATE.md`** — copy this to create a task.
- **`STARTERSLUG-###-<slug>.md`** — one file per task (the full, AI-ready description).

## Creating a task

1. Copy `_TEMPLATE.md` → `STARTERSLUG-<next>-<slug>.md` (next code is shown at the top of `backlog.md`).
2. Fill **every** field (context, goal, acceptance criteria, files, dependencies, DoD).
3. Add a row to `backlog.md` and bump “Next free code”.

## Working a task

1. **Claim it:** set Status `In Progress` + Assignee (in `backlog.md` **and** the task file).
2. Follow [`docs/git-workflow.md`](../docs/git-workflow.md): branch `<type>/STARTERSLUG-###-<slug>`.
3. Self-check against the acceptance criteria; keep green (`build` / `lint:css` / `format:check`).
4. Open the PR → Status `In Review`. On merge → Status `Done`, delete the branch.

## Syncing to Jira (when connected)

Each field has a Jira equivalent (type, sprint, status, story points, links). When the Atlassian
connection is available, these files can be pushed to `STARTERSLUG` as issues with the same codes.
