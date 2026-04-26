# Scripts

项目类型: Hugo 博客

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

## 清理

清理 Hugo 构建产物:

```bash
rm -rf public resources .hugo_build.lock
```
