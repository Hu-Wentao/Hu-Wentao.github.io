import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadBaseUrl, loadPost, validatePlatformMetadata, validatePostContent } from "./content.js";
import type {
  PublishOptions,
  PublishRunResult,
  SitePublisherPort,
  SocialPublisherPort,
} from "./types.js";

interface PublishServiceDeps {
  rootDir: string;
  recordDir: string;
  sitePublisher: SitePublisherPort;
  socialPublisher: SocialPublisherPort;
}

export class PublishService {
  constructor(private readonly deps: PublishServiceDeps) {}

  async publishArticle(postPath: string, options: PublishOptions): Promise<PublishRunResult> {
    const baseUrl = loadBaseUrl(this.deps.rootDir);
    const post = loadPost(this.deps.rootDir, postPath, baseUrl);
    validatePostContent(post);
    validatePlatformMetadata(post, options.platforms);

    await this.deps.sitePublisher.assertWorktreeClean();
    await this.deps.sitePublisher.assertMainBranch();
    await this.deps.socialPublisher.assertReady(post, options);

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
      Object.assign(result, await this.deps.socialPublisher.publish(post, options));
    }

    this.writeResult(result);
    return result;
  }

  async publishSocial(postPath: string, options: PublishOptions): Promise<PublishRunResult> {
    const baseUrl = loadBaseUrl(this.deps.rootDir);
    const post = loadPost(this.deps.rootDir, postPath, baseUrl);
    validatePostContent(post);
    validatePlatformMetadata(post, options.platforms);

    await this.deps.sitePublisher.assertWorktreeClean();
    await this.deps.sitePublisher.assertMainBranch();
    await this.deps.sitePublisher.waitForUrl(post.canonicalUrl);
    await this.deps.socialPublisher.assertReady(post, options);

    const result: PublishRunResult = {
      postPath: post.relativePath,
      canonicalUrl: post.canonicalUrl,
      recordDir: this.deps.recordDir,
      dryRun: options.dryRun,
    };

    if (!options.dryRun) {
      Object.assign(result, await this.deps.socialPublisher.publish(post, options));
    }

    this.writeResult(result);
    return result;
  }

  private writeResult(result: PublishRunResult): void {
    mkdirSync(this.deps.recordDir, { recursive: true });
    writeFileSync(join(this.deps.recordDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  }
}
