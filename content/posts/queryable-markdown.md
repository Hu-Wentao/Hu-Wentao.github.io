---
title: "Queryable Markdown Skill：让 AI 稳定查询和维护 Markdown"
date: 2026-07-20T17:25:42+08:00
draft: false
aliases: ["/posts/make-markdown-queryable/"]
summary: "queryable-markdown 让 Agent 只读查询单篇 Markdown 或批量扫描 Markdown 集合，并通过持久化 mdq 契约安全地创建、维护和编辑半结构化文档"
tags: ["AI", "Markdown", "Skill", "VibeCoding", "文档工程"]
categories: ["Artifacts"]
publish:
  juejin:
    category: "人工智能"
---

> 本文介绍一种帮助 AI Agent 准确查询、批量检索和编辑半结构化 Markdown 文档的 Skill，安装使用参见 [快速体验](#快速体验)

存储结构化数据，`csv`/`jsonl`/`sqlite` 等数据格式都已经十分成熟且方便。在AI时代，半结构化/无固定结构的Markdown文件往往更实用。例如需求文档可以混合标题、列表、长段落、代码示例和临时备注；尚未写完的需求可以缺少状态或详情；开发者也可以随手调整标题层级，而不必先通过 Schema 校验。

MD的自由格式非常适合人类写作，却让 AI 的精确查询/编辑变得困难。

## AI查询MD文档的问题
当 AI 需要从一份文档中查找 `REQ-102` 时，它通常会先执行全文搜索，再读取命中位置附近的内容：

```bash
rg -n 'REQ-102' requirements.md
```

这并不意味着整份文档都会进入模型上下文。`rg` 在底层扫描文件，但 AI 实际看到的通常只有命中行和少量上下文。真正的问题是，全文匹配不知道哪一次出现代表“需求自身的 ID”：

- 它可能命中 `REQ-102` 对应的需求标题。
- 也可能命中其他需求中的依赖引用。
- 可能命中代码块里的示例数据。
- `REQ-102` 和 `REQ-1020` 还可能被同一个宽松表达式命中。

可以不断收紧正则，但正则依赖当前排版。一旦有人把 ID 从标题移到列表、改变标题层级，或者在需求之间插入一个临时章节，查询规则就会失效。

## 一个技能解决MD读写问题：queryable-markdown

为此，我实现了 [queryable-markdown](https://github.com/Hu-Wentao/skills/tree/main/skills/queryable-markdown) Skill。它不要求文档先拥有特殊头部：面对单篇普通 Markdown 或目录下的一组文档，Skill 可以临时解析结构、定位候选范围并保持只读；当用户明确要求创建、转换“带查询契约的 Markdown”，或适用的治理工作流要求为已授权的文档写入建立契约时，才把 AI 对业务结构的理解写成一份很小的声明式查询协议。

它的核心可以概括成一句话：

> 单篇或一组普通 Markdown 保持只读也能查询；需要长期稳定查询和维护时，再用可验证的契约获得稳定身份、字段和安全编辑边界。

## Markdown 不是数据库，但可以暴露查询契约

这个方案有两条查询路径：

~~~text
                        ┌─ 无 profile：临时分析 ─→ 有证据的候选范围
单篇 Markdown ─→ 容错解析器 ─┤
                        └─ 有 profile：声明规则 ─→ 字段化 JSON 结果
                                     ↑
                         可选的逐文档 sidecar 索引

目录 / Glob ─→ scan ─→ 对每篇 Markdown 应用上面的只读查询
                 └─→ 聚合路径、记录、候选与诊断
~~~

- **Markdown 正文**仍然是唯一事实源，人可以继续直接编辑。
- **容错解析器**可以在没有 profile 时临时识别标题、ID、标签和代码区域，只读地返回候选。
- **集合扫描（collection scan）** 可以用目录和 Glob 批量选择文档，统一保留文件路径、原文范围和逐文档诊断。
- **mdq profile** 是可选的持久化查询契约，描述记录边界、唯一键和字段来源。
- **sidecar 索引**只是可丢弃的缓存，不能覆盖当前文档。

如果选择持久化，文档控制区里保存的不是 Shell 或 Python 脚本，而是 YAML 声明式数据。`profile` 放在从文件第一个字节开始的 YAML Front Matter 中，并嵌套在顶层 `mdq` key 下；已有完整 YAML Front Matter 时就合并这个命名空间。文档不能要求 Agent 执行任意代码，只能告诉受信任的查询引擎“如何识别记录”。这既便于审查，也避免文档变成代码执行入口。

## 一份不完整的需求文档

考虑下面这份人工维护的需求清单：

````md
# Product requirements

## REQ-101 - Email login

状态：planned

### 详情

用户通过邮箱登录。这个需求依赖 REQ-102。

## Password reset

- 编号：REQ-102
- **状态**：drafting

### 描述

发送密码重置链接，最终流程还没写完

## REQ-103: Audit events

- 状态：planned
- 状态：blocked

```md
## REQ-999: 这里只是文档示例
```

## Unnumbered idea

以后也许支持 Passkey。
````

它大体遵循“一条需求一个二级标题”的规则，却不是完整、统一的结构化数据：

- `REQ-101` 和 `REQ-103` 的 ID 在标题中，`REQ-102` 的 ID 在正文列表中。
- “详情”和“描述”表达的是同一个字段。
- `REQ-102` 尚未写完。
- `REQ-103` 同时出现两个互相冲突的状态。
- `REQ-999` 位于代码块中，不是真实需求。
- 最后一条想法还没有 ID。

传统的数据导入流程可能要求先清洗完整份文档，但 Skill 的目标不是强迫人立即整理数据，而是尽可能查询已经存在且有来源证据的内容。

## 没有元信息头也能查

如果用户只说“查一下 `REQ-102`”，这是一次只读查询，不是对文档的改造授权。Skill 会在内存中构造临时查询规则：

1. 解析 Markdown token 和 source map，先排除代码块、注释与其他不透明区域。
2. 从 ID 标题、`ID` / `编号` 标签和章节层级中推断候选记录。
3. 只返回命中记录或局部行的原文范围，不把整篇文档放入模型上下文。
4. 当同一文本同时出现在标题、依赖描述和示例中时，保留所有候选并说明证据强弱。

这种查询不会写入 profile、marker 或索引。代价是，每次查询都要重新推断一部分结构，而且无法保证“状态”“详情”等业务字段始终按照同一规则被解释。它适合一次性问题，不等价于持久化契约。

## 需要持久化时，AI 写入什么

通常只有当用户明确要求“转换为带 mdq 契约的文档”“保存查询规则”或“修复已有查询契约”时，Skill 才会修改控制区。另一个例外是：适用的上游治理工作流可能规定，已授权创建或编辑的受治理文档必须带持久契约。这个例外只授权当前文档所需的最小契约，不会顺带授权修改其他内容、批量迁移、创建索引或修复无关契约。

Skill 会先执行 `inspect`，观察标题层级、常见 ID 形态、重复标签、代码围栏和已有 Front Matter，再由 AI 根据多条真实记录生成一个尽可能小的 YAML profile：

```yaml
---
mdq:
  version: 1
  dialect: commonmark
  records:
    boundary:
      source: heading
      levels: [2]
      level_tolerance: 1
    key:
      source: heading
      pattern: '^(?P<id>REQ-[0-9]+)(?:[ ：:-]+(?P<title>.*))?$'
      group: id
  fields:
    title:
      source: heading
      pattern: '^(?:REQ-[0-9]+[ ：:-]+)?(?P<title>.+)$'
      group: title
    status:
      source: label
      labels: [状态, Status]
    detail:
      source: section
      headings: [详情, 描述, Description]
  tolerance:
    incomplete: true
---
```

这段 profile 表示：

- 二级标题通常是一条记录的开始，允许手工编辑造成一级的标题漂移。
- 从标题中提取 `REQ-数字` 作为 key。
- 标题、状态和详情分别来自标题、标签行和子章节；标题字段的独立正则同时兼容“带 ID”与“不带 ID”两种标题。
- 已经可以恢复 key 的残缺记录仍然允许查询。

`REQ-102` 没有在标题中提供 ID，无法单靠主规则定位。Skill 不会重写整个正文，而是在必要时插入一个稳定、不可见的边界标记：

```md
<!-- mdq:record id="REQ-102" -->
## Password reset
```

这是一种显式的例外处理：大部分记录继续使用作者原有结构，只有无法可靠识别的少数记录获得 marker。删除 Front Matter 中的 `mdq` key 和 marker 后，原始业务正文保持不变。

## 查询结果不是“猜一个答案”

当文档已有有效 profile 时，Agent 不必重新推断字段语义，而是调用 Skill 中的确定性查询脚本：

```bash
uv run "$SKILL_DIR/scripts/mdq.py" query requirements.md --id REQ-102
```

结果类似（为便于阅读，省略 `candidates`、byte range 和部分顶层诊断）：

```json
{
  "status": "matched",
  "count": 1,
  "records": [
    {
      "key": "REQ-102",
      "fields": {
        "title": "Password reset",
        "status": "drafting",
        "detail": "发送密码重置链接，最终流程还没写完"
      },
      "line_start": 37,
      "line_end": 46,
      "confidence": 0.8,
      "diagnostics": [],
      "identity_evidence": [
        {
          "source": "marker",
          "value": "REQ-102",
          "line": 37
        }
      ]
    }
  ]
}
```

这里的重点不是将 Markdown 转成一个看起来完整的 JSON，而是保留“不完整”和“不确定”本身：

- 缺失字段返回 `null`，不会由 AI 补写。
- 相同 ID 对应多条记录时返回 `ambiguous` 和全部匹配，不默认选择第一条。
- 同一个标量字段出现多个不同值时返回 `null + field_conflict`，并保留每个值的位置。
- marker 与标题 ID 冲突时，两者都只作为候选证据，不产生结构化精确匹配。
- 每条结果都包含行号和 UTF-8 byte range，可以回到原文复核。

因此，查询结果表达的是“根据当前协议，可以从哪些原文证据中恢复出什么”，而不是“模型认为最可能是什么”。

## 应用场景

`queryable-markdown` 适合需要保留 Markdown 写作体验，同时又要按稳定身份和字段查询、审计或修改文档的场景。单篇查询可以使用临时选择器；跨文档字段查询和批量编辑则更适合建立持久化契约。

### 精确查询单篇文档中的记录

需求文档、设计说明和运行手册经常同时包含正文引用、代码示例和真实记录。通过精确 key 查询，Agent 可以区分“记录自身的 ID”和正文中提到的其他 ID，并返回字段值、身份证据和原文范围。普通 Markdown 也能以临时选择器完成一次性只读查询；需要反复查询或编辑时，再添加持久化契约。

### 汇总一个文件夹中所有文档的状态

当需求、计划或知识条目拆在多个文件里时，可以使用 `scan` 一次查询指定路径下所有 Markdown 的 `status` 字段：

```bash
uv run "$SKILL_DIR/scripts/mdq.py" scan docs/requirements \
  --glob '**/*.md' \
  --field status \
  --require-contract
```

这个命令没有提供 `--text`，因此会投影每条结构化记录的 `status` 字段，而不是只筛选某个状态。结果可以直接用于状态看板、发布前检查、需求盘点，以及查找缺失或冲突的状态值。

目录扫描默认使用 `**/*.md`，也可以重复 `--glob` 合并多个受限模式。Glob 必须相对于集合根目录，不能是绝对路径或包含 `..`。结果按根目录相对路径稳定排序，重叠模式不会让同一文件被重复处理，软链接也不会被跟随。

`scan` 支持以下选择方式：

- 不提供选择器时，返回所有结构化记录。
- `--id` 跨文档查找区分大小写的精确 key。
- `--text` 执行不区分大小写的字面量搜索，而不是正则搜索。
- `--field` 将搜索限制在某个声明字段；没有 `--text` 时则只投影这个字段。
- `--limit` 只限制返回记录数，不会跳过其余文档的验证和诊断。

默认情况下，无契约文档仍可使用内存中的临时选择器。对于必须遵循统一契约的受治理文档集合，可以添加 `--require-contract`：没有 `profile` 或 `profile` 无效的文件会被报告为错误，但其他有效文档的匹配仍然保留。当请求命名字段时，每份生效的契约都必须声明该字段，工具不会从任意正文中猜测 `status` 之类的业务含义。

集合结果使用 `mdq.collection.v1` 信封。除了扁平化的 `records` 和 `candidates`，结果还保留绝对路径、根目录相对路径、原文范围、逐文档摘要与带来源位置的诊断。有效匹配与无效文档同时存在时，顶层状态是 `partial`，调用方不必在“得到有效结果”和“看见坏文档”之间二选一。

### 批量更新某个路径下所有 Markdown 的状态

批量更新状态是“先批量查询，再逐文档执行受控编辑”，不是对整个目录做一次全文替换。`scan` 始终只读，CLI 也不提供跳过身份解析和验证的批量写命令。这里的“元数据字段”是 `profile` 映射出的业务字段，例如正文标签中的 `status`；更新字段值不授权修改 `mdq` profile、marker 或索引策略。

一次安全的批量状态更新包含以下步骤：

1. 使用 `scan --field status --require-contract` 列出目标路径中的文档、记录 key、当前状态、原文范围和诊断。
2. 根据用户给出的明确规则选择目标，例如只把 `planned` 更新为 `active`。不要为 `null`、字段冲突或缺失值猜测新状态。
3. 对每个目标文档运行 `validate` 和 `diagnose`，再用精确 key 查询目标。跳过无有效契约、身份重复、边界不明确、漂移影响目标，或只有 `regex` 提取规则而没有可靠写入位置的记录，并单独报告原因。
4. 只修改目标记录中承载 `status` 的最小源码范围，保留其他字段、排版和文档内容。
5. 每次写入后重新验证并查询已修改记录、一个不存在的 key，以及存在时的一个未修改记录；文档声明了 sidecar index 时，再重建该文档的索引。
6. 全部写入完成后重新运行相同的 `scan`，核对状态与目标数量，并检查仓库 diff 是否包含越界修改。

可以直接把查询条件和状态转换规则交给 Agent：

```bash
codex "请使用 queryable-markdown skill，扫描 docs/requirements 下所有 Markdown 的 status 字段；列出完整状态清单，然后把 status=planned 的记录批量更新为 active。只编辑具有有效 mdq 契约且身份与边界唯一的记录；跳过并报告缺失、冲突、无契约或无效契约文档。逐文档验证后重新扫描目录，并列出实际修改的文件、记录 key 和最终状态。"
```

这个流程适合批量推进需求状态、切换发布阶段或更新计划执行状态。它仍然把每篇 Markdown 源码当作事实源，并为每次编辑保留可审查的文档边界。

## 控制面严格，数据面容错

手工文档可以残缺，但查询规则不能含糊。这是整个设计中最重要的边界。

当用户选择持久化查询契约时，mdq profile 属于控制面，需要严格验证：

- 不允许重复 YAML key 和 YAML alias。
- 不允许未知的非扩展字段。
- 正则捕获组必须真实存在，并设置单次匹配超时。
- index 必须位于文档目录内，不能覆盖、软链接或别名指向源文档。
- profile 必须是 byte 0 开始的唯一 YAML Front Matter，并位于顶层 `mdq` key 下；代码块中的示例 profile 不会生效。

Markdown 正文属于数据面，查询时尽可能恢复：

- CommonMark/GFM 解析 token 及 source map 提供标题和代码块的基础边界。
- 源码行扫描作为 token 结构无法恢复记录时的降级路径。
- fenced code、indented code、blockquote/list 中的代码围栏和跨行 code span 都不会产生记录。
- HTML 注释只隐藏注释内容，不会连带删除同一行的有效标题或字段。
- 最后一条记录即使在 EOF 处突然结束，只要 key 可以恢复，仍然可以查询。

这种设计与“残缺 JSON 查询工具”很像：输入不需要先变得完美，但恢复出来的每一个值都必须说明来源和可信程度。

## 从查询工具到文档维护 Skill

`queryable-markdown` 不只包装了一组查询命令，它还明确区分“文档当前状态”和“用户授权的操作”：

| 文档状态 | 用户操作 | Skill 的行为 |
| --- | --- | --- |
| 没有有效契约 | 查询、查找、总结 | 临时推断选择器，只读，不添加 profile、marker 或索引 |
| 没有有效契约 | 普通内容编辑 | 交给通用编辑流程；仅当适用治理工作流要求时，才随已授权写入添加最小契约 |
| 没有有效契约 | 创建或转换为契约文档 | 用户明确要求或治理工作流要求时，先检查现有结构，再写入最小契约和必要 marker |
| 有效契约 | 查询 | 按契约只读提取，不因存在契约而擅自修改 |
| 有效契约 | 新增、更新、删除或重命名记录 | 先精确解析目标，再在记录边界内做最小源码补丁 |
| 契约有效但发生漂移 | 查询或编辑 | 返回恢复诊断；漂移影响目标身份或边界时停止编辑 |
| 契约已声明但无效 | 查询或修复 | 报告契约错误，只做有边界的一次性检查；只有明确授权时才修复 |

这个状态矩阵解决了一个容易被忽略的问题：**文档可编辑，不等于当前请求授权了编辑**。普通的“帮我查一下”永远不应顺手改造文档；“更新 `REQ-102` 的状态”也不自动授权修改身份规则、marker 或索引策略。

对于已经建立契约的文档，记录修改采用一套事务式流程：

1. 修改前运行 `validate` 和 `diagnose`，确认目标身份与边界没有歧义。
2. 精确查询目标 ID，只读取目标范围及最少的相邻样式证据。
3. 在授权范围内做最小源码补丁，不通过 Markdown 渲染器重写整篇文档。
4. 修改后重新验证，查询受影响记录、一个未修改记录和一个不存在的 ID。
5. 如果声明了 sidecar index，在源码验证通过后再重建；最后检查 diff 是否越界。

重命名和删除会额外搜索文档内引用，但不会假设生命周期策略。比如用户说“删除”时，Skill 不会擅自改成“归档”；用户只说“重命名 ID”时，也不会未经确认改写语义不明的示例文本。

## 持久化契约如何维护

把 profile 写入文档控制区不是一次性的格式转换，而是为文档增加一个持续维护的查询接口。完整生命周期包括：

```bash
# 分析文档并生成候选 profile
uv run "$SKILL_DIR/scripts/mdq.py" inspect requirements.md

# 检查 key、缺失字段、冲突和结构漂移
uv run "$SKILL_DIR/scripts/mdq.py" validate requirements.md
uv run "$SKILL_DIR/scripts/mdq.py" diagnose requirements.md

# 精确查询和文字搜索
uv run "$SKILL_DIR/scripts/mdq.py" query requirements.md --id REQ-102
uv run "$SKILL_DIR/scripts/mdq.py" search requirements.md --field status --text planned

# 批量扫描目录中的 Markdown
uv run "$SKILL_DIR/scripts/mdq.py" scan docs/requirements \
  --glob '**/*.md' \
  --field status \
  --require-contract

# 可选：生成 sidecar
uv run "$SKILL_DIR/scripts/mdq.py" index requirements.md
```

如果用户修改了正文，source hash 会改变，旧索引立即失效。即使索引的 metadata 看起来正确，v1 查询仍会将其中的记录与当前源码重新提取的结果比较。sidecar 可以保存位置，但不能越过 Markdown 成为第二个事实源。

这个取舍优先保证正确性，也意味着 v1 解决的主要是 **模型上下文成本和查询确定性**，而不是让磁盘查询变成真正的亚线性随机访问。解析器仍然可能扫描当前文档，只是全文不会进入 AI 上下文。未来若要优化超大文件，可以让索引保存可验证的分片摘要，再只解析候选 byte range。

## 它与 CSV、数据库和 RAG 的区别

### 不是 CSV 的替代品

如果数据天然拥有稳定的行列结构，应当直接使用 CSV 或数据库。这个 Skill 面向的是另一类材料：以人类写作为主、包含长文本和混合 Markdown 结构、尚未完整定型的文档。

### 不是数据库

mdq 提供的是轻量查询契约，而不是事务、并发写入、关联查询或复杂聚合。它不会让 Markdown 获得数据库的全部能力，只是让 Agent 不必每次从自由文本中重新推断相同结构。

### 不是 RAG

RAG 和向量检索适合回答“哪些需求与登录安全相关”这类语义问题；mdq 适合回答“ID 为 `REQ-102` 的需求是什么”“状态为 planned 的记录有哪些”这类具有字段和身份语义的查询。

两者可以组合：先用 mdq 按项目、状态等 metadata 过滤，再在候选记录的详情中进行语义检索。

## 快速体验

如果已经安装 Node.js 和 pnpm，可以通过开源的 [skills CLI](https://github.com/vercel-labs/skills) 将 Skill 安装到本地全局目录：

```bash
pnpm dlx skills add Hu-Wentao/skills \
  --skill queryable-markdown \
  --global \
  --yes
```

进入包含 Markdown 文档的项目后，可以先做一次不修改文档的查询：

```bash
codex "请使用 queryable-markdown skill，从 docs/requirements.md 查询 REQ-102 的状态和详情。保持文档只读，列出身份证据和原文范围。"
```

即使文档没有 mdq profile，Skill 也会做临时结构推断，但不会写入任何元数据。

如果记录分散在目录下，可以发起批量只读查询：

```bash
codex "请使用 queryable-markdown skill，扫描 docs/requirements 下的 Markdown，从声明的 status 字段查找 planned；要求每份文档都有有效契约，同时保留有效匹配、逐文档摘要和无效文档诊断。保持全部文件只读。"
```

这类扫描不会创建目录索引，也不会为了满足 `--require-contract` 自动改造普通文档。

如果这份文档之后会被反复按 ID 和字段查询，再明确要求 Codex 持久化查询契约：

```bash
codex "请使用 queryable-markdown skill，将 docs/requirements.md 转换为带持久化 mdq 契约的文档。先展示识别出的记录边界、key 和字段映射；只添加最小 profile/marker；验证后分别查询一条正常记录、一条残缺记录和一个代码块中的伪 ID。"
```

前两个请求都只授权查询；只有最后一个请求会授权 Agent 最小化修改文档控制区，然后执行验证和代表性查询。它不会为了获得漂亮的结构而重排整篇 Markdown。

## 仍然存在的边界

这个方案并不能自动理解任意文档。

- 无 profile 查询仍需扫描当前文档，而且临时推断的结构可信度低于已验证的持久化契约。
- 集合扫描会按 Glob 读取所有匹配文档；`--limit` 只限制返回记录，不会减少其余文档的验证成本，v1 也不创建目录级索引。
- 首次持久化准备仍需扫描全文，并让 AI 阅读足够有代表性的片段；结构高度不规则时，可能需要完整理解一次。
- 如果记录没有任何可恢复的身份信息，它只能作为候选片段，不能被精确查询。
- v1 主要支持 CommonMark/GFM；部分 MDX 和 Hugo `highlight` 代码块可以隔离，但复杂扩展语法仍需要在 `inspect` 阶段声明兼容性限制。
- 规则改变后需要重新验证；如果文档逐渐偏离原有写法，应该更新 profile，而不是不断叠加模糊 fallback。
- 语义相似度、总结和跨文档推理仍然应该交给 AI 或 RAG。

这些限制不是缺陷的掩饰，而是查询结果可以被信任的前提。工具宁愿返回 `null`、`ambiguous` 或 candidate，也不应该把不确定性包装成一个确定答案。

## 结语

文档协作让 Markdown 成为人与 AI 共享的事实源，但“能一起编辑”不等于“能稳定查询”。如果 AI 每次查一个需求都要重新全文搜索、读取上下文并猜测边界，文档规模越大，相同的理解成本就会被重复支付越多次。

Queryable Markdown 的思路，是在不牺牲 Markdown 写作自由的前提下，先为单篇文档或一个 Markdown 集合提供只读、有证据的临时查询；当用户确实需要稳定的重复查询和安全维护时，再为文档增加一个小型、版本化、可验证的 YAML 契约。人继续维护不完美的文档，确定性程序负责文件选择、身份、边界与字段提取，Agent 只在需要语义判断和受控修改时介入。

Markdown 不需要变成数据库，但它可以学会向 Agent 清楚地说明自己。

## 相关

- [queryable-markdown Skill 源码](https://github.com/Hu-Wentao/skills/tree/main/skills/queryable-markdown)
- [skills CLI](https://github.com/vercel-labs/skills)
