import { describe, expect, test } from "vitest";

import {
  buildCanonicalUrl,
  rewriteFrontMatterForPublish,
} from "../src/content.js";

describe("content helpers", () => {
  test("rewriteFrontMatterForPublish only changes draft/date and preserves body", () => {
    const original = `---\ntitle: "Demo"\ndate: 2026-05-31T00:00:00+08:00\ndraft: true\nsummary: "demo"\n---\n\n正文内容\n`;
    const updated = rewriteFrontMatterForPublish(original, "2026-06-01T09:30:00+08:00");
    expect(updated).toContain("date: 2026-06-01T09:30:00+08:00");
    expect(updated).toContain("draft: false");
    expect(updated.endsWith("\n\n正文内容\n")).toBe(true);
  });

  test("buildCanonicalUrl prefers explicit absolute url", () => {
    const url = buildCanonicalUrl("https://wyattcoder.top/", "content/posts/demo.md", {
      title: "Demo",
      url: "https://custom.example/post",
    });
    expect(url).toBe("https://custom.example/post");
  });

  test("buildCanonicalUrl preserves an explicit English site-root url", () => {
    const url = buildCanonicalUrl("https://wyattcoder.top/", "content/posts/demo.en.md", {
      title: "Demo",
      slug: "demo",
      url: "/en/posts/demo/",
    });
    expect(url).toBe("https://wyattcoder.top/en/posts/demo/");
  });
});
