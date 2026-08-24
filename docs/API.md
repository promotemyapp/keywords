# Keyword Research API

The API accepts a topic, discovers related search language from Google autocomplete, adds free Google Trends interest signals, ranks candidates for blog usefulness, and returns a structured keyword brief. Search Console is intentionally not part of this project. The API preserves the shared Request→Response handler, local Bun server, Vercel Function entrypoints, CORS behavior, validation, body limits, and signed guided sessions from the reference project.

## Run locally

```bash
bun run start
```

The API listens on `http://127.0.0.1:3000` by default. Set `PORT` or `HOST` when needed. If the default port is busy, the local server tries the next ten ports. Guided sessions require `SESSION_SECRET` with at least 32 characters.

Open the root URL with a browser to use the dashboard. After a request completes, it shows a human-readable primary keyword and supporting-keyword bubbles first, followed by expandable full JSON, YAML brief, and research-guidance sections for AI agents and programmatic inspection.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Browser console or JSON endpoint discovery. |
| GET | `/health` | Service health check. |
| GET | `/v1/config` | Research defaults and guardrails. |
| POST | `/v1/keywords/recommended` | Research a topic and return ranked blog keywords. |
| POST | `/v1/keywords/research` | Alias for the recommended research route. |
| POST | `/v1/keywords/specific` | Return a brief with configuration overrides. |
| POST | `/v1/sessions` | Start guided research setup. |
| POST | `/v1/sessions/answers` | Answer the next guided question. |

## Recommended request

```bash
curl -X POST http://127.0.0.1:3000/v1/keywords/recommended \
  -H 'Content-Type: application/json' \
  -d '{"topic":"Rodinné domy","audience":"rodiny plánující nový dům","configuration":{"country":"Czech Republic","language":"Czech","search_intent":"informational"}}'
```

`topic` is required. The response includes `research.primary_keyword`, diverse `research.supporting_keywords` selected from different content clusters, each with a `cluster` and `content_role`, Google Trends signals, all deduplicated candidates, source URLs, methodology, limitations, and a `brief.markdown` YAML document ready for a blog-writing agent.

The free providers are Google autocomplete and Google Trends. When Autocomplete has no result for a localized content angle, the API can retain the angle seed as a transparent `content-angle-template` candidate so the supporting set remains diverse. Trends returns normalized relative interest and direction, not exact monthly volume. The response does not claim CPC, difficulty, or ranking position.

## Specific request

```json
{
  "topic": "inventory software",
  "audience": "independent retailers",
  "configuration": {
    "language": "German",
    "country": "Germany",
    "search_intent": "commercial",
    "supporting_query_limit": 6
  }
}
```

Unknown configuration keys and invalid values return HTTP 422. Malformed JSON returns HTTP 400.

## Guided flow

Start with `POST /v1/sessions`, then send the returned `sessionToken` and one `value` to `POST /v1/sessions/answers`. Questions cover topic, audience, language, country, and search intent. The final response runs the same live keyword research as a direct request.

## Deployment

`vercel.json` and `api/` keep the portable Function setup from the reference project. Configure `SESSION_SECRET` in each Vercel environment when guided sessions are needed.
