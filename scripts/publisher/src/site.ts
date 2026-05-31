import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { PublisherError } from "./errors.js";
import { formatIsoWithTimezone, rewriteFrontMatterForPublish } from "./content.js";
import type { Logger, PostDocument, ShellRunner, SitePublishResult, SitePublisherPort } from "./types.js";

interface SitePublisherDeps {
  rootDir: string;
  logger: Logger;
  shell: ShellRunner;
  fetchImpl?: typeof fetch;
  deployPollIntervalMs?: number;
  deployTimeoutMs?: number;
}

export class GitSitePublisher implements SitePublisherPort {
  private readonly fetchImpl: typeof fetch;
  private readonly deployPollIntervalMs: number;
  private readonly deployTimeoutMs: number;

  constructor(private readonly deps: SitePublisherDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.deployPollIntervalMs = deps.deployPollIntervalMs ?? 15_000;
    this.deployTimeoutMs = deps.deployTimeoutMs ?? 8 * 60_000;
  }

  async assertWorktreeClean(): Promise<void> {
    const result = await this.deps.shell.run("git", ["status", "--porcelain"], {
      cwd: this.deps.rootDir,
    });
    if (result.stdout.trim().length > 0) {
      throw new PublisherError("工作区不是干净状态，请先处理未提交内容");
    }
  }

  async assertMainBranch(): Promise<void> {
    const result = await this.deps.shell.run("git", ["branch", "--show-current"], {
      cwd: this.deps.rootDir,
    });
    if (result.stdout.trim() !== "main") {
      throw new PublisherError("发布脚本仅允许在 main 分支执行");
    }
  }

  async publishPost(post: PostDocument, publishedAt: Date, dryRun: boolean): Promise<SitePublishResult> {
    const original = readFileSync(post.absolutePath, "utf8");
    const publishedAtIso = formatIsoWithTimezone(publishedAt);
    const updated = rewriteFrontMatterForPublish(original, publishedAtIso);
    const changedFrontMatter = updated !== original;
    if (!changedFrontMatter) {
      throw new PublisherError("front matter 未发生变化，终止发布");
    }

    writeFileSync(post.absolutePath, updated, "utf8");
    let restored = false;
    try {
      await this.runHugoBuild();
      if (dryRun) {
        this.deps.logger.info("dry-run：跳过 git commit/push");
        return {
          publishedAtIso,
          changedFrontMatter,
        };
      }

      await this.deps.shell.run("git", ["add", post.relativePath], { cwd: this.deps.rootDir });
      await this.deps.shell.run("git", ["commit", "-m", `chore: publish ${post.slug}`], {
        cwd: this.deps.rootDir,
      });
      await this.deps.shell.run("git", ["push", "origin", "main"], { cwd: this.deps.rootDir });
      const sha = await this.deps.shell.run("git", ["rev-parse", "HEAD"], { cwd: this.deps.rootDir });
      return {
        publishedAtIso,
        changedFrontMatter,
        commitSha: sha.stdout.trim(),
      };
    } catch (error) {
      writeFileSync(post.absolutePath, original, "utf8");
      restored = true;
      throw error;
    } finally {
      if (dryRun && !restored) {
        writeFileSync(post.absolutePath, original, "utf8");
      }
    }
  }

  async waitForUrl(url: string): Promise<void> {
    this.deps.logger.info(`等待文章链接可访问：${url}`);
    const startedAt = Date.now();
    while (Date.now() - startedAt < this.deployTimeoutMs) {
      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          redirect: "follow",
        });
        if (response.ok) {
          return;
        }
      } catch {
        // ignore
      }
      await delay(this.deployPollIntervalMs);
    }
    throw new PublisherError(`等待部署超时：${url}`);
  }

  private async runHugoBuild(): Promise<void> {
    this.deps.logger.info("执行 Hugo 构建校验");
    await this.deps.shell.run("hugo", ["--gc", "--minify"], { cwd: this.deps.rootDir });
  }
}
