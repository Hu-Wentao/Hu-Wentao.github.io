---
title: "Queryable Markdown：让 AI 稳定查询和维护 Markdown"
date: 2026-07-12T00:00:00+08:00
draft: true
aliases: ["/posts/make-markdown-queryable/"]
summary: "queryable-markdown 让 Agent 只读查询普通 Markdown，并通过持久化 mdq 契约安全地创建、维护和编辑半结构化文档"
tags: ["AI", "Markdown", "Skill", "VibeCoding", "文档工程"]
categories: ["Artifacts"]
---

如果一份文档拥有严格的行列结构，我会直接使用 CSV、JSON 或数据库，而不是 Markdown。

Markdown 的价值恰恰在于它不严格。需求文档可以混合标题、列表、长段落、代码示例和临时备注；尚未写完的需求可以缺少状态或详情；开发者也可以随手调整标题层级，而不必先通过 Schema 校验。这种自由非常适合人类写作，却让 AI 的精确查询变得困难。

例如，当我让 AI 从一份需求文档中查找 `REQ-102` 时，它通常会先执行全文搜索，再读取命中位置附近的内容：

```bash
rg -n 'REQ-102' requirements.md
```

这并不意味着整份文档都会进入模型上下文。`rg` 在底层扫描文件，但 AI 实际看到的通常只有命中行和少量上下文。真正的问题是，全文匹配不知道哪一次出现代表“需求自身的 ID”：

- 它可能命中 `REQ-102` 对应的需求标题。
- 也可能命中其他需求中的依赖引用。
- 可能命中代码块里的示例数据。
- `REQ-102` 和 `REQ-1020` 还可能被同一个宽松表达式命中。

可以不断收紧正则，但正则依赖当前排版。一旦有人把 ID 从标题移到列表、改变标题层级，或者在需求之间插入一个临时章节，查询规则就会失效。

