---
name: blog-slidev
description: Create, maintain, preview, build, and embed standalone Slidev projects in this Hugo blog repository. Use when adding a presentation under slides/, changing a deck's publishing path, updating the GitHub Pages Slidev build, or linking and embedding a deck from Hugo content.
---

# Blog Slidev Workflow

Use the globally installed `slidev` skill for Slidev syntax, layouts, components, animation, and export details. Apply the repository-specific rules below for project structure and publishing.

## Repository contract

- Store every deck as an independent pnpm project at `slides/<slug>/`.
- Use a lowercase kebab-case slug. Treat it as a permanent public identifier.
- Keep each deck's `package.json`, `pnpm-lock.yaml`, `slides.md`, components, layouts, snippets, and public assets inside its own directory.
- Do not add deck dependencies to the blog root `package.json` and do not turn the repository into a pnpm workspace unless the user requests that migration.
- Publish a deck at `/slides/<slug>/`. GitHub Actions writes its static build to `public/slides/<slug>/` after Hugo builds the blog.
- Never commit generated `dist/`, `node_modules/`, or `public/` output.

## Create a deck

1. Confirm the requested title and derive a stable kebab-case slug.
2. Run:

   ```bash
   .agents/skills/blog-slidev/scripts/create-deck.sh <slug> "<title>"
   ```

3. Edit `slides/<slug>/slides.md` using the official `slidev` skill.
4. Run `pnpm --dir slides/<slug> dev` for local authoring.
5. Run `pnpm --dir slides/<slug> exec slidev build --base /slides/<slug>/` before handoff.

The creation script refuses to overwrite an existing directory, copies the bundled template, substitutes the slug/title, and runs `pnpm install` in the new deck.

## Publish and verify

The Pages workflow must keep this order:

1. Build Hugo into `public/`.
2. Discover direct child directories under `slides/` that contain `package.json`.
3. Run `pnpm install --frozen-lockfile` in each deck.
4. Build each deck with `pnpm --dir <deck> exec slidev build`, base `/slides/<slug>/`, and output `public/slides/<slug>/`.
5. Upload `public/` once with `actions/upload-pages-artifact`.

When changing deployment logic, verify both Hugo output and at least one deck build. Ensure generated HTML references the deck's `/slides/<slug>/` base rather than `/`.

## Link or embed in Hugo

Prefer a normal link when full-screen presenting is the main experience:

```md
[打开演示文稿](/slides/<slug>/)
```

Use the repository shortcode when the deck must appear inside an article:

```md
{{</* slidev slug="<slug>" title="演示文稿标题" */>}}
```

The shortcode validates the slug before rendering an iframe. Do not replace it with raw HTML or enable Goldmark's global `unsafe` option.

## Change checklist

- Preserve unrelated working-tree changes and follow the repository's commit rules.
- Update the deck's lockfile whenever dependencies change.
- Keep the public slug and build base identical.
- Run the skill validator after editing this skill.
- Report breaking path changes, compatibility configuration, verification commands, and the final public URL.
