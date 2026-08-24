# Keyword-research testing

This directory contains repeatable live benchmarks for the keyword-research API.

- `benchmarks/2026-08-24/` contains the 100-topic discovery run, the 50-topic validation run, and their evaluations.
- `topics/topics-100-cs.json` is the canonical Czech topic set. The first 50 topics are reused for the validation run so the before/after comparison is controlled.
- `scripts/run-live-benchmark.mjs` runs the live API and writes a Markdown report with every response plus aggregate metrics.

Live runs require network access because the service uses Google Autocomplete and Google Trends.
