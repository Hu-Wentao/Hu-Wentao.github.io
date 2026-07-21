import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  blockRelease,
  completeRelease,
  findDuePublishActions,
  findQueueAttention,
  startRelease,
  validatePublishSchedule,
} from "../src/schedule.js";
import type { PublishSchedule, ReleaseState } from "../src/types.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("publish schedule", () => {
  test("starts external distribution for at most one manually published article according to queuePosition", () => {
    const rootDir = createRoot("first.md", "second.md");
    const schedule = createSchedule([
      article("content/posts/second.md", 200),
      article("content/posts/first.md", 100),
    ]);

    validatePublishSchedule(rootDir, schedule);
    const actions = findDuePublishActions(schedule, new Date("2026-07-21T09:00:00+08:00"));

    expect(actions).toEqual([
      expect.objectContaining({
        articlePath: "content/posts/first.md",
        platform: "juejin",
        queuePosition: 100,
      }),
      expect.objectContaining({
        articlePath: "content/posts/first.md",
        platform: "wechat",
        queuePosition: 100,
      }),
      expect.objectContaining({
        articlePath: "content/posts/first.md",
        platform: "zhihu",
        queuePosition: 100,
      }),
    ]);
  });

  test("returns all due continuation platforms and filters article exclusions", () => {
    const rootDir = createRoot("first.md", "second.md");
    const schedule = createSchedule([
      {
        ...article("content/posts/first.md", 100),
        exclude: { groups: ["longtail"], platforms: ["x", "zhihu"] },
        releases: article("content/posts/first.md", 100).releases,
      },
      article("content/posts/second.md", 200),
    ]);

    validatePublishSchedule(rootDir, schedule);
    const actions = findDuePublishActions(schedule, new Date("2026-07-21T09:00:00+08:00"));

    expect(actions.map((action) => `${action.articlePath}:${action.platform}`)).toEqual([
      "content/posts/first.md:juejin",
      "content/posts/first.md:wechat",
    ]);
  });

  test("waits after actual completion time before advancing to the next stage", () => {
    const rootDir = createRoot("first.md");
    const schedule = createSchedule([{
      ...article("content/posts/first.md", 100),
      releases: {
        site: manualSite("first", "2026-07-17T09:00:00+08:00"),
        wechat: published("2026-07-19T09:10:00+08:00", "https://weixin.example/first"),
        zhihu: published("2026-07-19T09:20:00+08:00", "https://zhihu.example/first"),
        juejin: published("2026-07-19T10:00:00+08:00", "https://juejin.example/first"),
      },
    }]);

    validatePublishSchedule(rootDir, schedule);
    expect(findDuePublishActions(schedule, new Date("2026-07-21T09:59:00+08:00"))).toEqual([]);
    expect(findDuePublishActions(schedule, new Date("2026-07-21T10:00:00+08:00"))
      .map((action) => action.platform)).toEqual(["cnblogs", "csdn", "jianshu", "x"]);
  });

  test("records external publishing transitions and refuses to automate the site", () => {
    const rootDir = createRoot("first.md");
    const schedule = createSchedule([article("content/posts/first.md", 100)]);
    validatePublishSchedule(rootDir, schedule);

    expect(() => startRelease(
      schedule,
      "content/posts/first.md",
      "site",
      new Date("2026-07-21T09:00:00+08:00"),
    )).toThrow("site 只允许手动发布");

    const started = startRelease(
      schedule,
      "content/posts/first.md",
      "juejin",
      new Date("2026-07-21T09:00:00+08:00"),
    );
    expect(started).toMatchObject({ status: "publishing", attempts: 1 });
    expect(() => startRelease(
      schedule,
      "content/posts/first.md",
      "juejin",
      new Date("2026-07-21T09:01:00+08:00"),
    )).toThrow("正在发布");

    const blocked = blockRelease(schedule, "content/posts/first.md", "juejin", "platform failed");
    expect(blocked).toMatchObject({ status: "blocked", lastError: "platform failed" });
    expect(findQueueAttention(schedule)).toEqual([
      expect.objectContaining({
        articlePath: "content/posts/first.md",
        platform: "juejin",
        status: "blocked",
        lastError: "platform failed",
      }),
    ]);
    const retried = startRelease(
      schedule,
      "content/posts/first.md",
      "juejin",
      new Date("2026-07-21T10:00:00+08:00"),
    );
    expect(retried.attempts).toBe(2);
    const completed = completeRelease(
      schedule,
      "content/posts/first.md",
      "juejin",
      "https://example.com/posts/first/",
      new Date("2026-07-21T10:10:00+08:00"),
      "abc123",
    );
    expect(completed).toMatchObject({ status: "published", attempts: 2, commitSha: "abc123" });
  });

  test("rejects duplicate positions, drafts, and missing manual site evidence", () => {
    const rootDir = createRoot("first.md", "second.md");
    const duplicate = createSchedule([
      article("content/posts/first.md", 100),
      article("content/posts/second.md", 100),
    ]);
    expect(() => validatePublishSchedule(rootDir, duplicate)).toThrow("queuePosition 重复");

    const excludesSite = createSchedule([{
      ...article("content/posts/first.md", 100),
      exclude: { platforms: ["site"] },
    }]);
    expect(() => validatePublishSchedule(rootDir, excludesSite)).toThrow("不允许排除 site");

    writeFileSync(
      join(rootDir, "content/posts/first.md"),
      "---\ntitle: Test\ndraft: true\n---\n",
      "utf8",
    );
    expect(() => validatePublishSchedule(rootDir, createSchedule([
      article("content/posts/first.md", 100),
    ]))).toThrow("只有 draft: false");

    writeFileSync(
      join(rootDir, "content/posts/first.md"),
      "---\ntitle: Test\n---\n",
      "utf8",
    );
    expect(() => validatePublishSchedule(rootDir, createSchedule([
      article("content/posts/first.md", 100),
    ]))).toThrow("只有 draft: false");

    writeFileSync(
      join(rootDir, "content/posts/first.md"),
      "---\ntitle: Test\ndraft: false\n---\n",
      "utf8",
    );
    expect(() => validatePublishSchedule(rootDir, createSchedule([{
      ...article("content/posts/first.md", 100),
      releases: {},
    }]))).toThrow("缺少主站手动发布记录");

    const siteInPipeline = createSchedule([]);
    siteInPipeline.pipeline.unshift({ name: "site", afterDays: 0, platforms: ["site"] });
    expect(() => validatePublishSchedule(rootDir, siteInPipeline)).toThrow("主站只能手动发布");
  });
});

