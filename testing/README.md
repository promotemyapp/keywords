# Keyword-research testing

This directory contains repeatable live benchmarks for the keyword-research API.

- `benchmarks/2026-08-24/` contains the 100-topic discovery run, the 50-topic validation run, and their evaluations.
- `benchmarks/2026-08-25/` contains a smaller 40-topic improvement cycle and progressively smaller 20-, 10-, and 5-topic validations.
- `topics/topics-100-cs.json` is the canonical Czech topic set. Benchmark scripts support an offset so matched subsets can be reused for controlled before/after comparisons.
- `scripts/run-live-benchmark.mjs` runs the live API and writes a Markdown report with every response plus aggregate metrics.

Live runs require network access because the service uses Google Autocomplete and Google Trends. The optional fourth runner argument is the zero-based topic offset, which enables matched subset validation.
