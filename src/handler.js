import { createHmac, timingSafeEqual } from "node:crypto";
import { ConfigurationError, loadKeywordResearchConfig, resolveKeywordResearchConfig, validateKeywordResearchConfig } from "./config.js";
import { ResearchError, researchKeywords } from "./research.js";
import { renderDashboardPage } from "./dashboard.js";

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_REQUEST_BODY_BYTES = 1_000_000;
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const QUESTIONS = [
  { id: "topic", prompt: "What product, topic, or problem are you researching?" },
  { id: "audience", prompt: "Who is the target audience?" },
  { id: "language", prompt: "Which language should the research use?" },
  { id: "country", prompt: "Which country or market should the research target?" },
  { id: "search_intent", prompt: "What search intent should be prioritized?" }
];

export class SessionError extends Error {
  constructor(message, status = 401) { super(message); this.name = "SessionError"; this.status = status; }
}

export function createApiHandler({ sessionSecret = process.env.SESSION_SECRET, now = () => Date.now(), sessionTtlMs = SESSION_TTL_MS, fetchImpl = fetch } = {}) {
  const codec = sessionSecret ? createSessionCodec(sessionSecret) : null;
  return async function handleRequest(request) {
    try {
      const path = normalizeFunctionPath(new URL(request.url).pathname);
      if (request.method === "OPTIONS") return emptyResponse(204);
      if (request.method === "GET" && path === "/") return request.headers.get("accept")?.includes("text/html") ? htmlResponse(200, renderDashboardPage()) : jsonResponse(200, discovery());
      if (request.method === "GET" && path === "/health") return jsonResponse(200, { status: "ok" });
      if (request.method === "GET" && path === "/v1/config") return jsonResponse(200, loadKeywordResearchConfig());
      if (request.method === "POST" && (path === "/v1/keywords/recommended" || path === "/v1/keywords/research")) { const body = await readJson(request); return jsonResponse(200, await researchResponse("recommended", body.configuration ?? {}, body, fetchImpl, now)); }
      if (request.method === "POST" && path === "/v1/keywords/specific") { const body = await readJson(request); return jsonResponse(200, await researchResponse("specific", body.configuration ?? {}, body, fetchImpl, now)); }
      if (request.method === "POST" && path === "/v1/sessions") {
        if (!codec) throw new SessionError("Guided sessions require SESSION_SECRET to be configured.", 503);
        return jsonResponse(201, sessionQuestion(createSession(now, sessionTtlMs), codec));
      }
      if (request.method === "POST" && path === "/v1/sessions/answers") {
        if (!codec) throw new SessionError("Guided sessions require SESSION_SECRET to be configured.", 503);
        const body = await readJson(request); const session = codec.decode(body.sessionToken, now()); answerSession(session, body.value);
        if (session.questionIndex === QUESTIONS.length) return jsonResponse(200, { complete: true, ...(await researchResponse("guided", session.configuration, session, fetchImpl, now)) });
        return jsonResponse(200, sessionQuestion(session, codec));
      }
      return jsonResponse(404, { error: "Route not found." });
    } catch (error) { return jsonResponse(errorStatus(error), { error: error.message || "Unexpected server error." }); }
  };
}

async function researchResponse(mode, overrides, input, fetchImpl, now) {
  const configuration = resolveKeywordResearchConfig(overrides);
  const research = await researchKeywords({ topic: input.topic, audience: input.audience, configuration, fetchImpl, now });
  return {
    topic: research.topic,
    primary_keyword: research.primary_keyword.keyword,
    supporting_keywords: research.supporting_keywords.map(({ keyword }) => keyword)
  };
}

