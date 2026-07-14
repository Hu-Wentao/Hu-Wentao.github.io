# Vibe Coding 协作耗时模型（独立草稿）

> 本文档是公式与模拟器的实施草稿，不属于 Hugo 文章内容，也不参与站点发布。

## 比较目标

比较同一个 REQ 在三种协作模式下，从提出需求到代码落地的墙钟时间。时间分成两类：

1. **需求到方案确认**：完成必要的 SPEC 修订，并确认可以实施的方案。
2. **方案到代码落地**：AI 根据最终方案一次性写入代码。

模式 1 的方案与代码在时间轴上交错，但仍分别归入“方案贡献”和“代码贡献”；模式 2、3 则在方案确认后才开始最终代码落地。

## 1.5 轮的统一假设

沿用前文口径，平均 1.5 轮包含首轮；等价于首轮必做、50% 概率再修订一轮。模型暂不支持第三轮及以上修订。

同一个 1.5 在三种模式中的调度单位不同：

- **即时通讯**：每个 SPEC 平均经历 1.5 次“隐式方案 + 代码修改”。
- **邮件通讯**：整个邮件批次平均往返 1.5 轮，每一轮都重新处理全部 SPEC。
- **文档协作**：每个 SPEC 平均在文档内修订 1.5 次；修订可以增量触发、彼此穿插，文档确认后代码只落地一次。

因此，邮件的第二轮是“整个批次再次往返”，文档的第二轮是“需要修订的 SPEC 在文档内继续流转”。二者不能使用同一套批次调度。

## 输入变量

变量名直接描述业务含义：

- \(N_{\text{spec}}\)：REQ 包含的 SPEC 数量。
- \(R_{\text{revision-avg}}\)：平均修订轮数，当前范围为 1 到 2，默认 1.5。
- \(N_{\text{spec-revision}}=N_{\text{spec}}R_{\text{revision-avg}}\)：平均 SPEC 修订总量。
- \(T_{\text{spec-edit}}\)：开发者编辑一个 SPEC 一轮的时间。
- \(T_{\text{AI-plan}}\)：AI 形成或修改一个 SPEC 方案的时间。
- \(T_{\text{plan-review}}\)：开发者审查一个 SPEC 方案的时间。
- \(T_{\text{code-landing}}\)：执行一次代码落地（可包含必要检查）的墙钟时间。

假设方案任务和代码任务都可以由足够多的 subagent 并行处理，因此：

\[
T_{\text{AI-plan-batch}}\approx T_{\text{AI-plan}}
\]

并假设信息充分时，AI 落地一个 SPEC 与多个 subagent 并行落地整个批次的墙钟时间近似相同，因此三种模式共用同一个 \(T_{\text{code-landing}}\)。代码审查、合并和测试暂不进一步拆分；如果需要，可以直接包含在这个复合时间里。

在即时通讯中，这个成本发生在每次尚未最终确认的 SPEC 修订中，归入“代码贡献”；在邮件和文档中，它发生在方案确认后，并且只支付一次。

## 共同基础成本

三种模式都要完成相同数量的方案编辑和方案审查：

\[
T_{\text{common-plan}}
=
N_{\text{spec-revision}}
\left(
T_{\text{spec-edit}}+T_{\text{plan-review}}
\right)
\]

根据最终方案一次性落地代码的成本为：

\[
T_{\text{code-once}}=T_{\text{code-landing}}
\]

共同基础成本为：

\[
\boxed{
T_{\text{common-base}}
=
T_{\text{common-plan}}+T_{\text{code-once}}
}
\]

“模式开销”并不都代表无效工作，而是相对共同基础成本额外暴露在关键路径上的 AI 等待、重复代码修改或调度屏障。

## 模式 1：即时通讯

每个 SPEC 修订都串行经历：

```text
编辑需求 → AI 形成隐式方案 → AI 修改代码 → 审查方案和代码
```

方案贡献为：

\[
T_{\text{instant-plan}}
=
N_{\text{spec-revision}}
\left(
T_{\text{spec-edit}}+T_{\text{AI-plan}}+T_{\text{plan-review}}
\right)
\]

代码贡献为：

\[
T_{\text{instant-code}}
=
N_{\text{spec-revision}}T_{\text{code-landing}}
\]

总时间为：

\[
T_{\text{instant-total}}
=
T_{\text{instant-plan}}+T_{\text{instant-code}}
\]

相对共同基础成本的模式开销为：

\[
T_{\text{instant-overhead}}
=
T_{\text{instant-total}}-T_{\text{common-base}}
\]

它包含两部分：每个 SPEC 修订都要串行等待 AI 形成方案，以及在方案未最终确认前反复修改和检查代码。

## 模式 2：邮件通讯

邮件把全部 SPEC 作为一个批次。整个批次平均经历 \(R_{\text{revision-avg}}\) 轮：

```text
编辑整批 → AI 并行处理整批方案 → 审查整批
```

