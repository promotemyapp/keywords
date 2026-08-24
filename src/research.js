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
const CONTENT_ANGLE_SEEDS = {
  czech: [
    { cluster: "costs", role: "budget and costs", build: (topic) => `náklady na ${topic}` },
    { cluster: "process", role: "process and timeline", build: (topic) => `jak probíhá ${topic}` },
    { cluster: "permits", role: "permits and regulations", build: (topic) => `povolení pro ${topic}` },
    { cluster: "plans", role: "plans and design", build: (topic) => `projekt a plán ${topic}` },
    { cluster: "materials", role: "materials and technology", build: (topic) => `materiály pro ${topic}` },
    { cluster: "financing", role: "financing", build: (topic) => `financování ${topic}` },
    { cluster: "mistakes", role: "mistakes and risks", build: (topic) => `chyby při ${topic}` },
    { cluster: "energy", role: "energy efficiency", build: (topic) => `energeticky úsporné ${topic}` },
    { cluster: "maintenance", role: "maintenance", build: (topic) => `údržba ${topic}` }
  ],
  english: [
    { cluster: "costs", role: "budget and costs", build: (topic) => `cost of ${topic}` },
    { cluster: "process", role: "process and timeline", build: (topic) => `how to ${topic}` },
    { cluster: "permits", role: "permits and regulations", build: (topic) => `${topic} permits and regulations` },
    { cluster: "plans", role: "plans and design", build: (topic) => `${topic} plans and design` },
    { cluster: "materials", role: "materials and technology", build: (topic) => `best materials for ${topic}` },
    { cluster: "financing", role: "financing", build: (topic) => `financing ${topic}` },
    { cluster: "mistakes", role: "mistakes and risks", build: (topic) => `common mistakes in ${topic}` },
    { cluster: "energy", role: "energy efficiency", build: (topic) => `energy efficient ${topic}` },
    { cluster: "maintenance", role: "maintenance", build: (topic) => `maintenance of ${topic}` }
  ]
};

export class ResearchError extends Error {
  constructor(message, status = 502) { super(message); this.name = "ResearchError"; this.status = status; }
}

