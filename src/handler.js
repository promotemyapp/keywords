import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ConfigurationError,
  fixedRecommendationsToConfiguration,
  getAuthorChoices,
  getPersonaChoices,
  getProfile,
  loadFixedBlogRecommendations,
  loadStructureConfig,
  normalizePostType,
  resolveAuthor,
  resolvePersona,
  resolveConfiguration,
  setRange,
  validateConfiguration
} from "./config.js";
import { loadAgentGuidance, loadKeywordResearchGuidance } from "./guidance.js";
import { composeTemplate } from "./templates.js";

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_REQUEST_BODY_BYTES = 1_000_000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const QUESTIONS = [
  {
    id: "postType",
    prompt: "What kind of post do you need?",
    type: "choice",
    choices: ["blog", "social_media"]
  },
  {
    id: "persona",
    prompt: "Which writing persona should the post use?",
    type: "choice"
  },
  {
    id: "author",
    prompt: "Which author should the post use?",
    type: "choice"
  },
  {
    id: "body.words",
    prompt: "How long should the post body be?",
    type: "range",
    path: ["body", "words"]
  },
  {
    id: "title.words",
    prompt: "How long should the main title be?",
    type: "range",
    path: ["title", "words"]
  },
  {
    id: "subtitles.count",
    prompt: "How many subtitles or content beats should the post have?",
    type: "range",
    path: ["subtitles", "count"]
  },
  {
    id: "subtitles.words",
    prompt: "How long should each subtitle be?",
    type: "range",
    path: ["subtitles", "words"]
  },
  {
    id: "body.sections",
    prompt: "How many body sections should the post have?",
    type: "range",
    path: ["body", "sections"]
  },
  {
    id: "tags.count",
    prompt: "How many tags should the post have?",
    type: "range",
    path: ["tags", "count"],
    requiredRange: { min: 10, max: 10 }
  }
];

export class SessionError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "SessionError";
    this.status = status;
  }
}

export function createApiHandler({
  sessionSecret = process.env.SESSION_SECRET,
  now = () => Date.now(),
  sessionTtlMs = SESSION_TTL_MS
} = {}) {
  const sessionCodec = sessionSecret ? createSessionCodec(sessionSecret) : null;

  return async function handleRequest(request) {
    try {
      const url = new URL(request.url);
      const path = normalizeFunctionPath(url.pathname);

      if (request.method === "OPTIONS") return emptyResponse(204);
      if (request.method === "GET" && path === "/") {
        return request.headers.get("accept")?.includes("text/html")
          ? htmlResponse(200, renderDiscoveryPage())
          : jsonResponse(200, apiDiscovery());
      }
      if (request.method === "GET" && path === "/health") {
        return jsonResponse(200, { status: "ok" });
      }
      if (request.method === "GET" && path === "/v1/post-types") {
        const config = loadStructureConfig();
        return jsonResponse(200, {
          postTypes: Object.keys(config.profiles),
          profiles: config.profiles
        });
      }
      if (request.method === "GET" && path === "/v1/personas") {
        return jsonResponse(200, { personas: getPersonaChoices() });
      }
      if (request.method === "GET" && path === "/v1/authors") {
        return jsonResponse(200, { authors: getAuthorChoices() });
      }
      if (request.method === "POST" && path === "/v1/templates/recommended") {
        const body = await readJson(request);
        const recommendations = loadFixedBlogRecommendations();
        return jsonResponse(200, templateResponse({
          mode: "recommended",
          delivery: "direct",
          postType: "blog",
          configuration: fixedRecommendationsToConfiguration(recommendations),
          persona: resolvePersona(body.persona),
          author: resolveAuthor(body.author),
          fixedRecommendations: recommendations
        }));
      }
      if (request.method === "POST" && path === "/v1/templates/specific") {
        const body = await readJson(request);
        const postType = normalizePostType(body.postType);
        const configuration = resolveConfiguration(postType, body.configuration ?? {});
        return jsonResponse(200, templateResponse({
          mode: "specific",
          delivery: "direct",
          postType,
          configuration,
          persona: resolvePersona(body.persona),
          author: resolveAuthor(body.author)
        }));
      }
      if (request.method === "POST" && path === "/v1/templates") {
        const body = await readJson(request);
        const postType = normalizePostType(body.postType);
        const configuration = resolveConfiguration(postType, body.configuration ?? {});
        return jsonResponse(200, templateResponse({
          mode: "specific",
          delivery: "direct",
          postType,
          configuration,
          persona: resolvePersona(body.persona),
          author: resolveAuthor(body.author)
        }));
      }
      if (request.method === "POST" && (path === "/v1/sessions" || path === "/v1/templates/specific/guided")) {
        if (!sessionCodec) {
          throw new SessionError("Guided sessions require SESSION_SECRET to be configured.", 503);
        }
        return jsonResponse(201, sessionQuestion(createSession(now, sessionTtlMs), sessionCodec));
      }
      if (request.method === "POST" && (path === "/v1/sessions/answers" || path === "/v1/templates/specific/guided/answers")) {
        if (!sessionCodec) {
          throw new SessionError("Guided sessions require SESSION_SECRET to be configured.", 503);
        }
        const body = await readJson(request);
        const session = sessionCodec.decode(body.sessionToken, now());
        const result = answerSession(session, body.value);

        if (result.questionIndex === QUESTIONS.length) {
          return jsonResponse(200, {
            complete: true,
            ...templateResponse({
              mode: "specific",
              delivery: "guided",
              postType: result.postType,
              configuration: result.configuration,
              persona: resolvePersona(result.persona),
              author: resolveAuthor(result.author)
            })
          });
        }

        return jsonResponse(200, sessionQuestion(result, sessionCodec));
      }

      return jsonResponse(404, { error: "Route not found." });
    } catch (error) {
      return jsonResponse(errorStatus(error), { error: error.message || "Unexpected server error." });
    }
  };
}

