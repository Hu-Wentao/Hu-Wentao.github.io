export interface PublishConfig {
  cover?: string;
  juejin?: {
    category?: string;
    tags?: string[];
  };
  x?: {
    text?: string;
  };
}

export interface PostMetadata {
  title: string;
  date?: string | Date;
  draft?: boolean;
  summary?: string;
  tags?: string[];
  categories?: string[];
  slug?: string;
  url?: string;
  publish?: PublishConfig;
}

export interface PostDocument {
  absolutePath: string;
  relativePath: string;
  slug: string;
  raw: string;
  body: string;
  title: string;
  summary: string;
  canonicalUrl: string;
  metadata: PostMetadata;
}

export interface PublishOptions {
  command: "publish:article";
  dryRun: boolean;
}

export interface SitePublishResult {
  publishedAtIso: string;
  commitSha?: string;
  changedFrontMatter: boolean;
}

export interface PublishRunResult {
  postPath: string;
  canonicalUrl: string;
  recordDir: string;
  dryRun: boolean;
  commitSha?: string;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface ShellRunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  allowFailure?: boolean;
}

export interface ShellRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellRunner {
  run(command: string, args: string[], options?: ShellRunOptions): Promise<ShellRunResult>;
}

export interface SitePublisherPort {
  assertWorktreeClean(): Promise<void>;
  assertMainBranch(): Promise<void>;
  publishPost(post: PostDocument, publishedAt: Date, dryRun: boolean): Promise<SitePublishResult>;
  waitForUrl(url: string): Promise<void>;
}

export type ReleaseStatus = "publishing" | "published" | "blocked";

export interface ReleaseState {
  status: ReleaseStatus;
  attempts: number;
  publicationMethod?: "manual";
  startedAt?: string;
  publishedAt?: string;
  verifiedAt?: string;
  url?: string;
  commitSha?: string;
  lastError?: string;
}

export interface PublishPipelineStage {
  name: string;
  afterDays: number;
  platformSource?: "wechatsync_authenticated_drafts";
  platforms?: string[];
  groups?: string[];
}

export interface QueuedArticle {
  path: string;
  queuePosition: number;
  exclude?: {
    groups?: string[];
    platforms?: string[];
  };
  releases?: Record<string, ReleaseState>;
}

export interface PublishSchedule {
  version: 1;
  timezone: string;
  cadenceDays: number;
  discovery: {
    enabledAfter: string;
  };
  platformGroups: Record<string, string[]>;
  pipeline: PublishPipelineStage[];
  articles: QueuedArticle[];
}

export interface DiscoverableArticle {
  path: string;
  title: string;
  publishedAt: string;
  canonicalUrl: string;
}

export interface DuePublishAction {
  articlePath: string;
  platform: string;
  stage: string;
  queuePosition: number;
  dueAt: string;
}

export interface QueueAttentionItem {
  articlePath: string;
  platform: string;
  status: "publishing" | "blocked";
  startedAt?: string;
  lastError?: string;
}
