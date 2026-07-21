import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { PublisherError } from "./errors.js";
import { loadBaseUrl, loadPost } from "./content.js";
import type {
  DuePublishAction,
  PublishPipelineStage,
  PublishSchedule,
  QueueAttentionItem,
  QueuedArticle,
  ReleaseState,
} from "./types.js";

export const DEFAULT_SCHEDULE_PATH = "publishing/schedule.json";

export function loadPublishSchedule(rootDir: string, inputPath = DEFAULT_SCHEDULE_PATH): PublishSchedule {
  const schedulePath = resolveInsideRoot(rootDir, inputPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(schedulePath, "utf8"));
  } catch (error) {
    throw new PublisherError(`无法读取发布计划 ${relative(rootDir, schedulePath)}：${errorMessage(error)}`);
  }
  validatePublishSchedule(rootDir, parsed);
  return parsed;
}

export function validatePublishSchedule(rootDir: string, value: unknown): asserts value is PublishSchedule {
  if (!isRecord(value)) {
    throw new PublisherError("发布计划必须是 JSON 对象");
  }
  if (value.version !== 1) {
    throw new PublisherError("发布计划 version 必须为 1");
  }
  if (typeof value.timezone !== "string" || value.timezone.trim().length === 0) {
    throw new PublisherError("发布计划缺少 timezone");
  }
  if (!isPositiveInteger(value.cadenceDays)) {
    throw new PublisherError("cadenceDays 必须是正整数");
  }
  if (!isRecord(value.platformGroups)) {
    throw new PublisherError("platformGroups 必须是对象");
  }

  const platformGroups: Record<string, string[]> = {};
  for (const [group, platforms] of Object.entries(value.platformGroups)) {
    platformGroups[group] = requireStringArray(platforms, `platformGroups.${group}`);
  }

  if (!Array.isArray(value.pipeline) || value.pipeline.length === 0) {
    throw new PublisherError("pipeline 至少需要一个阶段");
  }
  const pipeline = value.pipeline.map((stage, index) => validateStage(stage, index, platformGroups));
  const stageNames = new Set<string>();
  const stagedPlatforms = new Set<string>();
  for (const stage of pipeline) {
    if (stageNames.has(stage.name)) {
      throw new PublisherError(`pipeline 阶段名称重复：${stage.name}`);
    }
    stageNames.add(stage.name);
    const platforms = resolveStagePlatforms(stage, platformGroups);
    if (platforms.length === 0) {
      throw new PublisherError(`pipeline 阶段没有平台：${stage.name}`);
    }
    for (const platform of platforms) {
      if (stagedPlatforms.has(platform)) {
        throw new PublisherError(`平台只能出现在一个 pipeline 阶段：${platform}`);
      }
      stagedPlatforms.add(platform);
    }
  }
  if (stagedPlatforms.has("site")) {
    throw new PublisherError("pipeline 不允许包含 site；主站只能手动发布");
  }

  if (!Array.isArray(value.articles)) {
    throw new PublisherError("articles 必须是数组");
  }
  const positions = new Set<number>();
  const paths = new Set<string>();
  const knownPlatforms = new Set(["site", ...pipeline.flatMap((stage) =>
    resolveStagePlatforms(stage, platformGroups))]);
  const baseUrl = value.articles.length > 0 ? loadBaseUrl(rootDir) : "";
  for (const article of value.articles) {
    validateArticle(rootDir, article, platformGroups, knownPlatforms, baseUrl);
    if (positions.has(article.queuePosition)) {
      throw new PublisherError(`queuePosition 重复：${article.queuePosition}`);
    }
    if (paths.has(article.path)) {
      throw new PublisherError(`文章重复入队：${article.path}`);
    }
    positions.add(article.queuePosition);
    paths.add(article.path);
  }
}

export function findDuePublishActions(schedule: PublishSchedule, now: Date): DuePublishAction[] {
  if (Number.isNaN(now.getTime())) {
    throw new PublisherError("无效的调度时间");
  }

  const actions: DuePublishAction[] = [];
  const sortedArticles = [...schedule.articles].sort((left, right) => left.queuePosition - right.queuePosition);
  const startedArticles = sortedArticles.filter((article) => hasStartedDistribution(article));
  for (const article of startedArticles) {
    actions.push(...findDueContinuationActions(schedule, article, now));
  }

  const nextArticle = sortedArticles.find((article) => !hasStartedDistribution(article));
  if (nextArticle) {
    actions.push(...findDueContinuationActions(schedule, nextArticle, now));
  }

  return actions.sort((left, right) => {
    const timeDifference = Date.parse(left.dueAt) - Date.parse(right.dueAt);
    return timeDifference || left.queuePosition - right.queuePosition || left.platform.localeCompare(right.platform);
  });
}

