import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { FileLogger } from "../src/logger.js";
import { PublishService } from "../src/service.js";
import { GitSitePublisher } from "../src/site.js";
import type {
  Logger,
  PostDocument,
  PublishOptions,
  PublishRunResult,
  ShellRunOptions,
  ShellRunResult,
  ShellRunner,
  SocialPublisherPort,
} from "../src/types.js";

class FakeShellRunner implements ShellRunner {
  constructor(private readonly handler: (command: string, args: string[]) => ShellRunResult | Promise<ShellRunResult>) {}

  async run(command: string, args: string[], _options?: ShellRunOptions): Promise<ShellRunResult> {
    const result = await this.handler(command, args);
    if (result.exitCode !== 0) {
      throw new Error(`${command} failed`);
    }
    return result;
  }
}

class FakeSocialPublisher implements SocialPublisherPort {
  readonly events: string[] = [];

  async assertReady(_post: PostDocument, _options: PublishOptions): Promise<void> {
    this.events.push("ready");
  }

  async publish(_post: PostDocument, _options: PublishOptions): Promise<Pick<PublishRunResult, "juejin" | "x">> {
    this.events.push("publish");
    return {
      x: {
        status: "published",
        text: "hello",
        url: "https://x.com/test/status/1",
      },
    };
  }
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("publish service", () => {
  test("site publisher restores original file when hugo build fails", async () => {
    const rootDir = createTempRepo();
    const postPath = join(rootDir, "content/posts/demo.md");
    const original = readFileSync(postPath, "utf8");
    const logger = new FileLogger(join(rootDir, ".publish-records/test.log"));
    const site = new GitSitePublisher({
      rootDir,
      logger,
      shell: new FakeShellRunner((command) => {
        if (command === "git") {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "build failed", exitCode: 1 };
      }),
    });

    await expect(site.publishPost({
      absolutePath: postPath,
      relativePath: "content/posts/demo.md",
      slug: "demo",
      raw: original,
      body: "正文",
      title: "Demo",
      summary: "摘要",
      canonicalUrl: "https://wyattcoder.top/posts/demo/",
      metadata: { title: "Demo" },
    }, new Date("2026-06-01T09:00:00+08:00"), false)).rejects.toThrow();

    expect(readFileSync(postPath, "utf8")).toBe(original);
  });

  test("publishArticle dry-run stops before social publish", async () => {
    const rootDir = createTempRepo();
    const logger = new FileLogger(join(rootDir, ".publish-records/test.log"));
    const shell = new FakeShellRunner((command, args) => {
      if (command === "git" && args[0] === "status") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (command === "git" && args[0] === "branch") {
        return { stdout: "main\n", stderr: "", exitCode: 0 };
      }
      if (command === "hugo") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    const site = new GitSitePublisher({
      rootDir,
      logger,
      shell,
      fetchImpl: async () => new Response(null, { status: 200 }) as Response,
    });
    const social = new FakeSocialPublisher();
    const service = new PublishService({
      rootDir,
      recordDir: join(rootDir, ".publish-records/run"),
      sitePublisher: site,
      socialPublisher: social,
    });

    const result = await service.publishArticle("content/posts/demo.md", {
      command: "publish:article",
      dryRun: true,
      platforms: ["x"],
    });

    expect(result.dryRun).toBe(true);
    expect(social.events).toEqual(["ready"]);
  });
});

function createTempRepo(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "publisher-test-"));
  tempDirs.push(rootDir);
  writeFileSync(join(rootDir, "hugo.toml"), "baseURL = 'https://wyattcoder.top/'\n", "utf8");
  mkdirSync(join(rootDir, "content/posts"), { recursive: true });
  writeFileSync(
    join(rootDir, "content/posts/demo.md"),
    `---\ntitle: "Demo"\ndate: 2026-05-31T00:00:00+08:00\ndraft: true\nsummary: "摘要"\ntags: ["AI"]\npublish:\n  juejin:\n    category: "人工智能"\n---\n\n正文\n`,
    "utf8",
  );
  return rootDir;
}