function createSession(now, sessionTtlMs) {
  return {
    version: 1,
    questionIndex: 0,
    postType: null,
    persona: null,
    author: null,
    configuration: null,
    expiresAt: now() + sessionTtlMs
  };
}

function answerSession(session, value) {
  const question = QUESTIONS[session.questionIndex];
  if (!question) throw new SessionError("This guided session is already complete.", 409);

  if (question.id === "postType") {
    session.postType = normalizePostType(value);
    session.configuration = getProfile(session.postType);
  } else if (question.id === "persona") {
    session.persona = resolvePersona(value).id;
  } else if (question.id === "author") {
    session.author = resolveAuthor(value).id;
  } else if (value !== "default") {
    setRange(session.configuration, question.path, value);
  }

  session.questionIndex += 1;
  return session;
}

function sessionQuestion(session, sessionCodec) {
  const question = QUESTIONS[session.questionIndex];
  const response = {
    sessionToken: sessionCodec.encode(session),
    complete: false,
    mode: "specific",
    delivery: "guided",
    question: { id: question.id, prompt: question.prompt, type: question.type }
  };

  if (question.choices) response.question.choices = question.choices;
  if (question.id === "persona") response.question.choices = getPersonaChoices();
  if (question.id === "author") response.question.choices = getAuthorChoices();
  if (question.path && session.configuration) {
    response.question.default = question.path.reduce((current, key) => current[key], session.configuration);
    response.question.accepts = "{ min: integer, max: integer } or 'default'";
  }
  if (question.requiredRange) response.question.requiredRange = question.requiredRange;
  return response;
}

