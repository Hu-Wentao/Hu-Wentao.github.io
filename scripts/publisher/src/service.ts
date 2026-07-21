import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadBaseUrl, loadPost } from "./content.js";
import type {
  PublishOptions,
  PublishRunResult,
  SitePublisherPort,
} from "./types.js";

interface PublishServiceDeps {
  rootDir: string;
  recordDir: string;
  sitePublisher: SitePublisherPort;
}

export class PublishService {
  constructor(private readonly deps: PublishServiceDeps) {}

  async publishArticle(postPath: string, options: PublishOptions): Promise<PublishRunResult> {
    const baseUrl = loadBaseUrl(this.deps.rootDir);
    const post = loadPost(this.deps.rootDir, postPath, baseUrl);

    await this.deps.sitePublisher.assertWorktreeClean();
    await this.deps.sitePublisher.assertMainBranch();

    const publishedAt = new Date();
    const siteResult = await this.deps.sitePublisher.publishPost(post, publishedAt, options.dryRun);
    const result: PublishRunResult = {
      postPath: post.relativePath,
      canonicalUrl: post.canonicalUrl,
      recordDir: this.deps.recordDir,
      dryRun: options.dryRun,
      commitSha: siteResult.commitSha,
    };

    if (!options.dryRun) {
      await this.deps.sitePublisher.waitForUrl(post.canonicalUrl);
    }

    this.writeResult(result);
    return result;
  }

  private writeResult(result: PublishRunResult): void {
    mkdirSync(this.deps.recordDir, { recursive: true });
    writeFileSync(join(this.deps.recordDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  }
}
