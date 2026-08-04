---
mdq:
  version: 1
  dialect: gfm
  records:
    boundary:
      source: heading
      levels: [2]
      pattern: '^(?P<id>SEO-RESULT-[A-Z0-9-]+)(?:[ ：—-]+(?P<title>.+))$'
    key:
      source: heading
      pattern: '^(?P<id>SEO-RESULT-[A-Z0-9-]+)(?:[ ：—-]+(?P<title>.+))$'
      group: id
  fields:
    title:
      source: heading
      group: title
    project_id:
      source: label
      labels: [Project ID]
    recorded_at:
      source: label
      labels: [Recorded At]
    outcome:
      source: label
      labels: [Outcome]
    summary:
      source: section
      headings: [Summary]
    evidence:
      source: section
      headings: [Evidence]
    constraints:
      source: section
      headings: [Constraints]
---

# SEO Results

本文件只记录个人网站自己的 SEO 结果。记录结果不自动产生全局经验。
