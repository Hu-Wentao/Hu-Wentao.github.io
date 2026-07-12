---
title: "Vibe Coding 人机交互的最佳形态：文档协作"
date: 2026-07-12T00:00:00+08:00
draft: true
summary: "人的精力和注意力是有限的，在交互中减少信息熵才能弥补沟通中的效率损失"
tags: ["AI", "VibeCoding", "人机交互", "软件工程"]
categories: ["思考"]
---

从 AI 聊天衍生出来的 AI 编程工具，都对即时沟通的交互模式情有独钟。从 Codex 和 Claude Code，再到各类 IDE 插件、AI 编程客户端，无一不是让用户在与 AI 的持续对话中完成需求沟通和方案调整。

经典交互流程往往是开发者提出需求，AI 直接开始生成代码。而一些 AI 工具进一步提供 Plan 模式，即在生成代码之前通过提问的方式定下实现方案，再基于方案生成代码。这样的小修小补确实有一定效果，但是并没有完全解决方案修订效率低下的问题。

我认为 Vibe Coding 领域中人机的最佳交互形态，是围绕一份实现方案展开的文档协作。

## Vibe Coding 的循环工作流

一个开发需求 REQ 往往包含多个需要确认的实现细节。我们可以将它表示为一组 SPEC：

\[
\mathrm{REQ} =
\left\{
\mathrm{SPEC}_1,
\mathrm{SPEC}_2,
\ldots,
\mathrm{SPEC}_M
\right\}
\]

每个 SPEC 都要经历三个步骤：开发者编辑方案，AI 分析并修改方案，开发者审查 AI 的修改。等本轮涉及的 SPEC 达成一致后，AI 才根据方案落地代码，开发者再检查运行效果。

~~~text
提出需求 REQ
    ↓
拆分为 M 个 SPEC
    ↓
协作完善本轮 M_r 个 SPEC
    ↓
AI 根据方案落地代码
    ↓
开发者检查运行效果
    ├─ 不符合预期：修改受影响的 SPEC，进入下一轮
    └─ 符合预期：结束
~~~

为了让后面的时间比较更容易理解，使用带有语义的时间符号：

- \(t_{\mathrm{edit}}\)：开发者编辑一个 SPEC 的平均时间
- \(t_{\mathrm{analyze}}\)：AI 分析并修改一个 SPEC 的平均时间
- \(t_{\mathrm{review}}\)：开发者审查一个 SPEC 修改结果的平均时间
- \(T_{\mathrm{spec},x}(M_r)\)：在协作模式 \(x\) 下，第 \(r\) 轮完善 \(M_r\) 个 SPEC 的端到端时间
- \(T_{\mathrm{code},r}\)：第 \(r\) 轮根据方案落地代码的时间
- \(T_{\mathrm{check},r}\)：第 \(r\) 轮检查代码运行效果的时间
- \(T_{\mathrm{concurrency},x}(M_r)\)：开发者与 AI 重叠工作、多个 AI 任务并行执行所节省的关键路径时间
- \(T_{\mathrm{context},x,r}\)：\(T_{\mathrm{handoff},x}(M_r)\) 中需要开发者主动承担的上下文切换和恢复时间

首轮需要处理全部 SPEC，因此 \(M_1=M\)。后续返工通常只影响其中一部分，所以 \(M_r\) 不应默认始终等于 \(M\)。

假设模式 \(x\) 一共经历 \(N_x\) 轮，那么完整工作流的端到端时间为：

\[
T_{\mathrm{vibe},x} =
\sum_{r=1}^{N_x}
\left[
T_{\mathrm{spec},x}(M_r)
+
T_{\mathrm{code},r}
+
T_{\mathrm{check},r}
\right]
\]

不同协作模式的主要差异发生在 \(T_{\mathrm{spec},x}\)：同样是处理 \(M_r\) 个 SPEC，有些模式要求人与 AI 完全串行，有些模式则允许开发者与 AI 重叠工作，甚至让多个 AI 任务并行执行。

