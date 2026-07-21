import { parseArgs } from "node:util";

import { PublisherError } from "./errors.js";
import {
  blockRelease,
  completeRelease,
  DEFAULT_SCHEDULE_PATH,
  findDuePublishActions,
  findQueueAttention,
  loadPublishSchedule,
  startRelease,
  writePublishSchedule,
} from "./schedule.js";

function main(): void {
  const [command, ...argv] = process.argv.slice(2);
  const parsed = parseArgs({
    args: argv,
    options: {
      schedule: { type: "string", default: DEFAULT_SCHEDULE_PATH },
      article: { type: "string" },
      platform: { type: "string" },
      platforms: { type: "string" },
      at: { type: "string" },
      url: { type: "string" },
      "commit-sha": { type: "string" },
      error: { type: "string" },
    },
    strict: true,
  });
  const rootDir = process.cwd();
  const schedule = loadPublishSchedule(rootDir, parsed.values.schedule);
  const now = parsed.values.at ? new Date(parsed.values.at) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new PublisherError("--at 必须是有效时间");
  }

  if (command === "validate") {
    print({ valid: true, articles: schedule.articles.length });
    return;
  }
  if (command === "due") {
    const runtimePlatforms = requireRuntimePlatforms(schedule, parsed.values.platforms);
    print({
      checkedAt: now.toISOString(),
      attention: findQueueAttention(schedule),
      actions: findDuePublishActions(schedule, now, runtimePlatforms),
    });
    return;
  }

  const article = requireOption(parsed.values.article, "--article");
  const platform = requireOption(parsed.values.platform, "--platform");
  let release;
  if (command === "start") {
    release = startRelease(
      schedule,
      article,
      platform,
      now,
      requireRuntimePlatforms(schedule, parsed.values.platforms),
    );
  } else if (command === "complete") {
    release = completeRelease(
      schedule,
      article,
      platform,
      requireOption(parsed.values.url, "--url"),
      now,
      parsed.values["commit-sha"],
    );
  } else if (command === "block") {
    release = blockRelease(schedule, article, platform, requireOption(parsed.values.error, "--error"));
  } else {
    throw new PublisherError("用法：pnpm publish:queue <validate|due|start|complete|block> [options]");
  }

  writePublishSchedule(rootDir, schedule, parsed.values.schedule);
  print({ article, platform, release });
}

function requireRuntimePlatforms(schedule: ReturnType<typeof loadPublishSchedule>, value: string | undefined): string[] {
  const requiresRuntimePlatforms = schedule.pipeline.some((stage) => stage.platformSource !== undefined);
  if (!requiresRuntimePlatforms) {
    return [];
  }
  if (!value?.trim()) {
    throw new PublisherError("动态 Wechatsync 队列必须提供 --platforms <已登录且支持草稿的平台ID，逗号分隔>");
  }
  const platforms = value.split(",").map((platform) => platform.trim()).filter(Boolean);
  if (platforms.length === 0 || new Set(platforms).size !== platforms.length) {
    throw new PublisherError("--platforms 必须是无重复的平台 ID，使用逗号分隔");
  }
  if (platforms.includes("site")) {
    throw new PublisherError("--platforms 不允许包含 site");
  }
  return platforms;
}

function requireOption(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new PublisherError(`缺少 ${name}`);
  }
  return value.trim();
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
