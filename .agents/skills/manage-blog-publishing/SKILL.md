---
name: manage-blog-publishing
description: Manage and execute this Hugo repository's external-platform publication queue for articles already published manually on the self-hosted blog. Resolve eligible targets from the currently authenticated Wechatsync platforms at run time. Use when Codex needs to enroll or reorder eligible articles, configure platform exclusions, inspect due syndication, recover blocked releases, or run the recurring two-day external distribution workflow in publishing/schedule.json. Never use it to publish drafts or publish to the self-hosted site.
---

# Manage Blog Publishing

Use `publishing/schedule.json` as the durable external-syndication plan and state record. Keep self-hosted blog publication entirely outside this automation.

## Enforce Hard Boundaries

- Enroll only an article whose front matter explicitly has `draft: false`.
- Never publish to `site`, run `pnpm publish:article`, or change article front matter from this workflow.
- Enroll only an article the user explicitly confirms they already published manually on the self-hosted blog. Do not infer manual publication from `draft: false` or a live URL alone.
- Require the canonical URL to be public and verify that it contains the exact article title before enrollment.
- Treat a queued platform as authorization for that article and external platform only.

The queue validator enforces draft state, canonical URL equality, a verified manual site record, and the absence of `site` from the automated pipeline.

## Resolve Current Wechatsync Targets

Before inspecting due work or starting a release:

1. Call Wechatsync `list_platforms` with `forceRefresh: true`.
2. Keep only entries where `isAuthenticated` is `true` and `capabilities` contains both `article` and `draft`.
3. Exclude local/non-publishing targets such as `zip-download`, even if they report authenticated.
4. Use the returned platform IDs exactly as reported. Never infer targets from Wechatsync documentation, an old run, `platformGroups`, or a handwritten supported-platform list.
5. If the extension is disconnected or the refreshed list cannot be obtained, stop without changing queue state.

The eligible target set may change on every run. `platformGroups` is only an optional policy map for article-level class exclusions; it is not evidence that a platform is connected.

## Enroll or Reorder an Article

1. Read the article front matter, `publishing/schedule.json`, and `Scripts.md`.
2. Require explicit user confirmation of manual self-hosted publication. Stop and ask if it is missing.
3. Verify the canonical URL and exact title on the live page.
4. Add a unique positive `queuePosition`; prefer gaps of 100. A smaller value starts external distribution earlier.
5. Record the verified site baseline under `releases.site`:

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

6. Use `exclude.groups` for a configured policy group and `exclude.platforms` for an individual Wechatsync platform ID. An exclusion may remain configured while that platform is disconnected.
7. Preserve all release records when reordering or changing exclusions. Never fabricate a publication time, verification, or URL.
8. Run `pnpm publish:queue validate` after every edit.
9. Follow the repository `-c`/`-i` rule and commit only the requested paths.

## Inspect Due Work

Run:

```bash
pnpm publish:queue validate
pnpm publish:queue due --platforms <refreshed-platform-ids>
```

`due` is read-only. Report every `attention` item. Treat returned actions as one run's immutable work list and process those actions only. The queue starts external distribution for at most one previously unstarted article per run while also advancing due stages for articles already in progress.

## Run the Scheduled Workflow

1. Require the local `main` checkout; external publication needs the user's main Chrome login state.
2. Resolve the current Wechatsync targets using the required refresh procedure above.
3. Run `pnpm publish:queue validate`, then run `pnpm publish:queue due --platforms <comma-separated-refreshed-ids>` once.
4. Report `attention` items. If no actions are due, stop.
5. Run `git status --short`. If any working-tree change exists, stop without changing queue state.
6. For each returned external action, run `start --platforms <same-refreshed-platform-ids>`, stage only `publishing/schedule.json`, and commit `chore: start <platform> publication for <slug>`.
7. Publish through Wechatsync and the user's main Chrome as described below.
8. After verifying the exact public URL, run `complete`, commit only the schedule with `chore: record <platform> publication for <slug>`, then push `main`.
9. On failure, first check whether a public post already exists. If it does not, run `block`, commit only the schedule with `chore: block <platform> publication for <slug>`, push `main`, and stop later actions for that article.

Never mark a draft, editor page, generic HTTP success, or unverified post as published.

## Publish an External Target

1. Read the main-Chrome syndication constraints in `../publish-blog-article/SKILL.md`.
2. Use Wechatsync with the main Chrome extension to create the target draft. Upload local images first when required.
3. Use the user's main Chrome session to complete metadata and final publication. Never use a separate browser profile or isolated browser.
4. Verify the exact final public URL before calling `complete`.
5. If authentication, CAPTCHA, account confirmation, or an undefined platform workflow blocks final publication, record `blocked`. A Wechatsync draft is not completion.

## Recover a Blocked Release

1. Inspect `lastError` and the external platform before retrying.
2. If the public post already exists, verify it, run `start`, then `complete`; do not republish.
3. Otherwise resolve the blocker, run `start` to increment `attempts`, and follow the normal external workflow.

## State Commands

Use these commands only for external platforms; the CLI rejects `site`:

```bash
pnpm publish:queue start --article <path> --platform <external-platform> --platforms <refreshed-platform-ids>
pnpm publish:queue complete --article <path> --platform <external-platform> --url <public-url>
pnpm publish:queue block --article <path> --platform <external-platform> --error <message>
```

Do not edit external release states manually during normal operation.
