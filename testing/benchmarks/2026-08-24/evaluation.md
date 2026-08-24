# Self-improving benchmark evaluation

## Scope

This branch tested the Czech keyword-research endpoint with 100 different topics, analyzed the outputs, implemented a ranking improvement, and then ran two controlled 50-topic validation passes. The validation set is the first 50 topics from the same 100-topic corpus.

## 100-topic baseline

- 100/100 topics completed successfully after bounded retries for transient provider failures.
- 279 supporting keywords were returned.
- 55/100 topics had at least one supporting keyword.
- 25/100 primary keywords were labeled `no evidence`.
- Only 1 diversity keyword was returned across all 100 topics.
- 44/100 primary keywords exactly matched the input topic.

The main quality pattern was uneven coverage. Concrete topics such as recipes, insurance, photovoltaic systems, adoption, and travel produced useful modifiers around price, process, audience, or conditions. Broad or less represented topics often returned only the original input with no evidence. Several results were overly narrow or noisy, such as school-material modifiers for plant care and city-specific modifiers for senior care.

## Improvement implemented

The original selector filled `supporting_keywords` first and only then attempted to select `diversity_keywords` from the leftovers. With the default supporting limit of 8, this often exhausted the candidate pool before diversity selection ran.

The selector now:

1. reserves diversity candidates first;
2. excludes those candidates from the supporting set;
3. restricts diversity candidates to non-core content clusters; and
4. compares non-topic wording when checking similarity, so a different angle is not rejected merely because it shares the main topic words.

A regression test verifies that diversity candidates can be returned and never duplicate supporting candidates.

## Validation results

The first 50-topic slice before the change and after the ranking change produced:

| Metric | Before | After ranking change |
|---|---:|---:|
| Successful responses | 50/50 | 50/50 |
| Supporting keywords | 129 | 129 |
| Topics with supporting keywords | 25 | 25 |
| Diversity keywords | 1 | 0 |
| `no evidence` primary keywords | 14 | 14 |
| Primary equal to input | 24 | 24 |

The live difference is effectively neutral in this particular slice because most topics did not expose enough distinct non-core candidates. The code-level correction is still valid: when eligible diversity candidates exist, they are no longer crowded out by the supporting quota.

## Rejected experiment

The default seed limit was temporarily increased from 8 to 10 to query all generic content-angle seeds. The second 50-topic validation remained unchanged: 129 supporting keywords, 25 topics with supporting keywords, 0 diversity keywords, 14 `no evidence` primaries, and 24 unchanged primaries. Because the wider seed set added provider work without measurable quality improvement, the configuration was restored to 8.

## Final assessment

The tool is reliable as a directional first-pass keyword ideation service, but not as a complete SEO prioritization system. Its strongest outputs are localized Czech long-tail variants from topics with healthy Autocomplete coverage. Its main limitations are provider dependence, inconsistent coverage, lack of search-volume and competition metrics, and weak diversity yield in sparse result sets.

At this point, further blind live testing is unlikely to produce a meaningful ranking improvement without a new evidence source or a product decision about desired behavior for sparse topics. The next high-value improvements would require either additional provider data (volume/difficulty) or an explicit policy for generating and labeling heuristic content angles when Autocomplete returns nothing. Those would change the product’s evidence model, so they are not implemented in this branch.

## Decision

Stop the iteration here. The selector fix is retained, the seed-expansion experiment is reverted, the 100-topic raw benchmark and both 50-topic validation reports are preserved, and the automated suite passes.
