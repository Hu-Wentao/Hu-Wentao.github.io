import { describe, expect, test } from "vitest";

import {
  buildCanonicalUrl,
  buildXText,
  normalizedJuejinTags,
  rewriteFrontMatterForPublish,
  validatePlatformMetadata,
} from "../src/content.js";
import type { PostDocument } from "../src/types.js";

function createPost(overrides: Partial<PostDocument> = {}): PostDocument {
  return {
    absolutePath: "/tmp/post.md",
    relativePath: "content/posts/post.md",
    slug: "post",
    raw: "",
    body: "First paragraph.\n\nSecond paragraph.",
    title: "My Post",
    summary: "Short summary",
    canonicalUrl: "https://wyattcoder.top/posts/post/",
    metadata: {
      title: "My Post",
      tags: ["AI"],
      publish: {
        juejin: {
          category: "人工智能",
        },
      },
    },
    ...overrides,
  };
}

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

  test("buildXText truncates to 280 chars with link", () => {
    const text = buildXText(createPost({
      summary: "a".repeat(400),
    }));
    expect(Array.from(text).length).toBeLessThanOrEqual(280);
    expect(text).toContain("https://wyattcoder.top/posts/post/");
  });

  test("validatePlatformMetadata requires juejin category", () => {
    const post = createPost({
      metadata: {
        title: "My Post",
        tags: ["AI"],
        publish: {},
      },
    });
    expect(() => validatePlatformMetadata(post, ["juejin"])).toThrow(/publish\.juejin\.category/);
  });

  test("normalizedJuejinTags falls back to hugo tags", () => {
    expect(normalizedJuejinTags(createPost())).toEqual(["AI"]);
  });
});