因此，可以进一步写成：

\[
T_{\mathrm{spec},x}(M_r) =
M_r
\left(
t_{\mathrm{edit}}
+
t_{\mathrm{analyze}}
+
t_{\mathrm{review}}
\right)
+
T_{\mathrm{handoff},x}(M_r)
{}-
T_{\mathrm{concurrency},x}(M_r)
\]

其中，\(T_{\mathrm{handoff},x}(M_r)\) 是发送消息、切换上下文、重新定位修改对象、跨会话分发背景和合并结果等交接成本；\(T_{\mathrm{concurrency},x}(M_r)\) 是相对完全串行基线节省的关键路径时间，包含两类收益：开发者编辑与 AI 分析互相重叠，以及不同 SPEC 的 AI 分析任务彼此并行。并发没有减少实际工作量，只是让一部分工作不再依次落在关键路径上。

### 开发者时间与端到端时间

AI 的处理时间会计入端到端耗时，但并不等于开发者的主动工作时间。开发者在 SPEC 协作阶段真正投入的时间近似为：

\[
T_{\mathrm{dev,spec},x} =
\sum_{r=1}^{N_x}
\left[
M_r
\left(
t_{\mathrm{edit}}
+
t_{\mathrm{review}}
\right)
+
T_{\mathrm{context},x,r}
\right]
\]

即时沟通会把开发者的注意力切成大量“编辑—等待—审查”的短周期；邮件沟通减少了打断，却将反馈推迟到整个批次之后；文档协作则试图让开发者保持连续编辑，同时让 AI 在后台消费已经产生的修改。多会话或多 Agent 协作同样可以并行处理不同 SPEC，但需要额外承担上下文分发与结果合并的成本。

因此，提高 Vibe Coding 效率并不只是让 AI 更快，而是减少无意义的交接和等待，让开发者的主动工作与 AI 的处理尽可能重叠。

### 常见 Vibe Coding 模式对比

#### 即时沟通模式：每个 SPEC 一个同步点

即时沟通通常按照下面的顺序工作：

~~~text
编辑 SPEC₁ → 等待 AI₁ → 审查 SPEC₁
           → 编辑 SPEC₂ → 等待 AI₂ → 审查 SPEC₂
           → ...
~~~

开发者必须等当前 SPEC 的 AI 结果返回并完成审查，才能自然地进入下一个 SPEC。人与 AI 基本处于串行状态，因此：

\[
T_{\mathrm{concurrency},\mathrm{chat}}(M_r)
\approx 0
\]

\[
T_{\mathrm{spec},\mathrm{chat}}(M_r)
\approx
M_r
\left(
t_{\mathrm{edit}}
+
t_{\mathrm{analyze}}
+
t_{\mathrm{review}}
\right)
+
T_{\mathrm{handoff},\mathrm{chat}}(M_r)
\]

它的优点是第一个 SPEC 可以很快得到反馈，适合只有一两个细节的小任务；缺点是每个 SPEC 都形成一次同步点，开发者需要反复等待并恢复上下文。

#### 邮件沟通模式：整个批次一个同步点

邮件沟通允许开发者一次编辑多个 SPEC，但 AI 只有在邮件发送后才能开始处理：

~~~text
编辑 SPEC_1 → 编辑 SPEC_2 → ... → 编辑 SPEC_(M_r)
                                          ↓ 发送
AI 处理 SPEC_1 → AI 处理 SPEC_2 → ... → AI 处理 SPEC_(M_r)
                                                   ↓ 返回
审查 SPEC_1 → 审查 SPEC_2 → ... → 审查 SPEC_(M_r)
~~~

如果 AI 在批次内串行处理 SPEC，并且只在全部处理完成后返回结果，那么：

