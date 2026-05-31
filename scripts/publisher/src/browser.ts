import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium, type BrowserContext } from "playwright-core";

import { PublisherError } from "./errors.js";
import type { Logger } from "./types.js";

export function profileDir(rootDir: string): string {
  return join(rootDir, ".publisher-profile");
}

export async function launchPublisherBrowser(rootDir: string): Promise<BrowserContext> {
  const userDataDir = profileDir(rootDir);
  mkdirSync(userDataDir, { recursive: true });

  const executablePath = process.env.PUBLISHER_BROWSER_PATH || findChromeExecutable();
  if (!executablePath) {
    throw new PublisherError("未找到 Chrome，可通过 PUBLISHER_BROWSER_PATH 指定浏览器路径");
  }

  return chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: process.env.PUBLISHER_BROWSER_HEADLESS === "1",
    viewport: { width: 1440, height: 960 },
  });
}

export async function openSetupBrowser(rootDir: string, logger: Logger): Promise<void> {
  const context = await launchPublisherBrowser(rootDir);
  const pages = context.pages();
  const page = pages[0] ?? (await context.newPage());
  await page.goto("https://www.wechatsync.com/", { waitUntil: "domcontentloaded" });
  await context.newPage().then((tab) => tab.goto("https://juejin.cn/", { waitUntil: "domcontentloaded" }));
  await context.newPage().then((tab) => tab.goto("https://x.com/home", { waitUntil: "domcontentloaded" }));

  logger.info("已打开专用浏览器 profile，请安装 Wechatsync 扩展、启用 MCP 连接并登录掘金/X");
  await new Promise<void>((resolve) => {
    context.on("close", () => resolve());
    process.on("SIGINT", () => resolve());
  });
  await context.close().catch(() => undefined);
}

function findChromeExecutable(): string | undefined {
  const candidates = process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
      ]
    : process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/snap/bin/chromium",
        ];

  return candidates.find((candidate) => existsSync(candidate));
}