为此，我实现了 [queryable-markdown](https://github.com/Hu-Wentao/skills/tree/main/skills/queryable-markdown) Skill。它不要求文档先拥有特殊头部：面对普通 Markdown，Skill 可以临时解析结构、定位候选范围并保持只读；只有当用户明确要求创建或转换“带查询契约的 Markdown”时，才把 AI 对业务结构的理解写成一份很小的声明式查询协议。

它的核心可以概括成一句话：

> 普通 Markdown 保持只读也能查询；需要长期维护时，再用可验证的契约获得稳定身份、字段和安全编辑边界。

## Markdown 不是数据库，但可以暴露查询契约

这个方案有两条查询路径：

~~~text
                         ┌─ 无 profile：临时分析 ─→ 有证据的候选范围
人工维护的 Markdown ─→ 容错解析器 ─┤
                         └─ 有 profile：声明规则 ─→ 字段化 JSON 结果
                                      ↑
                                可选 sidecar 索引
~~~

- **Markdown 正文**仍然是唯一事实源，人可以继续直接编辑。
- **容错解析器**可以在没有 profile 时临时识别标题、ID、标签和代码区域，只读地返回候选。
- **mdq profile** 是可选的持久化查询契约，描述记录边界、唯一键和字段来源。
- **sidecar 索引**只是可丢弃的缓存，不能覆盖当前文档。

如果用户选择持久化，文档控制区里保存的不是 Shell 或 Python 脚本，而是 YAML 声明式数据。它可以合并进现有 YAML frontmatter，也可以放在文件开头的 `<!-- mdq ... -->` 注释块中。文档不能要求 Agent 执行任意代码，只能告诉受信任的查询引擎“如何识别记录”。这既便于审查，也避免文档变成代码执行入口。

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

## 用户要求持久化时，AI 写入什么

只有当用户明确要求“转换为带 mdq 契约的文档”“保存查询规则”或“修复已有查询契约”时，Skill 才会修改控制区。它先执行 `inspect`，观察标题层级、常见 ID 形态、重复标签、代码围栏和已有 frontmatter，再由 AI 根据多条真实记录生成一个尽可能小的 YAML profile：

```yaml
<!-- mdq
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
-->
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

这是一种显式的例外处理：大部分记录继续使用作者原有结构，只有无法可靠识别的少数记录获得 marker。删除 profile 和 marker 后，原始业务正文保持不变。

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

## 控制面严格，数据面容错

手工文档可以残缺，但查询规则不能含糊。这是整个设计中最重要的边界。

当用户选择持久化查询契约时，mdq profile 属于控制面，需要严格验证：

- 不允许重复 YAML key 和 YAML alias。
- 不允许未知的非扩展字段。
- 正则捕获组必须真实存在，并设置单次匹配超时。
- index 必须位于文档目录内，不能覆盖、软链接或别名指向源文档。
- profile 只能位于文件起始位置，或完整 YAML、TOML、JSON frontmatter 之后；代码块里的示例 profile 永远不会生效。

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
| 没有有效契约 | 创建或转换为契约文档 | 先检查现有结构，再写入最小契约和必要 marker |
| 有效契约 | 查询 | 按契约只读提取，不因存在契约而擅自修改 |
| 有效契约 | 新增、更新、删除或重命名记录 | 先精确解析目标，再在记录边界内做最小源码补丁 |
| 契约漂移或失效 | 查询、修复 | 返回恢复诊断；只有用户明确授权时才修复 |

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

如果已经安装 Node.js 和 pnpm，可以通过开源的 [skills CLI](https://github.com/vercel-labs/skills) 将 Skill 安装到 Codex 的全局目录：

```bash
pnpm dlx skills add Hu-Wentao/skills \
  --skill queryable-markdown \
  --agent codex \
  --global \
  --yes
```

进入包含 Markdown 文档的项目后，可以先做一次不修改文档的查询：

```bash
codex "请使用 queryable-markdown skill，从 docs/requirements.md 查询 REQ-102 的状态和详情。保持文档只读，列出身份证据和原文范围。"
```

即使文档没有 mdq profile，Skill 也会做临时结构推断，但不会写入任何元数据。

如果这份文档之后会被反复按 ID 和字段查询，再明确要求 Codex 持久化查询契约：

```bash
codex "请使用 queryable-markdown skill，将 docs/requirements.md 转换为带持久化 mdq 契约的文档。先展示识别出的记录边界、key 和字段映射；只添加最小 profile/marker；验证后分别查询一条正常记录、一条残缺记录和一个代码块中的伪 ID。"
```

只有第二个请求会授权 Agent 最小化修改文档控制区，然后执行验证和代表性查询。它不会为了获得漂亮的结构而重排整篇 Markdown。

## 仍然存在的边界

这个方案并不能自动理解任意文档。

- 无 profile 查询仍需扫描当前文档，而且临时推断的结构可信度低于已验证的持久化契约。
- 首次持久化准备仍需扫描全文，并让 AI 阅读足够有代表性的片段；结构高度不规则时，可能需要完整理解一次。
- 如果记录没有任何可恢复的身份信息，它只能作为候选片段，不能被精确查询。
- v1 主要支持 CommonMark/GFM；部分 MDX 和 Hugo `highlight` 代码块可以隔离，但复杂扩展语法仍需要在 `inspect` 阶段声明兼容性限制。
- 规则改变后需要重新验证；如果文档逐渐偏离原有写法，应该更新 profile，而不是不断叠加模糊 fallback。
- 语义相似度、总结和跨文档推理仍然应该交给 AI 或 RAG。

这些限制不是缺陷的掩饰，而是查询结果可以被信任的前提。工具宁愿返回 `null`、`ambiguous` 或 candidate，也不应该把不确定性包装成一个确定答案。

## 结语

文档协作让 Markdown 成为人与 AI 共享的事实源，但“能一起编辑”不等于“能稳定查询”。如果 AI 每次查一个需求都要重新全文搜索、读取上下文并猜测边界，文档规模越大，相同的理解成本就会被重复支付越多次。

Queryable Markdown 的思路，是在不牺牲 Markdown 写作自由的前提下，先为任意文档提供只读、有证据的临时查询；当用户确实需要稳定的重复查询和安全维护时，再为文档增加一个小型、版本化、可验证的 YAML 契约。人继续维护不完美的文档，确定性程序负责身份、边界与字段提取，Agent 只在需要语义判断和受控修改时介入。

Markdown 不需要变成数据库，但它可以学会向 Agent 清楚地说明自己。

## 相关

- [queryable-markdown Skill 源码](https://github.com/Hu-Wentao/skills/tree/main/skills/queryable-markdown)
- [skills CLI](https://github.com/vercel-labs/skills)
- [Vibe Coding 人机交互的最佳形态：文档协作](/posts/vibe-coding-document-collaboration/)
