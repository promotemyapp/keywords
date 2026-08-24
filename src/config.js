import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CONFIG_PATH = fileURLToPath(new URL("../config/keyword-research.json", import.meta.url));

export class ConfigurationError extends Error {
  constructor(message) { super(message); this.name = "ConfigurationError"; }
}

export function loadKeywordResearchConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

export function resolveKeywordResearchConfig(overrides = {}) {
  if (!isPlainObject(overrides)) throw new ConfigurationError("configuration must be an object when provided.");
  const result = merge(loadKeywordResearchConfig().defaults, overrides);
  validateKeywordResearchConfig(result);
  return result;
}

export function validateKeywordResearchConfig(config) {
  for (const key of ["language", "country", "search_intent"]) {
    if (typeof config[key] !== "string" || !config[key].trim()) throw new ConfigurationError(`${key} must be a non-empty string.`);
  }
  if (typeof config.trends_enabled !== "boolean") throw new ConfigurationError("trends_enabled must be a boolean.");
  if (typeof config.trends_timeframe !== "string" || !config.trends_timeframe.trim()) throw new ConfigurationError("trends_timeframe must be a non-empty string.");
  for (const key of ["supporting_query_limit", "serp_result_limit", "suggestion_seed_limit", "trends_keyword_limit"]) {
    if (!Number.isInteger(config[key]) || config[key] < 1 || config[key] > 100) throw new ConfigurationError(`${key} must be an integer from 1 through 100.`);
  }
}

function merge(base, override) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (!(key in result)) throw new ConfigurationError(`configuration.${key} is not supported.`);
    result[key] = value;
  }
  return result;
}

function isPlainObject(value) { return value !== null && !Array.isArray(value) && typeof value === "object"; }