\[
T_{\mathrm{spec},\mathrm{mail}}(M_r)
\approx
M_r t_{\mathrm{edit}}
+
M_r t_{\mathrm{analyze}}
+
M_r t_{\mathrm{review}}
+
T_{\mathrm{handoff},\mathrm{mail}}(M_r)
\]

忽略交接成本时，它与即时沟通需要的总处理量相同。邮件并没有凭空增加 AI 的计算时间，而是把 \(M_r t_{\mathrm{analyze}}\) 集中成了一个连续的阻塞阶段：相对于即时沟通，开发者在收到任何反馈前的单次 AI 等待，从一个 \(t_{\mathrm{analyze}}\) 放大到整批 \(M_r t_{\mathrm{analyze}}\)。AI 无法在开发者编辑后续 SPEC 时提前分析，开发者也必须等整个批次完成后才能开始审查。

因此，邮件提高了单次沟通的信息承载量，却牺牲了第一个反馈的到达时间，也没有形成真正的人机流水线。

#### 文档协作模式：逐个 SPEC 增量触发

文档协作不是把多个 SPEC 攒成一个更大的 Prompt，而是将每个段落的修改变成一个可以立即调度的增量任务：

~~~text
开发者：编辑 SPEC₁ → 编辑 SPEC₂ → 编辑 SPEC₃ → ...
AI：             分析 SPEC₁
                         分析 SPEC₂
                                  分析 SPEC₃
全部分析完成后：审查 SPEC₁ → 审查 SPEC₂ → 审查 SPEC₃ → ...
~~~

开发者完成 \(\mathrm{SPEC}_1\) 后，不需要等待 AI 返回，而是继续阅读并编辑 \(\mathrm{SPEC}_2\)。与此同时，AI 已经可以分析 \(\mathrm{SPEC}_1\) 的差异。后续 SPEC 修改完成后，也可以作为彼此独立的任务交给 AI 并行分析。

令 \(T_{\mathrm{analyze,tail}}\) 表示开发者完成本轮最后一个 SPEC 时，仍然留在关键路径上的 AI 分析时间，则：

为了让模型保持可读，下面采用一个相对保守的分阶段估算：开发者先完成本轮全部 SPEC 的编辑，等 AI 分析全部结束后，再统一审查结果。如果开发者可以在后续 AI 任务运行时穿插审查已经返回的结果，实际耗时还会更短。

\[
T_{\mathrm{spec},\mathrm{doc}}(M_r)
\approx
M_r t_{\mathrm{edit}}
+
T_{\mathrm{analyze,tail}}
+
M_r t_{\mathrm{review}}
+
T_{\mathrm{handoff},\mathrm{doc}}(M_r)
\]

其范围为：

\[
t_{\mathrm{analyze}}
\le
T_{\mathrm{analyze,tail}}
\le
M_r t_{\mathrm{analyze}}
\]

当 SPEC 相对独立、AI 有足够的并行处理能力，并且文档系统可以可靠识别每个段落的修改时：

\[
T_{\mathrm{analyze,tail}}
\approx
t_{\mathrm{analyze}}
\]

于是：

\[
T_{\mathrm{spec},\mathrm{doc}}(M_r)
\approx
M_r t_{\mathrm{edit}}
+
t_{\mathrm{analyze}}
+
M_r t_{\mathrm{review}}
+
T_{\mathrm{handoff},\mathrm{doc}}(M_r)
\]

与邮件模式相比，理想情况下节省的关键路径时间约为：

\[
\begin{aligned}
T_{\mathrm{spec},\mathrm{mail}}(M_r)
{}-
T_{\mathrm{spec},\mathrm{doc}}(M_r)
\approx{}&
\left(M_r-1\right)t_{\mathrm{analyze}}
\\
&
+
T_{\mathrm{handoff},\mathrm{mail}}(M_r)
{}-
T_{\mathrm{handoff},\mathrm{doc}}(M_r)
\end{aligned}
\]