function createSessionCodec(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new SessionError("SESSION_SECRET must be a string with at least 32 characters.", 503);
  }

  return {
    encode(session) {
      const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
      return `${payload}.${sign(payload, secret)}`;
    },
    decode(token, now) {
      if (typeof token !== "string") throw new SessionError("sessionToken is required.");

      const [payload, signature, ...extraParts] = token.split(".");
      if (!payload || !signature || extraParts.length > 0 || !matchesSignature(payload, signature, secret)) {
        throw new SessionError("sessionToken is invalid.");
      }

      let session;
      try {
        session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      } catch {
        throw new SessionError("sessionToken is invalid.");
      }

      if (session.version !== 1 || !Number.isInteger(session.questionIndex) || session.questionIndex < 0) {
        throw new SessionError("sessionToken is invalid.");
      }
      if (!Number.isFinite(session.expiresAt) || now >= session.expiresAt) {
        throw new SessionError("sessionToken has expired.", 410);
      }
      if (session.questionIndex > 0) {
        session.postType = normalizePostType(session.postType);
        validateConfiguration(session.configuration);
      }
      if (session.questionIndex > 1) session.persona = resolvePersona(session.persona).id;
      if (session.questionIndex > 2) session.author = resolveAuthor(session.author).id;

      return session;
    }
  };
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function matchesSignature(payload, signature, secret) {
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function normalizeFunctionPath(path) {
  if (path === "/api") return "/";
  return path.startsWith("/api/") ? path.slice(4) : path;
}

function templateResponse({ mode, delivery, postType, configuration, persona, author, fixedRecommendations }) {
  const recommendationMode = mode === "recommended";
  const templates = composeTemplate(postType, configuration, persona, author, recommendationMode
    ? {
        configurationField: "fixed_recommendations_config",
        configurationReference: "config/blog-post-fixed-recommendations.json"
      }
    : undefined);

  return {
    packageVersion: "1.0",
    mode,
    delivery,
    postType,
    configuration,
    persona,
    author,
    ...(fixedRecommendations ? { fixedRecommendations } : {}),
    guidance: loadAgentGuidance(),
    ...(postType === "blog" ? { keywordResearch: loadKeywordResearchGuidance() } : {}),
    template: {
      id: postType === "blog" ? "blog-post-template" : "social-media-post-template",
      format: "markdown",
      markdown: templates.combined
    }
  };
}

function apiDiscovery() {
  return {
    name: "Reusable Marketing Post Templates API",
    version: "v1",
    documentation: "Repository docs/API.md",
    endpoints: [
      { method: "GET", path: "/health", description: "Service health check" },
      { method: "GET", path: "/v1/post-types", description: "Available post types and profiles" },
      { method: "GET", path: "/v1/personas", description: "Available writing personas" },
      { method: "GET", path: "/v1/authors", description: "Available authors" },
      { method: "POST", path: "/v1/templates/recommended", description: "Return the researched blog template baseline" },
      { method: "POST", path: "/v1/templates/specific", description: "Compose a template from supplied settings" },
      { method: "POST", path: "/v1/templates/specific/guided", description: "Start guided specific configuration" },
      { method: "POST", path: "/v1/templates/specific/guided/answers", description: "Answer the next guided specific question" }
    ]
  };
}

async function readJson(request) {
  const body = await request.text();
  if (body.length > MAX_REQUEST_BODY_BYTES) {
    throw new ConfigurationError("Request body must be smaller than 1 MB.");
  }
  return body ? JSON.parse(body) : {};
}

function errorStatus(error) {
  if (error instanceof SessionError) return error.status;
  if (error instanceof ConfigurationError) return 422;
  if (error instanceof SyntaxError) return 400;
  return 500;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" }
  });
}

function htmlResponse(status, body) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/html; charset=utf-8" }
  });
}

function emptyResponse(status) {
  return new Response(null, { status, headers: CORS_HEADERS });
}

function renderDiscoveryPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Post Template API Console</title>
    <style>
      :root { color: #16213a; background: #f4f7fb; font: 16px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      main { width: min(1120px, calc(100% - 32px)); margin: 40px auto 72px; }
      .hero { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
      h1 { margin: 0; font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -.04em; }
      h2 { margin: 0; font-size: 1.15rem; }
      p { margin: 8px 0 0; }
      .eyebrow { color: #3656b9; font-size: .76rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .hint { color: #5c6b85; }
      .layout { display: grid; grid-template-columns: minmax(280px, .8fr) minmax(0, 1.5fr); gap: 20px; align-items: start; }
      .card { background: #fff; border: 1px solid #dce4f2; border-radius: 18px; box-shadow: 0 8px 28px rgb(32 53 89 / 7%); }
      .controls { padding: 24px; position: sticky; top: 20px; }
      .response { min-height: 440px; padding: 24px; }
      .field { display: grid; gap: 7px; margin-top: 18px; }
      label { color: #35435c; font-size: .88rem; font-weight: 750; }
      select, textarea, button { font: inherit; }
      select, textarea { width: 100%; border: 1px solid #c9d4e5; border-radius: 10px; color: #16213a; background: #fff; padding: 10px 12px; }
      textarea { min-height: 116px; resize: vertical; font: .82rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
      button { width: 100%; margin-top: 22px; border: 0; border-radius: 10px; padding: 12px 16px; color: #fff; background: #2449bd; cursor: pointer; font-weight: 800; }
      button:hover { background: #1e3da2; }
      button:disabled { cursor: wait; opacity: .7; }
      .mode-note { margin-top: 10px; color: #5c6b85; font-size: .86rem; }
      .status { margin: 0 0 18px; color: #3656b9; font-weight: 700; }
      .status.error { color: #b42318; }
      .empty { display: grid; min-height: 360px; place-items: center; text-align: center; color: #5c6b85; }
      .empty span { display: block; margin-bottom: 10px; color: #3656b9; font-size: 2rem; }
      .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 18px 0 22px; }
      .summary-card { border: 1px solid #dce4f2; border-radius: 12px; background: #f9fbff; padding: 13px; }
      .summary-card span { display: block; color: #63718a; font-size: .72rem; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
      .summary-card strong { display: block; margin-top: 4px; font-size: .96rem; line-height: 1.35; }
      .summary-card p { margin-top: 7px; color: #31415d; font-size: .88rem; line-height: 1.45; }
      .summary-card.author-card { display: grid; grid-template-columns: 52px 1fr; column-gap: 12px; }
      .summary-card.author-card img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; grid-row: span 2; }
      .summary-card.author-card p { grid-column: 2; }
      details { border-top: 1px solid #e2e8f2; padding: 14px 0; }
      summary { cursor: pointer; color: #22334e; font-weight: 800; }
      pre { overflow: auto; margin: 12px 0 0; padding: 14px; border-radius: 10px; color: #dce7fa; background: #15213a; font: .78rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
      .response[hidden], .field[hidden], .empty[hidden] { display: none; }
      .endpoint { display: inline-flex; align-items: center; border-radius: 999px; padding: 7px 11px; color: #28435f; background: #e9effa; font: .76rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
      @media (max-width: 820px) { main { margin-top: 24px; } .hero, .layout { display: block; } .hero > div + div { margin-top: 14px; } .controls { position: static; margin-bottom: 20px; } }
      @media (max-width: 460px) { .summary { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <header class="hero">
        <div>
          <div class="eyebrow">Reusable Marketing Post Templates</div>
          <h1>API testing console</h1>
          <p class="hint">Send a template request and inspect the agent-ready response in one place.</p>
        </div>
        <div class="endpoint">POST /v1/templates/recommended</div>
      </header>

      <div class="layout">
        <form class="card controls" id="test-form">
          <h2>Build a test request</h2>
          <p class="hint">Configuration choices are loaded from this API.</p>

          <div class="field">
            <label for="mode">Request mode</label>
            <select id="mode" name="mode">
              <option value="recommended">Recommendation — optimized blog baseline</option>
              <option value="specific">Specific — selected post settings</option>
            </select>
          </div>

          <div class="field" id="post-type-field" hidden>
            <label for="post-type">Post type</label>
            <select id="post-type" name="postType">
              <option value="blog">Blog post</option>
              <option value="social_media">Social media post</option>
            </select>
          </div>

          <div class="field">
            <label for="persona">Writing persona</label>
            <select id="persona" name="persona" disabled></select>
          </div>

          <div class="field">
            <label for="author">Author</label>
            <select id="author" name="author" disabled></select>
          </div>

          <div class="field" id="configuration-field" hidden>
            <label for="configuration">Optional structural override (JSON)</label>
            <textarea id="configuration" name="configuration" spellcheck="false" placeholder='{"body":{"words":{"min":2500,"max":3500}}}'></textarea>
          </div>

          <p class="mode-note" id="mode-note">Returns the fixed, research-informed blog recommendations.</p>
          <button id="submit-button" type="submit" disabled>Run API request</button>
        </form>

        <section class="card response" aria-live="polite">
          <div class="empty" id="empty-state"><div><span>↗</span><strong>Your response will appear here</strong><p>Choose settings and run an API request to inspect the template package.</p></div></div>
          <div id="response-content" class="response" hidden>
            <p class="status" id="status"></p>
            <h2>Response overview</h2>
            <div class="summary" id="summary"></div>
            <details><summary>Agent guidance</summary><pre id="guidance"></pre></details>
            <details><summary>Keyword-research workflow</summary><pre id="keyword-research"></pre></details>
            <details><summary>Markdown template</summary><pre id="template"></pre></details>
            <details><summary>Raw JSON response</summary><pre id="raw-response"></pre></details>
          </div>
        </section>
      </div>
    </main>
    <script>
      const form = document.getElementById("test-form");
      const mode = document.getElementById("mode");
      const postTypeField = document.getElementById("post-type-field");
      const configurationField = document.getElementById("configuration-field");
      const modeNote = document.getElementById("mode-note");
      const persona = document.getElementById("persona");
      const author = document.getElementById("author");
      const submitButton = document.getElementById("submit-button");
      const emptyState = document.getElementById("empty-state");
      const responseContent = document.getElementById("response-content");
      const status = document.getElementById("status");
      const summary = document.getElementById("summary");

      function option(value, label) {
        const element = document.createElement("option");
        element.value = value;
        element.textContent = label;
        return element;
      }

      function setChoices(select, choices) {
        select.replaceChildren();
        choices.forEach(function (choice) { select.append(option(choice.id, choice.name)); });
        select.disabled = false;
      }

      function updateMode() {
        const specific = mode.value === "specific";
        postTypeField.hidden = !specific;
        configurationField.hidden = !specific;
        modeNote.textContent = specific
          ? "Returns a template with your selected post type and optional structural override."
          : "Returns the fixed, research-informed blog recommendations.";
      }

      function addSummary(label, value, description, image) {
        const card = document.createElement("div");
        card.className = "summary-card";
        if (image) {
          card.classList.add("author-card");
          const portrait = document.createElement("img");
          portrait.src = image.url;
          portrait.alt = image.alt;
          card.append(portrait);
        }
        const caption = document.createElement("span");
        caption.textContent = label;
        const detail = document.createElement("strong");
        detail.textContent = value;
        card.append(caption, detail);
        if (description) {
          const explanation = document.createElement("p");
          explanation.textContent = description;
          card.append(explanation);
        }
        summary.append(card);
      }

      function renderResponse(result, elapsed) {
        emptyState.hidden = true;
        responseContent.hidden = false;
        status.className = "status";
        status.textContent = "Success · " + elapsed + " ms · " + result.mode + " mode";
        summary.replaceChildren();
        addSummary("Post type", result.postType || "—");
        addSummary("Persona", result.persona ? result.persona.name : "—", result.persona ? result.persona.writing_style : "");
        addSummary(
          "Author",
          result.author ? (result.author.full_name || result.author.name) : "—",
          result.author ? "Age: " + result.author.age + " · " + result.author.job_title : "",
          result.author ? result.author.photo : null
        );
        addSummary("Body target", result.configuration && result.configuration.body ? result.configuration.body.words.min + " words" : "—");
        addSummary("Sections", result.configuration && result.configuration.body ? String(result.configuration.body.sections.min) : "—");
        addSummary("Tags", result.configuration && result.configuration.tags ? String(result.configuration.tags.count.min) : "—");
        document.getElementById("guidance").textContent = result.guidance ? result.guidance.markdown : "No guidance included.";
        document.getElementById("keyword-research").textContent = result.keywordResearch ? result.keywordResearch.markdown : "This template type does not include keyword-research guidance.";
        document.getElementById("template").textContent = result.template ? result.template.markdown : "No Markdown template included.";
        document.getElementById("raw-response").textContent = JSON.stringify(result, null, 2);
      }

      function renderError(message) {
        emptyState.hidden = true;
        responseContent.hidden = false;
        status.className = "status error";
        status.textContent = "Request failed · " + message;
        summary.replaceChildren();
        document.getElementById("guidance").textContent = "Choose valid settings and run the request again.";
        document.getElementById("keyword-research").textContent = "";
        document.getElementById("template").textContent = "";
        document.getElementById("raw-response").textContent = "";
      }

      async function loadChoices() {
        try {
          const responses = await Promise.all([fetch("/v1/personas"), fetch("/v1/authors")]);
          const personaResult = await responses[0].json();
          const authorResult = await responses[1].json();
          setChoices(persona, personaResult.personas);
          setChoices(author, authorResult.authors);
          submitButton.disabled = false;
        } catch (error) {
          renderError("Configuration choices could not be loaded.");
        }
      }

      mode.addEventListener("change", updateMode);
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = "Running request…";
        const startedAt = performance.now();

        try {
          const payload = { persona: persona.value, author: author.value };
          let endpoint = "/v1/templates/recommended";
          if (mode.value === "specific") {
            endpoint = "/v1/templates/specific";
            payload.postType = document.getElementById("post-type").value;
            const rawConfiguration = document.getElementById("configuration").value.trim();
            if (rawConfiguration) payload.configuration = JSON.parse(rawConfiguration);
          }

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Unexpected API response.");
          renderResponse(result, Math.round(performance.now() - startedAt));
        } catch (error) {
          renderError(error.message || "Unexpected API error.");
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Run API request";
        }
      });

      updateMode();
      loadChoices();
    </script>
  </body>
</html>`;
}
