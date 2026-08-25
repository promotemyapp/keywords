# Smaller self-improvement cycle — Czech keyword research

## Scope

This cycle deliberately used smaller batches: a 40-topic baseline, followed by matched validation runs of 20, 10, and 5 topics. Every raw API result is retained beside this evaluation.

## 40-topic baseline

- 40/40 successful responses.
- 99 supporting keywords in total.
- 20/40 topics with at least one supporting keyword.
- 10/40 `no evidence` primaries.
- 0 diversity keywords.
- 19/40 primary keywords exactly matching the supplied topic.

The baseline had three clear primary-keyword quality problems despite successful API responses:

1. Accentless Google suggestions could be returned verbatim, for example `vylet vlakem po cesku` instead of the supplied `výlet vlakem po Česku`.
2. A document-format autocomplete query such as `pracovní list` could outrank the broader topic for a marketing-blog request.
3. Czech transactional and city modifiers were treated as generic informational keywords, making `cena` or a city such as `Brno` more likely to become the primary result even when the request was a nationwide informational topic.

## Improvements and measured validation

### 1. Czech-aware normalization and deduplication

Comparison, deduplication, scoring, and diversity checks now ignore diacritics while outputs preserve the supplied Czech spelling when the candidate is otherwise equivalent.

Matched 20-topic validation (topics 21–40):

- Coverage metrics stayed stable: 20/20 success, 56 supporting keywords, 10 topics with supporting keywords, and 5 `no evidence` primaries.
- The observed degraded primary changed from `vylet vlakem po cesku` (`okay`) to `výlet vlakem po Česku` (`good`).

### 2. Primary-quality penalties and Czech intent terms

Document-format terms are now demoted only for primary-keyword selection; they remain available as supporting ideas. Czech informational, commercial, transactional, and navigational terms are recognized, so the configured intent genuinely affects ranking.

The document-format penalty alone replaced `pracovní list` with `kurz`, which was an improvement but still too narrow. Adding Czech intent recognition then produced the broad topic as the primary result.

Matched 10-topic validation (topics 1–10):

| Metric | Baseline | After Czech intent ranking |
|---|---:|---:|
| Successful responses | 10/10 | 10/10 |
| Supporting keywords | 25 | 25 |
| Topics with supporting keywords | 7 | 7 |
| `no evidence` primaries | 2 | 2 |
| Primary equal to supplied topic | 3 | 5 |

Notable qualitative changes:

- `péče o pokojové rostliny pracovní list` → `péče o pokojové rostliny`
- `fotovoltaika pro rodinný dům cena` → `fotovoltaika pro rodinný dům`

### 3. Unrequested Czech locality penalty

Common Czech city names are now demoted only when selecting a primary keyword and only when that locality is absent from the supplied topic. City queries remain eligible supporting keywords.

Matched five-topic validation (topics 11–15) held all coverage metrics steady and changed:

- `24 hodinová péče o seniory doma brno` → `24 hodinová péče o seniory doma`

## Regression coverage

The automated suite now includes tests for:

- preserving supplied Czech spelling when Autocomplete omits diacritics;
- preventing document-format queries from replacing a broader primary;
- Czech intent terms selecting a different primary for informational and transactional requests; and
- preventing an unrequested Czech city from replacing a nationwide primary.

## Final assessment

This small-batch cycle produced clear, targeted primary-keyword improvements without reducing successful responses or supporting-keyword coverage. The remaining limitations are unchanged: sparse Autocomplete data still causes `no evidence` fallbacks, and diversity keywords remain absent when the provider does not yield distinct validated candidates.

Further ranking-only changes are not justified by this evidence. Generating diversity or filling sparse topics would require a product decision to return labeled heuristic angles, or a new data source such as search-volume and difficulty data. Neither is implemented here because it would change the API’s evidence model rather than improve the current ranking of validated suggestions.

## Decision

Stop this iteration cycle after the five-topic validation. Keep the improvements on `self-improving`; do not promote them to `develop` or `main` until a separate review approves that promotion.
