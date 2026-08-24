import { readFileSync } from "node:fs";

const README_URL = new URL("../README.md", import.meta.url);

export function loadKeywordResearchGuidance() {
  const readme = readFileSync(README_URL, "utf8");
  const start = readme.indexOf("## Keyword research workflow");
  const end = readme.indexOf("\n## API architecture", start);
  if (start < 0 || end < 0) throw new Error("Canonical keyword-research guidance is unavailable from README.md.");
  return { source: "README.md#keyword-research-workflow", markdown: readme.slice(start, end).trim() };
}
