# Scripts

项目类型: Hugo 博客

## 文章发布脚本

首次使用前:

1. 确保本机已安装 `nvm`、Node `v24.14.1`、`pnpm`、`hugo`。
2. 执行 `pnpm install` 安装依赖。
3. 若需同步到外部平台，在主 Chrome 中安装 Wechatsync 扩展并启用 `MCP 连接`。
4. 在主 Chrome 中登录目标平台，并把 Wechatsync MCP 配置到 Codex。

新增 front matter 可选配置:

```yaml
publish:
  cover: "https://example.com/cover.jpg"
  juejin:
    category: "人工智能"
    tags: ["AI", "工程化"]
  x:
    text: "自定义 X 文案"
```

完整发布指定文章:

```bash
pnpm publish:article content/posts/my-post.md
```

外部平台发布不能直接通过 `pnpm` 执行。请在 Codex 中明确指定平台，例如:

```text
正式发布 content/posts/my-post.md，并同步到掘金和 X
```

Codex 会先使用 Wechatsync MCP 与主 Chrome 扩展创建草稿，再使用主 Chrome
登录态完成最终发布。发布流程不会创建或使用独立浏览器 profile。

预演流程但不实际发布:

```bash
pnpm publish:article content/posts/my-post.md --dry-run
```

脚本约束:

- 仅支持 `content/posts/*.md`
- 仅允许在 `main` 分支执行
- 执行前工作区必须干净
- `pnpm publish:article` 只负责网站发布，不会向外部平台发送内容
- 外部平台发布必须由 Codex 的 `publish-blog-article` skill 编排
- 掘金同步先由 Wechatsync 创建草稿，再由主 Chrome 补齐元数据并发布
- X 使用主 Chrome 发布摘要链接帖，不走官方 API
- Hacker News 使用独立的手动翻译发布流程，不走 Wechatsync 或自动队列

运行产物:

- 发布记录: `.publish-records/<timestamp>-<slug>/`

失败恢复:

- 如果失败发生在 `git commit` 之前，文章 front matter 会自动回滚
- 如果失败发生在 `push` 之后，仓库改动不会自动撤销，需要人工处理
- 失败时会把日志写入 `.publish-records/`

## 手动翻译并发布到 Hacker News

Hacker News 只接收英文文章标题和公开 URL，完整译文先发布到本站。该流程必须由用户明确触发，例如：

```text
翻译并发布 content/posts/my-post.md 到 Hacker News
```

Codex 使用项目 Skill `$publish-hacker-news` 执行以下流程：

1. 验证中文原文已经在主站正式发布；
2. 创建同名 `content/posts/my-post.en.md` 英文译文；
3. 将英文页面发布到 `/en/posts/my-post/` 并验证部署；
4. 检查是否已经存在相同 URL 的 Hacker News 投稿；
5. 使用主 Chrome 登录态提交标题和 URL；
6. 验证公开 item URL，并写回英文文章 front matter。

英文译文必须包含以下配置：

```yaml
publish:
  autoSyndication: false
  hackerNews:
    title: "English submission title"
    # 投稿成功后由 Codex 写入：
    # itemUrl: "https://news.ycombinator.com/item?id=123"
    # submittedAt: "2026-07-31T12:00:00+08:00"
```

`autoSyndication: false` 会阻止文章进入分批发布队列。`hacker-news` 也是代码级 manual-only 平台，不能出现在 `platformGroups`、`pipeline`、`--platforms` 或队列 release 记录中。准备译文但不投稿时，可以明确要求“仅准备 Hacker News 英文译文”。

## 分批发布队列

发布计划和运行状态统一保存在 `publishing/schedule.json`。Codex 定时任务每两天运行一次：

