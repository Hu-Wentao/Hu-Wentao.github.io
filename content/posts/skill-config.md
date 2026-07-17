---
title: "让同一个 Skill 适应不同项目：Skill Config 机制"
date: 2026-07-17T00:00:00+08:00
draft: true
summary: "通过通用 Skill、项目 Profile、确定性解析器和内容寻址缓存，让同一套 Agent 工作流在不同仓库中获得可审查、可验证的项目行为"
tags: ["AI", "VibeCoding", "Skill", "软件工程", "配置管理"]
categories: ["Artifacts"]
---

一个可复用 Skill 很容易在第一个项目里工作良好，又在接入第二个项目时迅速长出大量条件分支：如果仓库是 A，就运行 `pnpm test`；如果仓库是 B，就使用另一套目录和发布流程；如果是某个内部项目，还要遵守一组只有它才需要的术语、拓扑和安全规则。

继续把这些差异写进共享 `SKILL.md`，最终会得到一个了解所有项目、却难以在任何项目中独立演进的“万能 Skill”。复制一份 Skill 再分别修改也没有真正解决问题：通用流程修复后需要同步多个副本，项目规则和共享逻辑仍然会逐渐漂移。

为此，我在 [skillcraft](https://github.com/Hu-Wentao/skills/tree/main/skills/skillcraft) 中实现了 Skill Config 机制。它把一个 Skill 的行为拆成三类：

| 内容 | 所有者 | 是否进入版本控制 |
| --- | --- | --- |
| 通用工作流、默认行为和安全不变量 | 可复用 Skill | 是 |
| 项目术语、命令、拓扑和项目政策 | 目标仓库的 Profile | 是 |
| 合并后的有效指令 | 确定性解析器生成的缓存 | 否 |

它的核心可以概括成一句话：

> 共享 Skill 定义“怎样完成这类工作”，项目配置定义“在这个仓库里具体怎样做”，解析器把二者编译成 Agent 本次真正执行的指令。

## 配置不是 Skill 的替代品

并非每个 Skill 都需要项目配置。普通 Skill 仍然可以将完整行为放在自己的 `SKILL.md`、`scripts/` 和 `references/` 中。只有当同一个可复用工作流必须根据仓库中长期维护、需要评审的规则改变行为时，才值得引入 Skill Config。

路径不同也不一定需要配置。如果 Agent 可以廉价、可靠地从 `package.json`、目录结构或现有工具中发现差异，直接发现通常更简单。适合进入配置的是仓库必须明确拥有的决定，例如：

- 项目使用的领域术语和权威文档；
- 构建、验证和发布命令；
- 服务拓扑、环境名称和包管理约定；
- 只对当前项目成立的安全边界与操作政策。

一次性用户输入、密钥、生成结果和运行状态则不属于配置。它们既不应污染共享 Skill，也不应被包装成项目长期规则。

## 三层目录对应三种所有权

一个支持配置的 Skill 在目标仓库中使用以下结构：

~~~text
.agents/
├── skills/<skill-name>/
│   ├── SKILL.md
│   ├── references/<task>.md
│   └── scripts/resolve.py
├── skills-config/<skill-name>/
│   ├── config.yaml
│   └── <profile>.md
└── .cache/<skill-name>/
    └── <task>/<digest>.md
~~~

`.agents/skills/<skill-name>/` 是可复用实现。它包含所有项目都成立的流程、通用 fallback、配置 Schema、解析器以及测试。

`.agents/skills-config/<skill-name>/` 属于目标项目。这里的配置和 Profile 应与代码一起提交、评审和演进，但不应被反向复制到共享 Skill 仓库中。

`.agents/.cache/<skill-name>/` 保存解析器生成的有效指令。它是可重复生成的运行产物，应加入 `.gitignore`，而不是成为第三份人工维护的事实源。

这条边界解决的并不只是代码复用问题。它让通用 Skill 的维护者可以修改跨项目流程，让项目维护者可以修改本地规则，双方都不必取得另一侧全部内容的所有权。

## 一个配置文件怎样描述项目行为

每个 Skill 拥有自己的版本化 Schema。下面是一个假想的 `release-web` Skill 配置：

```yaml
schema: release-web.config.v1
profile: personal-blog
tasks:
  default:
    base: references/default.md
    profile: project.md
    commands:
      validate: pnpm build
```

`tasks` 允许一个 Skill 为不同任务组合不同的通用指令和项目指令。`base` 相对于 `.agents/skills/release-web/`，`profile` 相对于 `.agents/skills-config/release-web/`。`commands` 只是声明项目提供的命令，并不代表解析器有权执行它。

对应的 `project.md` 可以只写当前仓库特有的知识：

```md
# Project Profile

- 使用 pnpm 管理 Node.js 依赖。
- 发布前以 `pnpm build` 验证 Hugo 站点。
- 静态产物位于 `public/`。
```

这样，通用发布流程不需要知道 `personal-blog` 这个项目名，也不需要增加 `if project == ...`。同一份 Skill 安装到另一个仓库后，只需由那个仓库维护自己的 Profile。

## 真正让配置生效的是解析过程

只有配置文件还不够。如果 `SKILL.md` 没有要求 Agent 在执行任务前解析配置，Profile 就只是一份可能永远不会被读取的旁路文档。

因此，支持配置的 Skill 必须将下面的动作写入自身工作流：

```bash
uv run python .agents/skills/<skill-name>/scripts/resolve.py --task <task>
```

`skillcraft` 生成的 resolver 会按确定顺序完成以下工作：

1. 从当前目录向上寻找最近的 Git 仓库根目录；
2. 加载 Skill 内置的通用任务指令；
3. 如果存在 `skills-config/<skill-name>/config.yaml`，校验 Schema 并加载项目 Profile；
4. 先放入通用指令，再追加项目指令和声明式命令；
5. 对所有有效输入计算稳定的 `instructions_id`；
6. 将合并结果写入 `.agents/.cache/`；
7. 返回一份很小的 manifest，由 Agent 读取其中指向的有效指令。

解析结果类似：

```yaml
status: ready
skill: release-web
task: default
profile: personal-blog
instructions_id: release-web/default@7e537ec8d3298b2a
instructions:
  path: .agents/.cache/release-web/default/7e537ec8d3298b2a.md
sources:
  base: .agents/skills/release-web/references/default.md
  profile: .agents/skills-config/release-web/project.md
commands:
  validate: pnpm build
```

Agent 读取 `instructions.path` 后，得到的不是互相独立的几份材料，而是一份包含来源、优先级、通用规则、项目规则和命令声明的完整有效指令。配置从“可能相关的上下文”变成了工作流中必须消费的输入。

## `instructions_id` 是行为指纹

resolver 会把解析器版本、Skill 名称、任务名、Profile 名称、通用指令、项目指令、命令和原始配置共同纳入 SHA-256，再截取摘要生成 `instructions_id`。

这带来两个重要性质：

- 输入不变时，ID 稳定，解析结果可以安全复用；
- 任何会影响行为的输入发生变化时，ID 随之改变，缓存不会悄悄复用旧指令。

因此，`instructions_id` 不是人工维护的版本号，而是本次有效行为的内容指纹。缓存路径也包含同一个摘要，使“哪份指令产生了这次行为”可以被准确追踪，同时避免把生成文件提交进仓库。

## 项目 Profile 有优先级，但没有越权能力

项目指令在与通用“可配置默认值”描述同一个选择时拥有更高优先级。例如，通用指令可以建议运行默认测试命令，而项目 Profile 可以将它替换为仓库自己的验证入口。

但 Profile 不能覆盖所有内容。它始终服从更高层级的 system、developer 和 user 指令，也不能覆盖 Skill 明确声明的不可配置安全不变量、resolver 的 Schema 校验和路径边界。

resolver 还会拒绝绝对路径以及逃逸各自根目录的相对路径。解析前会调用 `resolve()` 规范化路径，再检查最终位置是否仍位于 Skill 或配置目录中，因此 `../../outside.md` 和通过符号链接绕出根目录的文件都不能被当成 Profile 载入。

同样，配置中的命令只会出现在解析结果中。resolver 不执行命令；Agent 是否以及何时执行，仍由 Skill 工作流和用户授权决定。配置决定行为参数，不借机获得额外权限。

## 没有配置时仍然必须可用

项目配置是增强模式，不是使用 Skill 的前置条件。找不到 `config.yaml` 时，resolver 会直接加载 `references/<task>.md`，并返回 `profile: generic`。

这个 fallback 很重要。它保证 Skill 可以先作为普通通用能力安装和使用，也允许项目在确实出现稳定差异之后再引入 Profile，而不必为每个仓库创建一份空配置。

反过来，如果仓库已经提供了配置，却请求了其中不存在的任务，resolver 会明确报错，而不是悄悄退回 generic。显式配置意味着项目已经接管了这部分行为，拼写错误和缺失映射不应被默认值掩盖。

## 测试的是“同一个 Skill，不同的行为”

配置解析器至少需要验证以下场景：

- 无配置时可以使用 generic fallback；
- 通用指令与项目 Profile 按顺序组合；
- 输入不变时 `instructions_id` 保持稳定；
- 错误 Schema 和未配置任务被拒绝；
- `base` 与 `profile` 不能逃逸各自根目录；
- 同一份 Skill 放入两个不同临时仓库后，会得到不同的 Profile、命令、有效指令和 `instructions_id`。

最后一项尤其关键。单独证明“配置文件能被读取”并不能证明共享 Skill 已经与项目事实解耦；只有相同 Skill 无需修改自身代码，就能在两个仓库中解析出不同且正确的行为，机制才真正成立。

## 用 skillcraft 创建支持配置的 Skill

安装 `skillcraft` 后，可以用 `--project-config` 初始化解析器、通用任务参考、配置契约和 resolver 测试：

```bash
uv run python /path/to/skillcraft/scripts/init_skill.py release-web \
  --path .agents/skills \
  --project-config \
  --interface display_name="Release Web" \
  --interface short_description="Release a web project safely" \
  --interface default_prompt="Use $release-web to release this project."
```

生成脚手架只是开始。接下来仍需根据真实任务修改通用参考、任务名、Schema 和 Profile，并运行结构校验与 resolver 测试：

```bash
uv run python /path/to/skillcraft/scripts/quick_validate.py \
  .agents/skills/release-web

uv run python \
  .agents/skills/release-web/scripts/tests/test_resolve.py
```

`skillcraft` 也可以像普通 Skill 一样安装：

```bash
pnpm dlx skills add Hu-Wentao/wyatt_skills \
  --skill skillcraft \
  --yes
```

## 结语

Skill Config 的目标不是把 `SKILL.md` 变成另一种配置系统，而是建立清晰的行为所有权：通用方法属于共享 Skill，项目事实属于目标仓库，运行时合成结果属于可丢弃缓存。

版本化 Schema 让配置可以演进，路径校验守住文件边界，声明式命令避免解析阶段越权，generic fallback 保留独立可用性，`instructions_id` 则把一次有效行为变成可追踪的内容指纹。最关键的是，`SKILL.md` 明确要求执行 resolver，让这些设计不只存在于目录结构中，而是真正进入 Agent 的执行链路。

当项目差异不再以条件分支回流到共享 Skill，同一个工作流才能同时保持可复用和项目感知：通用能力只维护一次，每个仓库仍然拥有、评审并验证自己的做法。

## 相关

- [skillcraft Skill](https://github.com/Hu-Wentao/skills/tree/main/skills/skillcraft)
- [wyatt_skills](https://github.com/Hu-Wentao/skills)
