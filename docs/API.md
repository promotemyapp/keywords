# Keyword Research API

The API accepts a topic, discovers related search language from Google autocomplete, adds free Google Trends interest signals, ranks candidates for blog usefulness, and returns only the compact keyword recommendations needed by the calling agent. Search Console is intentionally not part of this project. Internal provider details and methodology stay inside the service. The API preserves the shared Request→Response handler, local Bun server, Vercel Function entrypoints, CORS behavior, validation, body limits, and signed guided sessions from the reference project.

## Run locally

```bash
bun run start
```

The API listens on `http://127.0.0.1:3000` by default. Set `PORT` or `HOST` when needed. If the default port is busy, the local server tries the next ten ports. Guided sessions require `SESSION_SECRET` with at least 32 characters.

Open the root URL with a browser to use the dashboard. After a request completes, it shows a human-readable primary keyword and supporting-keyword bubbles first, followed by the compact JSON response for AI agents and programmatic inspection.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Browser console or JSON endpoint discovery. |
| GET | `/health` | Service health check. |
| GET | `/v1/config` | Research defaults and guardrails. |
| POST | `/v1/keywords/recommended` | Research a topic and return ranked blog keywords. |
| POST | `/v1/keywords/research` | Alias for the recommended research route. |
| POST | `/v1/keywords/specific` | Return compact recommendations with configuration overrides. |
| POST | `/v1/sessions` | Start guided research setup. |
| POST | `/v1/sessions/answers` | Answer the next guided question. |

## Recommended request

```bash
curl -X POST http://127.0.0.1:3000/v1/keywords/recommended \
  -H 'Content-Type: application/json' \
  -d '{"topic":"Rodinné domy","configuration":{"country":"Czech Republic","language":"Czech"}}'
```

`topic` is required. The response contains only `topic`, one `primary_keyword` object, an ordered `supporting_keywords` object array, and up to three `diversity_keywords`. Each object contains `keyword` and a qualitative `score`; the numeric score stays internal. Supporting keywords are sorted from strongest to weakest using that internal score. Diversity keywords are selected for lower repetition and broader topical coverage. Provider details, exploratory seeds, trends signals, methodology, and other internal research data are not returned.

The free providers are Google Autocomplete and Google Trends. Their signals are used internally to rank recommendations; they are not exposed in the compact response. The API does not claim CPC, difficulty, or ranking position.

The primary keyword is the highest-ranked validated candidate. The supplied topic is used as the fallback only when no provider candidate is available.

The browser dashboard may request an internal dashboard view to visualize scores, but those internal fields are not part of the normal agent-facing response.

## Specific request

```json
{
  "topic": "inventory software",
  "configuration": {
    "language": "German",
    "country": "Germany",
    "supporting_query_limit": 6
  }
}
```

Unknown configuration keys and invalid values return HTTP 422. Malformed JSON returns HTTP 400.

## Guided flow

Start with `POST /v1/sessions`, then send the returned `sessionToken` and one `value` to `POST /v1/sessions/answers`. Questions cover topic, audience, language, country, and search intent. The final response runs the same live keyword research as a direct request.

## Deployment

`vercel.json` and `api/` keep the portable Function setup from the reference project. Configure `SESSION_SECRET` in each Vercel environment when guided sessions are needed.
