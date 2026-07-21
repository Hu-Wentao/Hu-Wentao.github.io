import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import matter from "gray-matter";
import { parse as parseToml } from "smol-toml";

import { PublisherError } from "./errors.js";
import type { PostDocument, PostMetadata } from "./types.js";

export function loadBaseUrl(rootDir: string): string {
  const raw = readFileSync(resolve(rootDir, "hugo.toml"), "utf8");
  const parsed = parseToml(raw) as { baseURL?: string };
  if (!parsed.baseURL) {
    throw new PublisherError("hugo.toml 缺少 baseURL");
  }
  return ensureTrailingSlash(parsed.baseURL);
}

export function loadPost(rootDir: string, inputPath: string, baseUrl: string): PostDocument {
  const absolutePath = resolve(rootDir, inputPath);
  const relativePath = relative(rootDir, absolutePath);
  if (!relativePath.startsWith("content/posts/")) {
    throw new PublisherError("v1 只支持 content/posts/*.md");
  }
  const raw = readFileSync(absolutePath, "utf8");
  const parsed = matter(raw);
  const metadata = parsed.data as PostMetadata;
  if (!metadata.title?.trim()) {
    throw new PublisherError(`${relativePath} 缺少 title`);
  }

  const slug = deriveSlug(relativePath, metadata);
  const summary = deriveSummary(metadata.summary, parsed.content);
  return {
    absolutePath,
    relativePath,
    slug,
    raw,
    body: parsed.content,
    title: metadata.title.trim(),
    summary,
    canonicalUrl: buildCanonicalUrl(baseUrl, relativePath, metadata),
    metadata,
  };
}

export function rewriteFrontMatterForPublish(raw: string, publishedAtIso: string): string {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/);
  if (!match) {
    throw new PublisherError("仅支持 YAML front matter（---）");
  }

  let frontMatterBlock = match[1];
  const body = match[2];
  frontMatterBlock = replaceOrInsertScalar(frontMatterBlock, "draft", "false");
  frontMatterBlock = replaceOrInsertScalar(frontMatterBlock, "date", publishedAtIso);
  return `---\n${frontMatterBlock}\n---${body}`;
}

export function buildCanonicalUrl(baseUrl: string, relativePath: string, metadata: PostMetadata): string {
  if (metadata.url?.trim()) {
    const value = metadata.url.trim();
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return new URL(value.replace(/^\//, ""), ensureTrailingSlash(baseUrl)).toString();
  }

  const slug = metadata.slug?.trim() || relativePath.split("/").pop()?.replace(/\.md$/i, "") || "";
  return new URL(`posts/${slug}/`, ensureTrailingSlash(baseUrl)).toString();
}

export function formatIsoWithTimezone(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offsetHour = String(Math.floor(abs / 60)).padStart(2, "0");
  const offsetMinute = String(abs % 60).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`;
}

function replaceOrInsertScalar(frontMatterBlock: string, key: string, value: string): string {
  const pattern = new RegExp(`^(${escapeRegex(key)}\\s*:\\s*).*$`, "m");
  if (pattern.test(frontMatterBlock)) {
    return frontMatterBlock.replace(pattern, `$1${value}`);
  }
  return `${frontMatterBlock}\n${key}: ${value}`;
}

function deriveSlug(relativePath: string, metadata: PostMetadata): string {
  return metadata.slug?.trim() || relativePath.split("/").pop()?.replace(/\.md$/i, "") || "";
}

function deriveSummary(summary: string | undefined, body: string): string {
  const candidate = summary?.trim();
  if (candidate) {
    return candidate;
  }

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((part) => stripMarkdown(part).trim())
    .filter((part) => part.length > 0);
  if (paragraphs.length === 0) {
    return "";
  }

  return paragraphs[0].slice(0, 140);
}

function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
