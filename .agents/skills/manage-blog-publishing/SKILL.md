---
name: manage-blog-publishing
description: Manage and execute this Hugo repository's staged article publication queue. Use when Codex needs to add or reorder queued articles, configure per-article platform or platform-group exclusions, inspect due releases, recover blocked releases, or run the recurring two-day publication workflow in publishing/schedule.json.
---

# Manage Blog Publishing

Use `publishing/schedule.json` as the durable plan and state record. Use the TypeScript queue commands for validation and state transitions; orchestrate external publication through the user's main Chrome session.

## Manage the Queue

1. Read `publishing/schedule.json` and `Scripts.md` before changing the queue.
2. Add articles only from `content/posts/*.md`.
3. Assign unique positive `queuePosition` values. Prefer gaps of 100; a smaller value enters the site queue earlier.
4. Use `exclude.groups` for a whole configured platform group and `exclude.platforms` for individual platforms. Never exclude `site`.
5. Preserve `releases` when reordering or changing exclusions. Do not fabricate publication state or URLs.
6. Run `pnpm publish:queue validate` after every queue edit.
7. Follow the repository `-c`/`-i` rule for interactive queue edits and commit only the requested paths.

## Inspect Due Work

Run:

```bash
pnpm publish:queue validate
pnpm publish:queue due
```

`due` is read-only. Report every `attention` item; `publishing` may indicate an interrupted run and `blocked` needs recovery. Treat returned actions as one run's immutable work list: process those actions only. Do not rerun `due` after completing a site action and start another queued site article in the same scheduled run.

## Run the Scheduled Workflow

Run unattended only in the local `main` checkout because website publication pushes `main` and external publication requires the user's main Chrome login state.

1. Run `git branch --show-current`. If the branch is not `main`, stop without changing queue state and report the blocker.
2. Run `pnpm publish:queue validate`, then run `pnpm publish:queue due` once and retain its action list.
3. Report `attention` items. If there are no actions, report that nothing is due and stop.
4. Run `git status --short`. If any working-tree change exists, stop without changing queue state and report the blocker.
5. Process continuation actions before the single site action. Preserve the order returned for actions in the same category.
6. For each action, run `start`, stage only `publishing/schedule.json`, and commit `chore: start <platform> publication for <slug>`. This clean committed `publishing` state prevents duplicate retries after interruption.
7. Complete the platform workflow below.
8. After verifying a public URL, run `complete`, stage only the schedule, commit `chore: record <platform> publication for <slug>`, then push `main`.
9. On a real failure, reconcile first: check whether a public post or site commit already exists. If publication did not complete, run `block`, commit only the schedule with `chore: block <platform> publication for <slug>`, push `main`, and stop processing later actions for that article.

Never mark a draft, editor page, generic HTTP 200 response, or unverified post as `published`.

## Publish the Site Target

For `site`:

1. Run `pnpm publish:article <article-path>` after committing the `publishing` queue state.
2. Follow the verification requirements in `../publish-blog-article/SKILL.md`: verify the exact GitHub Pages deployment and confirm that the canonical URL contains the article title.
3. Read the site publication commit with `git rev-parse HEAD` and pass it to `complete --commit-sha`.

The site publisher pushes all current local `main` commits. Report any pre-existing commits included in that push.

## Publish an External Target

The queued platform is explicit authorization for that article and platform only.

1. Read and follow the main-Chrome syndication constraints in `../publish-blog-article/SKILL.md`.
2. Use Wechatsync with the main Chrome extension to create the target draft. Upload local images first when required.
3. Use the user's main Chrome session to complete platform metadata and final publication. Never launch a separate browser profile or fall back to an isolated browser.
4. Verify the exact final public URL before calling `complete`.
5. If the platform lacks a defined final-publication path, authentication is missing, or CAPTCHA/account confirmation is required, leave the relevant main Chrome tab open when possible and record `blocked`. Do not treat a Wechatsync draft as completion.

## Recover a Blocked Release

1. Read `lastError` and inspect the platform or deployment state before retrying.
2. If the public post already exists, verify its URL, run `start`, then immediately run `complete` with the verified URL; do not republish.
3. Otherwise resolve the blocker and run `start` again. This increments `attempts`.
4. Follow the normal platform workflow and record the result.

## State Command Reference

```bash
pnpm publish:queue start --article <path> --platform <platform>
pnpm publish:queue complete --article <path> --platform <platform> --url <public-url> [--commit-sha <sha>]
pnpm publish:queue block --article <path> --platform <platform> --error <message>
```

Do not edit `releases` manually during normal operation. The commands enforce platform exclusions, valid transitions, attempt counts, and public URL shape.
