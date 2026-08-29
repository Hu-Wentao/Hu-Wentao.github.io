---
title: "ACDD: Agentic contract-driven development"
date: 2026-05-31T00:00:00+08:00
draft: false
summary: "A documented constraint system for AI-generated code with minimal human intervention"
tags: ["Flutter", "FlowR", "Vibe Coding", "Skill"]
categories: ["Artifacts"]
publish:
  autoSyndication: false
---

One of the main problems with Vibe Coding in enterprise projects is that developers cannot fully let an agent work independently. To maintain quality, developers must frequently intervene in the agent's actions. To let the AI implement a feature autonomously, developers may eventually have to deal with a huge codebase that the AI generated but that no one can maintain or understand.

To constrain AI-generated code while reducing human intervention, this article proposes an AI-assisted programming approach that combines code and documentation: Agentic Contract-Driven Development (ACDD).

## Agentic contract-driven development

Development teams often avoid comments and documentation not only because they require additional work, but also because they frequently fall behind the code and can cause misunderstandings. In ACDD, comments are code that drives agent programming. They are the core contract between people and AI. Human developers write the project-specific constraints in a contract and require the AI to follow a specific pattern and use specific components to implement a feature.

Using a Flutter project as an example, this article explains how a Contract MVVM architecture based on ACDD helps developers focus on important decisions instead of spending time on implementation details.

## Contract: documentation embedded in code

In a traditional Model-View-ViewModel (MVVM) architecture, decoupling the view from business logic is the primary goal. A page's route, state, theme, events, and widget tree are spread across multiple files.
When a new developer or an AI takes over the project, they must search the whole codebase to find the page entry point.
The ViewModel may look independent but contain layout assumptions. A widget may look like a pure presentation component but hide business branches. During a page migration or refactor, it is difficult to see which parts are shared components and which are private to the page.

In the Vibe Coding era, Figma can constrain UI details such as page dimensions, so developers only need to focus on the page's core structure.
For interaction, developers need to focus on page events.
For business logic, developers need to focus on page state data. Mainstream large language models can often generate the UI details, interaction logic, and business logic well enough for a first usable version. Developers do not need to provide detailed guidance immediately.

The goal of Contract MVVM is for a page to explain itself from its first line. The `fr-mvvm-contract` skill recommends that each page use three files:

```text
xxx_page/
├── xxx_page.dart
├── xxx_page.v.dart
└── xxx_page.vm.dart
```

The `xxx_page.dart` file is the contract file. As the page entry point and the central description of the page's core contract, it contains the essential information that the skill generates during the first pass. This information helps the AI generate the UI and logic code that follows. Using Figma and OpenAPI together with this approach can improve efficiency significantly.

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

- Figma: If a design exists, the AI first reads the UI information in the design.
- API: If the page has a data structure, the AI first reads the API documentation to obtain request and response values.
- Route: The route for the page.
- Reused Widgets: The cross-page components that the page depends on.
- Widget Tree: The page's primary widget structure.
- Theme: Whether the page has an independent theme model.
- Events: The event entry points in the BLoC pattern.
- ViewModels: The page's business logic and data processing.
- Models: The page's data models.

When you enter a page, you do not need to guess the UI structure from the widget tree or read the ViewModel first to find the state. The contract file tells you what the page is, what it contains, how data flows, and which elements belong to the page boundary.
If a page has no reused components, independent theme, or events, write `none` explicitly. Explicit empty information is more useful than silence because it reduces searching and guessing.

This structure is especially important for AI. It compresses the cost of understanding a page into one small file. For people, it acts as a page-level README and as the entry file that evolves with the code.

The `xxx_page.v.dart` file is responsible only for the UI view. It contains the page-private view structure and a small number of layout-related components. It can know what the state looks like, but it should not manage business-state transitions.

The `xxx_page.vm.dart` file is responsible only for business logic and state changes.

- To change the visual layout, start with `.v.dart`.
- To change the state structure, start with the Model in the contract file.
- To change business behavior, start with `.vm.dart`.
- To change the page's overall semantics, update the contract comments first.

## A quick way for Flutter developers to try the skill

The [fr-mvvm-contract](https://github.com/Hu-Wentao/flowr/blob/main/skills/fr-mvvm-contract/SKILL.md) skill brings the core elements together in the contract file. In most cases, developers should be able to understand a page's features, dependencies, presentation, and logic by reading only that file. This lets developers understand and take over AI-generated code without a steep learning curve, addressing a common problem with Vibe Coding: generated code that people cannot understand.

If you have installed the Codex CLI locally, run the following command. Replace `/path/to/flutter_project` with the path to your Flutter project. The command uses Vercel's `skills` CLI to install `fr-mvvm-contract` in the specified project and then asks the agent to migrate one low-risk page to Contract MVVM:

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
codex --cd "$PROJECT" "Use the fr-mvvm-contract skill to select a low-risk Flutter page and refactor it to the Contract MVVM structure. Check git status before editing, preserve existing behavior, and run dart format and flutter analyze after the change."
```

## Conclusion

AI can generate code faster, and it can also generate deviations faster. Vibe Coding is an unavoidable trend. Human developers need to do more than wait; they need to guide AI toward code that remains maintainable and understandable.

If ordinary MVVM decouples the View and ViewModel, Contract MVVM also addresses the problem of how to make a page consistently understandable. As Vibe Coding becomes more common, this understandability will become infrastructure.

A Vibe-native architecture does not ask AI to generate more code without constraints. It makes the codebase naturally suitable for safe, continuous evolution by both AI and people.

## Related

- [Contract MVVM Skill](https://github.com/Hu-Wentao/flowr/blob/main/skills/fr-mvvm-contract/SKILL.md)
- [FlowR state management framework](https://github.com/Hu-Wentao/flowr)