需求到方案确认的时间为：

\[
T_{\text{email-plan}}
=
R_{\text{revision-avg}}
\left[
N_{\text{spec}}
\left(
T_{\text{spec-edit}}+T_{\text{plan-review}}
\right)
+T_{\text{AI-plan}}
\right]
\]

方案确认后，代码只落地一次：

\[
T_{\text{email-code}}=T_{\text{code-once}}
\]

总时间为：

\[
T_{\text{email-total}}
=
T_{\text{email-plan}}+T_{\text{email-code}}
\]

由于共同基础成本已经包含同样的 \(N_{\text{spec}}R_{\text{revision-avg}}\) 次编辑和审查，因此：

\[
\boxed{
T_{\text{email-overhead}}
=
R_{\text{revision-avg}}T_{\text{AI-plan}}
}
\]

## 模式 3：文档协作

每个 SPEC 的平均 1.5 次修订都发生在文档阶段。开发者完成一个增量修改后即可交给 AI，随后继续编辑其他 SPEC；AI 返回后，开发者按结果到达顺序审查，需要修订的 SPEC 立即进入下一轮。

文档方案时间可以归纳为：

\[
T_{\text{document-plan}}
=
T_{\text{common-plan}}+T_{\text{document-AI-wait}}
\]

其中 \(T_{\text{document-AI-wait}}\) 表示文档调度中没有被开发者编辑或审查覆盖、最终暴露在关键路径上的 AI 等待时间。模拟器通过以下方式计算它：

1. 每个 SPEC 首轮必做，并以 \(R_{\text{revision-avg}}-1\) 的概率再修订一轮。
2. 枚举所有可能的 SPEC 修订组合，并按概率加权。
3. 开发者只有一个编辑/审查执行槽；AI 任务并发数量不受限。
4. 开发者先连续完成首轮编辑，随后优先审查最早返回的结果；需要修订时立即编辑并重新提交。

方案确认后，代码只落地一次：

\[
T_{\text{document-code}}=T_{\text{code-once}}
\]

总时间为：

\[
T_{\text{document-total}}
=
T_{\text{document-plan}}+T_{\text{document-code}}
\]

也就是：

\[
\boxed{
T_{\text{document-total}}
=
T_{\text{common-base}}+T_{\text{document-AI-wait}}
}
\]

不能再把整个文档协作时间乘以 1.5，因为 1.5 已经体现在 SPEC 修订任务数量和离散事件调度中。

## 默认算例

模拟器默认参数：

- \(N_{\text{spec}}=4\)
- \(R_{\text{revision-avg}}=1.5\)
- \(T_{\text{spec-edit}}=5\) 分钟
- \(T_{\text{AI-plan}}=8\) 分钟
- \(T_{\text{plan-review}}=3\) 分钟
- \(T_{\text{code-landing}}=8\) 分钟

由此得到：

\[
N_{\text{spec-revision}}=4\times1.5=6
\]

\[
T_{\text{common-plan}}=6\times(5+3)=48\text{ 分钟}
\]

\[
T_{\text{code-once}}=8\text{ 分钟}
\]

\[
T_{\text{common-base}}=48+8=56\text{ 分钟}
\]

| 协作模式 | 需求到方案 / 方案贡献 | 方案到代码 / 代码贡献 | 模式开销 | 总耗时 |
| --- | ---: | ---: | ---: | ---: |
| 即时通讯 | 96 分钟 | 48 分钟 | 88 分钟 | 144 分钟 |
| 邮件通讯 | 60 分钟 | 8 分钟 | 12 分钟 | 68 分钟 |
| 文档协作 | 50.5 分钟 | 8 分钟 | 2.5 分钟 | 58.5 分钟 |

即时通讯的两列是活动归因，因为方案与代码在实际时间轴上交错；邮件和文档的两列则是先后相接的真实阶段。

## 模拟器展示要求

- 输入项使用完整语义名，不展示单字母变量。
- 明确同时展示“SPEC 修订总量”和“邮件整批轮数”，防止把两个 1.5 混为同一种调度。
- 每种模式展示总耗时、方案贡献、代码贡献和模式开销。
- 对比条使用同一尺度，并把“共同基础成本”和“模式开销”堆叠显示。
- 即时通讯标明“方案与代码交错”；邮件和文档标明“方案确认后落地一次”。
- 精确的文档调度枚举保留在模拟器内部，不在界面暴露递推公式。

## 模型边界

- 默认不计算现实邮件的离线查收延迟。
- 代码审查、共享文件冲突、合并和测试没有单独建模；需要时统一计入代码落地时间。
- 每个 SPEC 最多两轮；平均 1.5 通过“首轮 + 50% 概率第二轮”实现。
- 邮件第二轮按整个批次重新处理；文档第二轮只调度需要修订的 SPEC。
- 该模型用于比较任务组织方式，不是对所有工程任务的性能承诺。
