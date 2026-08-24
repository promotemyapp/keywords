# Agent instructions

These instructions define the preparation baseline for agents working in this repository.

## Mission

Maintain a portable, agent-ready **blog-post** knowledge package for product marketing. AI agents in external projects are the primary consumers: they request this package to obtain explicit structure and instructions, then create actual blog posts in their own projects. The repository’s external output consists of template material: structure, configuration, drafting instructions, review rules, and source-grounded SEO guidance. Human-readable material presents the same contract for review and maintenance. Posts are represented as Open Knowledge Format (OKF) concept documents: UTF-8 Markdown files with YAML frontmatter and a Markdown body. External projects handle research, verification, publishing, and final approval. Social-media material is preserved for a later milestone.

## Specialized guidance

- [`api-implementation.md`](api-implementation.md) — API contract, validation, security, testing, and documentation guidance.
- [`../README.md#agent-operating-view`](../README.md#agent-operating-view) — canonical blog-only SEO, evidence, and Google AI-search authoring guidance.

## Tooling policy

Use Bun exclusively for package management, scripts, and tests in this repository.

## Before making changes

1. Read the repository `README.md` and the relevant role instructions in this directory.
2. Read `SPEC.md` before creating or editing an OKF document.
3. Read `templates/blog-post.md` when creating or changing the post shape.
4. Read `config/blog-post-fixed-recommendations.json` before setting or reviewing blog length and count expectations.
5. Read the [agent-operating view of the canonical blog SEO specification](../README.md#agent-operating-view) before designing, drafting, or reviewing a blog post.
6. Read `AGENTS/api-implementation.md` before creating or changing the API.
7. Inspect existing files and preserve unrelated user changes.
8. Keep this preparation phase template- and documentation-only unless the user explicitly asks for implementation.

## OKF rules

- Every concept document must begin with YAML frontmatter delimited by `---`.
- `type` is the only required frontmatter key; use descriptive project types such as `Blog Post` or `Social Media Post`.
- The authoring contract focuses on `title`, the Markdown body, and `tags`.
- Every completed post must have exactly ten tags. The method used to create them is outside this template contract.
- Every completed post must have one main title, at least one subtitle, structured body content, and a measurable word count.
- Use the fixed blog recommendations unless the task explicitly provides different requirements.
- Use standard Markdown links for relationships.
- Store concept documents under names other than the OKF-reserved `index.md` and `log.md`.
- Preserve unknown frontmatter keys when editing existing documents.
- Use ISO 8601 timestamps with an explicit UTC offset.
- Preserve the stable title, body, and tags fields when adapting a blog post for an external consumer.
- Preserve headings and structured sections in every completed post.
- Treat `templates/blog-post.md` as the active template direction. Work on `post-core.md` and `social-media-post.md` belongs to their future deferred milestones.

## Content workflow

Research → outline → blog draft → factual/source review → human review → publish-ready handoff.

Design the social-media template independently in its future milestone.

Agents publish, schedule, send, or make external changes with explicit user authorization. Mark uncertain information for review and present verified facts with their supporting sources.

## Project explanations

When explaining this repository, its templates, configuration, or workflow, make the explanation visual when that improves comprehension:

- Use Mermaid flowcharts for composition, data flow, and step-by-step processes.
- Use Markdown tables for profiles, ranges, and direct comparisons.
- Use compact directory trees for repository structure.
- Add a diagram or image only when it clarifies an important relationship; keep plain facts and short instructions as prose.

Keep diagrams consistent with the source files and update them when the documented architecture changes.

## Documentation maintenance

Treat README updates as part of finishing a milestone, not as an afterthought:

- Update the root `README.md` when a milestone changes the project purpose, architecture, setup, public API, configuration, workflow, or current status.
- Update a focused README or reference, such as `templates/README.md` or `docs/API.md`, when the change is local to that area.
- Before handoff, check that examples, diagrams, paths, commands, and stated behavior match the polished implementation.
- Update documentation when a change affects how a person or external project understands or uses the repository.

## Quality bar

Content should have a clear audience and purpose, accurate and supported claims, useful structure, an appropriate tone, accessible language, and a channel-appropriate length.

## Documentation style

Write documentation and specifications as positive, action-oriented guidance. Define the intended outcome, required inputs, structure, process, and quality standards. Use scope statements to explain responsibility boundaries. Keep this style consistent in human and agent-facing material.

## Handoff

Summarize changed files, unresolved questions, sources used, and any claims requiring human review. Keep generated drafts clearly distinguishable from approved or published content.
