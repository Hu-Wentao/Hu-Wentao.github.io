# Development Notes

This repository is a Hugo personal blog published by GitHub Pages.

## Publish a Post

1. Create a Markdown file under `content/posts/`.
2. Add front matter similar to:

```markdown
---
title: "Post title"
date: 2026-04-19T12:00:00+08:00
draft: false
tags: ["tag"]
categories: ["category"]
---
```

3. Write the post body in Markdown.
4. Commit and push to `main`.
5. GitHub Actions builds the site and deploys it to GitHub Pages.

## Local Preview

Use Hugo Extended. The GitHub Actions workflow currently builds with Hugo `0.146.0`.

```bash
hugo server -D
```

Then open the local URL printed by Hugo.

## Theme

The site uses PaperMod as a Git submodule at `themes/PaperMod`.

Clone with submodules:

```bash
git clone --recurse-submodules git@github.com:Hu-Wentao/Hu-Wentao.github.io.git
```

Initialize submodules in an existing clone:

```bash
git submodule update --init --recursive
```

Update the theme when needed:

```bash
git submodule update --remote --merge themes/PaperMod
```

After updating the theme, run a local build before pushing:

```bash
hugo --gc --minify
```