function createSession(now, ttl) { return { version: 1, questionIndex: 0, configuration: loadKeywordResearchConfig().defaults, topic: null, audience: null, expiresAt: now() + ttl }; }
function answerSession(session, value) {
  const question = QUESTIONS[session.questionIndex];
  if (!question) throw new SessionError("This guided session is already complete.", 409);
  if (typeof value !== "string" || !value.trim()) throw new ConfigurationError(`${question.id} must be a non-empty string.`);
  if (question.id === "topic" || question.id === "audience") session[question.id] = value.trim(); else session.configuration[question.id] = value.trim();
  if (question.id === "search_intent") validateKeywordResearchConfig(session.configuration);
  session.questionIndex += 1;
}
function sessionQuestion(session, codec) { const question = QUESTIONS[session.questionIndex]; return { sessionToken: codec.encode(session), complete: false, mode: "guided", question: { id: question.id, prompt: question.prompt, type: "text" } }; }
function createSessionCodec(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new SessionError("SESSION_SECRET must be a string with at least 32 characters.", 503);
  return { encode(session) { const payload = Buffer.from(JSON.stringify(session)).toString("base64url"); return `${payload}.${sign(payload, secret)}`; }, decode(token, now) {
    if (typeof token !== "string") throw new SessionError("sessionToken is required."); const [payload, signature, ...extra] = token.split(".");
    if (!payload || !signature || extra.length || !matchesSignature(payload, signature, secret)) throw new SessionError("sessionToken is invalid.");
    let session; try { session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new SessionError("sessionToken is invalid."); }
    if (session.version !== 1 || !Number.isInteger(session.questionIndex) || session.questionIndex < 0 || session.questionIndex > QUESTIONS.length) throw new SessionError("sessionToken is invalid.");
    if (!Number.isFinite(session.expiresAt) || now >= session.expiresAt) throw new SessionError("sessionToken has expired.", 410);
    validateKeywordResearchConfig(session.configuration); return session;
  } };
}
function sign(payload, secret) { return createHmac("sha256", secret).update(payload).digest("base64url"); }
function matchesSignature(payload, signature, secret) { const expected = Buffer.from(sign(payload, secret)); const received = Buffer.from(signature); return expected.length === received.length && timingSafeEqual(expected, received); }
function normalizeFunctionPath(path) { if (path === "/api") return "/"; return path.startsWith("/api/") ? path.slice(4) : path; }
function discovery() { return { name: "Marketing Keyword Research API", version: "v1", documentation: "Repository docs/API.md", endpoints: [{ method: "GET", path: "/health", description: "Service health check" }, { method: "GET", path: "/v1/config", description: "Research defaults and limits" }, { method: "POST", path: "/v1/keywords/recommended", description: "Research a topic and return ranked blog keywords" }, { method: "POST", path: "/v1/keywords/research", description: "Alias for recommended keyword research" }, { method: "POST", path: "/v1/keywords/specific", description: "Research with configuration overrides" }, { method: "POST", path: "/v1/sessions", description: "Start guided keyword research setup" }, { method: "POST", path: "/v1/sessions/answers", description: "Answer the next guided setup question" }] }; }
async function readJson(request) { const body = await request.text(); if (body.length > MAX_REQUEST_BODY_BYTES) throw new ConfigurationError("Request body must be smaller than 1 MB."); return body ? JSON.parse(body) : {}; }
function errorStatus(error) { if (error instanceof SessionError) return error.status; if (error instanceof ConfigurationError) return 422; if (error instanceof ResearchError) return error.status; if (error instanceof SyntaxError) return 400; return 500; }
function jsonResponse(status, body) { return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" } }); }
function htmlResponse(status, body) { return new Response(body, { status, headers: { ...CORS_HEADERS, "Content-Type": "text/html; charset=utf-8" } }); }
function emptyResponse(status) { return new Response(null, { status, headers: CORS_HEADERS }); }
function renderDiscoveryPage() { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Keyword Research API Console</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#172033;background:#f4f7fb;margin:0}main{width:min(960px,calc(100% - 32px));margin:48px auto}.card{background:#fff;border:1px solid #dce4f2;border-radius:16px;padding:24px;box-shadow:0 8px 28px #20355912}textarea{width:100%;min-height:130px;box-sizing:border-box;margin:12px 0;font:14px monospace;padding:12px;border:1px solid #c9d4e5;border-radius:8px}button{border:0;border-radius:8px;padding:12px 16px;background:#2449bd;color:#fff;font-weight:700;cursor:pointer}pre{overflow:auto;background:#15213a;color:#dce7fa;padding:16px;border-radius:8px;white-space:pre-wrap}</style></head><body><main><div class="card"><p>MARKETING KEYWORD RESEARCH</p><h1>API testing console</h1><p>Submit a research brief request and inspect the agent-ready response.</p><form id="form"><textarea id="body" spellcheck="false">{"topic":"{{TOPIC}}","audience":"{{TARGET_AUDIENCE}}"}</textarea><button>Run recommended research request</button></form><pre id="result">Your response will appear here.</pre></div></main><script>form.addEventListener('submit',async(event)=>{event.preventDefault();result.textContent='Loading…';const response=await fetch('/v1/keywords/recommended',{method:'POST',headers:{'Content-Type':'application/json'},body:body.value});result.textContent=JSON.stringify(await response.json(),null,2)});</script></body></html>`; }
