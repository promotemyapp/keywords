import { ConfigurationError } from "./config.js";
import { fetchTrendSignals } from "./trends.js";

const GOOGLE_SUGGEST_URL = "https://suggestqueries.google.com/complete/search";
const SEARCH_INTENTS = new Set(["informational", "commercial", "transactional", "navigational"]);
const INTENT_TERMS = {
  informational: ["how", "what", "why", "guide", "tips", "ideas", "checklist", "steps", "examples", "benefits"],
  commercial: ["best", "top", "review", "comparison", "vs", "versus", "alternative", "software"],
  transactional: ["buy", "price", "cost", "quote", "near me", "service", "builder", "company"],
  navigational: ["login", "support", "contact", "website", "official"]
};
const LANGUAGE_CODES = { czech: "cs", english: "en", german: "de", french: "fr", spanish: "es", italian: "it", polish: "pl", slovak: "sk", dutch: "nl", portuguese: "pt", russian: "ru", ukrainian: "uk" };

export class ResearchError extends Error {
  constructor(message, status = 502) { super(message); this.name = "ResearchError"; this.status = status; }
}

export async function researchKeywords({ topic, audience = "", configuration, fetchImpl = fetch, now = () => new Date().toISOString() }) {
  validateResearchInput(topic, configuration);
  const seeds = buildSeeds(topic, audience, configuration);
  const responses = await Promise.all(seeds.map((seed) => fetchSuggestions(seed, configuration, fetchImpl)));
  const suggestions = responses.flatMap(({ seed, keywords }) => keywords.map((keyword) => ({ keyword, seed })));
  let ranked = rankSuggestions(suggestions, topic, audience, configuration);
  const trends = configuration.trends_enabled
    ? await fetchTrendSignals(ranked.slice(0, configuration.trends_keyword_limit).map(({ keyword }) => keyword), { ...configuration, fetchImpl })
    : { provider: "google-trends", status: "disabled", signals: [], sources: [] };
  ranked = applyTrendSignals(ranked, trends.signals);
  const supporting = ranked.slice(1, configuration.supporting_query_limit).map((item) => ({ ...item, role: "supporting" }));
  const primary = ranked[0] ?? { keyword: topic.trim(), intent: classifyIntent(topic, configuration.search_intent), score: 0, sources: [], rationale: "Used the supplied topic because no suggestions were returned." };
  const warnings = ranked.length ? [] : ["No keyword suggestions were returned by Google Autocomplete for this topic and market. The primary keyword is the supplied topic and has no research score."];

  return {
    providers: ["google-autocomplete", "google-trends"],
    researched_at: now(),
    topic: topic.trim(),
    audience: audience.trim() || null,
    market: { language: configuration.language, country: configuration.country },
    methodology: "Related search suggestions were collected from multiple intent-oriented seeds, deduplicated, classified, and ranked with relative Google Trends interest as a free secondary signal.",
    limitations: ["Autocomplete suggestions are directional signals, not monthly search volume.", "Google Trends values are normalized relative interest, not absolute search counts.", "CPC, paid competition, and organic ranking difficulty are not available from this free pipeline.", "Suggestions and trend values can vary by location, language, time, and Google's systems."],
    sources: [...responses.map(({ seed, source }) => ({ provider: "google-autocomplete", seed, url: source })), ...trends.sources.map((url) => ({ provider: "google-trends", url }))],
    warnings,
    trends,
    primary_keyword: { ...primary, role: "primary" },
    supporting_keywords: supporting,
    all_candidates: ranked
  };
}

function validateResearchInput(topic, configuration) {
  if (typeof topic !== "string" || topic.trim().length < 2 || topic.trim().length > 200) throw new ConfigurationError("topic must be a string between 2 and 200 characters.");
  if (!SEARCH_INTENTS.has(configuration.search_intent)) throw new ConfigurationError(`search_intent must be one of: ${[...SEARCH_INTENTS].join(", ")}.`);
}

function buildSeeds(topic, audience, configuration) {
  const base = topic.trim();
  const audiencePart = audience.trim() ? ` ${audience.trim()}` : "";
  const modifiers = INTENT_TERMS[configuration.search_intent] ?? INTENT_TERMS.informational;
  return [...new Set([base, ...modifiers.slice(0, configuration.suggestion_seed_limit - 1).map((modifier) => `${modifier} ${base}${audiencePart}`)])].slice(0, configuration.suggestion_seed_limit);
}

