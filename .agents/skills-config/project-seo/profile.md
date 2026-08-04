# Personal Site SEO Profile

Treat `hugo.toml` as the site configuration authority and `content/` as the authored content
source. The canonical public origin is `https://wyattcoder.top/`; the default language is
Chinese, with an English language variant configured by Hugo.

Audit source Markdown without modifying `content/`, templates, themes, generated `public/`, or
the GitHub Pages publication state. Draft content may be discovered but should not create SEO
findings until it becomes indexable.

Project SEO results belong in `docs/seo/results.md`. Do not promote page text, private metrics,
or a project-specific content decision into the shared lesson catalog. Run the declared pnpm
checks after TypeScript changes and the Hugo build after approved site or content changes.
