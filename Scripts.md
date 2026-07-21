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

运行产物:

- 发布记录: `.publish-records/<timestamp>-<slug>/`

失败恢复:

- 如果失败发生在 `git commit` 之前，文章 front matter 会自动回滚
- 如果失败发生在 `push` 之后，仓库改动不会自动撤销，需要人工处理
- 失败时会把日志写入 `.publish-records/`

## 分批发布队列

发布计划和运行状态统一保存在 `publishing/schedule.json`。Codex 定时任务每两天运行一次：

- 推进所有已经到期的历史文章后续批次；
- 按 `queuePosition` 从小到大，最多启动一篇新文章的外部分发；
- 第一批的 `afterDays` 从主站手动发布时间开始计算，后续批次从上一批实际完成时间开始计算；
- 文章可以通过 `exclude.groups` 禁止一类平台，通过 `exclude.platforms` 禁止单个平台；
- 自动队列永远不会发布主站，也不会修改文章的 `draft` 或 `date`。

文章只有同时满足以下条件才能入队：

- front matter 明确为 `draft: false`；
- 用户明确确认文章已在自建博客上手动发布；
- canonical URL 已公开可访问，并经过标题内容验证；
- 队列中保存了 `publicationMethod: "manual"` 的主站发布记录。

建议以 `100` 为间隔设置队列位置，方便在已有文章之间插入新文章：

```json
{
  "path": "content/posts/my-post.md",
  "queuePosition": 200,
  "exclude": {
    "groups": ["longtail"],
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

只读查看当前到期动作：

```bash
pnpm publish:queue due
```

状态必须通过命令转换，不要手工把平台标记为发布完成：

```bash
pnpm publish:queue start \
  --article content/posts/my-post.md \
  --platform juejin

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
