# Airsoft empty-result regression test

Topic: `zaciname s airsoftem`  
Language: Czech  
Country: Czech Republic  
Endpoint: `POST /v1/keywords/recommended`

## Reproduction before the fix

The live provider returned HTTP 200 with no Autocomplete candidates. The API returned only the supplied topic as the primary keyword with score `no evidence`, zero supporting keywords, and zero diversity keywords.

## Result after the fix

The same live request now returns:

```json
{
  "topic": "zaciname s airsoftem",
  "primary_keyword": {
    "keyword": "zaciname s airsoftem",
    "score": "no evidence"
  },
  "supporting_keywords": [
    { "keyword": "zaciname s airsoftem cena", "score": "weak" },
    { "keyword": "zaciname s airsoftem vybavení", "score": "weak" },
    { "keyword": "zaciname s airsoftem tipy", "score": "weak" }
  ],
  "diversity_keywords": [
    { "keyword": "zaciname s airsoftem pro začátečníky", "score": "weak" }
  ]
}
```

## Behavior and evidence policy

- The minimum response is now three supporting keywords and one diversity keyword.
- Heuristic fallbacks are intentionally labeled internally as `heuristic-fallback` and receive a `weak` score because they do not have provider evidence.
- The supplied topic remains primary with `no evidence` when no validated provider candidate exists.
- A warning is included in the internal dashboard research data so fallback output is not mistaken for Autocomplete evidence.
- If the provider returns a small mixed candidate set, diversity selection is capped so it cannot consume the three supporting slots.

Automated verification: **21/21 tests pass**.