function createRoot(...files: string[]): string {
  const rootDir = mkdtempSync(join(tmpdir(), "publish-schedule-test-"));
  tempDirs.push(rootDir);
  writeFileSync(join(rootDir, "hugo.toml"), "baseURL = 'https://wyattcoder.top/'\n", "utf8");
  mkdirSync(join(rootDir, "content/posts"), { recursive: true });
  for (const file of files) {
    writeFileSync(join(rootDir, "content/posts", file), "---\ntitle: Test\ndraft: false\n---\n", "utf8");
  }
  return rootDir;
}

function createSchedule(articles: PublishSchedule["articles"]): PublishSchedule {
  return {
    version: 1,
    timezone: "Asia/Shanghai",
    cadenceDays: 2,
    platformGroups: {
      core: ["wechat", "zhihu", "juejin"],
      longtail: ["csdn", "cnblogs", "jianshu"],
      social: ["x"],
    },
    pipeline: [
      { name: "core", afterDays: 2, groups: ["core"] },
      { name: "longtail", afterDays: 2, groups: ["longtail", "social"] },
    ],
    articles,
  };
}

function article(path: string, queuePosition: number): PublishSchedule["articles"][number] {
  const slug = path.split("/").pop()!.replace(/\.md$/, "");
  return {
    path,
    queuePosition,
    exclude: { groups: [], platforms: [] },
    releases: { site: manualSite(slug, "2026-07-19T09:00:00+08:00") },
  };
}

function published(publishedAt: string, url: string): ReleaseState {
  return { status: "published", attempts: 1, publishedAt, url };
}

function manualSite(slug: string, publishedAt: string): ReleaseState {
  return {
    status: "published",
    attempts: 1,
    publicationMethod: "manual",
    publishedAt,
    verifiedAt: "2026-07-21T08:00:00+08:00",
    url: `https://wyattcoder.top/posts/${slug}/`,
  };
}