export function findQueueAttention(schedule: PublishSchedule): QueueAttentionItem[] {
  return schedule.articles.flatMap((article) =>
    Object.entries(article.releases ?? {})
      .filter(([, release]) => release.status === "publishing" || release.status === "blocked")
      .map(([platform, release]) => ({
        articlePath: article.path,
        platform,
        status: release.status as "publishing" | "blocked",
        startedAt: release.startedAt,
        lastError: release.lastError,
      })));
}

export function startRelease(
  schedule: PublishSchedule,
  articlePath: string,
  platform: string,
  now: Date,
): ReleaseState {
  const article = findArticle(schedule, articlePath);
  if (platform === "site") {
    throw new PublisherError("site 只允许手动发布，不能由自动队列执行");
  }
  assertPlatformAllowed(schedule, article, platform);
  const existing = article.releases?.[platform];
  if (existing?.status === "published") {
    throw new PublisherError(`${articlePath} 已发布到 ${platform}`);
  }
  if (existing?.status === "publishing") {
    throw new PublisherError(`${articlePath} 正在发布到 ${platform}`);
  }
  const next: ReleaseState = {
    status: "publishing",
    attempts: (existing?.attempts ?? 0) + 1,
    startedAt: now.toISOString(),
  };
  article.releases = article.releases ?? {};
  article.releases[platform] = next;
  return next;
}

export function completeRelease(
  schedule: PublishSchedule,
  articlePath: string,
  platform: string,
  url: string,
  now: Date,
  commitSha?: string,
): ReleaseState {
  const article = findArticle(schedule, articlePath);
  const existing = requirePublishingRelease(article, platform);
  if (!/^https?:\/\//i.test(url)) {
    throw new PublisherError("发布完成时必须提供公开的 http(s) URL");
  }
  const next: ReleaseState = {
    status: "published",
    attempts: existing.attempts,
    startedAt: existing.startedAt,
    publishedAt: now.toISOString(),
    url,
    ...(commitSha ? { commitSha } : {}),
  };
  article.releases![platform] = next;
  return next;
}

export function blockRelease(
  schedule: PublishSchedule,
  articlePath: string,
  platform: string,
  error: string,
): ReleaseState {
  const article = findArticle(schedule, articlePath);
  const existing = requirePublishingRelease(article, platform);
  const next: ReleaseState = {
    status: "blocked",
    attempts: existing.attempts,
    startedAt: existing.startedAt,
    lastError: error.trim() || "未知错误",
  };
  article.releases![platform] = next;
  return next;
}

export function writePublishSchedule(
  rootDir: string,
  schedule: PublishSchedule,
  inputPath = DEFAULT_SCHEDULE_PATH,
): void {
  validatePublishSchedule(rootDir, schedule);
  const schedulePath = resolveInsideRoot(rootDir, inputPath);
  const temporaryPath = resolve(dirname(schedulePath), `.${schedulePath.split("/").pop()}.tmp`);
  writeFileSync(temporaryPath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, schedulePath);
}

function findDueContinuationActions(
  schedule: PublishSchedule,
  article: QueuedArticle,
  now: Date,
): DuePublishAction[] {
  const site = article.releases?.site;
  if (site?.status !== "published" || !site.publishedAt) {
    return [];
  }

  let previousStageCompletedAt = new Date(site.publishedAt);
  if (Number.isNaN(previousStageCompletedAt.getTime())) {
    throw new PublisherError(`${article.path} 的 site.publishedAt 无效`);
  }

  const actions: DuePublishAction[] = [];
  for (const stage of schedule.pipeline) {
    const dueAt = addDays(previousStageCompletedAt, stage.afterDays);
    const allowedPlatforms = allowedStagePlatforms(schedule, article, stage);
    const incomplete = allowedPlatforms.filter((platform) => article.releases?.[platform]?.status !== "published");
    const activelyPublishing = incomplete.some((platform) => article.releases?.[platform]?.status === "publishing");
    const blocked = incomplete.some((platform) => article.releases?.[platform]?.status === "blocked");

    if (dueAt <= now && !activelyPublishing) {
      for (const platform of incomplete) {
        if (article.releases?.[platform]?.status !== "blocked") {
          actions.push({
            articlePath: article.path,
            platform,
            stage: stage.name,
            queuePosition: article.queuePosition,
            dueAt: dueAt.toISOString(),
          });
        }
      }
    }

    if (activelyPublishing || blocked || incomplete.length > 0) {
      break;
    }
    const completionTimes = allowedPlatforms
      .map((platform) => article.releases?.[platform]?.publishedAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value));
    previousStageCompletedAt = completionTimes.length > 0
      ? new Date(Math.max(...completionTimes.map((value) => value.getTime())))
      : dueAt;
  }
  return actions;
}