async function fetchSuggestions(seed, configuration, fetchImpl) {
  const url = new URL(GOOGLE_SUGGEST_URL);
  url.searchParams.set("client", "firefox");
  url.searchParams.set("q", seed);
  url.searchParams.set("hl", languageCode(configuration.language));
  url.searchParams.set("gl", countryCode(configuration.country));
  url.searchParams.set("oe", "utf-8");
  let response;
  try { response = await fetchImpl(url, { headers: { Accept: "application/json" } }); }
  catch (error) { throw new ResearchError(`Keyword suggestion provider could not be reached: ${error.message}`); }
  if (!response.ok) throw new ResearchError(`Keyword suggestion provider returned HTTP ${response.status}.`);
  let payload;
  try { payload = await response.json(); } catch { throw new ResearchError("Keyword suggestion provider returned invalid JSON."); }
  if (!Array.isArray(payload?.[1])) throw new ResearchError("Keyword suggestion provider returned an unexpected response.");
  return { seed, keywords: payload[1].filter((item) => typeof item === "string").map(normalizeKeyword).filter(Boolean), source: url.toString() };
}

function rankSuggestions(suggestions, topic, audience, configuration) {
  const topicWords = meaningfulWords(topic);
  const audienceWords = meaningfulWords(audience);
  const byKeyword = new Map();
  for (const { keyword, seed } of suggestions) {
    const key = keyword.toLowerCase();
    const existing = byKeyword.get(key) ?? { keyword, seeds: new Set() };
    existing.seeds.add(seed);
    byKeyword.set(key, existing);
  }
  return [...byKeyword.values()].map((item) => {
    const normalized = item.keyword.toLowerCase();
    const topicMatches = topicWords.filter((word) => normalized.includes(word)).length;
    const audienceMatches = audienceWords.filter((word) => normalized.includes(word)).length;
    const keywordWords = meaningfulWords(item.keyword);
    const intent = classifyIntent(item.keyword, configuration.search_intent);
    const exactTopicBonus = keywordWords.join(" ") === topicWords.join(" ") ? 6 : 0;
    const specificityBonus = Math.min(3, Math.max(0, keywordWords.length - topicWords.length));
    const score = topicMatches * 5 + audienceMatches * 2 + item.seeds.size * 3 + (intent === configuration.search_intent ? 4 : 0) + exactTopicBonus + specificityBonus + (item.keyword.endsWith("?") ? 1 : 0);
    return { keyword: item.keyword, intent, score, sources: [...item.seeds], rationale: rationaleFor(item.keyword, intent, item.seeds.size) };
  }).sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword));
}

function applyTrendSignals(ranked, signals) {
  const byKeyword = new Map(signals.map((signal) => [signal.keyword.toLowerCase(), signal]));
  return ranked.map((item) => {
    const trend = byKeyword.get(item.keyword.toLowerCase());
    if (!trend) return item;
    return { ...item, score: Math.round((item.score + trend.score) * 10) / 10, trend_interest: trend.interest, trend_latest_interest: trend.latest_interest, trend_direction: trend.direction, trend_score: trend.score };
  }).sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword));
}

function classifyIntent(keyword, preferred) {
  const lower = keyword.toLowerCase();
  const matches = Object.entries(INTENT_TERMS).map(([intent, terms]) => ({ intent, count: terms.filter((term) => lower.includes(term)).length }));
  const best = matches.sort((a, b) => b.count - a.count)[0];
  return best.count > 0 ? best.intent : preferred;
}

function rationaleFor(keyword, intent, sourceCount) { return `${intent[0].toUpperCase()}${intent.slice(1)} query found in ${sourceCount} research seed${sourceCount === 1 ? "" : "s"}; assess it as a distinct blog section or article angle.`; }
function normalizeKeyword(value) { return value.replace(/\s+/g, " ").trim().replace(/[.。]+$/, ""); }
function meaningfulWords(value) { return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2 && !["the", "and", "for", "with"].includes(word)); }
function languageCode(value) { const language = value.toLowerCase().split(/[-_\s]/)[0] || "en"; return LANGUAGE_CODES[language] ?? language; }
function countryCode(value) { const normalized = value.toLowerCase(); if (normalized.includes("czech")) return "cz"; if (normalized.includes("united states") || normalized === "usa") return "us"; return value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) || "us"; }
