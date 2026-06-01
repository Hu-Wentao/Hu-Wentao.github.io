---
title: "ACDD：面向 Agent 的契约驱动开发"
date: 2026-05-31T00:00:00+08:00
draft: false
summary: "低人工干预的文档化AI代码生成约束方案"
tags: ["Flutter", "FlowR", "VibeCoding", "Skill"]
categories: ["Artifacts"]
---

Vibe Coding在企业项目中的痛点是开发者无法放手让Agent自主工作. 想要保证质量, 就必须频繁介入AI操作行为; 想要AI自动实现, 就意味着未来要面对 AI生成的无法维护且不可理解的巨型屎山.

为了在减少人工干预的情况下约束AI代码生成行为, 本文提出一种代码与文档结合的AI辅助编程方案, 即契约驱动编程(Agentic Contract-Driven Development).

## 契约驱动编程 Agentic Contract-Driven Development

开发团队不愿意写注释和文档, 不仅是因为注释带来额外工作, 更是因为注释经常滞后于代码, 反而容易造成误解. 在ACDD中, 注释就是一种驱动Agent编程的代码, 是人与AI之间的核心契约. 人类开发者将项目所需要的特定约束写在contract中, 要求AI遵循特定范式,引用特定组件实现功能.

本文以Flutter项目为例, 介绍基于ACDD思想实现的Contract-MVVM架构的如何让开发者关注重要的事情, 不在细节上浪费精力.

## Contract 嵌入代码的文档

在传统 MVVM 架构中, 让视图和业务逻辑解耦是核心目标. 一个页面的路由、状态、主题、事件和 Widget 树分散在多个文件里. 
新人或 AI 接手时, 要先全局搜索才能知道页面入口在哪里. 
ViewModel 看似独立, 实际夹杂了布局假设；Widget 看似纯展示, 实际藏着业务分支. 页面迁移或重构时, 很难一眼判断哪些是公共组件, 哪些只是页面私有实现.

在Vibe Coding时代, 对于UI, 有Figma约束页面尺寸等细节, 人类开发者只需要关注页面核心结构; 
对于交互, 人类开发者需要关注页面事件; 
对于业务逻辑, 人类开发者需要关注页面状态数据. 而UI中的实现细节, 交互实现逻辑, 业务实现逻辑, 主流的LLM可以直接做到一步生成即达到基本可用的状态. 人类开发者没有必要在第一时间介入指导. 

Contract MVVM 的重点是让页面从第一行开始就说明自己, `fr-mvvm-contract` 推荐每个页面使用三个文件：
```text
xxx_page/
├── xxx_page.dart
├── xxx_page.v.dart
└── xxx_page.vm.dart
```

其中 `xxx_page.dart` 是 contract 文件. 作为页面入口和集中描述页面的核心契约, 在首轮生成中, Skill会自动生成所有必要的基础信息. 帮助AI在生成后续的UI与逻辑代码. 搭配figma和open-api使用更是效率翻倍.

```dart
/// Figma: none
/// API: [ProfileApi], [ProfileReq], [ProfileRsp]
/// Route: [AppRouter.profile]
/// Reused Widgets: [AppToolbar]
/// Widget Tree:
/// - [ProfilePage]
///   - [_ProfilePageView]
///   - [ProfileHeader]
///   - [ProfileActionList]
/// Theme: [ProfilePageTheme]
/// Events:
/// - [LoadEvt]: load current user profile.
/// - [RefreshEvt]: refresh profile after pull gesture.
/// ViewModels:
/// - [ProfilePageViewModel]: primary page view model
/// Models:
/// - [ProfilePageModel]: primary page state
```

- Figma: 如果有设计稿, 则AI先读取设计稿中的UI信息.
- API: 如果有页面数据结构, 则AI先读取API文档, 获取请求与响应值.
- Route: 页面对应的路由.
- Reused Widgets: 依赖了哪些跨页面复用组件.
- Widget Tree: 页面主要 Widget 结构.
- Theme: 页面是否有独立主题模型.
- Events: BLoC 模式下有哪些事件入口.
- ViewModels: 页面业务逻辑, 数据处理.
- Models: 页面数据模型.

进入页面时, 你不用先跳到 Widget 树里猜界面结构, 也不用先读 ViewModel 找状态. contract 文件会先告诉你：这个页面是什么、由哪些部分构成、数据怎么流动、哪些东西属于页面边界.
如果一个页面没有复用组件、没有独立主题、没有事件, 也应该明确写 `none`.显式的空信息比沉默更有价值, 因为它减少了搜索和猜测.

对 AI 来说, 这种结构尤其重要.它把“请先理解这个页面”的成本压缩成一个小文件.对人来说, 它像是页面级 README, 也是和代码一起演进的入口文件.

`xxx_page.v.dart` 只负责 UI视图. 只包含页面私有的视图结构和少量有布局意义的组件.它可以知道状态长什么样, 但不应该承担业务状态转移.

`xxx_page.vm.dart` 只负责业务逻辑和状态变化.

- 改视觉布局, 优先看 `.v.dart`.
- 改状态结构, 优先看 contract 文件里的 Model.
- 改业务行为, 优先看 `.vm.dart`.
- 改页面整体语义, 先更新 contract 注释.

## Flutter开发者快速体验Skill

[fr-mvvm-contract](https://github.com/Hu-Wentao/flowr/blob/main/skills/fr-mvvm-contract/SKILL.md) skill将核心元素集中到contract文件中, 力求开发者在90%的情况下, 只需要查看一个contract文件就能了解页面的功能,依赖,表现与逻辑. 让开发者可以零门槛理解并接管AI生成的代码, 解决VibeCode无法理解的问题.

如果你已经在本地安装了 Codex CLI, 可以执行下面的命令, 将 `/path/to/flutter_project` 替换为你的Flutter项目路径. 命令会通过Vercel的 `skills` CLI把 `fr-mvvm-contract` 安装到指定项目, 然后让Agent选择一个低风险页面迁移为 Contract MVVM:

```bash
PROJECT=/path/to/flutter_project && \
(cd "$PROJECT" && \
  npx --yes skills add Hu-Wentao/flowr \
    --skill flowr-dart-usage \
    --skill flowr-usage \
    --skill fr-mvvm-contract \
    --agent codex \
    --agent claude-code \
    --yes) && \
codex --cd "$PROJECT" "请使用 fr-mvvm-contract skill, 选择一个低风险 Flutter 页面, 将它重构为 Contract MVVM 结构. 修改前先检查 git status; 保留现有行为; 完成后运行 dart format 和 flutter analyze."
```

## 结语
AI 可以更快地产生代码, 也可以更快地产生偏差. VibeCoding的趋势不可阻挡, 人类开发者需要做的不是原地等待, 而是驾驭AI写出可维护, 可理解的代码.

如果说普通 MVVM 是为了解耦 View 和 ViewModel, 那么 Contract MVVM 进一步解决的是“如何让页面被稳定理解”.在 Vibe Coding 逐渐成为常态之后, 这种可理解性会变成基础设施.

Vibe 原生架构, 不是让 AI 随意生成更多代码, 而是让代码库天然适合被 AI 和人一起安全地持续演进.

## 相关

- [Contract MVVM Skill](https://github.com/Hu-Wentao/flowr/blob/main/skills/fr-mvvm-contract/SKILL.md)
- [FlowR 状态管理框架](https://github.com/Hu-Wentao/flowr)
