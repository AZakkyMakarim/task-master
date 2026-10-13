# Issue tracker: Beads

Issues and specs for this repo live in the local beads database. Use the `bd` CLI for all operations. Run `bd prime` for the full command reference.

GitHub Issues on `AZakkyMakarim/task-master` are not used. Don't call `gh issue`.

## Conventions

- **Create an issue**: `bd create --title "..." --description "..." --type task|bug|feature|epic|chore|decision --priority 2`. For multi-line bodies, pipe a heredoc into `--stdin` (or use `--body-file <path>`). Priority is `0`-`4`, not "high"/"medium"/"low".
- **Read an issue**: `bd show <id>` for the body, labels, and dependencies, then `bd comments <id>` for the conversation. Add `--json` to either for structured output.
- **List issues**: `bd list --status open --json`, with `--label <name>` (must have all), `--label-any <name>` (at least one), `--type`, and `--parent <id>` filters as needed. Multiple statuses are comma-separated: `--status open,in_progress`.
- **Comment on an issue**: `bd comments add <id> "..."`, or `bd comments add <id> -f <path>` for long bodies.
- **Apply / remove labels**: `bd label add <id> <label>` / `bd label remove <id> <label>`. Labels are created on first use.
- **Close**: `bd close <id> --reason "..."`.
- **Never use `bd edit`**: it opens `$EDITOR` and blocks the agent. Use `bd update <id> --title/--description/--notes/--design` instead.

Issue IDs are strings (e.g. `task-master-a3f8`), not numbers. Quote them exactly as `bd` prints them.

## Pull requests as a triage surface

**PRs as a request surface: no.** Beads has no pull requests; `/triage` works on beads issues only.

## When a skill says "publish to the issue tracker"

Create a beads issue with `bd create`. Use `--type epic` for a spec with children, and `--parent <id>` for each ticket under it.

## When a skill says "fetch the relevant ticket"

Run `bd show <id>` and `bd comments <id>`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single epic with **child** issues as tickets.

- **Map**: an epic labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body in its description. `bd create --type epic --labels wayfinder:map --title "..." --stdin`.
- **Child ticket**: an issue created with `--parent <map-id> --no-inherit-labels`, with the question in the description. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). `--no-inherit-labels` stops the child picking up `wayfinder:map` from the map.
- **Blocking**: beads dependencies. `bd dep add <child> <blocker>` means `<child>` is blocked by `<blocker>`. A ticket is unblocked when every blocker is closed.
- **Frontier query**: `bd ready --parent <map-id> --unassigned`. `bd ready` already drops anything with an open blocker; first in the output wins.
- **Claim**: `bd update <id> --claim`, the session's first write.
- **Resolve**: `bd comments add <id> "<answer>"`, then `bd close <id>`, then append a context pointer (gist + link) to the map's Decisions-so-far with `bd update <map-id> --description "..."`.
