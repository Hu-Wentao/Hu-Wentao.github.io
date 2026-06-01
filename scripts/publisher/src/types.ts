export type Platform = "juejin" | "x";

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
  date?: string;
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
  command: "publish:article" | "publish:social";
  dryRun: boolean;
  platforms: Platform[];
}

export interface SitePublishResult {
  publishedAtIso: string;
  commitSha?: string;
  changedFrontMatter: boolean;
}

export interface JuejinPublishResult {
  draftId?: string;
  articleId?: string;
  url?: string;
  status: "published" | "dry-run";
}

export interface XPublishResult {
  text: string;
  url?: string;
  status: "published" | "dry-run";
}

export interface PublishRunResult {
  postPath: string;
  canonicalUrl: string;
  recordDir: string;
  dryRun: boolean;
  commitSha?: string;
  juejin?: JuejinPublishResult;
  x?: XPublishResult;
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

export interface SocialPublisherPort {
  assertReady(post: PostDocument, options: PublishOptions): Promise<void>;
  publish(post: PostDocument, options: PublishOptions): Promise<Pick<PublishRunResult, "juejin" | "x">>;
}
