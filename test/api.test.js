import assert from "node:assert/strict";
import test from "node:test";
import vercelFunction from "../api/index.js";
import { createApiHandler } from "../src/server.js";

const SECRET = "test-session-secret-with-at-least-32-characters";
const suggestionFetch = async (url) => ({
  ok: true,
  status: 200,
  async json() {
    if (new URL(url).hostname === "trends.google.com") return { widgets: [{ type: "TIMESERIES", token: "test-token", request: { comparisonItem: [] } }] };
    const seed = new URL(url).searchParams.get("q");
    return [seed, [`${seed} guide`, `best ${seed}`, `how to ${seed}`]];
  },
  async text() {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/explore")) return JSON.stringify({ widgets: [{ type: "TIMESERIES", token: "test-token", request: { comparisonItem: [] } }] });
    if (parsed.hostname === "trends.google.com") return JSON.stringify({ default: { timelineData: [{ value: [80, 20, 10] }, { value: [90, 30, 15] }] } });
    return "";
  }
});

test("health works through the Vercel entrypoint", async () => {
  const response = await vercelFunction.fetch(new Request("https://example.vercel.app/api/health"));
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("discovery exposes keyword endpoints", async () => {
  const response = await createApiHandler()(new Request("https://example.vercel.app/", { headers: { Accept: "application/json" } }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.name, "Marketing Keyword Research API");
  assert.ok(result.endpoints.some((endpoint) => endpoint.path === "/v1/keywords/recommended"));
});

test("browser console includes human and agent response views", async () => {
  const response = await createApiHandler()(new Request("https://example.vercel.app/", { headers: { Accept: "text/html" } }));
  const page = await response.text();
  assert.equal(response.status, 200);
  assert.match(page, /Primary keyword/);
  assert.match(page, /Supporting keywords/);
  assert.match(page, /topic-input/);
  assert.match(page, /Topic to research/);
  assert.match(page, /supporting-card/);
  assert.match(page, /supporting-keywords/);
  assert.match(page, /Full response for AI agents/);
  assert.match(page, /keyword-bubble/);
  assert.match(page, /keyword-text/);
  assert.match(page, /score-indicator/);
  assert.match(page, /score-fill/);
  assert.match(page, /medium-high/);
  assert.match(page, /scoreLabel\.textContent = String\(score\)/);
  assert.match(page, /performance\.now/);
  assert.match(page, /parsed\.topic = topic/);
  assert.doesNotMatch(page, /rodiny plánující nový dům/);
  assert.doesNotMatch(page, /"audience"/);
  assert.match(page, /Search intent is optional/);
});

test("recommended mode returns compact keyword recommendations", async () => {
  const handler = createApiHandler({ fetchImpl: suggestionFetch });
  const response = await handler(new Request("https://example.vercel.app/v1/keywords/recommended", { method: "POST", body: JSON.stringify({ topic: "analytics software", audience: "small businesses" }) }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.topic, "analytics software");
  assert.match(result.primary_keyword.keyword, /analytics software/);
  assert.ok(result.supporting_keywords.length > 0);
  assert.ok(result.supporting_keywords.every(({ keyword, score }) => keyword && typeof score === "number"));
  assert.deepEqual(Object.keys(result).sort(), ["primary_keyword", "supporting_keywords", "topic"]);
});

test("recommended mode applies language and country overrides", async () => {
  const requestedUrls = [];
  const handler = createApiHandler({ fetchImpl: async (url) => { requestedUrls.push(new URL(url)); return suggestionFetch(url); } });
  const response = await handler(new Request("https://example.vercel.app/v1/keywords/recommended", { method: "POST", body: JSON.stringify({ topic: "building family houses", configuration: { language: "English", country: "United States" } }) }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.topic, "building family houses");
  assert.ok(requestedUrls.some((url) => url.hostname === "suggestqueries.google.com" && url.searchParams.get("hl") === "en" && url.searchParams.get("gl") === "us"));
});

test("empty provider results are reported as a warning", async () => {
  const handler = createApiHandler({ fetchImpl: async (url) => ({ ok: true, status: 200, async json() { return [new URL(url).searchParams.get("q"), []]; }, async text() { return ""; } }) });
  const response = await handler(new Request("https://example.vercel.app/v1/keywords/recommended", { method: "POST", body: JSON.stringify({ topic: "building family houses" }) }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.supporting_keywords.length, 0);
  assert.equal(result.primary_keyword.score, 0);
});

test("autocomplete requests UTF-8 and preserves Czech characters", async () => {
  const requestedUrls = [];
  const handler = createApiHandler({ fetchImpl: async (url) => { requestedUrls.push(new URL(url)); return { ok: true, status: 200, async json() { return ["Rodinné domy", ["rodinné domy na prodej"]]; } }; } });
  const response = await handler(new Request("https://example.vercel.app/v1/keywords/recommended", { method: "POST", body: JSON.stringify({ topic: "Rodinné domy", configuration: { language: "Czech", country: "Czech Republic" } }) }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.primary_keyword.keyword, "rodinné domy na prodej");
  assert.match(result.primary_keyword.keyword, /é/);
  assert.ok(requestedUrls.filter((url) => url.hostname === "suggestqueries.google.com").every((url) => url.searchParams.get("oe") === "utf-8"));
});

test("specific mode validates and applies overrides", async () => {
  const handler = createApiHandler({ fetchImpl: suggestionFetch });
  const response = await handler(new Request("https://example.vercel.app/v1/keywords/specific", { method: "POST", body: JSON.stringify({ topic: "inventory software", configuration: { language: "German", country: "Germany", supporting_query_limit: 6 } }) }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.topic, "inventory software");
});

test("invalid configuration is rejected", async () => {
  const handler = createApiHandler({ fetchImpl: suggestionFetch });
  const response = await handler(new Request("https://example.vercel.app/v1/keywords/specific", { method: "POST", body: JSON.stringify({ topic: "inventory software", configuration: { unsupported: true } }) }));
  assert.equal(response.status, 422);
});

test("research requires a topic", async () => {
  const handler = createApiHandler({ fetchImpl: suggestionFetch });
  const response = await handler(new Request("https://example.vercel.app/v1/keywords/recommended", { method: "POST", body: JSON.stringify({}) }));
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /topic/);
});

test("provider failures become a gateway error", async () => {
  const handler = createApiHandler({ fetchImpl: async () => { throw new Error("offline"); } });
  const response = await handler(new Request("https://example.vercel.app/v1/keywords/recommended", { method: "POST", body: JSON.stringify({ topic: "building family houses" }) }));
  assert.equal(response.status, 502);
});

test("guided sessions work across handler instances", async () => {
  const first = createApiHandler({ sessionSecret: SECRET, fetchImpl: suggestionFetch });
  const start = await first(new Request("https://example.vercel.app/v1/sessions", { method: "POST" }));
  let result = await start.json();
  for (const value of ["analytics software", "small businesses", "English", "United States", "commercial"]) {
    const next = createApiHandler({ sessionSecret: SECRET, fetchImpl: suggestionFetch });
    const response = await next(new Request("https://example.vercel.app/v1/sessions/answers", { method: "POST", body: JSON.stringify({ sessionToken: result.sessionToken, value }) }));
    result = await response.json();
  }
  assert.equal(result.complete, true);
  assert.ok(result.primary_keyword.keyword);
});

test("guided sessions require a signing secret", async () => {
  const handler = createApiHandler({ sessionSecret: undefined });
  const response = await handler(new Request("https://example.vercel.app/v1/sessions", { method: "POST" }));
  assert.equal(response.status, 503);
});
