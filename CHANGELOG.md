# Changelog

## 0.2.20 — 2026-08-24

- Correct the Vercel `includeFiles` schema so persona source files can deploy successfully.

## 0.2.19 — 2026-08-24

- Import persona `SOUL.md` files as bundled text assets so the Vercel runtime can resolve them reliably.

## 0.2.18 — 2026-08-24

- Include persona `SOUL.md` files in the Vercel Function bundle so deployed API requests can resolve persona definitions.

## 0.2.17 — 2026-08-24

- Move persona definitions into individual `personas/<name>/SOUL.md` files with YAML structure, numeric traits, priorities, principles, and guardrails.
- Keep `config/personas.json` as the persona catalog and resolve complete soul definitions through the API.
- Document the persona catalog and clarify that API responses contain persona, author, blog template, agent guidance, and keyword-research guidance.

## 0.2.16 — 2026-08-24

- Replace Sophie’s mock portrait with a distinct short textured curly-bob hairstyle.

## 0.2.15 — 2026-08-24

- Add Sophie Redwood, a 25-year-old ginger example author.
- Add Thomas Hawthorne, a 51-year-old English-looking example author.
- Add mock portraits and template instructions for both new authors.

## 0.2.14 — 2026-08-24

- Serve configured author portraits from the local Bun server for consistent local and Vercel behavior.

## 0.2.13 — 2026-08-24

- Add mock portrait assets to every example author profile.
- Add explicit author `template_instructions` separating AI generation context from published attribution display.
- Show the selected author portrait and profile details in the browser testing console.

## 0.2.12 — 2026-08-24

- Add example full names, ages, and job titles to the John, Melissa, and Radovan author profiles.
- Include the selected author details in API responses and the browser testing console Author card.

## 0.2.11 — 2026-08-24

- Keep the Author overview card focused on the selected author name until author profiles include meaningful details.

## 0.2.10 — 2026-08-24

- Add the selected author's byline and attribution purpose inside the Author overview card.

## 0.2.9 — 2026-08-24

- Merge each selected persona's writing-style explanation into its overview card.
- Start the Agent guidance section collapsed in the browser testing console.

## 0.2.8 — 2026-08-24

- Hide the empty response placeholder after an API response is displayed in the browser testing console.

## 0.2.7 — 2026-08-24

- Show the selected persona's writing-style effect directly in the API testing console response overview.

## 0.2.6 — 2026-08-24

- Replace the browser discovery page with an interactive API testing console for recommendation and specific template requests.
- Present returned template packages as a readable overview with expandable guidance, research, template, and raw-response sections.

## 0.2.5 — 2026-08-24

- Add reusable John, Melissa, and Radovan author configurations to every template response.
- Support default and selected authors in recommendation mode, direct specific mode, and guided specific mode.

## 0.2.4 — 2026-08-24

- Add reusable Persona A, Persona B, and Persona C writing-style configurations to every template response.
- Support default and selected personas in recommendation mode, direct specific mode, and guided specific mode.

## 0.2.3 — 2026-08-23

- Route public multi-segment API requests to the Vercel catch-all function.

## 0.2.2 — 2026-08-23

- Add a Bun lockfile marker so Vercel selects Bun for dependency installation and function deployment.

## 0.2.1 — 2026-08-23

### Fixed

- Configured Vercel to use the Other framework preset, Bun installation, and the repository's `api/` function entrypoints for production deployment.

## 0.2.0 — 2026-08-23

### Released

- Established recommendation mode as the one-call, self-contained guidance package for external AI agents creating blog posts.
- Added keyword-research workflow, structured keyword brief, query-to-section mapping, and Search Console-informed research guidance to the returned blog package.
- Included canonical drafting, SEO, AI-search, evidence, review, fixed-recommendation, and Markdown-template materials in the documented consumer workflow.