如果暂时忽略两种模式的交接成本差异，节省量就近似为 \(\left(M_r-1\right)t_{\mathrm{analyze}}\)。它既来自开发者编辑与 AI 分析的重叠，也来自多个 AI 分析任务之间的并行。

文档协作的优势不在于减少了阅读、编辑和审查每个 SPEC 所必需的认知成本，而在于消除了“必须编辑完全部内容才能发送”的批次屏障，使开发者编辑与 AI 分析形成流水线。

这个结论也存在边界条件。AI 任务必须串行执行时，并行收益会缩小，但只要 AI 能在每个 SPEC 修改完成后立即开始分析，流式触发带来的人机重叠仍然存在。只有当 SPEC 高度耦合、并发修改会互相覆盖，导致 AI 必须等全部编辑完成后才能开始处理时，\(T_{\mathrm{analyze,tail}}\) 才会逐渐接近 \(M_r t_{\mathrm{analyze}}\)。对于只有一个 SPEC 的小任务，即时沟通往往拥有更低的启动成本。

#### 多会话 / 多 Agent 协作模式：独立上下文并行

另一种打破即时沟通串行等待的方式，是为不同 SPEC 创建独立会话，或者将它们分发给多个 Agent。开发者提交一个 SPEC 后就可以继续整理下一个 SPEC，各 Agent 在彼此独立的上下文中并行分析：

~~~text
开发者：提交 SPEC₁ → 提交 SPEC₂ → 提交 SPEC₃ → ...
Agent₁：             分析 SPEC₁
Agent₂：                         分析 SPEC₂
Agent₃：                                     分析 SPEC₃
汇总阶段：                                               统一审查与协调
~~~

令 \(P\) 表示可以并行工作的 Agent 数量，\(T_{\mathrm{analyze,tail,agent}}(M_r,P)\) 表示开发者提交本轮最后一个 SPEC 时，多 Agent 分析任务仍然留在关键路径上的时间，则：

\[
T_{\mathrm{spec},\mathrm{agent}}(M_r)
\approx
M_r t_{\mathrm{edit}}
+
T_{\mathrm{analyze,tail,agent}}(M_r,P)
+
M_r t_{\mathrm{review}}
+
T_{\mathrm{handoff},\mathrm{agent}}(M_r)
\]

忽略调度开销，并假定每个 SPEC 的分析时间相近，可以给出一个保守范围：

\[
t_{\mathrm{analyze}}
\le
T_{\mathrm{analyze,tail,agent}}(M_r,P)
\le
\left\lceil
\frac{M_r}{P}
\right\rceil
t_{\mathrm{analyze}}
\]

当 Agent 数量充足，并且不同 SPEC 可以独立处理时：

\[
T_{\mathrm{analyze,tail,agent}}(M_r,P)
\approx
t_{\mathrm{analyze}}
\]

因此，只看编辑、分析和审查的关键路径，多 Agent 模式可以接近理想状态下的文档协作。两者的主要差异转移到了交接成本：独立会话需要分别附带必要背景，Agent 的结论还可能基于不同版本的上下文，开发者最终必须合并结果并解决跨 SPEC 的冲突。这个成本可以进一步拆分为：

\[
\begin{aligned}
T_{\mathrm{handoff},\mathrm{agent}}
={}&
T_{\mathrm{dispatch}}
+
T_{\mathrm{context\ sync}}
\\
&+
T_{\mathrm{merge}}
+
T_{\mathrm{consistency}}
\end{aligned}
\]

若两种模式获得相同的并行收益，可以近似表示为：

\[
\begin{aligned}
T_{\mathrm{spec},\mathrm{agent}}(M_r)
{}-
T_{\mathrm{spec},\mathrm{doc}}(M_r)
\approx{}&
T_{\mathrm{handoff},\mathrm{agent}}(M_r)
\\
&-
T_{\mathrm{handoff},\mathrm{doc}}(M_r)
\end{aligned}
\]