- 自动发现 front matter `date` 严格晚于 `discovery.enabledAfter` 的新文章；启用前的历史文章永不自动导入；
- 跳过 front matter 设置了 `publish.autoSyndication: false` 的文章；
- 只在文章已被 Git 跟踪且无本地修改、`draft: false`、主站 canonical URL 可访问并包含准确标题时自动入队；
- 自动入队使用当前最大 `queuePosition + 100`，随后立即计算是否到期；已超过间隔的文章可在同一次任务中直接分发；
- 推进所有已经到期的历史文章后续批次；
- 按 `queuePosition` 从小到大，最多启动一篇新文章的外部分发；
- 第一批的 `afterDays` 从主站手动发布时间开始计算，后续批次从上一批实际完成时间开始计算；
- 每次运行都从 Wechatsync 强制刷新平台状态，只选择 `isAuthenticated: true` 且同时支持 `article`、`draft` 的外部平台；
- X 是例外：登录状态仍由 Wechatsync 的本次刷新结果确认，但只通过主 Chrome 发布“摘要 + 主站 canonical URL”的普通帖子，不同步完整文章，也不创建 X Article；
- 平台文档、历史列表和 `platformGroups` 都不能代替本次运行的连接状态；
- 文章可以通过 `exclude.groups` 禁止一类平台，通过 `exclude.platforms` 禁止单个平台；
- 自动队列永远不会发布主站，也不会修改文章的 `draft` 或 `date`。
- Hacker News 永远不会成为自动队列目标。

文章只有同时满足以下条件才能入队：

- front matter 明确为 `draft: false`；
- front matter `date` 严格晚于自动发现启用时间；
- 文章已被 Git 跟踪且没有未提交修改；
- canonical URL 已公开可访问，并经过标题内容验证；
- 队列中保存了 `publicationMethod: "manual"` 的主站发布记录。

建议以 `100` 为间隔设置队列位置，方便在已有文章之间插入新文章：

```json
{
  "path": "content/posts/my-post.md",
  "queuePosition": 200,
  "exclude": {
    "groups": [],
    "platforms": ["x"]
  },
  "releases": {
    "site": {
      "status": "published",
      "attempts": 1,
      "publicationMethod": "manual",
      "publishedAt": "2026-07-21T09:00:00+08:00",
      "verifiedAt": "2026-07-21T10:00:00+08:00",
      "url": "https://wyattcoder.top/posts/my-post/"
    }
  }
}
```

修改计划后执行校验：

```bash
pnpm publish:queue validate
```

只读发现启用后新发布、尚未入队的文章：

```bash
pnpm publish:queue discover
```

完成主站 URL 与标题验证后入队：

```bash
pnpm publish:queue enqueue \
  --article content/posts/my-post.md \
  --title "文章的准确标题" \
  --url https://wyattcoder.top/posts/my-post/
```

只读查看当前到期动作：

```bash
pnpm publish:queue due --platforms <本次刷新得到的逗号分隔平台ID>
```

若刷新成功但没有合格平台，使用 `--platforms=`；任务会保留队列并等待下次运行。

状态必须通过命令转换，不要手工把平台标记为发布完成：

```bash
pnpm publish:queue start \
  --article content/posts/my-post.md \
  --platform juejin \
  --platforms <本次刷新得到的逗号分隔平台ID>

pnpm publish:queue complete \
  --article content/posts/my-post.md \
  --platform juejin \
  --url https://juejin.cn/post/example

pnpm publish:queue block \
  --article content/posts/my-post.md \
  --platform juejin \
  --error "需要重新登录"
```

`publishing` 状态用于阻止任务异常中断后的重复发布。`blocked` 状态需要人工确认后，才能再次执行 `start` 重试。队列的管理和定时执行流程由项目 Skill `$manage-blog-publishing` 约束。

## 本地预览

启动本地开发服务器:

```bash
hugo server -D
```

指定端口启动:

```bash
hugo server -D --port 1313
```

草稿和未来时间内容一起预览:

```bash
hugo server -D -F
```

## 构建

本地构建静态站点:

```bash
hugo
```

清理后重新构建:

```bash
rm -rf public resources && hugo
```

## 新建内容

新建文章:

```bash
hugo new posts/my-post.md
```

新建项目:

```bash
hugo new projects/my-project.md
```

## 主题与依赖

首次拉取仓库后初始化子模块:

```bash
git submodule update --init --recursive
```

同步主题子模块到仓库记录的版本:

```bash
git submodule update --init --recursive
```

拉取主题子模块远端最新提交并合并到当前工作区:

```bash
git submodule update --remote --merge themes/PaperMod
```

## 常用检查

查看工作区状态:

```bash
git status
```

查看 Hugo 配置是否有明显问题并执行构建:

```bash
hugo --gc --minify
```

校验发布脚本类型和测试:

```bash
pnpm typecheck
pnpm test
```

## 清理

清理 Hugo 构建产物:

```bash
rm -rf public resources .hugo_build.lock
```
