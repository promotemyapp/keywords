const GOOGLE_TRENDS_EXPLORE_URL = "https://trends.google.com/trends/api/explore";
const GOOGLE_TRENDS_TIMESERIES_URL = "https://trends.google.com/trends/api/widgetdata/multiline";

export async function fetchTrendSignals(keywords, { language, country, timeframe, fetchImpl = fetch } = {}) {
  const selected = keywords.slice(0, 5);
  if (!selected.length) return { provider: "google-trends", status: "skipped", signals: [], sources: [] };

  const exploreRequest = {
    comparisonItem: selected.map((keyword) => ({ keyword, geo: countryCode(country), time: timeframe })),
    category: 0,
    property: ""
  };
  const exploreUrl = new URL(GOOGLE_TRENDS_EXPLORE_URL);
  exploreUrl.searchParams.set("hl", languageCode(language));
  exploreUrl.searchParams.set("tz", "0");
  exploreUrl.searchParams.set("req", JSON.stringify(exploreRequest));

  try {
    const explore = await getJson(exploreUrl, fetchImpl);
    const widget = explore.widgets?.find((candidate) => candidate.type === "TIMESERIES");
    if (!widget?.token || !widget.request) return unavailable(exploreUrl, "Google Trends returned no time-series widget.");

    const dataUrl = new URL(GOOGLE_TRENDS_TIMESERIES_URL);
    dataUrl.searchParams.set("hl", languageCode(language));
    dataUrl.searchParams.set("tz", "0");
    dataUrl.searchParams.set("req", JSON.stringify(widget.request));
    dataUrl.searchParams.set("token", widget.token);
    const timeline = await getJson(dataUrl, fetchImpl);
    const rows = timeline.default?.timelineData ?? [];
    const signals = selected.map((keyword, index) => {
      const values = rows.map((row) => Number(row.value?.[index] ?? 0)).filter(Number.isFinite);
      const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      const first = values[0] ?? 0;
      const last = values.at(-1) ?? 0;
      const direction = last > first * 1.1 ? "rising" : last < first * 0.9 ? "falling" : "stable";
      return { keyword, interest: Math.round(average * 10) / 10, latest_interest: last, direction, score: Math.min(10, Math.round((average / 10 + (direction === "rising" ? 2 : direction === "stable" ? 1 : 0)) * 10) / 10) };
    });
    return { provider: "google-trends", status: "available", timeframe, signals, sources: [exploreUrl.toString(), dataUrl.toString()] };
  } catch (error) {
    return unavailable(exploreUrl, error.message || "Google Trends was unavailable.");
  }
}

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Google Trends returned HTTP ${response.status}.`);
  const text = await response.text();
  const cleaned = text.replace(/^\)]}\}',?\s*/, "");
  try { return JSON.parse(cleaned); } catch { throw new Error("Google Trends returned invalid JSON."); }
}

function unavailable(source, reason) { return { provider: "google-trends", status: "unavailable", signals: [], sources: [source.toString()], warning: reason }; }
function languageCode(value = "English") { return value.toLowerCase().startsWith("czech") ? "cs" : value.toLowerCase().split(/[-_\s]/)[0] || "en"; }
function countryCode(value = "United States") { const normalized = value.toLowerCase(); if (normalized.includes("czech")) return "CZ"; if (normalized.includes("united states") || normalized === "usa") return "US"; return value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "US"; }
