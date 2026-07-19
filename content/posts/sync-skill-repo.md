---
title: "把项目里的 Skill 改动安全送回源码仓库：sync-skill-repo"
date: 2026-07-19T00:00:00+08:00
draft: true
summary: "通过本机源码仓库注册表、skills-lock.json、双工作区预检和单 Skill 提交，将项目内验证过的 Skill 改动安全同步回源码仓库"
tags: ["AI", "VibeCoding", "Skill", "Git", "开发工具"]
categories: ["Artifacts"]
---

一个可复用 Skill 安装到项目之后，真正暴露问题的地方往往不是它的源码仓库，而是实际使用它的项目。

项目会提供真实的目录结构、包管理器、权限边界和协作约定。Agent 在这里修正 `SKILL.md`、补充脚本或完善测试，经过几轮任务后，本地这份 Skill 通常会比最初安装的版本更可靠。然而，改动也很容易就此停留在项目中：手工复制回源码仓库容易选错目录、漏掉文件，直接提交又可能混入源码仓库里原有的其他工作。

为此，我实现了 [sync-skill-repo](https://github.com/Hu-Wentao/skills/tree/main/skills/sync-skill-repo) Skill。它将“把项目内修改过的 Skill 发布回源码仓库”变成一条有明确来源、有预检、有验证、只提交目标 Skill 的工作流。

它的核心可以概括成一句话：

> 用项目的 lock 文件说明 Skill 来自哪里，用本机注册表找到对应源码仓库，再把已确认的项目版本校验、提交并推送回去。

## 为什么不能只用 `cp -R`

一次同步同时涉及两个 Git 工作区：

- **项目工作区**保存正在被真实任务使用的 Skill，它是本次要发布的内容来源；
- **Skill 源码仓库**保存可复用版本，它是要提交和推送的目标。

如果只执行一次目录复制，仍然有几个问题没有答案：

1. 这份 Skill 最初来自哪个仓库？
2. 源码仓库在当前电脑的哪个路径？
3. monorepo 中的目标是 `skills/foo/`，还是其他嵌套目录？
4. 项目内未提交的修改是不是用户确认要发布的版本？
5. 源码仓库是否还有另一批未完成工作？
6. 复制后的 Skill 能否通过结构校验？
7. 最终提交是否只包含这一个 Skill？

`sync-skill-repo` 处理的正是复制命令前后的这些边界。复制本身很简单，困难的是建立一条不会猜测目标、不会悄悄混入其他改动的发布链路。

## 用 lock 文件描述来源，用注册表描述本机路径

项目通常已经通过 `skills-lock.json` 记录 Skill 的安装来源。一个条目可能类似：

```json
{
  "version": 1,
  "skills": {
    "demo-skill": {
      "source": "Hu-Wentao/skills",
      "skillPath": "skills/demo-skill/SKILL.md"
    }
  }
}
```

这里的 `source` 是可移植的仓库标识，`skillPath` 则说明 Skill 在源码仓库中的位置。它们适合进入项目版本控制，但不能说明源码仓库在某一台电脑上被检出到哪里。

本机路径由独立注册表保存：

```text
${CODEX_HOME:-$HOME/.codex}/skill-source-repositories.json
```

第一次使用时，在当前机器上登记源码仓库：

```bash
uv run python /path/to/sync-skill-repo/scripts/sync_skill_repo.py \
  register /path/to/local-skill-source-repository
```

脚本会读取仓库的 `origin`，将 SSH、HTTPS 和 `owner/repo` 等写法规范化为同一个来源标识，并验证登记路径确实是 Git 工作树根目录。如果仓库没有可用的 `origin`，可以显式传入来源：

```bash
uv run python /path/to/sync-skill-repo/scripts/sync_skill_repo.py \
  register /path/to/repository \
  --source example/skills
```

仓库改过名字，或者历史 lock 文件仍使用旧名称时，可以重复使用 `--alias` 登记别名。

这层拆分很重要：项目只保存可共享的来源身份，机器相关的绝对路径留在用户目录，不会被误提交到项目仓库，也不要求每位协作者使用相同的目录布局。

## 目标解析是一条确定性链路

同步时，脚本先验证 Skill 目录中存在 `SKILL.md`，并要求 front matter 的 `name` 与目录名完全一致。随后从 Skill 目录向项目 Git 根目录查找最近的 `skills-lock.json`，读取同名 Skill 的 `source` 和可选 `skillPath`，再用本机注册表将来源标识解析为唯一的源码仓库。

整个过程可以表示为：

~~~text
项目内 Skill 目录
      ↓ name 必须与目录名一致
最近的 skills-lock.json
      ↓ source + skillPath
本机源码仓库注册表
      ↓ 唯一的 Git 工作树
源码仓库中的目标 Skill 目录
~~~

如果 lock 条目没有 `skillPath`，目标默认是 `skills/<skill-name>/`。如果项目没有可用的 lock 条目，则必须显式提供源码仓库；目标不使用默认结构时，还要同时提供相对路径：

```bash
uv run python /path/to/sync-skill-repo/scripts/sync_skill_repo.py sync \
  .agents/skills/demo-skill \
  --repo /path/to/source-repository \
  --destination packages/agent-skills/demo-skill \
  --dry-run
```

目标路径必须位于源码仓库内部，不能是绝对路径，也不能通过 `..` 逃逸 Git 根目录。信息不足时直接失败，而不是在多个仓库或目录之间猜一个“最可能”的目标。

## 先 dry run，再决定是否发布

Skill 要求第一次同步始终先执行 dry run：

```bash
uv run python /path/to/sync-skill-repo/scripts/sync_skill_repo.py sync \
  .agents/skills/demo-skill \
  --dry-run
```

预检会报告：

- 项目 Skill、源码仓库和目标目录的绝对路径；
- 目标是由哪个 lock 条目和注册来源解析出来的；
- 当前分支及其 upstream；
- 源码仓库已有多少个未推送提交；
- 哪些文件将新增或更新；
- 哪些只存在于目标目录中的文件会被保留。

这一步不写文件、不提交，也不推送。它让使用者在真正发布前检查“从哪里到哪里”和“具体会改什么”。

如果当前分支处于 detached HEAD，或者没有配置 upstream，预检会停止。已有未推送提交也会被明确报告，因为最后的 `git push` 不只发布新生成的同步提交，还会把当前分支上原有的未推送提交一并推送。

## 两个 dirty 开关确认的是两件不同的事

默认情况下，只要任一侧出现需要人工判断的未提交状态，同步就会停止。

项目内的 Skill 有未提交修改时，脚本要求增加：

```text
--allow-source-dirty
```

这里的 `source` 指本次复制的内容来源，也就是项目内 Skill。这个开关表达的是：“我已经确认，当前工作区中这份尚未提交的 Skill 就是要发布的版本。”它不会顺带允许源码仓库变脏。

如果 Skill 源码仓库存在其他未提交修改，需要先按照仓库协作规则选择“先提交”或“先忽略”。选择先忽略时才增加：

```text
--allow-dirty
```

即使允许源码仓库存在其他改动，只要这些改动与目标 Skill 目录重叠，脚本仍会拒绝继续。同步提交使用带路径限定的 `git add` 和 `git commit`，因此不会把目标目录之外的未提交文件混入本次 commit。

这两个开关不是跳过安全检查的通用 `--force`。前者确认要发布哪一个项目版本，后者确认如何处理源码仓库中不重叠的另一批工作。

## 同步不是镜像删除

确认 dry run 后，去掉 `--dry-run` 执行同步：

```bash
uv run python /path/to/sync-skill-repo/scripts/sync_skill_repo.py sync \
  .agents/skills/demo-skill \
  --allow-source-dirty
```

脚本会复制项目 Skill 中新增和变化的文件，但不会自动删除只存在于目标目录中的文件。这是一项刻意的保守策略：目标仓库可能拥有项目安装副本中没有的说明、测试或维护文件，自动镜像删除会把“安装时未包含”误判成“已经废弃”。

因此，dry run 会将这些文件列为 `PRESERVE`。如果某个目标文件确实已经过时，需要先审查，再单独删除。

复制过程还会排除 Git 元数据、`.env`、`.env.*`、缓存、`node_modules`、`dist`、`.pyc` 等不应回流的内容。项目 Skill 中的符号链接必须仍指向 Skill 目录内部，不能借同步读取目录外的文件。

## 从复制到推送是一条完整事务链

文件复制完成后，脚本会调用已安装的 `skillcraft` 对目标 Skill 执行结构校验。校验失败时不会创建提交，也不会推送。

通过校验后，它只暂存目标 Skill 目录，并创建默认提交：

```text
feat: sync demo-skill skill
```

也可以使用 `--message` 指定提交信息。最后，脚本执行普通 `git push`，不会 force push，并报告 commit SHA、分支与 upstream。如果项目版本与源码版本内容相同，则不会产生空提交。

一次完整操作通常是：

```bash
# 1. 只读检查解析结果、Git 状态和文件变化
uv run python /path/to/sync-skill-repo/scripts/sync_skill_repo.py sync \
  .agents/skills/demo-skill \
  --dry-run

# 2. 确认项目内未提交版本正是要发布的版本后执行
uv run python /path/to/sync-skill-repo/scripts/sync_skill_repo.py sync \
  .agents/skills/demo-skill \
  --allow-source-dirty \
  --message "fix: improve demo skill validation"
```

第二条命令不一定需要 `--allow-source-dirty`。如果项目内 Skill 已经提交且工作区干净，应直接省略它。

## 它刻意不做什么

`sync-skill-repo` 提供的是一条窄而安全的回流路径，不是跨仓库发布平台。它不会：

- 猜测没有登记的源码仓库；
- 自动拉取、变基或解决远端分支冲突；
- 删除目标目录独有的文件；
- 提交源码仓库中不属于目标 Skill 的改动；
- 在 detached HEAD 或没有 upstream 的分支上发布；
- 使用 force push 覆盖远端历史。

如果普通 `git push` 因远端更新而失败，应回到源码仓库按正常 Git 流程处理分支差异，再重新执行同步。Skill 不会把发布便利性置于版本历史安全之上。

## 什么时候适合使用

这个 Skill 适合“可复用 Skill 安装进项目，在真实任务中完成改进，再把改进发布回统一源码”的协作方式。它尤其适合源码仓库与消费项目分离、Skill 通过 `skills-lock.json` 安装，或者多个 Skill 共同存放在 monorepo 中的情况。

如果修改本来就发生在 Skill 的源码仓库里，则无需先复制到另一个位置再同步；脚本也会拒绝把已位于目标源码仓库中的 Skill 同步回自己。项目特有的路径、命令或政策也不应因为“在项目里有效”就全部回流到通用 Skill，这类差异更适合留在项目配置或项目级 Skill 中。

## 结语

可复用 Skill 的改进往往诞生在消费它的项目中，但只有回到源码仓库，才能进入版本历史并被其他项目重新安装。`sync-skill-repo` 在这两者之间补上了一条可审查的发布路径：lock 文件提供来源事实，本机注册表提供路径映射，dry run 暴露文件和 Git 影响，双工作区检查隔离不同批次的修改，`skillcraft` 校验守住 Skill 结构，路径限定提交则确保一次只发布一个 Skill。

它没有试图隐藏 Git，也没有把目录复制包装成魔法。恰恰相反，它把原本依赖记忆和手工检查的关键决定逐项显式化，让“这个项目里已经修好的 Skill”可以可靠地成为“源码仓库里下一次可安装的版本”。

## 相关

- [sync-skill-repo Skill](https://github.com/Hu-Wentao/skills/tree/main/skills/sync-skill-repo)
- [skillcraft Skill](https://github.com/Hu-Wentao/skills/tree/main/skills/skillcraft)
- [wyatt_skills](https://github.com/Hu-Wentao/skills)
