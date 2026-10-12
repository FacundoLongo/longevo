---
name: longevo-brief
description: "Prepare a brief for a task before you design or build it: read the issue (GitHub, Linear, Jira, Notion or plain text), find the affected code, and collect the business rules, docs, golden tests and what must not change, with acceptance criteria as WHEN/THEN. Saves it to docs/work/ after the user says yes. Use before a task of some size, or when the user gives an issue link and asks to plan it."
---

# Longevo brief

Collect what a task needs into one brief, so the design and the tests start from the repo's rules and not from guesses. The brief is input for your spec tool; it does not replace it. Never write to the tracker. Never stage or commit.

## 1. Get the task

Follow [references/sources.md](references/sources.md):

- **Text:** use it as it is.
- **A GitHub issue:** `gh issue view <number or link> --json title,body,labels,comments`.
- **Linear, Jira or Notion:** read it with an MCP tool the agent has.
- **Nothing works:** ask the user to paste the task.

## 2. Find the affected code

Search the repo for the names, routes, models and messages in the task. List the files and folders it will touch. If two areas fit and the code cannot tell which one, ask one question with both options.

## 3. Collect context

```
node <this skill's folder>/scripts/longevo.mjs context --cwd . --paths <comma-separated files or globs>
```

It returns the docs and rules that cover those paths, the tests near them, the golden tests from `docs/testing.md`, their coverage rows, how often they change and open briefs. Read only what it points to. If an open brief already covers the same code, say so and ask whether to continue that one.

## 4. Draft the brief

Use the eight parts in [references/brief-template.md](references/brief-template.md):

- **Rules that apply:** each with its status and evidence.
- **What must not change:** each item with the regression test that protects it.
- **Acceptance criteria:** WHEN/THEN lines.
- **Tests:** leave it empty; `longevo-testing` fills it when the tests are planned.

## 5. Ask

Ask only what the code, the docs and the task cannot answer, one question at a time, with options. Put each answer in the brief. Questions the user leaves open go under "Open questions".

## 6. Propose and save

Show the brief, then a one-item list:

1. Save it to `docs/work/<today>-<slug>/brief.md`.

> Which ones do I apply? [All / Pick numbers / None]

If the user picks it:

1. Create the file with the engine:

   ```bash
   node <this skill's folder>/scripts/longevo.mjs apply brief --cwd . <<'JSON'
   {"slug": "partial-refunds", "task": "https://github.com/acme/shop/issues/42", "covers": ["src/refunds/**"]}
   JSON
   ```

   `covers` may name folders that do not exist yet, for code the task will add.

2. Fill its sections with your edit tool, exactly as you showed them.
3. Show the path.

Never stage or commit. If the user does not pick it, save nothing; the brief was shown, and asking for it again shows it again.

## 7. Next step

Say: "Design and plan with your tool (Superpowers brainstorming, OpenSpec, Spec Kit or plan mode), with the brief as input. When the work is done, mark it with `apply done` and run `longevo-sync`; it moves the criteria into the rules."

## Rules

- Never write to the tracker: no comments, no status changes, no links.
- Every rule and claim points to a file and line, or says it has no evidence.
- Do not design the solution. The brief says what and why, not how.
- Never print a secret.