function validateStage(
  value: unknown,
  index: number,
  platformGroups: Record<string, string[]>,
): PublishPipelineStage {
  if (!isRecord(value)) {
    throw new PublisherError(`pipeline[${index}] 必须是对象`);
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw new PublisherError(`pipeline[${index}] 缺少 name`);
  }
  if (!Number.isInteger(value.afterDays) || (value.afterDays as number) < 0) {
    throw new PublisherError(`pipeline[${index}].afterDays 必须是非负整数`);
  }
  const platforms = value.platforms === undefined
    ? undefined
    : requireStringArray(value.platforms, `pipeline[${index}].platforms`);
  const groups = value.groups === undefined
    ? undefined
    : requireStringArray(value.groups, `pipeline[${index}].groups`);
  if ((platforms?.length ?? 0) + (groups?.length ?? 0) === 0) {
    throw new PublisherError(`pipeline[${index}] 至少需要 platforms 或 groups`);
  }
  for (const group of groups ?? []) {
    if (!(group in platformGroups)) {
      throw new PublisherError(`pipeline[${index}] 引用了未知平台组：${group}`);
    }
  }
  return { name: value.name, afterDays: value.afterDays as number, platforms, groups };
}

function validateArticle(
  rootDir: string,
  value: unknown,
  platformGroups: Record<string, string[]>,
  knownPlatforms: Set<string>,
  baseUrl: string,
): asserts value is QueuedArticle {
  if (!isRecord(value)) {
    throw new PublisherError("articles 中的每一项都必须是对象");
  }
  if (typeof value.path !== "string" || !value.path.startsWith("content/posts/") || !value.path.endsWith(".md")) {
    throw new PublisherError("文章 path 必须匹配 content/posts/*.md");
  }
  const articlePath = resolveInsideRoot(rootDir, value.path);
  if (!existsSync(articlePath)) {
    throw new PublisherError(`队列文章不存在：${value.path}`);
  }
  const post = loadPost(rootDir, value.path, baseUrl);
  if (post.metadata.draft !== false) {
    throw new PublisherError(`只有 draft: false 的文章才能进入自动发布队列：${value.path}`);
  }
  if (!isPositiveInteger(value.queuePosition)) {
    throw new PublisherError(`${value.path} 的 queuePosition 必须是正整数`);
  }
  if (value.exclude !== undefined) {
    if (!isRecord(value.exclude)) {
      throw new PublisherError(`${value.path} 的 exclude 必须是对象`);
    }
    const groups = value.exclude.groups === undefined
      ? []
      : requireStringArray(value.exclude.groups, `${value.path}.exclude.groups`);
    const platforms = value.exclude.platforms === undefined
      ? []
      : requireStringArray(value.exclude.platforms, `${value.path}.exclude.platforms`);
    for (const group of groups) {
      if (!(group in platformGroups)) {
        throw new PublisherError(`${value.path} 排除了未知平台组：${group}`);
      }
    }
    for (const platform of platforms) {
      if (!knownPlatforms.has(platform)) {
        throw new PublisherError(`${value.path} 排除了未知平台：${platform}`);
      }
    }
    if (platforms.includes("site") || groups.some((group) => platformGroups[group].includes("site"))) {
      throw new PublisherError(`${value.path} 不允许排除 site`);
    }
  }
  if (value.releases !== undefined) {
    if (!isRecord(value.releases)) {
      throw new PublisherError(`${value.path} 的 releases 必须是对象`);
    }
    for (const [platform, release] of Object.entries(value.releases)) {
      if (!knownPlatforms.has(platform)) {
        throw new PublisherError(`${value.path} 包含未知发布状态：${platform}`);
      }
      validateRelease(value.path, platform, release);
    }
  }
  const siteRelease = isRecord(value.releases) ? value.releases.site : undefined;
  if (!isRecord(siteRelease)
    || siteRelease.status !== "published"
    || siteRelease.publicationMethod !== "manual") {
    throw new PublisherError(`${value.path} 缺少主站手动发布记录`);
  }
  if (siteRelease.url !== post.canonicalUrl) {
    throw new PublisherError(`${value.path} 的主站发布 URL 必须等于 canonical URL：${post.canonicalUrl}`);
  }
  if (typeof siteRelease.verifiedAt !== "string" || Number.isNaN(Date.parse(siteRelease.verifiedAt))) {
    throw new PublisherError(`${value.path} 的 site.verifiedAt 无效`);
  }
  if (Date.parse(siteRelease.verifiedAt) < Date.parse(String(siteRelease.publishedAt))) {
    throw new PublisherError(`${value.path} 的主站验证时间不能早于手动发布时间`);
  }
}

