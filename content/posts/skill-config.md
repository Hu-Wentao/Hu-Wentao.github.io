---
title: "Skillcraft：创建可复用 Skill，并让它适应不同项目"
date: 2026-07-17T00:00:00+08:00
lastmod: 2026-07-20T00:00:00+08:00
draft: true
summary: "Skillcraft 是 skill-creator 的完整替代：它覆盖 Skill 的设计、初始化、验证与前向测试，并通过 Skill Config 将通用能力和项目规则安全地组合起来"
tags: ["AI", "VibeCoding", "Skill", "软件工程", "配置管理"]
categories: ["Artifacts"]
---

创建一个 Skill 并不难。写一份 `SKILL.md`，告诉 Agent 什么时候使用它、遇到任务后怎样工作，就已经可以把一段临时提示词变成可复用能力。

真正困难的是继续维护它。

随着 Skill 被用于更多任务，说明会越来越长，脚本、参考资料和模板开始混在一起；接入第二个项目后，共享逻辑中又会出现项目专属命令、目录和条件分支。最终，Skill 要么成为一个消耗大量上下文的万能说明书，要么被复制成多个无法同步的项目版本。

为此，我实现了 [skillcraft](https://github.com/Hu-Wentao/skills/tree/main/skills/skillcraft)。它是一套创建、更新、验证和测试 Codex Skill 的完整工作流，也是 `skill-creator` 的直接替代。普通 Skill 可以继续保持自包含；当同一 Skill 确实需要在不同仓库中表现出不同的长期行为时，再启用它最重要的扩展：Skill Config。

它的核心可以概括成一句话：

> 先把能力设计成简洁、可验证的通用 Skill；只有项目必须拥有的差异，才通过可审查的配置注入。

## Skillcraft 不只是一个初始化脚本

`skillcraft` 保留了 `skill-creator` 的完整能力。名称不同，是为了避免与系统内置 Skill 发生发现冲突，而不是缩小适用范围。

它覆盖一个 Skill 的完整生命周期：

1. 用真实请求理解 Skill 应该解决什么问题；
2. 判断哪些内容属于通用指令、脚本、参考资料或输出资产；
3. 初始化目录和 `agents/openai.yaml`；
4. 编写或更新 `SKILL.md` 与配套资源；
5. 运行结构校验和脚本测试；
6. 用接近真实用户请求的任务做前向测试；
7. 根据实际失败继续收紧或简化 Skill。

创建新 Skill 时，`skillcraft` 会生成符合约定的目录骨架；更新已有 Skill 时，则跳过初始化，直接检查触发描述、工作流、资源与 UI 元数据是否仍然一致。对于复杂 Skill，它还强调使用隔离上下文做前向测试：测试者只看到待测 Skill 和真实任务，不提前知道预期答案或作者的诊断，避免“因为泄题而通过”。

因此，`skillcraft` 管理的不是一次文件生成，而是从需求理解到验证迭代的完整工程过程。

## 一个 Skill 应该怎样组织

`skillcraft` 使用标准 Skill 结构：

~~~text
<skill-name>/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
├── references/
└── assets/
~~~

其中只有 `SKILL.md` 必需，其他目录按需创建：

| 组成 | 职责 |
| --- | --- |
| `SKILL.md` | 定义触发条件、核心工作流和资源导航 |
| `agents/openai.yaml` | 提供展示名称、简短描述和默认提示等 UI 元数据 |
| `scripts/` | 保存需要确定性、会被反复执行的程序 |
| `references/` | 保存只在特定任务中才需要加载的详细知识 |
| `assets/` | 保存会被复制或用于最终产物的模板、图片、字体等文件 |

这里最重要的设计原则是渐进式披露。Agent 总能看到 Skill 的 `name` 和 `description`，Skill 被触发后才读取 `SKILL.md` 正文，遇到具体任务时再按需读取 reference 或调用 script。

~~~text
name + description
        ↓ Skill 被触发
     SKILL.md
        ↓ 当前任务需要
scripts / references / assets
~~~

这也是为什么 `description` 必须同时写清楚“做什么”和“何时使用”，而 `SKILL.md` 应只保留工作流与必要导航。大段领域资料放进 `references/`，重复且脆弱的操作写成 `scripts/`，供输出使用但不需要进入上下文的文件放进 `assets/`。

Skill 不需要为了看起来完整而同时拥有这三个目录，也不应再附带 `README.md`、安装指南、快速参考和变更日志等面向人的辅助文档。Skill 中的每个文件都应该直接帮助另一个 Agent 完成任务。

## 自由度应该与任务风险匹配

`skillcraft` 不追求把所有操作都写成脚本。它要求根据任务的稳定性和风险选择约束强度：

- 当多种方案都成立、选择依赖当前上下文时，使用高自由度的文字原则；
- 当存在推荐模式但允许局部变化时，使用伪代码或带参数的脚本；
- 当步骤脆弱、顺序错误会造成损失时，提供确定性脚本和严格检查。

这条原则同时避免两个极端：既不让 Agent 每次从头猜测高风险操作，也不把本来需要判断的工作硬编码成无法适应上下文的流水线。

## 普通 Skill 已经覆盖大多数场景

没有 `--project-config` 时，`skillcraft` 创建的是普通自包含 Skill。下面的命令会生成 `SKILL.md`、UI 元数据，以及实际需要的脚本和参考资料目录：

```bash
uv run python /path/to/skillcraft/scripts/init_skill.py release-package \
  --path "${CODEX_HOME:-$HOME/.codex}/skills" \
  --resources scripts,references \
  --interface display_name="Release Package" \
  --interface short_description="Release a package with validated steps" \
  --interface default_prompt="Use $release-package to prepare this release."
```

初始化后仍要删除占位内容、实现真实资源并运行验证：

```bash
uv run --with pyyaml python \
  /path/to/skillcraft/scripts/quick_validate.py \
  "${CODEX_HOME:-$HOME/.codex}/skills/release-package"
```

如果 Skill 只需要一套跨项目都成立的流程，到这里就足够了。不同仓库只是文件路径略有差异，而且这些差异可以可靠发现，也没有必要引入配置。

## Skill Config 解决什么问题

普通 Skill 的边界会在一种场景下遇到困难：工作方法相同，但每个仓库必须长期拥有并评审自己的术语、命令、拓扑或政策。

例如，一个通用发布 Skill 可以规定“读取版本、运行项目验证、构建产物、确认发布边界”的工作流；但不同仓库可能分别使用 `pnpm test`、`uv run pytest` 或 `fvm flutter test`，也可能拥有不同的环境名称、产物目录和恢复政策。

把这些项目事实直接写进共享 `SKILL.md`，会让 Skill 逐渐了解所有使用者。复制 Skill 再分别修改，又会让通用修复无法同步。更隐蔽的错误是在共享脚本中加入项目分支：

```python
# 错误：共享 Skill 开始认识具体项目
if profile == "personal-blog":
    validate_command = "pnpm build"
```

Skill Config 的目标就是让共享能力与项目事实各自拥有明确位置，并在运行时确定性地组合，而不是让一方吞并另一方。

## 三层内容，三个所有者

启用 Skill Config 后，目标仓库采用三层结构：

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

| 内容 | 所有者 | 是否跟踪 |
| --- | --- | --- |
| 通用工作流、fallback、安全不变量、Schema 和 resolver | 可复用 Skill | 是 |
| 项目术语、命令、拓扑、政策和验证入口 | 目标仓库 | 是 |
| 合并后的有效指令 | resolver 生成 | 否 |

`.agents/skills/<skill-name>/` 仍然是可复用 Skill，不能携带某个具体项目的 Profile。`.agents/skills-config/<skill-name>/` 与项目代码一起提交和评审，但不会反向复制进共享 Skill。`.agents/.cache/<skill-name>/` 只是可重复生成的运行产物，应加入 `.gitignore`。

一次性用户输入、密钥、生成结果和运行状态不属于任何 Profile。Skill Config 保存的是仓库需要长期拥有的行为差异，不是一个任意数据存储目录。

## 配置描述任务，不执行任务

每个支持配置的 Skill 拥有自己的版本化 Schema。例如，一个 `release-web` Skill 可以由博客仓库提供以下配置：

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

`base` 相对于 `.agents/skills/release-web/`，用于选择通用任务说明；`profile` 相对于 `.agents/skills-config/release-web/`，用于选择项目说明；`commands` 声明当前项目提供的命令。

对应的 `project.md` 只需要保存这个仓库特有的知识：

```md
# Project Profile

- 使用 pnpm 管理 Node.js 依赖。
- 发布前运行 `pnpm build`。
- 静态产物位于 `public/`。
```

配置中的命令只是 resolver 的输出。解析配置不会执行它们，Agent 是否以及何时运行命令，仍由 Skill 工作流、当前任务和用户授权共同决定。

## Resolver 让配置真正进入执行链路

只生成 `config.yaml` 还不够。如果 Agent 没有被要求读取它，Profile 仍然只是一份旁路文档。

因此，支持配置的 Skill 必须在自己的 `SKILL.md` 中规定：执行相关任务前，先运行 resolver。

```bash
uv run python \
  .agents/skills/<skill-name>/scripts/resolve.py \
  --task <task>
```

`skillcraft` 生成的 resolver 会完成以下工作：

1. 从当前目录向上寻找最近的 Git 仓库根目录；
2. 加载 Skill 内置的通用任务指令；
3. 如果存在项目配置，校验精确 Schema 和任务映射；
4. 分别校验通用 reference 与项目 Profile 的路径边界；
5. 先写入通用指令，再追加项目指令和声明式命令；
6. 对所有有效输入计算稳定的 `instructions_id`；
7. 将结果写入 `.agents/.cache/`；
8. 返回一份小型 manifest，供 Agent 定位并读取有效指令。

一次解析的 manifest 类似：

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

Agent 随后读取 `instructions.path`。它得到的不是三份松散材料，而是一份已经写明来源、优先级、通用规则、项目规则和命令声明的完整指令。只有完成这一步，项目配置才从“仓库中存在的文件”变成 Skill 的实际行为。

## `instructions_id` 是有效行为的指纹

resolver 会把解析器版本、Skill 名称、任务名、Profile 名称、通用指令、项目指令、命令和原始配置共同纳入 SHA-256，截取摘要生成 `instructions_id`。

这使解析结果具有两个性质：

- 输入不变时 ID 稳定，可以准确复用相同结果；
- 任一有效输入改变时 ID 改变，不会悄悄读取旧缓存。

缓存路径包含同一个摘要，所以 `instructions_id` 不是人工维护的版本号，而是“本次 Agent 到底依据哪套有效指令工作”的内容指纹。

## 项目规则优先，但不能越权

当项目指令与通用的可配置默认值描述同一选择时，项目指令优先。例如，通用流程可以要求“运行验证”，项目 Profile 再声明具体使用 `pnpm build`。

Profile 不能覆盖 system、developer 或 user 指令，也不能覆盖 Skill 明确声明的不可配置安全不变量、Schema 校验和路径边界。只有每个消费项目都必须遵守的规则，才适合被标记为不可配置不变量。

resolver 会拒绝绝对路径，以及逃逸各自根目录的相对路径。路径先经过规范化，再检查最终位置是否仍在 Skill 或配置目录中，因此 `../../outside.md` 和通过符号链接指向外部的文件都不能作为配置输入。

`profile` 名称本身也必须被共享代码视为不透明标识。它可以出现在 manifest 中并参与哈希，但不能触发 `if profile == "customer-a"`、字符串集合成员判断或 `match profile` 分支。具体行为必须由所选 Profile 内容和声明式命令表达。

最新的 `quick_validate.py` 会分析支持配置的 Skill 中的 Python AST。一旦共享 `scripts/` 出现具体 Profile 分支，验证就会失败，并要求将行为移回 `.agents/skills-config/<skill-name>/`。这道检查防止项目差异在完成配置拆分后又悄悄回流到共享代码。

## 没有配置时仍然是完整 Skill

Skill Config 是附加模式，不是 `skillcraft` 或生成 Skill 的前置条件。

如果仓库没有 `config.yaml`，resolver 会直接加载 `references/<task>.md`，并返回 `profile: generic`。这让同一 Skill 可以先以通用行为独立使用，等项目出现稳定且值得评审的差异后再增加配置，不需要为所有仓库创建空 Profile。

反过来，如果项目已经提供配置，却请求其中不存在的任务，resolver 会明确失败，而不是悄悄退回 generic。显式配置意味着项目已经接管这部分行为，配置错误不应被默认值掩盖。

## 验证“同一 Skill，不同项目行为”

普通 Skill 需要检查 frontmatter、命名、资源和脚本；配置型 Skill 还必须验证整个解析契约：

- 无配置时使用 generic fallback；
- 通用指令与项目 Profile 按顺序组合；
- 输入不变时 `instructions_id` 稳定；
- 错误 Schema、缺失任务和越界路径被拒绝；
- 同一份 Skill 放入两个临时仓库后，解析出不同的 Profile、命令、指令和 ID；
- resolver 测试只依赖临时 fixture，不依赖承载 Skill 源码的宿主仓库配置；
- 共享脚本没有按具体 Profile 名称分支。

其中，跨两个仓库的测试最能证明所有权边界。仅仅证明 `config.yaml` 可以被读取，并不能证明 Skill 已经摆脱项目硬编码；只有共享实现完全相同，两个仓库仍能得到各自正确的行为，Skill Config 才真正成立。

## 用 Skillcraft 创建配置型 Skill

普通模式和配置模式使用同一个初始化器。只有确实需要项目长期拥有行为差异时，才增加 `--project-config`：

```bash
uv run python /path/to/skillcraft/scripts/init_skill.py release-web \
  --path .agents/skills \
  --project-config \
  --interface display_name="Release Web" \
  --interface short_description="Release a web project safely" \
  --interface default_prompt="Use $release-web to release this project."
```

这个选项会额外生成 resolver、resolver 测试、generic `default` reference，以及项目配置契约。它们是需要继续定制的脚手架，不是完成品：作者仍需根据真实任务确定 Schema、任务名、通用指令和 Profile 边界，再运行结构校验与 resolver 测试。

如果是从已有 Skill 迁移，应先找出所有项目命名条件和项目事实，将 Profile 文本与命令移入 `skills-config`，把代码分支改为通用任务输入，保留 generic fallback，最后对比迁移前后的有效行为。Schema 或任务名发生变化时，还要明确记录破坏性变更。

## 安装与使用

可以从 `wyatt_skills` 安装 `skillcraft`：

```bash
pnpm dlx skills add Hu-Wentao/wyatt_skills \
  --skill skillcraft \
  --yes
```

安装后，可以直接让 Agent 创建普通 Skill：

```text
请使用 skillcraft 创建一个 release-dart-package Skill。
先根据真实发布请求确定工作流，只创建必要的 scripts 和 references，
生成并校验 agents/openai.yaml，最后运行结构验证。
```

也可以明确要求项目配置能力：

```text
请使用 skillcraft 创建一个支持项目配置的 release-web Skill。
通用 Skill 只保留发布流程和安全不变量；项目命令、环境名称和产物目录
放进 .agents/skills-config/release-web，并验证 generic fallback 和两个项目 Profile。
```

## 结语

`skillcraft` 首先是 `skill-creator` 的完整替代：它负责理解使用场景、设计资源、初始化 Skill、维护 UI 元数据、验证结构，并通过隔离的前向测试检查 Skill 是否真的能解决问题。Skill Config 是建立在这套完整工作流之上的关键扩展，而不是 `skillcraft` 的全部。

当一个 Skill 只需要通用行为时，保持自包含；当不同仓库必须拥有各自可评审的长期规则时，再把通用能力、项目 Profile 和运行缓存分成三个所有权层，通过 resolver 合成有效指令。

这样，Skill 可以在不复制自身、不认识具体项目、也不绕过权限边界的前提下适应不同仓库。`skillcraft` 解决的最终问题，不只是怎样写一份 `SKILL.md`，而是怎样让一个 Skill 在持续复用和演进之后，仍然简洁、可信并且可验证。

## 相关

- [skillcraft Skill](https://github.com/Hu-Wentao/skills/tree/main/skills/skillcraft)
- [wyatt_skills](https://github.com/Hu-Wentao/skills)