当 SPEC 彼此独立、共享背景很少时，多 Agent 模式可以获得很好的扩展性；当多个 SPEC 共同修改一份方案时，文档提供的单一事实源更容易保证一致性。两者并不互斥：文档可以作为多个 Agent 共同读取和回写的协作界面，在保留共享上下文的同时获得并行执行能力。

### 一个简化的时间示例

假设一轮中包含 4 个 SPEC，并且：

- \(t_{\mathrm{edit}}=5\) 分钟
- \(t_{\mathrm{analyze}}=8\) 分钟
- \(t_{\mathrm{review}}=3\) 分钟
- 暂不计算代码落地、运行检查和交接成本
- 两个文档协作算例均在本轮 AI 分析全部完成后统一审查结果
- 多 Agent 算例假设 \(P=4\)，每个 SPEC 交给一个独立 Agent 并行分析，暂不计算跨会话的上下文分发与结果合并成本

那么：

| 模式 | SPEC 协作时间 | 第一个 AI 结果返回时间 |
| --- | ---: | ---: |
| 即时沟通 | \(4\times(5+8+3)=64\) 分钟 | \(5+8=13\) 分钟 |
| 邮件沟通 | \(4\times5+4\times8+4\times3=64\) 分钟 | \(4\times5+4\times8=52\) 分钟 |
| 文档协作，仅流式触发，AI 串行 | \(5+8+3\times8+4\times3=49\) 分钟 | \(5+8=13\) 分钟 |
| 文档协作，流式触发且 AI 并行 | \(4\times5+8+4\times3=40\) 分钟 | \(5+8=13\) 分钟 |
| 多会话 / 多 Agent 协作，AI 并行 | \(4\times5+8+4\times3=40\) 分钟 | \(5+8=13\) 分钟 |

邮件与即时沟通的基础处理总量相同，但邮件的首个反馈更晚；即时沟通还会额外产生多次上下文切换。文档采用流式触发后，即使 AI 仍然串行处理，也能利用开发者编辑后续 SPEC 的 15 分钟，将总时间从 64 分钟降至 49 分钟。如果不同 SPEC 的 AI 分析还能并行执行，则可以再节省 9 分钟，将总时间降至 40 分钟。

在暂不计算交接成本的理想模型中，多 Agent 与并行文档协作拥有相同的 40 分钟关键路径。真实差异来自模型外的协作成本：多 Agent 需要向独立会话分发上下文并合并结果，文档协作则需要维护段落边界、增量修改和并发写入。前者更适合独立任务，后者更适合共享同一方案的关联 SPEC。

### Plan 模式：减少返工，而不是改变通信介质

Plan 模式与上述协作模式并不在同一个比较维度。即时沟通、邮件沟通、文档协作和多 Agent 协作描述信息如何交接和调度，Plan 描述的是在代码落地前增加一次方案确认，以降低后续返工概率。Plan 可以与任意一种协作方式组合。

假设生成和确认 Plan 需要 \(T_{\mathrm{plan}}\)，使用 Plan 后循环轮数从 \(N_x\) 变为 \(N_{\mathrm{plan}}\)，那么：

\[
T_{\mathrm{vibe},x+\mathrm{plan}} =
T_{\mathrm{plan}}
+
\sum_{r=1}^{N_{\mathrm{plan}}}
\left[
T_{\mathrm{spec},x}(M_r)
+
T_{\mathrm{code},r}
+
T_{\mathrm{check},r}
\right]
\]

Plan 是否值得，取决于前置的方案成本能否被减少的返工抵消。在文档协作中，Plan 还可以从 AI 单方面生成、开发者一次性审批的静态产物，转变为双方持续增量编辑的共享工作界面。

更进一步，文档协作与多 Agent 也可以组合：开发者在共享文档中修改 SPEC，系统根据段落差异将任务分发给多个 Agent，再把分析结果回写到同一份文档中。此时，文档负责维持唯一、可审查的方案状态，多 Agent 负责提高处理并行度，两种机制分别降低交接成本和关键路径时间。
