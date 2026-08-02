---
title: "多个项目共用一台主机时，谁来管理入口：host-governance Skill"
date: 2026-08-02T00:00:00+08:00
draft: true
summary: "把项目部署涉及的 Caddy、Tailscale、Cloudflare、DNS 和服务暴露纳入同一条主机治理事务，明确消费项目、基础设施仓库与运行时系统的权威边界"
tags: ["AI", "VibeCoding", "Skill", "基础设施", "运维"]
categories: ["Artifacts"]
---

一个项目部署到服务器时，工作通常不会在应用进程启动后结束。它还需要一个域名、一条 Caddy 路由、一组 Tailscale 访问规则，可能还要修改 Cloudflare DNS。单看每个项目，这些都是部署所需的正常配置；但当多个项目共用一台主机时，它们操作的其实是同一组共享基础设施。

如果每个项目只按照自己的部署脚本修改主机，冲突很快就会出现：两个项目声明同一个域名或监听端口，一个项目覆盖另一个项目的 Caddy 根配置，新加的 Tailscale 规则意外扩大了旧服务的访问范围，DNS 已经公开但应用健康检查尚未通过。应用部署成功，并不等于入口、网络和域名已经处于正确状态。

为此，我实现了 [host-governance](https://github.com/Hu-Wentao/skills/tree/main/skills/host-governance) Skill。它把一次项目部署涉及的主机级变更组织成同一条治理事务：先确定每项事实由谁负责，再检查当前状态和资源冲突，生成完整变更计划，只执行本次明确授权的步骤，最后分别验证应用、入口、网络和 DNS。

它的核心可以概括成一句话：

> 项目可以提出部署需求，但共享主机配置必须由主机基础设施的权威来源统一治理。

## 主机是多个项目共享的边界

一台主机可以承载多个项目。反过来，一个项目也可能部署到多台主机或多个环境。`host-governance` 因此不把“项目仓库”直接等同于“主机配置所有者”，而是区分三个层次：

```text
消费项目
  └─ 拥有应用端口、协议、健康检查和回滚命令
          ↓ 提出部署意图
主机基础设施仓库
  └─ 拥有目标主机、入口、网络访问和域名期望状态
          ↓ 通过受控执行器应用
运行时系统
  └─ Caddy、Tailscale、Cloudflare API 和实际主机状态
```

消费项目最清楚应用如何运行，例如它监听哪个端口、使用什么协议、怎样判断健康以及如何回滚。主机基础设施仓库则掌握跨项目共享的事实，例如某个域名已经属于哪个服务、哪些端口已经被占用、哪些节点可以访问目标主机，以及 Cloudflare 资源由 Terraform、API 还是控制台管理。

运行时系统是实时状态来源。Git 中的期望配置不能证明 Caddy 已经加载成功、Tailscale 策略已经生效，或者 DNS 已经通过目标解析器传播。治理流程必须同时读取仓库事实和实时状态，但不能把实时观测复制成另一份永久权威。

## 一次部署先形成完整变更矩阵

`host-governance` 不会看到“把这个服务发布到公网”就立即修改 Caddy 或 DNS。它先收集稳定服务 ID、所属项目、目标环境与主机、应用协议、绑定地址、端口、健康检查、期望域名、暴露范围和所需网络流量。

随后，它为每个变更组件建立统一矩阵：

| 字段 | 需要回答的问题 |
| --- | --- |
| Owner | 哪个仓库或外部系统拥有这项期望事实 |
| Target | 要修改哪台主机、哪个文件、策略、Zone 或资源 ID |
| Current | 带时间边界的当前状态来自哪里 |
| Desired | 本次授权要求到达什么状态 |
| Executor | 使用哪个 CLI、API、专用 Skill 或人工操作 |
| Validate | 需要哪些语法、运行时和负向验证 |
| Rollback | 失败后如何恢复精确快照 |
| Authority | 当前步骤是只读、已授权写入，还是仍被阻塞 |

只有完整计划没有所有权冲突，流程才进入写入阶段。一般情况下，应用应先在私有路径通过健康检查，然后配置访问控制和入口，最后再发布 DNS。具体顺序仍由项目事实决定，而不是被 Skill 写死。

## Caddy、Tailscale 和 Cloudflare 不是三件孤立的事

一次外部可访问的部署可能同时跨越 Caddy、Tailscale 和 Cloudflare。三个系统各有自己的验证方式，但它们共同决定同一条请求路径是否安全可用。

### Caddy 管理共享入口

修改 Caddy 前，需要识别安装方式、配置来源、导入关系、运行身份和管理端点，并读取完整有效配置。流程会检查重复站点地址、通配符重叠、监听冲突、重定向循环和证书所有权冲突。

当现有布局支持配置导入时，每个服务应拥有独立片段，消费项目不直接拥有共享根配置。候选配置需要在与真实服务一致的模块、环境文件和运行身份下通过验证，然后使用既有的零停机 reload 或管理 API 流程加载。配置解析成功并不等于请求链路已经可用，最终还要从正确的 DNS、SNI、协议和网络来源发起探测。

### Tailscale 管理谁能访问谁

Tailscale 规则具有叠加语义。增加一条更窄的 Grant 或 ACL，不会抵消另一条已经匹配目标的宽泛规则。因此，治理流程不仅检查准备新增的规则，还会查找所有已经覆盖目标节点的选择器和访问路径。

策略变更需要同时包含正向和负向测试：需要的流量必须成功，不应允许的发起路径和横向访问必须失败。保存策略成功只说明控制面接受了配置，不能替代从真实来源节点执行的验证。

### Cloudflare 管理外部资源与 DNS

Cloudflare 变更首先要解析准确的 Account、Zone、资源类型、外部 ID 和当前控制器。一个资源不能同时由 Terraform、控制台脚本和另一个自动化控制器管理。既有资源需要先进入选定的 State，再由声明式配置接管。

创建、更新、替换和删除必须分别审查。域名注册、转移、续费、联系人修改、账单变更、Zone 删除、DNSSEC 切换、Nameserver 变更和批量 DNS 删除不属于普通项目部署授权。即使它们在同一个 API 中，也必须获得单独授权。

## 项目配置只描述项目自己的部署事实

`host-governance` 是全局 Skill，不要求每个项目复制一份完整流程。没有项目配置时，它使用通用工作流；消费项目也可以在 `.agents/skills-config/host-governance/` 中添加经过评审的适配：

```text
.agents/skills-config/host-governance/
├── config.yaml
└── project.md
```

最小配置结构如下：

```yaml
schema: host-governance.config.v1
profile: project-profile
tasks:
  control:
    base: references/control.md
    profile: project.md
    commands:
      inspect: <READ_ONLY_PROJECT_INSPECTION_COMMAND>
      validate: <PROJECT_VALIDATION_COMMAND>
```

这里的两个大写值是项目需要替换的命令占位符。项目 Profile 可以声明部署清单路径、稳定服务 ID、环境词汇、应用侧检查命令和回滚入口，但不能复制设备清单、共享 Caddy 映射、Tailnet 策略、Cloudflare 期望状态、临时观测或凭据。

解析器从消费项目根目录读取配置：

```bash
uv run python <SKILL_ROOT>/scripts/resolve.py \
  --cwd <PROJECT_ROOT> \
  --task control
```

`SKILL_ROOT` 是已安装的 `host-governance` 目录，`PROJECT_ROOT` 是消费项目的 Git 根目录。解析只组合通用说明、项目说明和声明式命令，并把派生结果写入 `.agents/.cache/host-governance/`。它不会执行这些命令，也不会因为配置中出现了某个命令就推定用户已经授权写入。

## 授权不能从部署意图中自动扩大

“部署这个项目”可以说明期望结果，却不能自动授权所有相关外部动作。`host-governance` 将 `inspect` 和 `plan` 视为只读；远程写入、Caddy reload、Tailscale 策略保存、DNS 修改、迁移和回滚都必须有当前任务的明确授权。

流程还保留几条不可由项目 Profile 覆盖的边界：

- 不输出或持久化 API Token、Auth Key、私钥、Session 和含密请求体；
- 修改共享配置前保存精确快照和可验证的恢复路径；
- 发现域名、监听器、路由、选择器或资源 ID 所有权冲突时停止；
- 不通过扩大网络访问范围来让验证通过；
- 不把付费、删除或身份变更混入普通部署授权；
- 不因应用部署成功就宣称 TLS、DNS 或访问控制正确。

这使 Agent 可以自动完成确定性的检查和编排，同时把会改变暴露面、费用、数据或恢复边界的决定留给明确授权。

## 安装与使用

可以通过 `skills` CLI 安装：

```bash
pnpm dlx skills add Hu-Wentao/skills \
  --skill host-governance \
  --yes
```

安装后，可以先要求 Agent 做一次只读部署检查：

```text
请使用 host-governance 检查当前项目部署到目标主机所需的基础设施变更。
先保持只读，识别应用端口、健康检查、目标主机、Caddy 路由、
Tailscale 流量和 Cloudflare DNS 的当前状态、所有者与冲突；
生成完整变更矩阵，不要执行 reload、保存策略或修改 DNS。
```

确认计划后，再对准确步骤授予写入权限：

```text
根据刚才的变更矩阵，执行已列出的 Caddy 服务片段和对应 DNS 记录变更。
不要修改 Tailscale 策略。每个组件变更后立即验证；如果检测到漂移、
所有权冲突或意外暴露，停止后续步骤并保留当前证据，不要自动回滚。
```

第二个请求故意明确了允许和禁止的范围，也没有默认授权回滚。回滚同样会改变共享运行状态，只有当前请求已经授权，或前一项事务明确包含自动恢复时，Skill 才会执行。

## 它适合治理什么

`host-governance` 适合一个部署需要跨越多个共享基础设施表面，或者多个项目会在同一主机、Tailnet、Caddy 实例和 Cloudflare Account 中共同运行的场景。它也适合作为产品专用 Skill 的事务所有者：例如由 Tailscale 专用 Skill 执行策略操作，再把结果带回完整部署报告。

它不是应用发布工具、实时监控系统或主机资产数据库。它不会替消费项目决定应用如何构建，也不会让 Git 中的期望状态取代运行时检查。它提供的是一条跨项目、跨系统、可检查授权边界的主机基础设施治理工作流。

## 结语

多个项目共享一台主机时，真正需要共享的不是一份可以被所有项目随意修改的配置，而是一套清晰的所有权和事务边界。应用仓库拥有应用事实，主机基础设施仓库拥有共享入口与网络期望，Caddy、Tailscale 和 Cloudflare 保存各自的实时状态。

`host-governance` 将这些边界组合进同一条部署事务：先收集意图，再检查所有权和冲突；先形成完整计划，再执行经过授权的组件；既验证允许路径，也验证禁止路径。这样，一个项目的部署需求可以进入共享主机，而不会让它顺手成为整台主机的配置所有者。

## 相关

- [host-governance Skill](https://github.com/Hu-Wentao/skills/tree/main/skills/host-governance)
- [Skills 仓库](https://github.com/Hu-Wentao/skills)
