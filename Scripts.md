# Scripts

项目类型: Hugo 博客

## 文章发布脚本

首次使用前:

1. 确保本机已安装 `nvm`、Node `v24.14.1`、`pnpm`、`hugo`。
2. 执行 `pnpm install` 安装依赖。
3. 执行 `pnpm publish:setup`，在打开的专用浏览器 profile 中完成:
   - 安装 Wechatsync Chrome 扩展
   - 在扩展设置中启用 `MCP 连接`
   - 复制 Token 并导出环境变量 `WECHATSYNC_TOKEN`
   - 登录掘金和 X
4. 关闭 setup 时打开的浏览器窗口，再执行正式发布。

环境变量:

```bash
export WECHATSYNC_TOKEN="你的 token"
```

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
pnpm publish:article content/posts/my-post.md --platforms juejin,x
```

仅重试外部同步:

```bash
pnpm publish:social content/posts/my-post.md --platforms juejin,x
```

预演流程但不实际发布:

```bash
pnpm publish:article content/posts/my-post.md --dry-run --platforms juejin,x
```

脚本约束:

- 仅支持 `content/posts/*.md`
- 仅允许在 `main` 分支执行
- 执行前工作区必须干净
- 检测到 Hugo shortcode 或本地图片引用会直接失败
- `publish.juejin.category` 是掘金发布必填项
- 当前实现复用 Wechatsync 创建掘金草稿，再通过浏览器登录态自动补元数据并发布
- X 采用本机浏览器自动发摘要链接帖，不走官方 API

运行产物:

- 浏览器 profile: `.publisher-profile/`
- 发布记录: `.publish-records/<timestamp>-<slug>/`

失败恢复:

- 如果失败发生在 `git commit` 之前，文章 front matter 会自动回滚
- 如果失败发生在 `push` 或外部平台同步之后，仓库改动不会自动撤销，需要人工处理
- 失败时会把日志和浏览器截图写入 `.publish-records/`

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
