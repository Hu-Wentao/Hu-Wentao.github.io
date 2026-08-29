---
title: "Queryable Markdown Skill: Reliable document queries and maintenance with AI"
date: 2026-07-31T19:18:21+08:00
draft: false
summary: "Use verifiable mdq contracts to query and safely edit one or more Markdown documents"
tags: ["AI", "Markdown", "Skill", "Vibe Coding", "Documentation Engineering"]
categories: ["Artifacts"]
artifacts: ["queryable-markdown"]
publish:
  autoSyndication: false
---

> The [queryable-markdown](https://github.com/Hu-Wentao/skills/tree/main/skills/queryable-markdown) skill lets an agent query records and fields accurately while preserving Markdown's freedom as a writing format. It also lets the agent edit documents safely after receiving explicit authorization.

## Why Queryable Markdown is needed

Markdown works well for requirements, design notes, and runbooks. Headings, lists, long-form text, and code examples can coexist freely, and the content does not need to satisfy a strict schema in advance. This freedom makes precise queries difficult, however.

For example, when you use `rg -n 'REQ-102' requirements.md` to find a requirement, the match might be the record title, a reference from another requirement, or only a code example. A more complex regular expression can improve the result temporarily, but it can break when heading levels or formatting changes.

The core idea behind Queryable Markdown is:

> Use temporary, read-only queries for ordinary Markdown. When you need long-term, reliable querying and maintenance, add a small, declarative, verifiable `mdq` contract.

The Markdown body remains the source of truth. The contract describes only record boundaries, unique keys, and field sources. An optional sidecar index is only a cache: it can be rebuilt when it becomes stale and must not override the body.

## Two query modes

| Mode | Suitable scenario | Effect on the document |
| --- | --- | --- |
| Temporary selector | One-time lookup in ordinary Markdown | Read-only; does not write a profile, marker, or index |
| Persistent `mdq` contract | Repeated queries or edits by ID or field | Writes the smallest contract after explicit authorization and validates it continuously |

Suppose a requirements document contains the following content:

````md
# Requirements

## REQ-101 - Email login
Status: planned
Depends on REQ-102.

<!-- mdq:record id="REQ-102" -->
## Password reset
Status: drafting

```text
REQ-999 is only an example
```

## REQ-103 - Audit events
````

Without a contract, the skill parses the Markdown structure, excludes opaque areas such as code blocks, and returns candidate results with source locations and evidence strength. It does not transform a document merely because the user says, “Check this.”

If the document needs to be queried or edited repeatedly, add a minimal profile to the YAML front matter at the first byte of the file:

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
      pattern: '^(?P<id>REQ-[0-9]+)(?:[ :\-]+.*)?$'
      group: id
  fields:
    status:
      source: label
      labels: [Status]
  tolerance:
    incomplete: true
---
```

Only add invisible markers to individual records when the existing structure cannot provide a stable identity. You can then run a deterministic script to query the document precisely:

```bash
uv run "$SKILL_DIR/scripts/mdq.py" query requirements.md --id REQ-102
```

The simplified result looks like this:

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

The tool does not guess to produce a complete answer. A missing field returns `null`. A duplicate identity returns `ambiguous` and all matches. A conflicting field value preserves the diagnostic and its source location.

## Use cases

### Query one document precisely

Requirements often contain real records, cross-references, and code examples at the same time. Queryable Markdown can find a record by its exact key and return its field values, identity evidence, and source range. Use a temporary read-only query for an ordinary document. Create a persistent contract when you need repeated queries or edits.

### Query the status of every document in a directory

When requirements or plans are spread across multiple files, scan the `status` field in every Markdown file under a specified path:

```bash
uv run "$SKILL_DIR/scripts/mdq.py" scan docs/requirements \
  --glob '**/*.md' \
  --field status \
  --require-contract
```

The `scan` command is always read-only, and its default Glob is `**/*.md`. The `--require-contract` flag reports documents with no contract or an invalid contract while retaining results from other valid documents. The output includes relative paths, record keys, field values, source ranges, and per-document diagnostics. You can use it for status inventories, release checks, or dashboard data generation.

The `--limit` flag limits only the number of returned results. It does not skip validation for the remaining files. Version 1 also does not create a directory-level index.

### Update the status of every Markdown file under a path

Batch updates use a “scan first, then edit each document safely” process instead of replacing text across a directory. Here, a metadata field is a business field mapped by the `mdq` profile, such as the `status` value in the body. Updating it does not authorize changes to the profile, markers, or index strategy.

A safe update has four steps:

1. Run `scan --field status --require-contract` to obtain complete statuses, target keys, and diagnostics.
2. Select records according to an explicit transition rule, such as changing only `planned` to `active`. Skip records with missing values, conflicts, invalid contracts, or non-unique identities.
3. For each target document, validate and query it precisely before editing only the smallest source range that carries the `status` value. Do not edit when you have only a regular-expression extraction rule without an independent, bounded write location.
4. Validate and query the affected record again after each edit. Rebuild a sidecar index if the document declares one. Finally, repeat the scan and inspect the Git diff.

You can give Codex the scope and state transition rule directly:

```text
Use the queryable-markdown skill to scan the status of every Markdown file under docs/requirements.
Change records with status=planned to active. Edit only documents with valid contracts and unique
identities and boundaries. Skip and report all other documents. Validate and query each document
again after editing, then repeat the scan and list the files, keys, and final statuses that changed.
```

## Safe editing and permission boundaries

The fact that a document is editable does not mean that the current request authorizes editing. The skill chooses an action based on the document state and the user's intent:

| Document and request | Action |
| --- | --- |
| No valid contract; query only | Use a temporary selector and remain read-only |
| No valid contract; create or convert | Inspect the structure, then write the smallest contract and required markers |
| Valid contract; query only | Extract according to the contract without changing the document |
| Valid contract; edit records | Locate the record precisely and apply the smallest patch within its boundary |
| Invalid contract or drift affects the target | Return diagnostics and stop; repair the contract only after explicit authorization |

The complete transaction for editing a record is to validate, diagnose, and query the exact record before editing; then validate and query the affected record again and inspect the diff. Renaming, deleting, and batch editing do not expand the user's authorization.

Four boundaries cannot be crossed:

- Markdown source is the only source of truth. A sidecar can accelerate queries or store locations, but it cannot override the source.
- Do not fill in missing values. Do not select the first result when the identity is ambiguous.
- The profile must be declarative YAML. A document must not be allowed to make the agent execute arbitrary code.
- Editing body content, maintaining the contract, and maintaining an index are three separate authorizations.

## Try it quickly

Install the skill with the [skills CLI](https://github.com/vercel-labs/skills):

```bash
pnpm dlx skills add Hu-Wentao/skills \
  --skill queryable-markdown \
  --codex \
  --global \
  --yes
```

Then choose a prompt for the task:

```text
# Read-only query for one document
Use the queryable-markdown skill to query the status of REQ-102 in docs/requirements.md.
Keep the document read-only and list the identity evidence and source range.

# Scan a directory
Use the queryable-markdown skill to scan the status of every Markdown file under docs/requirements.
Require a valid contract for every document and retain diagnostics for invalid documents.

# Create a persistent contract
Use the queryable-markdown skill to convert docs/requirements.md into a document with an mdq contract.
First show the record boundaries, keys, and field mappings. Add only the smallest profile and required
markers, then validate the result.
```

The first two requests authorize queries only. Only the last request authorizes changes to the document-control area.

## When Queryable Markdown fits

- Use CSV or a database when data naturally has stable rows and columns or requires transactions, concurrent writes, or complex aggregation.
- Use `mdq` for precise ID and field queries. Semantic questions such as “Which requirements relate to login security?” are better suited to retrieval-augmented generation (RAG). The two approaches can be combined.
- Treat content without a recoverable identity as a candidate, not as an exact match.
- Version 1 primarily targets CommonMark and GitHub-Flavored Markdown (GFM). Confirm compatibility with `inspect` before using complex MDX or other extended syntax.
- Queries still read the current source. Collection scans also inspect matching files. The goal is deterministic querying, not database-style random access.

Queryable Markdown does not turn Markdown into a database. It makes the document explain where records are, how fields are extracted, and when an agent can edit them safely while preserving the writing experience.

## Related

- [Queryable Markdown Skill source](https://github.com/Hu-Wentao/skills/tree/main/skills/queryable-markdown)
- [skills CLI](https://github.com/vercel-labs/skills)
