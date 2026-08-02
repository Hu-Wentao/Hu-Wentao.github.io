---
title: "Queryable Markdown Skill：让 AI 稳定查询和维护文档"
date: 2026-07-31T19:18:21+08:00
draft: false
aliases: ["/posts/make-markdown-queryable/"]
summary: "用可验证的 mdq 契约查询和安全编辑单篇或一组 Markdown 文档"
tags: ["AI", "Markdown", "Skill", "VibeCoding", "文档工程"]
categories: ["Artifacts"]
artifacts: ["queryable-markdown"]
publish:
  juejin:
    category: "人工智能"
---

> [queryable-markdown](https://github.com/Hu-Wentao/skills/tree/main/skills/queryable-markdown) 让 Agent 在保留 Markdown 写作自由的同时，准确查询记录和字段，并在明确授权后安全编辑文档。

## 为什么需要 Queryable Markdown

Markdown 很适合编写需求、设计说明和运行手册：标题、列表、长文本与代码示例可以自由混合，内容也不必先满足严格的 Schema。但这种自由会让精确查询变得困难。

例如，用 `rg -n 'REQ-102' requirements.md` 查找需求时，命中的可能是记录标题、其他需求中的引用，也可能只是代码示例。更复杂的正则能够暂时改善结果，却会随着标题层级或排版变化而失效。

Queryable Markdown 的核心思路是：

> 普通 Markdown 可以临时、只读地查询；需要长期稳定查询和维护时，再加入一个小型、声明式、可验证的 `mdq` 契约。

Markdown 正文始终是事实源。契约只描述记录边界、唯一键和字段来源；可选的 sidecar 索引只是缓存，失效后可以重建，不能覆盖正文。

## 两种查询模式

| 模式 | 适合场景 | 对文档的影响 |
| --- | --- | --- |
| 临时选择器 | 一次性查找普通 Markdown | 只读，不写入 profile、marker 或索引 |
| 持久化 `mdq` 契约 | 反复按 ID、字段查询或编辑 | 明确授权后写入最小契约，并持续验证 |

假设需求文档包含以下内容：

````md
# Requirements

## REQ-101 - Email login
状态：planned
依赖 REQ-102。

<!-- mdq:record id="REQ-102" -->
## Password reset
状态：drafting

```text
REQ-999 只是示例
```

## REQ-103 - Audit events
````

没有契约时，Skill 会解析 Markdown 结构，排除代码块等不透明区域，再返回带原文位置和证据强弱的候选结果。它不会因为用户说“查一下”就改造文档。

如果这份文档需要被反复查询或编辑，可以在文件第一个字节开始的 YAML Front Matter 中加入最小 profile：

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
      pattern: '^(?P<id>REQ-[0-9]+)(?:[ ：:-]+.*)?$'
      group: id
  fields:
    status:
      source: label
      labels: [状态, Status]
  tolerance:
    incomplete: true
---
```

只有原有结构无法稳定提供身份时，才需要为个别记录添加不可见 marker。随后可以通过确定性脚本精确查询：

```bash
uv run "$SKILL_DIR/scripts/mdq.py" query requirements.md --id REQ-102
```

简化后的结果类似：

```json
{
  "status": "matched",
  "count": 1,
  "records": [{
    "key": "REQ-102",
    "fields": {"status": "drafting"},
    "line_start": 28,
    "confidence": 0.8
  }]
}
```

工具不会为了给出完整答案而猜测：缺失字段返回 `null`；重复身份返回 `ambiguous` 和全部匹配；字段值冲突会保留诊断与来源位置。

## 应用场景

### 精确查询单篇文档

需求正文经常同时包含真实记录、交叉引用和代码示例。Queryable Markdown 可以按精确 key 找到记录，返回字段值、身份证据和原文范围。普通文档适合临时只读查询；需要重复查询或编辑时，再建立持久化契约。

### 查询一个文件夹下所有文档的状态

当需求或计划分散在多个文件中时，可以扫描指定路径下所有 Markdown 的 `status` 字段：

```bash
uv run "$SKILL_DIR/scripts/mdq.py" scan docs/requirements \
  --glob '**/*.md' \
  --field status \
  --require-contract
```

`scan` 始终只读，默认 Glob 是 `**/*.md`。`--require-contract` 会报告无契约或契约无效的文档，同时保留其他有效文档的结果。输出包含相对路径、记录 key、字段值、原文范围和逐文档诊断，可用于状态盘点、发布检查或看板数据生成。

`--limit` 只限制返回数量，不会跳过其余文件的验证；v1 也不会创建目录级索引。

### 批量更新某路径下所有 Markdown 的状态

批量更新采用“先扫描，再逐文档安全编辑”，而不是对目录执行全文替换。这里的“元数据字段”是 `mdq` profile 映射出的业务字段，例如正文中的 `status`；更新它不等于授权修改 profile、marker 或索引策略。

一次安全更新只需要四步：

1. 用 `scan --field status --require-contract` 获取完整状态、目标 key 和诊断。
2. 按明确的转换规则选择记录，例如只把 `planned` 改为 `active`；跳过缺失、冲突、无效契约或身份不唯一的记录。
3. 对每个目标文档先验证并精确查询，再只修改承载 `status` 的最小源码范围。仅有正则提取规则、却没有独立且有边界的写入位置时，不执行编辑。
4. 每篇文档修改后重新验证和查询；如声明了 sidecar，再重建索引。最后重复扫描并检查 Git diff。

可以直接把范围与状态转换规则交给 Codex：

```text
请使用 queryable-markdown skill，扫描 docs/requirements 下所有 Markdown 的 status；
把 status=planned 的记录更新为 active。只编辑契约有效、身份与边界唯一的记录；
跳过并报告其他记录。逐文档验证后重新扫描，并列出实际修改的文件、key 和最终状态。
```

## 安全编辑与权限边界

文档可编辑，不代表当前请求授权了编辑。Skill 根据文档状态和用户意图采取不同动作：

| 文档与请求 | 行为 |
| --- | --- |
| 无有效契约，只要求查询 | 使用临时选择器，只读 |
| 无有效契约，要求创建或转换 | 检查结构后写入最小契约和必要 marker |
| 有效契约，只要求查询 | 按契约提取，不修改文档 |
| 有效契约，要求编辑记录 | 精确定位后，在记录边界内做最小补丁 |
| 契约无效或漂移影响目标 | 返回诊断并停止；只有明确授权才修复契约 |

编辑一条记录时，完整事务是：修改前 `validate`、`diagnose` 和精确查询；修改后再次验证、查询受影响记录，并检查 diff。重命名、删除或批量修改也不会扩大用户给出的授权范围。

还有四条不能突破的边界：

- Markdown 源码是唯一事实源，sidecar 只能加速或保存位置。
- 缺失值不补写，身份歧义不默认选择第一条。
- profile 必须是声明式 YAML，不能让文档要求 Agent 执行任意代码。
- 正文内容编辑、契约维护和索引维护是三种不同授权。

## 快速体验

使用 [skills CLI](https://github.com/vercel-labs/skills) 安装：

```bash
pnpm dlx skills add Hu-Wentao/skills \
  --skill queryable-markdown \
  --codex \
  --global \
  --yes
```

然后根据任务选择一种提示词：

```text
# 单篇只读查询
请使用 queryable-markdown skill，从 docs/requirements.md 查询 REQ-102 的 status，
保持文档只读，并列出身份证据和原文范围。

# 扫描目录
请使用 queryable-markdown skill，扫描 docs/requirements 下所有 Markdown 的 status，
要求每份文档都有有效契约，并保留无效文档的诊断。

# 建立持久化契约
请使用 queryable-markdown skill，将 docs/requirements.md 转换为带 mdq 契约的文档。
先展示记录边界、key 和字段映射，只添加最小 profile 与必要 marker，并完成验证。
```

前两个请求只授权查询；只有最后一个请求授权修改文档控制区。

## 适用边界

- 数据天然拥有稳定行列结构，或需要事务、并发写入和复杂聚合时，优先使用 CSV 或数据库。
- `mdq` 适合精确 ID 和字段查询；“哪些需求与登录安全相关”这类语义问题更适合 RAG。两者可以组合使用。
- 没有可恢复身份的内容只能作为候选，不能伪装成精确匹配。
- v1 主要面向 CommonMark/GFM；复杂 MDX 或扩展语法应先通过 `inspect` 确认兼容性。
- 查询仍需读取当前源码，集合扫描也会检查匹配文件；它优化的是查询确定性和模型上下文，而不是提供数据库式随机访问。

Queryable Markdown 不把 Markdown 变成数据库。它只是让文档在保留人类写作体验的同时，向 Agent 清楚说明记录在哪里、字段如何提取，以及什么情况下可以安全修改。

## 相关

- [queryable-markdown Skill 源码](https://github.com/Hu-Wentao/skills/tree/main/skills/queryable-markdown)
- [skills CLI](https://github.com/vercel-labs/skills)
