---
name: publish-hacker-news
description: Translate a formally published Hugo post into English, publish the English counterpart under /en/posts/, and submit its verified URL to Hacker News through the user's main Chrome session. Use when the user explicitly asks to prepare an English Hacker News translation or to translate and publish/submit a blog post to Hacker News. Never run this workflow from scheduled publishing, and never submit to Hacker News without explicit authorization.
---

# Publish to Hacker News

Treat this as a manual, explicitly authorized release. Hacker News receives the
English article URL and title; it does not receive the Markdown body.

## Enforce Boundaries

- Never add `hacker-news` to `publishing/schedule.json`, a platform group, a
  pipeline stage, or `--platforms`.
- Never call `pnpm publish:queue` or Wechatsync for this workflow.
- Require the English post to set `publish.autoSyndication: false` before it can
  become public.
- Use only the user's main Chrome session for Hacker News. Never use direct HTTP
  submission, an isolated browser, copied cookies, or a separate profile.
- Do not submit unless the user explicitly requested Hacker News publication.
  If the user requested only a translation or preparation, stop after creating
  and validating the draft.
- Do not publish an AI-generated Hacker News comment, solicit votes, or ask
  others to comment.

## Run Preflight

1. Read `../publish-blog-article/SKILL.md` and follow its Git, deployment, live
   verification, and main-Chrome constraints.
2. Resolve one source file under `content/posts/`. Require it to be tracked,
   unchanged, on `main`, and explicitly `draft: false`.
3. Derive its canonical URL and verify that the public page contains the exact
   source title. Do not translate an unpublished source for this workflow.
4. Inspect `git status --short`. Apply the repository's `-c`/`-i` rule to
   unrelated changes and never stage them.
5. Read the current official Hacker News Guidelines and FAQ before submission:
   `https://news.ycombinator.com/newsguidelines.html` and
   `https://news.ycombinator.com/newsfaq.html`.

## Prepare the English Counterpart

1. Use filename-based Hugo translations. For `content/posts/topic.md`, create
   `content/posts/topic.en.md`. Keep the same path and base filename so Hugo
   links both language versions.
2. Derive the English slug from the source `slug`, falling back to the source
   basename. Require an explicit site-root URL `/en/posts/<slug>/` so the
   publisher's canonical URL matches Hugo's multilingual output.
3. Translate the title, summary, headings, prose, tables, captions, and useful
   image alt text. Preserve code, commands, identifiers, URLs, Markdown
   structure, shortcodes, formulas, and product names unless an established
   English form exists.
4. Preserve factual meaning. Do not add claims, examples, endorsements, or
   promotional language that the source does not contain.
5. Add a short note linking to the verified Chinese original and identifying
   the page as its English translation.
6. Preserve relevant tags, categories, cover, and local image references. Use
   an English summary and an English page title.
7. Use this front matter contract:

```yaml
---
title: "<English page title>"
slug: <source-slug>
url: /en/posts/<source-slug>/
draft: true
summary: "<English summary>"
publish:
  autoSyndication: false
  hackerNews:
    title: "<Hacker News title>"
---
```

8. Default `publish.hackerNews.title` to the English page title. Remove a site
   name, gratuitous capitalization, exclamation marks, or clickbait; otherwise
   do not editorialize. Do not add `Show HN:` unless the user explicitly asks
   and the linked work satisfies the current Show HN rules.
9. If the English file already exists, preserve intentional edits. If it has a
   verified `publish.hackerNews.itemUrl`, follow **Recover or Re-run** instead
   of retranslating or resubmitting it.
10. Run `hugo --gc --minify`, inspect the rendered English page, and confirm
    that links, code blocks, images, and the source note remain correct.
11. Commit only the English draft with `docs: add English translation for
    <slug>`. This clean checkpoint is required before the normal publisher can
    run. For a preparation-only request, stop here and report the draft path.

## Publish the English Page

1. Reconfirm `publish.autoSyndication: false`, `draft: true`, and the exact
   `/en/posts/<slug>/` URL.
2. When the worktree is clean, run:

```bash
pnpm publish:article content/posts/<source>.en.md
```

3. If unrelated changes remain under an authorized `-i` path, use the scoped
   site-publication fallback from `publish-blog-article`; do not stash, commit,
   or discard unrelated files.
4. Wait for the GitHub Pages deployment associated with the publication commit.
5. Fetch the exact English canonical URL. Require a successful response, the
   exact English title, and an English document language before proceeding.

## Avoid Duplicate Submissions

1. Search for the exact English canonical URL before opening the submit form.
   Use the HN Algolia read API for lookup, then verify any candidate against its
   public `news.ycombinator.com/item?id=...` page. Fall back to the official HN
   site/domain listings if the search service is unavailable.
2. Normalize only a trailing slash when comparing URLs. Do not treat a title or
   domain-only match as the same submission.
3. If an exact public submission already exists, do not submit again. Verify it
   and continue to **Record the Result**.

## Submit with Main Chrome

1. Use `publish.hackerNews.title` when present; otherwise use the exact English
   page title.
2. Open the prefilled main-Chrome submission URL:

```text
https://news.ycombinator.com/submitlink?u=<encoded-English-URL>&t=<encoded-title>
```

3. Confirm the title and URL in the form, then submit once. Do not add a text
   body or an automated first comment.
4. If login, CAPTCHA, account confirmation, or another user-only checkpoint is
   required, leave the main Chrome tab open and ask the user to complete it.
5. Treat submission as complete only after a public item page contains the
   exact English URL and submitted title. A filled form or redirect alone is
   not completion.

## Record the Result

After verifying the public item, update only the English post metadata:

```yaml
publish:
  autoSyndication: false
  hackerNews:
    title: "<submitted title>"
    itemUrl: "https://news.ycombinator.com/item?id=<id>"
    submittedAt: "<ISO-8601 timestamp>"
```

Preserve the article body, `date`, and `draft: false`. Run `hugo --gc --minify`,
stage only the English post, commit with `chore: record Hacker News submission
for <slug>`, push `main`, and verify that the main branch is synchronized.

## Recover or Re-run

- If `itemUrl` is present, verify that it still points to the exact English URL
  and return it without resubmitting.
- If submission outcome is ambiguous, search for the exact URL before retrying.
- If Hacker News succeeded but recording failed, recover the existing item and
  backfill the metadata without another submission.
- If English site publication fails, do not open or submit the Hacker News form.
- If the English page is live but Hacker News is blocked, leave the page live,
  report the exact blocker, and keep Hacker News outside the automated queue.

Report the source URL, English URL, translation/publication commit, Hacker News
item URL, result-record commit, any pushed pre-existing commits, and unrelated
working-tree changes left intact.
