---
name: manage-blog-publishing
description: Discover newly published Hugo articles, enroll them in this repository's external-platform queue, and execute due syndication. Only discover articles published after the configured activation cutoff, resolve eligible targets from the currently authenticated Wechatsync platforms at run time, and handle X as a summary-and-canonical-link post rather than a full article. Use when Codex needs to run the recurring workflow, inspect or reorder the queue, configure exclusions, or recover blocked releases. Never use it to publish drafts or publish to the self-hosted site.
---

# Manage Blog Publishing

Use `publishing/schedule.json` as the durable external-syndication plan and state record. Keep self-hosted blog publication entirely outside this automation.

## Enforce Hard Boundaries

- Enroll only an article whose front matter explicitly has `draft: false`.
- Never publish to `site`, run `pnpm publish:article`, or change article front matter from this workflow.
- Auto-enroll only an article whose front matter `date` is strictly later than `discovery.enabledAfter`.
- Require the article to be tracked and unchanged in Git, then require its canonical URL to be public and contain the exact article title before enrollment.
- Treat a queued platform as authorization for that article and external platform only.

The queue validator enforces draft state, canonical URL equality, a verified manual site record, and the absence of `site` from the automated pipeline.

## Resolve Current Wechatsync Targets

Before inspecting due work or starting a release:

1. Call Wechatsync `list_platforms` with `forceRefresh: true`.
2. For platforms other than `x`, keep only entries where `isAuthenticated` is `true` and `capabilities` contains both `article` and `draft`.
3. Keep `x` when its refreshed entry is authenticated. X uses the summary-link workflow below, not Wechatsync full-article draft synchronization.
4. Exclude local/non-publishing targets such as `zip-download`, even if they report authenticated.
5. Use the returned platform IDs exactly as reported. Never infer targets from Wechatsync documentation, an old run, `platformGroups`, or a handwritten supported-platform list.
6. If refresh succeeds but no target is eligible, pass an explicit empty set as `--platforms=`; report attention and leave queued work for a later run.
7. If the extension is disconnected or the refreshed list cannot be obtained, stop without changing queue state.

The eligible target set may change on every run. `platformGroups` is only an optional policy map for article-level class exclusions; it is not evidence that a platform is connected.

## Discover and Enroll New Articles

1. Run `pnpm publish:queue validate`, then run `pnpm publish:queue discover` exactly once.
2. Treat only the returned candidates as this run's discovery set. Never scan drafts manually or change `discovery.enabledAfter` during a scheduled run.
3. For each candidate, require `git ls-files --error-unmatch <path>` to succeed and `git status --short -- <path>` to be empty.
4. Fetch the exact canonical URL and verify that the public page contains the exact article title. A generic HTTP success is insufficient. If verification fails, leave it unqueued so a later run can retry.
5. Run `pnpm publish:queue enqueue --article <path> --title <exact-title> --url <exact-canonical-url>` for each verified candidate, in the order returned by `discover`.
6. The command appends positions in increments of 100 and records the front matter `date` as the manual site publication time:

```json
{
  "status": "published",
  "attempts": 1,
  "publicationMethod": "manual",
  "publishedAt": "<actual-manual-publication-time>",
  "verifiedAt": "<verification-time>",
  "url": "<canonical-url>"
}
```

7. If any article was enrolled, validate again, commit only `publishing/schedule.json` with `chore: enqueue newly published blog posts`, and push `main` before inspecting due work.
8. Use `exclude.groups` for a configured policy group and `exclude.platforms` for an individual Wechatsync platform ID. Preserve release records when reordering or changing exclusions.

Never enqueue an article dated at or before the activation cutoff. Do not move the cutoff backward to import historical posts.

## Inspect Due Work

Run:

```bash
pnpm publish:queue validate
pnpm publish:queue due --platforms <refreshed-platform-ids>
```

`due` is read-only. Report every `attention` item. Treat returned actions as one run's immutable work list and process those actions only. The queue starts external distribution for at most one previously unstarted article per run while also advancing due stages for articles already in progress.

## Run the Scheduled Workflow

1. Require the local `main` checkout; external publication needs the user's main Chrome login state.
2. Require `publishing/schedule.json` to be unchanged. Allow unrelated working-tree changes under the repository's `-i` rule, but never stage them.
3. Discover, verify, enqueue, commit, and push newly published articles using the workflow above.
4. Resolve the current Wechatsync targets using the required refresh procedure above.
5. Run `pnpm publish:queue due --platforms <comma-separated-refreshed-ids>` exactly once after enrollment. This allows a newly enrolled article whose interval has elapsed to publish in the same run.
6. Report `attention` items. If no actions are due, stop.
7. For each returned external action, run `start --platforms <same-refreshed-platform-ids>`, stage only `publishing/schedule.json`, and commit `chore: start <platform> publication for <slug>`.
8. Publish through Wechatsync and the user's main Chrome as described below.
9. After verifying the exact public URL, run `complete`, commit only the schedule with `chore: record <platform> publication for <slug>`, then push `main`.
10. On failure, first check whether a public post already exists. If it does not, run `block`, commit only the schedule with `chore: block <platform> publication for <slug>`, push `main`, and stop later actions for that article.

Never mark a draft, editor page, generic HTTP success, or unverified post as published.

## Publish an External Target

1. Read the main-Chrome syndication constraints in `../publish-blog-article/SKILL.md`.
2. If the target is `x`, follow **Publish X Summary Link** below and do not run the full-article draft workflow.
3. For every other target, use Wechatsync with the main Chrome extension to create the full-article draft. Upload local images first when required.
4. Use the user's main Chrome session to complete metadata and final publication. Never use a separate browser profile or isolated browser.
5. Verify the exact final public URL before calling `complete`.
6. If authentication, CAPTCHA, account confirmation, or an undefined platform workflow blocks final publication, record `blocked`. A Wechatsync draft is not completion.

## Publish X Summary Link

1. Never send the full article body to X and never call Wechatsync `sync_article` for X.
2. Build one standard X post, not an X Article. Use front matter `publish.x.text` when present; otherwise compose a concise summary from the article title and summary.
3. Append the exact `releases.site.url` canonical blog URL. Preserve the URL verbatim and keep the complete post within the limit shown by X's composer.
4. Publish through the user's main Chrome X composer and verify the resulting public post URL before calling `complete`.

## Recover a Blocked Release

1. Inspect `lastError` and the external platform before retrying.
2. If the public post already exists, verify it, run `start`, then `complete`; do not republish.
3. Otherwise resolve the blocker, run `start` to increment `attempts`, and follow the normal external workflow.

## State Commands

Use these commands only for external platforms; the CLI rejects `site`:

```bash
pnpm publish:queue discover
pnpm publish:queue enqueue --article <path> --title <exact-title> --url <canonical-url>
pnpm publish:queue start --article <path> --platform <external-platform> --platforms <refreshed-platform-ids>
pnpm publish:queue complete --article <path> --platform <external-platform> --url <public-url>
pnpm publish:queue block --article <path> --platform <external-platform> --error <message>
```

Do not edit external release states manually during normal operation.
