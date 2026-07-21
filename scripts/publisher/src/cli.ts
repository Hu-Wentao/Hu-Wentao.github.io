import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";

import { PublisherError } from "./errors.js";
import { FileLogger } from "./logger.js";
import { GitSitePublisher } from "./site.js";
import { PublishService } from "./service.js";
import type { PublishOptions, ShellRunOptions, ShellRunResult, ShellRunner } from "./types.js";

class ProcessShellRunner implements ShellRunner {
  async run(command: string, args: string[], options: ShellRunOptions = {}): Promise<ShellRunResult> {
    return new Promise((resolveResult, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (exitCode) => {
        const result = {
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
        };
        if ((exitCode ?? 1) !== 0 && !options.allowFailure) {
          reject(new PublisherError(`${command} ${args.join(" ")} 执行失败\n${stderr || stdout}`));
          return;
        }
        resolveResult(result);
      });
    });
  }
}

async function main(): Promise<void> {
  const [command, maybePostPath, ...rest] = process.argv.slice(2);
  if (!command) {
    throw new PublisherError("用法：pnpm publish:article <post-path> [--dry-run]");
  }

  const rootDir = process.cwd();
  const recordDir = createRecordDir(rootDir, maybePostPath);
  const logger = new FileLogger(resolve(recordDir, "run.log"));
  const shell = new ProcessShellRunner();

  if (!maybePostPath) {
    throw new PublisherError(`${command} 缺少文章路径`);
  }

  const options = parsePublishOptions(command, rest);
  const sitePublisher = new GitSitePublisher({
    rootDir,
    logger,
    shell,
  });
  const service = new PublishService({
    rootDir,
    recordDir,
    sitePublisher,
  });

  const result = await service.publishArticle(maybePostPath, options);

  logger.info(`完成：${JSON.stringify(result)}`);
}

function parsePublishOptions(command: string, argv: string[]): PublishOptions {
  if (command !== "publish:article") {
    throw new PublisherError(`未知命令：${command}`);
  }

  const parsed = parseArgs({
    args: argv,
    options: {
      "dry-run": {
        type: "boolean",
        default: false,
      },
      platforms: {
        type: "string",
        default: "",
      },
    },
    allowPositionals: true,
  });

  const platforms = parsed.values.platforms
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (platforms.length > 0) {
    throw new PublisherError("外部平台发布必须从 Codex 发起，以便使用主 Chrome 登录态");
  }

  return {
    command,
    dryRun: parsed.values["dry-run"],
  };
}

function createRecordDir(rootDir: string, postPath: string | undefined): string {
  const slug = (postPath ?? "setup").split("/").pop()?.replace(/\.md$/i, "") ?? "run";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = resolve(rootDir, ".publish-records", `${stamp}-${slug}`);
  mkdirSync(target, { recursive: true });
  return target;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
