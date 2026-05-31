import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { BrowserContext, Page } from "playwright-core";

import { launchPublisherBrowser } from "./browser.js";
import { buildSyndicationMarkdown, buildXText, normalizedJuejinTags } from "./content.js";
import { PublisherError } from "./errors.js";
import type {
  JuejinPublishResult,
  Logger,
  Platform,
  PostDocument,
  PublishOptions,
  PublishRunResult,
  ShellRunner,
  SocialPublisherPort,
  XPublishResult,
} from "./types.js";

interface SocialPublisherDeps {
  rootDir: string;
  recordDir: string;
  logger: Logger;
  shell: ShellRunner;
  fetchImpl?: typeof fetch;
}

interface JuejinDraftRow {
  draftId: string;
  title: string;
  updatedAt: number;
}

export class BrowserSocialPublisher implements SocialPublisherPort {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly deps: SocialPublisherDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
  }

  async assertReady(post: PostDocument, options: PublishOptions): Promise<void> {
    if (options.platforms.length === 0) {
      return;
    }

    const context = await launchPublisherBrowser(this.deps.rootDir);
    try {
      if (options.platforms.includes("juejin")) {
        this.assertWechatsyncToken();
        await this.assertWechatsyncBridge();
        await this.assertJuejinReady(context);
      }
      if (options.platforms.includes("x")) {
        await this.assertXReady(context);
      }
      this.deps.logger.info(`浏览器侧预检完成：${post.title}`);
    } finally {
      await context.close();
    }
  }

  async publish(post: PostDocument, options: PublishOptions): Promise<Pick<PublishRunResult, "juejin" | "x">> {
    const context = await launchPublisherBrowser(this.deps.rootDir);
    try {
      const result: Pick<PublishRunResult, "juejin" | "x"> = {};
      if (options.platforms.includes("juejin")) {
        result.juejin = await this.publishToJuejin(context, post, options.dryRun);
      }
      if (options.platforms.includes("x")) {
        result.x = await this.publishToX(context, post, options.dryRun);
      }
      return result;
    } finally {
      await context.close();
    }
  }

  private assertWechatsyncToken(): void {
    if (!process.env.WECHATSYNC_TOKEN?.trim()) {
      throw new PublisherError("缺少 WECHATSYNC_TOKEN，请先在专用浏览器扩展中启用 MCP 连接");
    }
  }

  private async assertWechatsyncBridge(): Promise<void> {
    this.deps.logger.info("检查 Wechatsync CLI 连接");
    await this.deps.shell.run("pnpm", ["exec", "wechatsync", "auth", "juejin"], {
      cwd: this.deps.rootDir,
      env: process.env,
    });
  }

  private async assertJuejinReady(context: BrowserContext): Promise<void> {
    const page = await context.newPage();
    try {
      await page.goto("https://juejin.cn/", { waitUntil: "domcontentloaded" });
      await this.listJuejinDrafts(page, "");
    } catch (error) {
      await this.captureFailure(page, "juejin-ready");
      throw new PublisherError("掘金登录态校验失败", error);
    } finally {
      await page.close();
    }
  }

  private async assertXReady(context: BrowserContext): Promise<void> {
    const page = await context.newPage();
    try {
      await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) {
        throw new PublisherError("X 当前未登录");
      }
      await page.locator('[data-testid="AppTabBar_Home_Link"]').first().waitFor({ timeout: 15_000 });
    } catch (error) {
      await this.captureFailure(page, "x-ready");
      throw new PublisherError("X 登录态校验失败", error);
    } finally {
      await page.close();
    }
  }

  private async publishToJuejin(context: BrowserContext, post: PostDocument, dryRun: boolean): Promise<JuejinPublishResult> {
    const markdownPath = join(this.deps.recordDir, `${post.slug}.juejin.md`);
    mkdirSync(this.deps.recordDir, { recursive: true });
    writeFileSync(markdownPath, buildSyndicationMarkdown(post), "utf8");

    if (dryRun) {
      this.deps.logger.info("dry-run：跳过掘金实际发布");
      return { status: "dry-run" };
    }

    const page = await context.newPage();
    try {
      await page.goto("https://juejin.cn/", { waitUntil: "domcontentloaded" });
      const beforeDrafts = await this.listJuejinDrafts(page, post.title);

      this.deps.logger.info("调用 Wechatsync 同步掘金草稿");
      const syncArgs = ["exec", "wechatsync", "sync", markdownPath, "-p", "juejin", "-t", post.title];
      if (post.metadata.publish?.cover) {
        syncArgs.push("--cover", post.metadata.publish.cover);
      }
      await this.deps.shell.run("pnpm", syncArgs, {
        cwd: this.deps.rootDir,
        env: process.env,
      });

      const draft = await this.waitForDraft(page, post.title, new Set(beforeDrafts.map((item) => item.draftId)));
      const categoryId = await this.lookupJuejinCategoryId(post.metadata.publish?.juejin?.category ?? "");
      const tagIds = await this.lookupJuejinTagIds(categoryId, normalizedJuejinTags(post));
      const updatePayload = {
        draft_id: draft.draftId,
        title: post.title,
        mark_content: post.body.trim(),
        brief_content: post.summary,
        category_id: categoryId,
        tag_ids: tagIds,
        cover_image: post.metadata.publish?.cover ?? "",
        edit_type: 10,
        html_content: "deprecated",
      };
      await this.juejinApi(page, "/content_api/v1/article_draft/update", updatePayload);
      const publishResponse = await this.juejinApi<{
        article_id?: string;
      }>(page, "/content_api/v1/article/publish", {
        draft_id: draft.draftId,
        sync_to_org: false,
        column_ids: [],
        theme_ids: [],
      });
      const articleId = String((publishResponse as { article_id?: string }).article_id ?? "");
      if (!articleId) {
        throw new PublisherError("掘金发布成功但未返回 article_id");
      }
      return {
        status: "published",
        draftId: draft.draftId,
        articleId,
        url: `https://juejin.cn/post/${articleId}`,
      };
    } catch (error) {
      await this.captureFailure(page, "juejin-publish");
      throw new PublisherError("掘金发布失败", error);
    } finally {
      await page.close();
    }
  }

  private async publishToX(context: BrowserContext, post: PostDocument, dryRun: boolean): Promise<XPublishResult> {
    const text = buildXText(post);
    if (dryRun) {
      this.deps.logger.info("dry-run：跳过 X 实际发帖");
      return {
        status: "dry-run",
        text,
      };
    }

    const page = await context.newPage();
    try {
      await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
      const profileLocator = page.locator('[data-testid="AppTabBar_Profile_Link"]').first();
      await profileLocator.waitFor({ timeout: 15_000 });
      const profileLink = await profileLocator.getAttribute("href");
      const screenName = profileLink?.replace(/^\//, "");
      if (!screenName) {
        throw new PublisherError("无法识别 X 当前账号");
      }

      await page.goto("https://x.com/compose/post", { waitUntil: "domcontentloaded" });
      const composer = page.locator('[data-testid="tweetTextarea_0"]');
      await composer.waitFor({ timeout: 15_000 });
      await composer.fill(text);

      const responsePromise = page.waitForResponse((response) => {
        return response.url().includes("CreateTweet") && response.request().method() === "POST";
      });
      await page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first().click();
      const response = await responsePromise;
      const payload = (await response.json()) as Record<string, unknown>;
      const tweetId = extractTweetId(payload);
      if (!tweetId) {
        throw new PublisherError("X 发帖响应中未找到 tweet id");
      }

      return {
        status: "published",
        text,
        url: `https://x.com/${screenName}/status/${tweetId}`,
      };
    } catch (error) {
      await this.captureFailure(page, "x-publish");
      throw new PublisherError("X 发帖失败", error);
    } finally {
      await page.close();
    }
  }

  private async listJuejinDrafts(page: Page, keyword: string): Promise<JuejinDraftRow[]> {
    const response = await this.juejinApi<Array<Record<string, unknown>>>(page, "/content_api/v1/article_draft/list_by_user", {
      page_no: 1,
      page_size: 20,
      keyword,
    });
    return response
      .map((entry) => normalizeDraftRow(entry))
      .filter((entry): entry is JuejinDraftRow => Boolean(entry));
  }

  private async waitForDraft(page: Page, title: string, beforeIds: Set<string>): Promise<JuejinDraftRow> {
    const timeoutMs = 30_000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const drafts = await this.listJuejinDrafts(page, title);
      const candidate = drafts
        .filter((item) => item.title === title)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .find((item) => !beforeIds.has(item.draftId)) ?? drafts
        .filter((item) => item.title === title)
        .sort((left, right) => right.updatedAt - left.updatedAt)[0];
      if (candidate) {
        return candidate;
      }
      await delay(2_000);
    }
    throw new PublisherError(`未找到 Wechatsync 创建的掘金草稿：${title}`);
  }

  private async lookupJuejinCategoryId(categoryName: string): Promise<string> {
    const response = await this.fetchImpl("https://api.juejin.cn/tag_api/v1/query_category_list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const payload = (await response.json()) as {
      data?: Array<{ category_id?: string; category?: { category_name?: string } }>;
    };
    const match = payload.data?.find((item) => item.category?.category_name === categoryName);
    if (!match?.category_id) {
      throw new PublisherError(`未找到掘金分类：${categoryName}`);
    }
    return match.category_id;
  }

  private async lookupJuejinTagIds(categoryId: string, tagNames: string[]): Promise<string[]> {
    const response = await this.fetchImpl("https://api.juejin.cn/tag_api/v1/query_tag_list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        cate_id: categoryId,
        cursor: "0",
      }),
    });
    const payload = (await response.json()) as {
      data?: Array<{ tag_id?: string; tag?: { tag_name?: string } }>;
    };
    const tagMap = new Map<string, string>();
    for (const item of payload.data ?? []) {
      if (item.tag_id && item.tag?.tag_name) {
        tagMap.set(item.tag.tag_name, item.tag_id);
      }
    }
    const ids = tagNames.map((tagName) => {
      const id = tagMap.get(tagName);
      if (!id) {
        throw new PublisherError(`掘金分类 ${categoryId} 下未找到标签：${tagName}`);
      }
      return id;
    });
    return ids;
  }

  private async juejinApi<T>(page: Page, path: string, body: Record<string, unknown>): Promise<T> {
    const result = await page.evaluate(
      async ({ path, body }) => {
        const response = await fetch(`https://api.juejin.cn${path}`, {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const text = await response.text();
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
        return {
          ok: response.ok,
          status: response.status,
          payload,
        };
      },
      { path, body },
    );

    if (!result.ok) {
      throw new PublisherError(`掘金接口请求失败：${path}（HTTP ${result.status}）`);
    }
    const payload = result.payload as { err_no?: number; err_msg?: string; data?: T };
    if (typeof payload === "string") {
      throw new PublisherError(`掘金接口返回非 JSON：${path}`);
    }
    if (payload.err_no !== 0) {
      throw new PublisherError(`掘金接口报错：${path} ${payload.err_msg ?? "unknown error"}`);
    }
    return payload.data as T;
  }

  private async captureFailure(page: Page, name: string): Promise<void> {
    mkdirSync(this.deps.recordDir, { recursive: true });
    const target = join(this.deps.recordDir, `${name}.png`);
    await page.screenshot({ path: target, fullPage: true }).catch(() => undefined);
  }
}

function normalizeDraftRow(entry: Record<string, unknown>): JuejinDraftRow | null {
  const base = (entry.article_draft as Record<string, unknown> | undefined) ?? entry;
  const draftId = base.id ?? base.draft_id;
  const title = base.title;
  const updatedAt = Number(base.mtime ?? base.ctime ?? Date.now());
  if (!draftId || !title) {
    return null;
  }
  return {
    draftId: String(draftId),
    title: String(title),
    updatedAt,
  };
}

function extractTweetId(payload: Record<string, unknown>): string | undefined {
  const data = payload.data as Record<string, unknown> | undefined;
  const createTweet = data?.create_tweet as Record<string, unknown> | undefined;
  const tweetResults = createTweet?.tweet_results as Record<string, unknown> | undefined;
  const result = tweetResults?.result as Record<string, unknown> | undefined;
  const restId = result?.rest_id;
  return typeof restId === "string" ? restId : undefined;
}
