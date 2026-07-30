---
title: "别让一个容器拖垮整台服务器：docker-compose-guardrails Skill"
date: 2026-07-30T00:00:00+08:00
draft: true
summary: "为 Docker Compose 服务设置可执行的 CPU、内存和进程上限，并把构建隔离、宿主机资源保护与部署后验证纳入同一套 Agent 工作流"
tags: ["AI", "VibeCoding", "Skill", "Docker", "运维"]
categories: ["Artifacts"]
---

一台只有 7.8 GiB 内存的服务器上，某个新部署的容器因为程序缺陷持续占用 CPU、内存和进程资源。其他服务拿不到运行所需的资源，最终整台机器上的应用都受到影响。

事后检查 Docker 的实际配置，可以看到三个关键值：

```text
Memory=0
NanoCPUs=0
PidsLimit=<no value>
```

这些值不是“使用 Docker 默认限制”，而是没有限制。容器可以与宿主机和其他服务竞争全部资源。`restart: unless-stopped` 还会让异常服务在退出后继续启动，但不会为它补上任何资源边界。

这类问题不能只依赖开发者在下一份 `compose.yaml` 中记得多写三行配置。为此，我实现了 [docker-compose-guardrails](https://github.com/Hu-Wentao/skills/tree/main/skills/docker-compose-guardrails) Skill。它把容器资源治理变成一套可重复执行的编写、审查和部署工作流：先解析项目策略，再检查配置，最后验证 Docker 与宿主机实际生效的状态。

它的核心可以概括成一句话：

> 资源限制不是 Compose 文件里的注释性意图，而是部署后必须能够从运行时重新读出的系统事实。

## 为每个长期服务设置有限上限

`docker-compose-guardrails` 将缺少资源限制视为长期服务的部署缺陷。每个服务至少需要显式声明：

- `cpus`：容器可以使用的 CPU 配额；
- `mem_limit`：容器可以使用的内存上限；
- `pids_limit`：容器可以创建的进程数量上限；
- `restart`：容器退出后的重启策略。

一个最小示例类似下面这样：

```yaml
services:
  app:
    image: example/app:1.0
    cpus: "1.0"
    mem_limit: 1g
    pids_limit: 256
    restart: unless-stopped
```

示例中的数值不是所有服务都应该复制的默认值。合适的限制取决于工作负载、主机容量和服务的重要程度。缺少测量数据时，可以先设置保守的临时值，但必须说明后续使用哪些指标或负载测试调整它。

Skill 优先要求在 Compose 服务层设置 `cpus`、`mem_limit` 和 `pids_limit`。只在 `deploy.resources.limits` 中填写 CPU 或内存时，静态检查会给出警告，因为不同部署目标对 `deploy` 字段的执行方式不同。配置是否真正生效，仍需由运行时验证。

短期、手动执行的任务可以申请例外，但例外必须包含原因、负责人和预期持续时间。长期服务不能因为“暂时不知道该设多少”而默认为无限制。

## 静态检查先发现缺失配置

Skill 附带 `check_compose_guardrails.py` 脚本。它先调用 `docker compose config --format json` 渲染实际 Compose 模型，再逐个检查服务：

```bash
python3 /path/to/docker-compose-guardrails/scripts/check_compose_guardrails.py \
  -f compose.yaml
```

检查器会将以下情况作为错误：

- 缺少有限的 CPU 配额；
- 缺少有限的内存上限；
- 缺少有限的进程上限；
- 在长期服务的 `command` 或 `entrypoint` 中执行常见构建命令。

重启策略缺失或禁用会产生警告，要求部署者确认这是否符合服务用途。CPU 或内存只通过 `deploy.resources.limits` 提供时也会产生警告，提醒部署者验证目标环境是否执行这些限制。

检查器不会替代 Compose 自身的解析。环境变量、扩展字段和合并结果都先由 Docker Compose 处理，因此检查的是接近部署输入的渲染结果，而不是对 YAML 文本做不完整的正则匹配。

## 构建不能藏在容器启动命令里

有些项目会让容器启动时先执行构建，再启动应用：

```yaml
command: sh -c "pnpm build && pnpm start"
```

这种配置把两种资源特征完全不同的工作塞进了同一个生命周期。构建可能在短时间内占用大量 CPU 和内存；每次容器重启又会重新构建；构建失败还会触发重启策略，使容器反复执行同一项高开销任务。

`docker-compose-guardrails` 会拒绝常见的启动时构建命令，包括 `next build`、`pnpm build`、`npm run build` 和 `yarn build`。应用产物应在 Dockerfile 的构建阶段生成，运行阶段只启动已经构建好的产物。

```dockerfile
FROM node:24 AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

FROM node:24-slim AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]
```

这段代码只展示“构建阶段与运行阶段分离”的结构。示例假设应用生成 `dist/server.js`，实际复制内容和启动命令需要根据应用的构建产物调整。

分离阶段仍然不代表构建已经受到限制。BuildKit 守护进程和执行容器可能位于独立的 cgroup 中，只限制发起 `docker build` 的命令行进程并不能约束整棵构建执行树。对于资源紧张的生产主机，Skill 要求将构建器放进有边界的 best-effort cgroup，或者使用远程构建器。

## Compose 上限不能保证关键服务的最低资源

`mem_limit` 和 CPU 配额解决的是“一个容器最多可以使用多少资源”。它们不能回答另一个问题：当整台主机发生资源竞争时，关键服务至少能保留多少资源。

这两种目标不能混为一谈：

| 目标 | 主要机制 |
| --- | --- |
| 防止单个容器无限扩张 | Compose 的 CPU、内存和 PID 上限 |
| 在内存压力下保护关键服务 | cgroup v2 的 `memory.min` 及兼容的祖先配置 |
| 为重要服务提供更高 CPU 竞争优先级 | `cpu.weight` |
| 提供严格的 CPU 最低容量 | 独占 cpuset 或等价的容量隔离 |

`memory.low` 只能提供软回收保护，不能被描述为硬性最低内存。`cpu.weight` 影响竞争时的相对优先级，也不是严格的 CPU 保底。

因此，Skill 会先将长期工作负载分为三类：

- `critical`：主机压力下仍需保留明确最低资源的关键服务；
- `standard`：有有限上限，但不要求硬性最低资源的生产服务；
- `best-effort`：构建、开发、批处理和可让步任务。

需要最低资源保护时，部署还必须验证容器所在的叶子 cgroup 及相关祖先。Docker 重新创建容器时会产生新的 cgroup，所以一次手工写入 `memory.min` 不能形成持久策略。项目需要使用 `cgroup_parent`、受管理的 systemd slice、幂等生命周期协调器，或者能够提供等价保证的编排平台。

## 部署前先确认资源预算可行

有限上限也可能被配置成一个不可能兑现的整体预算。例如，主机只有 8 GiB 内存，却为多个关键服务声明了合计 10 GiB 的最低保护。每个单项看起来合理，组合起来仍然会让主机失去回旋空间。

Skill 要求部署前满足下面的基本关系：

```text
宿主机预留 + 所有关键服务的 memory.min 总和
    <= 可保护的宿主机内存
```

宿主机预留需要覆盖内核、Docker、网络、入口服务、监控和运维空间。交换分区可以承担紧急情况下的延迟代价，但不能被当作关键服务的受保护内存。

部署准入也不能只看某一刻的 `MemAvailable`。项目可以声明内存压力信息（Pressure Stall Information，PSI）阈值、现有 OOM 状态和其他资源信号。使用 PSI 时，应选择内核提供的 `avg10`、`avg60` 或 `avg300` 等时间窗口平均值，并明确范围、窗口、阈值和采样间隔，不能把累计 `total` 字段的差值伪装成标准 PSI 平均值。

如果预算或压力检查失败，部署和构建都应停止，并返回稳定、可操作的错误，说明哪个约束失败，以及观测值和允许值分别是多少。

## 用项目配置保存主机差异

通用 Skill 可以规定安全不变量，但不应该知道每台服务器有多少内存、哪些服务属于关键服务、使用哪个 cgroup 或执行哪些运维脚本。

项目可以在仓库中保存自己的部署策略：

```text
.agents/skills-config/docker-compose-guardrails/
├── config.yaml
└── host-policy.md
```

`config.yaml` 负责选择通用部署策略、项目配置和验证命令：

```yaml
schema: docker-compose-guardrails.config.v1
profile: production-host
tasks:
  deploy:
    base: references/deploy.md
    profile: host-policy.md
    commands:
      preflight: ./ops/check-resource-budget
      verify: ./ops/verify-cgroups
```

在审查或部署前，Agent 运行解析器：

```bash
uv run python /path/to/docker-compose-guardrails/scripts/resolve.py \
  --cwd /path/to/project \
  --task deploy
```

解析器将通用策略与项目策略组合成一份带稳定 `instructions_id` 的指令，并写入项目的 `.agents/.cache/docker-compose-guardrails/` 目录。它只声明 `preflight` 和 `verify` 等命令，不会在解析阶段执行命令。

项目配置可以提供服务分类、主机预留、资源预算、构建器位置和压力阈值，但不能覆盖四条通用安全不变量：

1. 每个长期容器都有有限的内存、CPU 和 PID 上限；
2. 关键服务最低资源由宿主机机制执行并验证；
3. 关键服务最低资源与宿主机预留之和不超过物理容量；
4. 构建器的完整执行树受到限制，且不能消耗关键服务的受保护容量。

这种拆分让同一份 Skill 可以用于不同项目，同时把主机拓扑和数值预算留在真正拥有这些事实的仓库中。

## 部署后读取实际状态

配置审查通过不代表部署已经完成。容器启动后，Skill 要求读取 Docker 的实际 `HostConfig`：

```bash
docker inspect CONTAINER_NAME \
  --format 'Memory={{.HostConfig.Memory}} NanoCPUs={{.HostConfig.NanoCpus}} PidsLimit={{.HostConfig.PidsLimit}} Restart={{.HostConfig.RestartPolicy.Name}}'
```

对于受限服务，`Memory` 和 `NanoCPUs` 必须是非零值，`PidsLimit` 不能是 `0` 或空值。部署报告应记录观测值，而不只是重复 `compose.yaml` 中的配置。

启用最低资源保护时，还要检查：

- 容器是否进入声明的资源类别；
- 叶子及祖先 cgroup 的 `memory.min` 是否正确；
- `memory.max`、CPU 控制和重启策略是否匹配项目配置；
- BuildKit 守护进程及执行容器是否位于构建器边界内；
- 实际受保护最低内存之和是否仍在准入预算内。

只要运行时状态与解析后的策略不同，部署就应失败。这个验收标准能够发现“Compose 写了但目标环境没有执行”“容器重建后脱离保护 cgroup”“构建器没有进入受限 slice”等仅靠静态文件无法识别的问题。

## 它解决的是一条完整部署链路

`docker-compose-guardrails` 最初来自一个很具体的故障：Compose 没有声明资源约束，Bug 因而从单个应用扩散成整台主机的资源事故。

随着工作流完善，它处理的不再只是给 YAML 增加三个字段，而是把资源安全贯穿到整个部署过程：

```text
解析项目策略
    ↓
分类服务与构建任务
    ↓
检查 Compose 上限和启动命令
    ↓
验证宿主机预算与压力
    ↓
部署或拒绝部署
    ↓
读取 Docker 与 cgroup 实际状态
```

这套流程不会消除应用 Bug，也不会让一台资源不足的主机凭空获得更多容量。它提供的是故障隔离：即使一个服务进入异常状态，它能够造成的资源影响也应被限制在预先审查过的边界内；当项目确实无法满足资源承诺时，系统应在部署前明确拒绝，而不是等其他应用失去响应后才发现问题。

## 相关

- [docker-compose-guardrails 源码](https://github.com/Hu-Wentao/skills/tree/main/skills/docker-compose-guardrails)
- [Docker Compose 服务配置参考](https://docs.docker.com/reference/compose-file/services/)
- [Linux cgroup v2 内存控制器](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory)
