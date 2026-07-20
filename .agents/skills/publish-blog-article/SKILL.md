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
3. Use the repository's existing publisher implementation. Do not duplicate or
   replace `scripts/publisher/` inside this skill.
4. Use Node through the version in `.nvmrc` and use pnpm, never npm or yarn.

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
pnpm publish:article <post-path> --dry-run --platforms ''
```

The publisher requires a clean worktree. If `-i` leaves unrelated changes in
place, skip this command and use the scoped fallback below; do not stash,
discard, or commit the user's unrelated changes merely to satisfy the CLI.

## Publish with a Clean Worktree

For website-only publication, run:

```bash
pnpm publish:article <post-path> --platforms ''
```

This command is the authoritative happy path. It validates content, sets
`draft: false` and the current timestamp, runs the Hugo production build,
commits the article, pushes `main`, and waits for the canonical URL.

Only when the user explicitly requests syndication, pass the requested targets:

```bash
pnpm publish:article <post-path> --platforms juejin,x
```

Do not silently accept the CLI default platform list; always pass
`--platforms` explicitly so external posting scope is visible.

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

Do not use this fallback for social syndication. Social publishing depends on
the publisher's readiness checks and run records; first obtain a clean worktree
or publish social separately after the site is live.

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