export async function researchKeywords({ topic, audience = "", configuration, fetchImpl = fetch, now = () => new Date().toISOString() }) {
  validateResearchInput(topic, configuration);
  const seeds = buildSeeds(topic, audience, configuration);
  const responses = await Promise.all(seeds.map(async (seed) => ({ ...await fetchSuggestions(seed.query, configuration, fetchImpl, seed.cluster !== "core"), cluster: seed.cluster, content_role: seed.role })));
  const suggestions = responses.flatMap(({ seed, keywords, cluster, content_role, generatedFallback }) => keywords.map((keyword) => ({ keyword, seed, cluster, content_role, generatedFallback })));
  let ranked = rankSuggestions(suggestions, topic, audience, configuration);
  const trends = configuration.trends_enabled
    ? await fetchTrendSignals(ranked.slice(0, configuration.trends_keyword_limit).map(({ keyword }) => keyword), { ...configuration, fetchImpl })
    : { provider: "google-trends", status: "disabled", signals: [], sources: [] };
  ranked = applyTrendSignals(ranked, trends.signals);
  const primary = ranked.find(({ generated_fallback }) => !generated_fallback) ?? { keyword: topic.trim(), intent: classifyIntent(topic, configuration.search_intent), score: 0, sources: [], rationale: "Used the supplied topic because no direct suggestions were returned." };
  const supporting = selectSupportingKeywords(ranked, configuration.supporting_query_limit, primary).map((item) => ({ ...item, role: "supporting" }));
  const warnings = [];
  if (!ranked.length) warnings.push("No keyword suggestions were returned by Google Autocomplete for this topic and market. The primary keyword is the supplied topic and has no research score.");
  if (responses.some(({ generatedFallback }) => generatedFallback)) warnings.push("Some content-angle candidates were generated from localized research templates because Google Autocomplete returned no suggestions for those angles.");

  return {
    providers: ["google-autocomplete", "google-trends"],
    researched_at: now(),
    topic: topic.trim(),
    audience: audience.trim() || null,
    market: { language: configuration.language, country: configuration.country },
    methodology: "Related search suggestions were collected from localized content-angle seeds, deduplicated, classified into content clusters, ranked, and diversified with relative Google Trends interest as a free secondary signal.",
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
  const language = languageName(configuration.language);
  const angleSeeds = (CONTENT_ANGLE_SEEDS[language] ?? CONTENT_ANGLE_SEEDS.english).map(({ cluster, role, build }) => ({ query: build(base), cluster, role }));
  return [{ query: base, cluster: "core", role: "main topic" }, ...angleSeeds].slice(0, configuration.suggestion_seed_limit);
}

async function fetchSuggestions(seed, configuration, fetchImpl, useSeedFallback = false) {
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
  const keywords = payload[1].filter((item) => typeof item === "string").map(normalizeKeyword).filter(Boolean);
  return { seed, keywords: keywords.length ? keywords : useSeedFallback ? [seed] : [], generatedFallback: !keywords.length && useSeedFallback, source: url.toString() };
}

function rankSuggestions(suggestions, topic, audience, configuration) {
  const topicWords = meaningfulWords(topic);
  const audienceWords = meaningfulWords(audience);
  const byKeyword = new Map();
  for (const { keyword, seed, cluster, content_role, generatedFallback } of suggestions) {
    const key = keyword.toLowerCase();
    const existing = byKeyword.get(key) ?? { keyword, seeds: new Set(), clusters: new Map(), providerEvidence: false, generatedEvidence: false };
    existing.seeds.add(seed);
    if (cluster !== undefined) existing.clusters.set(cluster, content_role);
    existing.providerEvidence ||= !generatedFallback;
    existing.generatedEvidence ||= generatedFallback;
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
    const clusters = [...item.clusters.keys()];
    const cluster = clusters.find((value) => value !== "core") ?? clusters[0] ?? "core";
    const candidateSource = item.providerEvidence && item.generatedEvidence ? "mixed" : item.providerEvidence ? "google-autocomplete" : "content-angle-template";
    return { keyword: item.keyword, intent, score, sources: [...item.seeds], cluster, clusters, content_role: item.clusters.get(cluster) ?? "main topic", candidate_source: candidateSource, generated_fallback: !item.providerEvidence, rationale: rationaleFor(item.keyword, intent, item.seeds.size, item.clusters) };
  }).sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword));
}

function selectSupportingKeywords(ranked, limit, primary) {
  const selected = [];
  const usedClusters = new Set();
  const candidates = ranked.filter((item) => item !== primary);
  for (const item of candidates) {
    if (item.cluster === "core" || usedClusters.has(item.cluster)) continue;
    selected.push(item); usedClusters.add(item.cluster);
    if (selected.length === limit) return selected;
  }
  for (const item of candidates) {
    if (selected.includes(item)) continue;
    selected.push(item);
    if (selected.length === limit) break;
  }
  return selected;
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

function rationaleFor(keyword, intent, sourceCount, clusters) { const clusterText = clusters.size ? `; mapped to ${[...clusters.keys()].join(", ")} content angle${clusters.size === 1 ? "" : "s"}` : ""; return `${intent[0].toUpperCase()} query found in ${sourceCount} research seed${sourceCount === 1 ? "" : "s"}${clusterText}; assess it as a distinct blog section or article angle.`; }
function normalizeKeyword(value) { return value.replace(/\s+/g, " ").trim().replace(/[.。]+$/, ""); }
function meaningfulWords(value) { return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2 && !["the", "and", "for", "with"].includes(word)); }
function languageName(value) { return value.toLowerCase().split(/[-_\s]/)[0] || "english"; }
function languageCode(value) { const language = value.toLowerCase().split(/[-_\s]/)[0] || "en"; return LANGUAGE_CODES[language] ?? language; }
function countryCode(value) { const normalized = value.toLowerCase(); if (normalized.includes("czech")) return "cz"; if (normalized.includes("united states") || normalized === "usa") return "us"; return value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) || "us"; }
