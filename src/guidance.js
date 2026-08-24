import { readFileSync } from "node:fs";

const README_URL = new URL("../README.md", import.meta.url);
const AGENT_VIEW_HEADING = "### Agent-operating view";
const NEXT_SECTION_HEADING = "\n## Template layers";
const KEYWORD_RESEARCH_HEADING = "#### Keyword research workflow";
const KEYWORD_RESEARCH_END_HEADING = "\n#### Required workflow";

export function loadAgentGuidance() {
  const readme = readFileSync(README_URL, "utf8");
  const start = readme.indexOf(AGENT_VIEW_HEADING);
  const end = readme.indexOf(NEXT_SECTION_HEADING, start);

  if (start < 0 || end < 0) {
    throw new Error("Canonical agent guidance is unavailable from README.md.");
  }

  return {
    source: "README.md#agent-operating-view",
    markdown: readme.slice(start, end).trim()
  };
}

export function loadKeywordResearchGuidance() {
  const readme = readFileSync(README_URL, "utf8");
  const start = readme.indexOf(KEYWORD_RESEARCH_HEADING);
  const end = readme.indexOf(KEYWORD_RESEARCH_END_HEADING, start);

  if (start < 0 || end < 0) {
    throw new Error("Canonical keyword-research guidance is unavailable from README.md.");
  }

  return {
    source: "README.md#keyword-research-workflow",
    markdown: readme.slice(start, end).trim()
  };
}
