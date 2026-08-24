---
type: "Post Template"
template_layer: core
template_version: "1.4"
status: "deferred"
deferred_reason: "The active template direction is blog-first. Retained for compatibility while social media is designed independently."
dynamic_ranges_config: "config/post-dynamic-ranges.json"
persona_config: "config/personas.json"
author_config: "config/authors.json"
structure_profile: "{{blog|social_media}}"
title: "{{POST_TITLE}}"
tags:
  - "{{TAG_01}}"
  - "{{TAG_02}}"
  - "{{TAG_03}}"
  - "{{TAG_04}}"
  - "{{TAG_05}}"
  - "{{TAG_06}}"
  - "{{TAG_07}}"
  - "{{TAG_08}}"
  - "{{TAG_09}}"
  - "{{TAG_10}}"
structure:
  main_title: required
  subtitles: required
  body: required
  word_count: required
  subtitle_count: required
---

# {{POST_TITLE}}

> **Deferred shared scaffold.** Use `blog-post.md` for active blog-template work. This file remains intact while the later social-media template is designed independently.

## {{SUBTITLE_01}}

{{SECTION_01}}

## {{SUBTITLE_02}}

{{SECTION_02}}

{{ADDITIONAL_SUBTITLES_AND_SECTIONS}}
