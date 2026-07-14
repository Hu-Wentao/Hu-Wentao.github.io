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

## 第一层：按流程展开原始公式

先按照每种模式实际发生的步骤计算时间，不提前提取“共同基础成本”。这样可以直接从公式看出每段时间对应哪个流程动作。

### 模式 1：即时通讯

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
\boxed{
T_{\text{instant-total}}
=
N_{\text{spec-revision}}
\left(
T_{\text{spec-edit}}
+T_{\text{AI-plan}}
+T_{\text{code-landing}}
+T_{\text{plan-review}}
\right)
}
\]

这里的“方案贡献”和“代码贡献”是活动归因，不是两个前后分离的阶段。实际时间轴仍然是每轮方案和代码交错发生。

### 模式 2：邮件通讯

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
N_{\text{spec}}T_{\text{spec-edit}}
+T_{\text{AI-plan}}
+N_{\text{spec}}T_{\text{plan-review}}
\right]
\]

方案确认后，代码只落地一次：

\[
T_{\text{email-code}}=T_{\text{code-landing}}
\]

总时间为：

\[
\boxed{
T_{\text{email-total}}
=
R_{\text{revision-avg}}
\left[
N_{\text{spec}}T_{\text{spec-edit}}
+T_{\text{AI-plan}}
+N_{\text{spec}}T_{\text{plan-review}}
\right]
+T_{\text{code-landing}}
}
\]

### 模式 3：文档协作

每个 SPEC 的平均 1.5 次修订都发生在文档阶段。开发者完成一个增量修改后即可交给 AI，随后继续编辑其他 SPEC；AI 返回后，开发者按结果到达顺序审查，需要修订的 SPEC 立即进入下一轮。

文档阶段包含全部 SPEC 编辑、AI 后台处理和方案审查。由于 AI 处理可以和开发者继续编辑或审查重叠，只有未被这些工作覆盖的等待时间会增加墙钟时间：

\[
T_{\text{document-plan}}
=
N_{\text{spec-revision}}T_{\text{spec-edit}}
+T_{\text{document-AI-wait}}
+N_{\text{spec-revision}}T_{\text{plan-review}}
\]

其中 \(T_{\text{document-AI-wait}}\) 表示文档调度中没有被开发者编辑或审查覆盖、最终暴露在关键路径上的 AI 等待时间。模拟器通过以下方式计算它：

1. 每个 SPEC 首轮必做，并以 \(R_{\text{revision-avg}}-1\) 的概率再修订一轮。
2. 枚举所有可能的 SPEC 修订组合，并按概率加权。
3. 开发者只有一个编辑/审查执行槽；AI 任务并发数量不受限。
4. 开发者先连续完成首轮编辑，随后优先审查最早返回的结果；需要修订时立即编辑并重新提交。

方案确认后，代码只落地一次：

\[
T_{\text{document-code}}=T_{\text{code-landing}}
\]

总时间为：

\[
\boxed{
T_{\text{document-total}}
=
N_{\text{spec-revision}}T_{\text{spec-edit}}
+T_{\text{document-AI-wait}}
+N_{\text{spec-revision}}T_{\text{plan-review}}
+T_{\text{code-landing}}
}
\]

不能再把整个文档协作时间乘以 1.5，因为 1.5 已经体现在 SPEC 修订任务数量和离散事件调度中。

## 第二层：提取共同项，优化对比公式

在三条原始公式都明确之后，可以看到它们都包含以下真实流程动作：完成预期数量的 SPEC 编辑与方案审查，并至少落地一次代码。此时再把这些项提取为“共同基础成本”：

\[
T_{\text{common-base}}
=
N_{\text{spec-revision}}T_{\text{spec-edit}}
+N_{\text{spec-revision}}T_{\text{plan-review}}
+T_{\text{code-landing}}
\]

提取共同项不会改变原始流程，只是把三种总时间改写成更容易横向比较的形式：

\[
\boxed{
T_{\text{instant-total}}
=
T_{\text{common-base}}
+N_{\text{spec-revision}}T_{\text{AI-plan}}
+\left(N_{\text{spec-revision}}-1\right)T_{\text{code-landing}}
}
\]

\[
\boxed{
T_{\text{email-total}}
=
T_{\text{common-base}}
+R_{\text{revision-avg}}T_{\text{AI-plan}}
}
\]

\[
\boxed{
T_{\text{document-total}}
=
T_{\text{common-base}}
+T_{\text{document-AI-wait}}
}
\]

因此可以统一定义：

\[
T_{\text{mode-overhead}}
=
T_{\text{mode-total}}-T_{\text{common-base}}
\]

这里的“模式开销”不一定是无效工作，而是相对共同流程额外暴露在关键路径上的时间：即时通讯是每轮 AI 方案处理和重复代码落地，邮件通讯是每轮整批 AI 处理屏障，文档协作则是无法被开发者工作覆盖的 AI 等待。

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

先按流程计算三种模式。

即时通讯：

\[
T_{\text{instant-plan}}=6\times(5+8+3)=96\text{ 分钟}
\]

\[
T_{\text{instant-code}}=6\times8=48\text{ 分钟}
\]

\[
T_{\text{instant-total}}=96+48=144\text{ 分钟}
\]

邮件通讯：

\[
T_{\text{email-plan}}
=
1.5\times\left[4\times5+8+4\times3\right]
=60\text{ 分钟}
\]

\[
T_{\text{email-total}}=60+8=68\text{ 分钟}
\]

文档协作通过离散事件调度得到：

\[
T_{\text{document-plan}}=50.5\text{ 分钟}
\]

\[
T_{\text{document-total}}=50.5+8=58.5\text{ 分钟}
\]

完成流程计算后，再提取共同基础成本：

\[
T_{\text{common-base}}=6\times5+6\times3+8=56\text{ 分钟}
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
- 每种模式先按流程展示方案贡献、代码贡献和总耗时。
- 在完成流程结果之后，再用“共同基础成本 + 模式开销”作为横向对比视图。
- 对比条使用同一尺度，并把优化后的“共同基础成本”和“模式开销”堆叠显示。
- 即时通讯标明“方案与代码交错”；邮件和文档标明“方案确认后落地一次”。
- 精确的文档调度枚举保留在模拟器内部，不在界面暴露递推公式。

## 模型边界

- 默认不计算现实邮件的离线查收延迟。
- 代码审查、共享文件冲突、合并和测试没有单独建模；需要时统一计入代码落地时间。
- 每个 SPEC 最多两轮；平均 1.5 通过“首轮 + 50% 概率第二轮”实现。
- 邮件第二轮按整个批次重新处理；文档第二轮只调度需要修订的 SPEC。
- 该模型用于比较任务组织方式，不是对所有工程任务的性能承诺。
