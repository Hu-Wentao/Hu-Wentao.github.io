---
name: publish-blog-article
description: Formally publish and verify a Hugo article in this blog repository. Use when the user asks to publish, formally publish, make live, deploy, or 上线/正式发布 an article under content/posts/. Covers publication preflight, frontmatter publication date and draft state, Hugo validation, a scoped Git commit, pushing main, waiting for the matching GitHub Pages deployment, live URL verification, and optional explicitly authorized syndication to Juejin or X.
---

# Publish Blog Article

Treat publication as complete only after the article is pushed, the matching
GitHub Pages deployment succeeds, and the canonical URL serves the article.
A local `draft: false`, build, or commit alone is not a completed publication.

## Resolve Scope

1. Resolve the requested file under `content/posts/` and read its frontmatter.
2. Treat an unqualified request such as “正式发布文章” as website publication
   only. Do not post to Juejin or X without explicit authorization.
   For translation and Hacker News submission, use
   `../publish-hacker-news/SKILL.md`; never route Hacker News through
   Wechatsync or the scheduled queue.
3. Use `scripts/publisher/` only for website publication. Orchestrate explicitly
   authorized external syndication with Wechatsync MCP and the user's main
   Chrome browser.
4. Use Node through the version in `.nvmrc` and use pnpm, never npm or yarn.
5. Never launch Playwright, Chromium, the in-app browser, or a separate browser
   profile for syndication. If main-Chrome control is unavailable, stop and ask
   the user to reconnect it; do not fall back to an isolated browser.

## Run Preflight

Before changing or publishing anything:

1. Run `git status --short` and confirm the current branch is `main`.
2. Fetch `origin/main`, then inspect `git log --oneline origin/main..HEAD`.
   This project authorizes pushing the current `main` history as part of a
   formal publication. Do not pause to ask about pre-existing ahead commits;
   include them in the push and report their SHAs in the handoff.
3. If unrelated working-tree changes exist, follow the repository's `-c` / `-i`
   rule. Never include unrelated paths in the publication commit.
4. Confirm the post has a title, YAML frontmatter, and a stable canonical URL.
5. Run a site-only dry run when the worktree is clean:

```bash
pnpm publish:article <post-path> --dry-run
```

The publisher requires a clean worktree. If `-i` leaves unrelated changes in
place, skip this command and use the scoped fallback below; do not stash,
discard, or commit the user's unrelated changes merely to satisfy the CLI.

## Publish with a Clean Worktree

For website-only publication, run:

```bash
pnpm publish:article <post-path>
```

This command is the authoritative happy path. It validates content, sets
`draft: false` and the current timestamp, runs the Hugo production build,
commits the article, pushes `main`, and waits for the canonical URL.

Never pass external targets to the publisher CLI. Complete website publication
and live verification first, then follow **Syndicate with Main Chrome** for
each platform the user explicitly authorized.

## Publish with `-i`

When unrelated working-tree changes remain and the user selected `-i`, reproduce
only the site portion of the publisher transaction:

1. Change only the target post's `date` to the current local timestamp and
   `draft` to `false` while preserving all other frontmatter and body bytes.
2. Run `hugo --gc --minify`.
3. Confirm the post appears in `hugo list published` with `draft=false` and the
   expected permalink.
4. Stage only the target post and inspect `git diff --cached --check` plus
   `git diff --cached --name-status`.
5. Commit only that post with `chore: publish <slug>`.
6. Push `main` to `origin`. Do not call the operation complete before this
   succeeds.

After the site is live, external syndication may proceed independently of
unrelated working-tree changes because it does not use the publisher CLI or
modify repository files.

## Syndicate with Main Chrome

Run this section only for platforms the user explicitly named.

1. Read the post frontmatter and body. Use `publish.juejin.category`,
   `publish.juejin.tags`, `publish.cover`, and `publish.x.text` when present;
   otherwise use the article tags and summary as fallbacks. Before calling
   `sync_article`, upload local images with Wechatsync MCP `upload_image_file`
   and replace their references with the returned URLs.
2. Use Wechatsync MCP `list_platforms` or `check_auth` to verify that the target
   platform is authenticated in the user's main Chrome extension. Do not infer
   readiness from a separate browser.
3. For Juejin, call Wechatsync MCP `sync_article` to create the draft. Then use
   the Chrome control skill against the user's main Chrome to locate that exact
   draft by title, set its category, tags, and optional cover, and publish it.
   Verify the resulting article URL.
4. For X, build a post from `publish.x.text` when present; otherwise use the
   article title and summary, then append the exact canonical blog URL, staying
   within the limit shown by X's composer. Publish one standard X post, not an
   X Article. Never send the full article body to X and never call Wechatsync
   `sync_article` for X. Use the Chrome control skill against the user's main
   Chrome to submit the post and verify its resulting URL.
5. Treat a Wechatsync draft as incomplete. Report a platform as published only
   after the platform exposes the final public URL.

If a platform requires login, CAPTCHA, or account confirmation, leave the main
Chrome tab open for handoff and ask the user to complete that step. Never copy
cookies or point automation at the Chrome profile directory.

## Verify Deployment

After either path:

1. Record `HEAD` and locate the GitHub Actions run for that exact SHA and the
   Hugo Pages workflow.
2. Wait until both build and deploy jobs complete successfully. Prefer
   `gh run watch <run-id> --exit-status` when GitHub CLI is available.
3. Fetch the canonical URL and confirm it contains the article title. A generic
   HTTP success or an older deployment is insufficient.
4. Confirm `main` is no longer ahead of `origin/main`.
5. Report the publication commit SHA, every pre-existing ahead SHA that was
   pushed, workflow URL, canonical article URL, breaking changes, compatibility
   aliases, and any unrelated working-tree changes left intact.

If push, deployment, or live verification fails, report publication as failed or
incomplete with the exact completed stage. Never describe a local commit as
“正式发布”.