function validateRelease(articlePath: string, platform: string, value: unknown): asserts value is ReleaseState {
  if (!isRecord(value) || !["publishing", "published", "blocked"].includes(String(value.status))) {
    throw new PublisherError(`${articlePath} 的 ${platform} 发布状态无效`);
  }
  if (!isPositiveInteger(value.attempts)) {
    throw new PublisherError(`${articlePath} 的 ${platform}.attempts 必须是正整数`);
  }
  if (value.status === "published") {
    if (typeof value.publishedAt !== "string" || Number.isNaN(Date.parse(value.publishedAt))) {
      throw new PublisherError(`${articlePath} 的 ${platform}.publishedAt 无效`);
    }
    if (typeof value.url !== "string" || !/^https?:\/\//i.test(value.url)) {
      throw new PublisherError(`${articlePath} 的 ${platform}.url 无效`);
    }
  }
}

function allowedStagePlatforms(
  schedule: PublishSchedule,
  article: QueuedArticle,
  stage: PublishPipelineStage,
): string[] {
  const excludedGroups = new Set(article.exclude?.groups ?? []);
  const excludedPlatforms = new Set(article.exclude?.platforms ?? []);
  const groupPlatforms = (stage.groups ?? [])
    .filter((group) => !excludedGroups.has(group))
    .flatMap((group) => schedule.platformGroups[group]);
  return [...new Set([...(stage.platforms ?? []), ...groupPlatforms])]
    .filter((platform) => !excludedPlatforms.has(platform));
}

function resolveStagePlatforms(stage: PublishPipelineStage, groups: Record<string, string[]>): string[] {
  return [...new Set([
    ...(stage.platforms ?? []),
    ...(stage.groups ?? []).flatMap((group) => groups[group] ?? []),
  ])];
}

function assertPlatformAllowed(schedule: PublishSchedule, article: QueuedArticle, platform: string): void {
  const stage = schedule.pipeline.find((candidate) =>
    resolveStagePlatforms(candidate, schedule.platformGroups).includes(platform));
  if (!stage) {
    throw new PublisherError(`未知发布平台：${platform}`);
  }
  if (!allowedStagePlatforms(schedule, article, stage).includes(platform)) {
    throw new PublisherError(`${article.path} 的策略禁止发布到 ${platform}`);
  }
}

function hasStartedDistribution(article: QueuedArticle): boolean {
  return Object.keys(article.releases ?? {}).some((platform) => platform !== "site");
}

function findArticle(schedule: PublishSchedule, articlePath: string): QueuedArticle {
  const article = schedule.articles.find((candidate) => candidate.path === articlePath);
  if (!article) {
    throw new PublisherError(`文章不在发布队列中：${articlePath}`);
  }
  return article;
}

function requirePublishingRelease(article: QueuedArticle, platform: string): ReleaseState {
  const release = article.releases?.[platform];
  if (release?.status !== "publishing") {
    throw new PublisherError(`${article.path} 的 ${platform} 当前不是 publishing 状态`);
  }
  return release;
}

function resolveInsideRoot(rootDir: string, inputPath: string): string {
  const absoluteRoot = resolve(rootDir);
  const target = resolve(absoluteRoot, inputPath);
  const relativePath = relative(absoluteRoot, target);
  if (relativePath.startsWith("..") || relativePath === "") {
    throw new PublisherError(`路径必须位于项目内：${inputPath}`);
  }
  return target;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new PublisherError(`${field} 必须是非空字符串数组`);
  }
  if (new Set(value).size !== value.length) {
    throw new PublisherError(`${field} 不允许重复值`);
  }
  return value;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
