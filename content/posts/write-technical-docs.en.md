---
title: "Write-technical-docs Skill: Make technical documentation accurate and usable"
date: 2026-08-20T14:43:20+08:00
draft: false
summary: "Organize technical facts into clear, scannable, actionable developer documentation with prioritized rules, on-demand style guidance, and layered review"
tags: ["AI", "Vibe Coding", "Skill", "Technical Writing", "Documentation Engineering"]
categories: ["Artifacts"]
publish:
  autoSyndication: false
---

It is not difficult to get an agent to write a technical document with fluent sentences. The real challenge is to satisfy several conditions at once: commands must be executable, prerequisites must be complete, readers must be able to find the next step quickly, terminology must remain consistent, and links and examples must not mislead readers.

You cannot solve these problems by “polishing” the prose. A document can read smoothly while hiding an incorrect parameter. Its structure can look complete while failing to explain what state an operation changes. Its examples can look realistic while containing output that no one has verified.

The `write-technical-docs` skill provides a writing and review workflow for developer documentation. It uses the [Google Developer Documentation Style Guide](https://developers.google.com/style) as its editorial foundation, but does not let general style rules override project facts, user requirements, or local documentation conventions.

Its core idea is:

> Confirm the technical facts and task boundaries first. Then organize them with the smallest structure that lets readers act and verify the result.

## It solves more than a writing problem

Technical documentation has at least two responsibilities: describe the system accurately and help readers complete a task. If you optimize only one of them, the document can still be unusable.

For example, an installation guide can be grammatically correct and use consistent headings and code blocks. If it omits the working directory, permission requirements, or necessary environment variables, readers still cannot complete the installation. Conversely, a guide that records every technical detail can force readers to infer the operation order when it presents information as a history of implementation.

For this reason, `write-technical-docs` puts technical correctness before editorial quality. It requires an agent not to invent commands, parameters, API behavior, compatibility conclusions, expected output, or product names. When existing evidence cannot confirm a fact, the agent should mark the uncertainty clearly or return it to the user for confirmation instead of filling the gap with fluent prose.

Only after the facts are established does the skill handle structure, language, formatting, and accessibility. This order avoids a common mistake: treating “reads like documentation” as evidence that the document is ready to deliver.

## Rules have a clear priority

General writing guidelines cannot know every project's terminology, templates, and compatibility commitments. `write-technical-docs` uses an explicit priority order to resolve conflicts:

1. Follow the user's requirements and the target project's terminology, templates, format, and validation rules.
2. When the project has no rule, apply the skill and Google technical writing guidance.
3. When changing an existing document, preserve intentional local consistency.
4. Ask the user to decide only when competing interpretations would materially change the audience, meaning, or structure.

This means that the skill does not mechanically replace every established project term to comply with an external style rule. It also does not modify API names or code identifiers that must remain unchanged. Accuracy and reader understanding always take priority over mechanical compliance.

The same principle applies to Chinese documentation. The skill still uses task-oriented organization, progressive disclosure, accessibility, and linking guidance, but it does not impose US English grammar, spelling, or punctuation on Chinese prose.

## Load writing guidance by task

The skill does not place every writing rule in one long document. It divides detailed guidance into four references and loads them as needed:

| Reference | What it covers |
| --- | --- |
| `voice-and-language.md` | Voice, sentence clarity, accessibility, inclusion, and internationalization |
| `structure-and-formatting.md` | Page structure, headings, paragraphs, lists, procedures, tables, and notices |
| `code-ui-and-links.md` | Inline code, code samples, commands, placeholders, UI actions, and links |
| `wording-and-naming.md` | Capitalization, abbreviations, numbers, dates, filenames, example data, and product names |

If a task only checks link and command formatting, an agent does not need to load every language rule. If it drafts or reviews a complete document, it reads the first four references. It reads `source-index.md` and visits authoritative sources only when it needs to check an exact Google rule or a current product name.

This organization reduces unrelated context and keeps the main `SKILL.md` focused on workflow. The agent first learns how to make decisions, then reads the specific rules required by the current task.

~~~text
User goal + project rules
        ↓
     SKILL.md
        ↓ references required by the document
Language / structure / code and links / naming
        ↓ when necessary
Google source guidance or authoritative product sources
~~~

## Start with the reader's task

When creating or rewriting a document, the skill first identifies six things: who the reader is, what the reader needs to accomplish, what type of document it is, what knowledge the reader is expected to have, which prerequisites the task has, and what evidence supports the technical conclusions.

The agent then checks neighboring documents and project rules before choosing terminology and formatting. It organizes the content in the order that readers need it, rather than in the order in which the feature was developed or the author considered it:

1. State what readers can learn or accomplish at the beginning.
2. List prerequisites and constraints before the actions that depend on them.
3. Present the common path before alternatives and edge cases.
4. Put explanations, commands, expected results, and verification methods next to the steps they support.
5. Remove repetition, filler, unsupported promises, and scaffolding unrelated to the task.

When a document contains a procedure, each step should have one primary action. Use code blocks with language identifiers for commands, keep commands separate from output, explain every placeholder before the reader must replace it, and identify optional steps clearly. State permission requirements, destructive operations, and external state changes directly.

This approach is not about adding more formatting to a page. It reduces the amount of information readers must infer while they work.

## Review facts before language

When reviewing an existing document, the skill uses a fixed order:

1. **Technical fidelity**: Check commands, code, links, versions, prerequisites, results, terminology, and internal consistency.
2. **Task completeness**: Confirm that the goal, conditions, actions, expected result, and required recovery path are complete.
3. **Information architecture**: Check the title hierarchy, content order, navigation, and repetition.
4. **Language**: Check voice, tense, sentence structure, terminology consistency, and inclusive language.
5. **Presentation**: Check lists, tables, code formatting, UI labels, links, and image descriptions.
6. **Accessibility**: Confirm that essential information does not depend only on color, position, punctuation, or an image.

This order separates content correctness from professional expression. An agent should not overlook an unverified version claim because a sentence needs editing. Nor should it assume that readers have everything they need merely because the page is well formatted.

When the user asks only for a review, the skill reports issues with locations and proposed fixes without editing the file. It writes to the document only when the user also authorizes changes. This keeps read-only review separate from actual modification.

## Code samples are technical facts too

Code in technical documentation is not decoration. The skill requires examples to contain only what the current task needs and to be runnable when the document promises that they are runnable.

Examples must not contain real secrets, personal data, or production endpoints. They must not use unexplained ellipses to pretend that code is complete. Command blocks should not include shell prompts, and sample output should be identified as reference output rather than exact output. For placeholders, the skill recommends meaningful uppercase names such as `PROJECT_ID` and requires each placeholder to be explained near the example.

UI actions also need to be precise. Documentation should use the labels that appear in the interface and describe interactions with verbs such as “select,” “enter,” and “press” instead of relying on a control's color, shape, or screen position. Link text should still explain its destination when read out of context. Avoid link text such as “click here,” which is not meaningful on its own.

These requirements point to one principle: code, UI actions, and links are part of the reader's path through a document and must be verified like technical claims in the prose.

## Install and invoke the skill

Install the skill from the skill repository with the `skills` CLI:

```bash
pnpm dlx skills add Hu-Wentao/skills \
  --skill write-technical-docs \
  --yes
```

When `write-technical-docs` is installed and available to Codex, specify it directly in a request. To draft a local development guide, use a prompt such as the following:

```text
Use the write-technical-docs skill to write a local development guide for this project.
First inspect the existing README, package-manager configuration, and project commands;
document only steps that you can verify. The readers are developers seeing this repository
for the first time. Include prerequisites, startup steps, expected results, and recovery
steps for common failures.
```

To review existing documentation, narrow the request:

```text
Use the write-technical-docs skill to review docs/deploy.md without editing it.
Check technical facts and task completeness first, then check structure, language, and format.
Report each issue with its location, severity, and a suggested change.
```

To rewrite a document, give explicit authorization and state which project facts must not change:

```text
Use the write-technical-docs skill to rewrite docs/api-quickstart.md.
Preserve the existing API names, request fields, and compatibility claims. Reorganize the
content so a reader can make the first request from the prerequisites onward, and add a
response verification step at the end.
```

The most useful information in a prompt is not “make it more professional.” It is the reader, the goal, the evidence source, the editing boundary, and the expected result. A skill can standardize the writing process, but it cannot invent product facts for the user.

## When it fits

The `write-technical-docs` skill fits the following content:

- Tutorials, how-to guides, and conceptual explanations.
- API, command-line, and UI documentation.
- READMEs, troubleshooting guides, and release notes.
- Developer content with code examples, commands, links, or screenshots.
- Chinese or English technical documentation that needs consistent structure, terminology, and accessibility.

The skill is not a source of product facts, a replacement for code testing, an API probe, or a substitute for compatibility verification. Without evidence, it should expose uncertainty. When verification is necessary, the agent must still inspect the source code, run authorized commands, or consult authoritative documentation.

For copywriting, literary prose, or brand concepts, this task-oriented process may not be appropriate. The skill is designed for developer documentation, not every form of writing.

## Final review before delivery

After drafting, the skill performs one final editorial review. It checks whether the opening states the result, prerequisites appear before actions, titles and links remain meaningful out of context, and commands, output, UI labels, and code identifiers are formatted correctly.

It also checks terminology consistency, defines abbreviations when needed, clarifies dates and units, provides useful alternative text for images, and removes unsupported claims about being the best, fastest, or a future feature.

The final handoff should explain what changed and what evidence was used to verify the technical facts. It should also list unresolved assumptions. For technical documentation, this information helps the next reviewer decide whether the document is ready to publish.

## Conclusion

High-quality technical documentation is not just correct information expressed more elegantly. It builds a complete path from facts to the reader's task and then to the result. `write-technical-docs` breaks that path into executable rules: project conventions come first, technical correctness comes before editorial quality, guidance loads on demand, the common path comes before edge cases, actions sit next to verification, and uncertain facts must not be hidden by fluent language.

The value of this method is not limited to more fluent sentences. It gives documentation work a repeatable review order and helps authors and reviewers distinguish product facts, editorial choices, and evidence that is still missing.

Once these boundaries are clear, technical documentation becomes more than a description of the system. It becomes an engineering interface that readers can use, verify, and maintain.

## Related

- [write-technical-docs Skill source](https://github.com/Hu-Wentao/skills/tree/main/skills/write-technical-docs)
- [Google Developer Documentation Style Guide](https://developers.google.com/style)
- [Write accessible documentation](https://developers.google.com/style/accessibility)
- [Document command-line syntax](https://developers.google.com/style/code-syntax)
