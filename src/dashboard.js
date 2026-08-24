export function renderDashboardPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Keyword Research API Console</title>
    <style>
      :root { color: #172033; background: #f4f7fb; font: 16px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      main { width: min(1180px, calc(100% - 32px)); margin: 40px auto 72px; }
      .hero { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: 8px; font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -.04em; }
      h2 { margin-bottom: 8px; font-size: 1.2rem; }
      h3 { margin: 0; font-size: 1rem; }
      .eyebrow { color: #3656b9; font-size: .76rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .hint, .muted { color: #5c6b85; }
      .endpoint { display: inline-flex; align-items: center; border-radius: 999px; padding: 8px 12px; color: #28435f; background: #e9effa; font: .76rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
      .layout { display: grid; grid-template-columns: minmax(280px, .75fr) minmax(0, 1.6fr); gap: 20px; align-items: start; }
      .card { background: #fff; border: 1px solid #dce4f2; border-radius: 18px; box-shadow: 0 8px 28px rgb(32 53 89 / 7%); }
      .controls { padding: 24px; position: sticky; top: 20px; }
      .results { min-height: 520px; padding: 24px; }
      .field { display: grid; gap: 7px; margin-top: 18px; }
      label { color: #35435c; font-size: .88rem; font-weight: 750; }
      input, textarea, button { font: inherit; }
      input { width: 100%; border: 1px solid #c9d4e5; border-radius: 10px; color: #16213a; background: #fff; padding: 11px 12px; }
      textarea { width: 100%; min-height: 150px; resize: vertical; border: 1px solid #c9d4e5; border-radius: 10px; color: #16213a; background: #fff; padding: 10px 12px; font: .82rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
      button { width: 100%; margin-top: 22px; border: 0; border-radius: 10px; padding: 12px 16px; color: #fff; background: #2449bd; cursor: pointer; font-weight: 800; }
      button:hover { background: #1e3da2; }
      button:disabled { cursor: wait; opacity: .7; }
      .status { margin-bottom: 20px; color: #3656b9; font-weight: 700; }
      .status.error { color: #b42318; }
      .empty { display: grid; min-height: 420px; place-items: center; text-align: center; color: #5c6b85; }
      .empty span { display: block; margin-bottom: 10px; color: #3656b9; font-size: 2rem; }
      .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 18px 0 24px; }
      .summary-card { border: 1px solid #dce4f2; border-radius: 12px; background: #f9fbff; padding: 13px; }
      .summary-card span { display: block; color: #63718a; font-size: .7rem; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
      .summary-card strong { display: block; margin-top: 4px; font-size: .95rem; line-height: 1.35; }
      .primary { margin-bottom: 24px; padding: 18px; border: 1px solid #bfcdf4; border-radius: 14px; background: linear-gradient(135deg, #f0f4ff, #fbfcff); }
      .primary .keyword-bubble { margin-top: 12px; font-size: 1.05rem; }
      .supporting-heading { margin-bottom: 12px; }
      .supporting-card { min-width: 0; margin-bottom: 24px; padding: 18px; border: 1px solid #dce4f2; border-radius: 14px; background: #fff; }
      .supporting-card h3 { margin-bottom: 6px; }
      .supporting-keywords { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-top: 16px; }
      .supporting-keywords .keyword-list { margin: 0; }
      .supporting-card .keyword-bubble { width: 100%; align-items: flex-start; border-radius: 12px; padding: 11px 12px; }
      .score-indicator { display: inline-flex; flex: 0 0 124px; align-items: center; gap: 7px; }
      .score-track { flex: 1; height: 7px; overflow: hidden; border-radius: 999px; background: #dce4f2; }
      .score-fill { display: block; height: 100%; border-radius: inherit; }
      .score-fill[data-level="low"] { background: #dc3545; }
      .score-fill[data-level="medium-low"] { background: #f28c28; }
      .score-fill[data-level="medium"] { background: #e4c441; }
      .score-fill[data-level="medium-high"] { background: #9fbe3c; }
      .score-fill[data-level="high"] { background: #239b56; }
      .score-label { flex: 0 0 auto; color: #53627c; font-size: .68rem; font-weight: 800; white-space: nowrap; }
      .content-angle-card { margin-bottom: 24px; padding: 18px; border: 1px dashed #c9d4e5; border-radius: 14px; background: #fafcff; }
      .content-angle-list { display: grid; gap: 8px; margin: 14px 0 0; }
      .content-angle { display: flex; justify-content: space-between; gap: 12px; padding: 9px 11px; border-radius: 9px; color: #35435c; background: #eef2f8; font-size: .88rem; }
      .content-angle small { flex: 0 0 auto; color: #63718a; font-weight: 800; }
      .keyword-list { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 24px; }
      .keyword-bubble { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 9px 12px; border: 1px solid #cbd7f3; border-radius: 999px; color: #213a86; background: #f1f4ff; font-weight: 700; }
      .keyword-bubble .keyword-text { min-width: 0; flex: 1; overflow-wrap: anywhere; }
      .keyword-bubble[data-intent="commercial"] { color: #6a4213; border-color: #f0d39a; background: #fff8e9; }
      .keyword-bubble[data-intent="transactional"] { color: #145c45; border-color: #b4dfce; background: #effbf6; }
      .keyword-bubble[data-intent="navigational"] { color: #5b2c78; border-color: #d9b9e9; background: #fbf3ff; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; color: #5c6b85; font-size: .86rem; }
      .meta span { padding: 4px 8px; border-radius: 6px; background: #eef2f8; }
      details { border-top: 1px solid #e2e8f2; padding: 14px 0; }
      summary { cursor: pointer; color: #22334e; font-weight: 800; }
      pre { overflow: auto; margin: 12px 0 0; padding: 14px; border-radius: 10px; color: #dce7fa; background: #15213a; font: .78rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
      .response[hidden], .empty[hidden] { display: none; }
      @media (max-width: 820px) { main { margin-top: 24px; } .hero, .layout { display: block; } .hero > div + div { margin-top: 14px; } .controls { position: static; margin-bottom: 20px; } .summary { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <header class="hero">
        <div>
          <div class="eyebrow">Marketing Keyword Research</div>
          <h1>API testing console</h1>
          <p class="hint">Research a topic and inspect the recommended blog keywords in human and agent formats.</p>
        </div>
        <div class="endpoint">POST /v1/keywords/recommended</div>
      </header>
      <div class="layout">
        <form class="card controls" id="test-form">
          <h2>Build a research request</h2>
          <p class="hint">Enter a topic and the API will discover diverse keyword angles automatically.</p>
          <div class="field"><label for="topic-input">Topic to research</label><input id="topic-input" type="text" value="Rodinné domy" autocomplete="off"></div>
          <div class="field"><label for="request-body">Advanced request JSON</label><textarea id="request-body" spellcheck="false">{"topic":"Rodinné domy","configuration":{"language":"Czech","country":"Czech Republic"}}</textarea><p class="hint">Search intent is optional and defaults to informational: searches focused on explanations, guides, and how-to content.</p></div>
          <button id="submit-button" type="submit">Research keywords</button>
        </form>
        <section class="card results" aria-live="polite">
          <div class="empty" id="empty-state"><div><span>⌕</span><strong>Your keyword research will appear here</strong><p>Run a request to see the primary keyword and supporting keyword bubbles.</p></div></div>
          <div id="response-content" class="response" hidden>
            <p class="status" id="status"></p>
            <h2 id="research-title">Recommended blog keywords</h2>
            <div class="summary" id="summary"></div>
            <div id="human-output"></div>
            <details open><summary>Full response for AI agents and programmatic clients</summary><pre id="raw-response"></pre></details>
          </div>
        </section>
      </div>
    </main>
    <script>
      const form = document.getElementById("test-form");
      const requestBody = document.getElementById("request-body");
      const topicInput = document.getElementById("topic-input");
      const submitButton = document.getElementById("submit-button");
      const emptyState = document.getElementById("empty-state");
      const responseContent = document.getElementById("response-content");
      const status = document.getElementById("status");
      const summary = document.getElementById("summary");
      const humanOutput = document.getElementById("human-output");
      const rawResponse = document.getElementById("raw-response");

      function addSummary(label, value) {
        const card = document.createElement("div"); card.className = "summary-card";
        const title = document.createElement("span"); title.textContent = label;
        const content = document.createElement("strong"); content.textContent = value || "—";
        card.append(title, content); summary.append(card);
      }

      function addBubble(item, parent) {
        const bubble = document.createElement("span"); bubble.className = "keyword-bubble"; bubble.dataset.intent = item.intent || "informational";
        const keywordText = document.createElement("span"); keywordText.className = "keyword-text"; keywordText.textContent = item.keyword;
        const score = Number(item.score ?? 0); const scoreIndicator = document.createElement("span"); scoreIndicator.className = "score-indicator"; scoreIndicator.setAttribute("aria-label", "Score " + score + " out of 50");
        const scoreRatio = Math.min(1, Math.max(0, score / 50)); const scoreLevel = scoreRatio < .2 ? "low" : scoreRatio < .4 ? "medium-low" : scoreRatio < .6 ? "medium" : scoreRatio < .8 ? "medium-high" : "high";
        const scoreTrack = document.createElement("span"); scoreTrack.className = "score-track"; const scoreFill = document.createElement("span"); scoreFill.className = "score-fill"; scoreFill.dataset.level = scoreLevel; scoreFill.style.width = scoreRatio * 100 + "%"; scoreTrack.append(scoreFill);
        const scoreLabel = document.createElement("span"); scoreLabel.className = "score-label"; scoreLabel.textContent = String(score); scoreIndicator.append(scoreTrack, scoreLabel);
        bubble.append(scoreIndicator);
        bubble.prepend(keywordText);
        parent.append(bubble);
      }

      function renderHumanOutput(result) {
        const research = result.dashboard_research;
        humanOutput.replaceChildren();
        const primary = document.createElement("div"); primary.className = "primary";
        const heading = document.createElement("h3"); heading.textContent = "Primary keyword";
        const explanation = document.createElement("p"); explanation.className = "muted"; explanation.textContent = "Use this as the main search target for the blog post.";
        const bubbleList = document.createElement("div"); bubbleList.className = "keyword-list"; addBubble(research.primary_keyword, bubbleList);
        primary.append(heading, explanation, bubbleList);
        const supportingHeading = document.createElement("h3"); supportingHeading.className = "supporting-heading"; supportingHeading.textContent = "Supporting keywords (" + research.supporting_keywords.length + ")";
        const supportingCard = document.createElement("div"); supportingCard.className = "supporting-card";
        const supportingTitle = document.createElement("h3"); supportingTitle.textContent = "Supporting keywords";
        const supportingExplanation = document.createElement("p"); supportingExplanation.className = "muted"; supportingExplanation.textContent = "Use these related queries as supporting sections or separate content angles.";
        const supportingKeywords = document.createElement("div"); supportingKeywords.className = "supporting-keywords";
        research.supporting_keywords.forEach((item) => { const keywordRow = document.createElement("div"); keywordRow.className = "keyword-list"; addBubble(item, keywordRow); supportingKeywords.append(keywordRow); });
        supportingCard.append(supportingTitle, supportingExplanation, supportingKeywords);
        const diversityHeading = document.createElement("h3"); diversityHeading.className = "supporting-heading"; diversityHeading.textContent = "Diversity keywords (" + research.diversity_keywords.length + ")";
        const diversityCard = document.createElement("div"); diversityCard.className = "supporting-card";
        const diversityTitle = document.createElement("h3"); diversityTitle.textContent = "Diversity keywords";
        const diversityExplanation = document.createElement("p"); diversityExplanation.className = "muted"; diversityExplanation.textContent = "These are genuinely different, still relevant queries that broaden the article’s coverage. The list can be shorter when research does not find enough distinct results.";
        const diversityKeywords = document.createElement("div"); diversityKeywords.className = "supporting-keywords";
        research.diversity_keywords.forEach((item) => { const keywordRow = document.createElement("div"); keywordRow.className = "keyword-list"; addBubble(item, keywordRow); diversityKeywords.append(keywordRow); });
        diversityCard.append(diversityTitle, diversityExplanation, diversityKeywords);
        humanOutput.append(primary, supportingHeading, supportingCard, diversityHeading, diversityCard);
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault(); submitButton.disabled = true; status.textContent = "Researching keyword suggestions…"; status.className = "status";
        const requestStartedAt = performance.now();
        try {
          const parsed = JSON.parse(requestBody.value);
          const topic = topicInput.value.trim();
          if (!topic) throw new Error("Enter a topic to research.");
          parsed.topic = topic;
          const response = await fetch("/v1/keywords/recommended?view=dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
          const result = await response.json();
          const responseTimeMs = performance.now() - requestStartedAt;
          if (!response.ok) throw new Error(result.error || "The API request failed.");
          emptyState.hidden = true; responseContent.hidden = false; status.textContent = "Success · " + formatDuration(responseTimeMs); summary.replaceChildren();
          addSummary("Topic", result.topic); addSummary("Recommendations", String(1 + result.supporting_keywords.length + result.diversity_keywords.length));
          renderHumanOutput(result); rawResponse.textContent = JSON.stringify({ topic: result.topic, primary_keyword: result.primary_keyword, supporting_keywords: result.supporting_keywords, diversity_keywords: result.diversity_keywords }, null, 2);
        } catch (error) { status.textContent = error.message; status.className = "status error"; emptyState.hidden = false; responseContent.hidden = true; }
        finally { submitButton.disabled = false; }
      });

      function formatDuration(milliseconds) {
        return milliseconds < 1000 ? Math.round(milliseconds) + " ms" : (milliseconds / 1000).toFixed(2) + " s";
      }
    </script>
  </body>
</html>`;
}
