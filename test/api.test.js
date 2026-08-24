import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { readFileSync } from "node:fs";
import test from "node:test";
import vercelFunction from "../api/index.js";
import { createApiHandler, createApiServer, startApiServer } from "../src/server.js";

const SESSION_SECRET = "test-session-secret-with-at-least-32-characters";

test("Vercel bundles canonical persona soul files with the API function", () => {
  const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.equal(vercelConfig.functions["api/**/*.js"].includeFiles, "personas/**/*.md");
});

async function withApi(run, options = {}) {
  const server = createApiServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("root route returns an interactive browser API testing console", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(baseUrl, { headers: { Accept: "text/html" } });
    const page = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(page, /API testing console/);
    assert.match(page, /id="test-form"/);
    assert.match(page, /Run API request/);
    assert.match(page, /Response overview/);
    assert.match(page, /addSummary\("Persona", result\.persona \? result\.persona\.name : "—", result\.persona \? result\.persona\.writing_style : ""\)/);
    assert.match(page, /addSummary\(/);
    assert.match(page, /result\.author\.full_name \|\| result\.author\.name/);
    assert.match(page, /"Age: " \+ result\.author\.age \+ " · " \+ result\.author\.job_title/);
    assert.match(page, /portrait\.src = image\.url/);
    assert.doesNotMatch(page, /addPersonaEffect/);
    assert.match(page, /<details><summary>Agent guidance<\/summary>/);
    assert.doesNotMatch(page, /<details open><summary>Agent guidance/);
    assert.match(page, /Keyword-research workflow/);
    assert.match(page, /\.empty\[hidden\] \{ display: none; \}/);
  });
});

test("root route returns JSON discovery for programmatic clients", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(baseUrl, { headers: { Accept: "application/json" } });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.version, "v1");
    assert.equal(result.endpoints.length, 8);
    assert.ok(result.endpoints.some((endpoint) => endpoint.path === "/v1/personas"));
    assert.ok(result.endpoints.some((endpoint) => endpoint.path === "/v1/authors"));
  });
});

test("local server serves configured author portraits", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/assets/authors/melissa-hart.png`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  });
});

test("Vercel Function route prefix exposes personas through the same API handler", async () => {
  const handler = createApiHandler();
  const response = await handler(new Request("https://example.vercel.app/api/v1/personas"));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(result.personas, [
    { id: "persona_a", name: "Persona A" },
    { id: "persona_b", name: "Persona B" },
    { id: "persona_c", name: "Persona C" }
  ]);
});

test("persona responses are resolved from canonical SOUL.md files", async () => {
  const handler = createApiHandler();
  const response = await handler(new Request("https://example.vercel.app/v1/templates/recommended", { method: "POST" }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.persona.soul_file, "personas/persona-a/SOUL.md");
  assert.equal(result.persona.schema_version, "1.0");
  assert.equal(result.persona.personality.traits.rigor, 0.85);
  assert.equal(result.persona.principles[0].priority, 1);
  assert.equal(result.persona.guardrails.hard[0].severity, "critical");
  assert.match(result.persona.soul_markdown, /Use this persona for professional blog posts/);
});

test("all catalog personas have statically bundled soul sources", async () => {
  const handler = createApiHandler();

  for (const persona of ["persona_a", "persona_b", "persona_c"]) {
    const response = await handler(new Request("https://example.vercel.app/v1/templates/recommended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona })
    }));
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.persona.id, persona);
    assert.ok(result.persona.soul_markdown.length > 0);
  }
});

test("Vercel Function route prefix exposes authors through the same API handler", async () => {
  const handler = createApiHandler();
  const response = await handler(new Request("https://example.vercel.app/api/v1/authors"));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(result.authors, [
    { id: "john", name: "John", full_name: "John Carter", age: 34, job_title: "Product Marketing Manager", photo: { url: "/assets/authors/john-carter.png", alt: "Mock portrait of John Carter" }, template_instructions: { generation_context: ["full_name", "age", "job_title"], published_display: { name: "John", photo: "/assets/authors/john-carter.png", include_age: false, include_job_title: false } } },
    { id: "melissa", name: "Melissa", full_name: "Melissa Hart", age: 29, job_title: "SaaS Content Strategist", photo: { url: "/assets/authors/melissa-hart.png", alt: "Mock portrait of Melissa Hart" }, template_instructions: { generation_context: ["full_name", "age", "job_title"], published_display: { name: "Melissa", photo: "/assets/authors/melissa-hart.png", include_age: false, include_job_title: false } } },
    { id: "radovan", name: "Radovan", full_name: "Radovan Novak", age: 41, job_title: "Product Growth Consultant", photo: { url: "/assets/authors/radovan-novak.png", alt: "Mock portrait of Radovan Novak" }, template_instructions: { generation_context: ["full_name", "age", "job_title"], published_display: { name: "Radovan", photo: "/assets/authors/radovan-novak.png", include_age: false, include_job_title: false } } },
    { id: "sophie", name: "Sophie", full_name: "Sophie Redwood", age: 25, job_title: "Content Marketing Specialist", photo: { url: "/assets/authors/sophie-redwood.png", alt: "Mock portrait of Sophie Redwood" }, template_instructions: { generation_context: ["full_name", "age", "job_title"], published_display: { name: "Sophie", photo: "/assets/authors/sophie-redwood.png", include_age: false, include_job_title: false } } },
    { id: "thomas", name: "Thomas", full_name: "Thomas Hawthorne", age: 51, job_title: "B2B Product Consultant", photo: { url: "/assets/authors/thomas-hawthorne.png", alt: "Mock portrait of Thomas Hawthorne" }, template_instructions: { generation_context: ["full_name", "age", "job_title"], published_display: { name: "Thomas", photo: "/assets/authors/thomas-hawthorne.png", include_age: false, include_job_title: false } } }
  ]);
});

test("Vercel Function entrypoint serves the health route", async () => {
  const response = await vercelFunction.fetch(new Request("https://example.vercel.app/health"));
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("specific direct mode composes a blog template with configuration overrides", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates/specific`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postType: "blog",
        persona: "persona_b",
        author: "melissa",
        configuration: { body: { words: { min: 2500, max: 3500 } } }
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.mode, "specific");
    assert.equal(result.delivery, "direct");
    assert.deepEqual(result.configuration.body.words, { min: 2500, max: 3500 });
    assert.equal(result.persona.id, "persona_b");
    assert.match(result.persona.writing_style, /Cheerful/);
    assert.deepEqual(result.author, {
      id: "melissa",
      name: "Melissa",
      full_name: "Melissa Hart",
      age: 29,
      job_title: "SaaS Content Strategist",
      photo: { url: "/assets/authors/melissa-hart.png", alt: "Mock portrait of Melissa Hart" },
      template_instructions: { generation_context: ["full_name", "age", "job_title"], published_display: { name: "Melissa", photo: "/assets/authors/melissa-hart.png", include_age: false, include_job_title: false } }
    });
    assert.equal(result.guidance.source, "README.md#agent-operating-view");
    assert.equal(result.packageVersion, "1.0");
    assert.equal(result.template.id, "blog-post-template");
    assert.match(result.template.markdown, /type: "Blog Post Template"/);
    assert.match(result.template.markdown, /persona_config: "config\/personas.json"/);
    assert.match(result.template.markdown, /author_config: "config\/authors.json"/);
    assert.match(result.template.markdown, /writing_style: "Cheerful, conversational/);
    assert.match(result.template.markdown, /name: "Melissa"/);
    assert.match(result.template.markdown, /template_instructions:/);
    assert.match(result.template.markdown, /include_age: false/);
    assert.match(result.template.markdown, /resolved_structure:/);
  });
});

test("recommendation mode returns the researched fixed blog template package", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates/recommended`, { method: "POST" });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.mode, "recommended");
    assert.equal(result.delivery, "direct");
    assert.equal(result.postType, "blog");
    assert.equal(result.persona.id, "persona_a");
    assert.deepEqual(result.author, {
      id: "john",
      name: "John",
      full_name: "John Carter",
      age: 34,
      job_title: "Product Marketing Manager",
      photo: { url: "/assets/authors/john-carter.png", alt: "Mock portrait of John Carter" },
      template_instructions: { generation_context: ["full_name", "age", "job_title"], published_display: { name: "John", photo: "/assets/authors/john-carter.png", include_age: false, include_job_title: false } }
    });
    assert.equal(result.fixedRecommendations.recommendations.body.words, 1800);
    assert.deepEqual(result.configuration.title.words, { min: 8, max: 8 });
    assert.match(result.guidance.markdown, /Required inputs/);
    assert.equal(result.keywordResearch.source, "README.md#keyword-research-workflow");
    assert.match(result.keywordResearch.markdown, /primary_query/);
    assert.match(result.keywordResearch.markdown, /Search Console/);
    assert.equal(result.template.id, "blog-post-template");
    assert.match(result.template.markdown, /fixed_recommendations_config/);
    assert.match(result.template.markdown, /required_inputs:/);
    assert.match(result.template.markdown, /keyword_research:/);
    assert.match(result.template.markdown, /PRIMARY_QUERY/);
    assert.match(result.template.markdown, /{{DIRECT_ANSWER_OR_KEY_TAKEAWAY}}/);
    assert.equal((result.template.markdown.match(/^## \{\{SECTION_TITLE_/gm) ?? []).length, 10);
    assert.equal((result.template.markdown.match(/^## /gm) ?? []).length, 10);
    assert.equal((result.template.markdown.match(/SOURCE_CITATION_/g) ?? []).length, 5);
    assert.equal((result.template.markdown.match(/EXPERT_QUOTE_01/g) ?? []).length, 1);
    assert.equal((result.template.markdown.match(/FAQ_QUESTION_/g) ?? []).length, 3);
  });
});

test("template requests reject an unknown persona", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates/specific`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postType: "blog", persona: "persona_unknown" })
    });

    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /persona_a, persona_b, persona_c/);
  });
});

test("template requests reject an unknown author", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates/specific`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postType: "blog", author: "author_unknown" })
    });

    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /john, melissa, radovan/);
  });
});

test("startup falls back to the next port when the default is occupied", async () => {
  const occupiedServer = createHttpServer();
  await new Promise((resolve) => occupiedServer.listen(0, "127.0.0.1", resolve));
  const occupiedPort = occupiedServer.address().port;
  const apiServer = createApiServer();

  try {
    const active = await startApiServer({
      server: apiServer,
      port: occupiedPort,
      host: "127.0.0.1",
      maxPort: occupiedPort + 1
    });
    assert.equal(active.port, occupiedPort + 1);
  } finally {
    await new Promise((resolve) => apiServer.close(resolve));
    await new Promise((resolve) => occupiedServer.close(resolve));
  }
});

test("direct template request rejects a tag count other than ten", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postType: "social_media",
        configuration: { tags: { count: { min: 8, max: 8 } } }
      })
    });

    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /exactly 10/);
  });
});

test("guided session asks each configuration question and returns a social template", async () => {
  await withApi(async (baseUrl) => {
    let response = await fetch(`${baseUrl}/v1/templates/specific/guided`, { method: "POST" });
    let result = await response.json();
    assert.equal(result.question.id, "postType");
    assert.equal(result.mode, "specific");
    assert.equal(result.delivery, "guided");

    const answers = ["social_media", "persona_c", "radovan", "default", "default", "default", "default", "default", "default"];
    for (const value of answers) {
      response = await fetch(`${baseUrl}/v1/templates/specific/guided/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: result.sessionToken, value })
      });
      result = await response.json();
    }

    assert.equal(response.status, 200);
    assert.equal(result.complete, true);
    assert.equal(result.mode, "specific");
    assert.equal(result.delivery, "guided");
    assert.equal(result.postType, "social_media");
    assert.equal(result.persona.id, "persona_c");
    assert.deepEqual(result.author, {
      id: "radovan",
      name: "Radovan",
      full_name: "Radovan Novak",
      age: 41,
      job_title: "Product Growth Consultant",
      photo: { url: "/assets/authors/radovan-novak.png", alt: "Mock portrait of Radovan Novak" },
      template_instructions: { generation_context: ["full_name", "age", "job_title"], published_display: { name: "Radovan", photo: "/assets/authors/radovan-novak.png", include_age: false, include_job_title: false } }
    });
    assert.equal(result.template.id, "social-media-post-template");
    assert.match(result.template.markdown, /type: "Social Media Post"/);
  }, { sessionSecret: SESSION_SECRET });
});

test("guided session tokens work across separate handler instances", async () => {
  const firstHandler = createApiHandler({ sessionSecret: SESSION_SECRET });
  const startResponse = await firstHandler(new Request("https://example.vercel.app/v1/sessions", { method: "POST" }));
  const start = await startResponse.json();
  const secondHandler = createApiHandler({ sessionSecret: SESSION_SECRET });
  const answerResponse = await secondHandler(new Request("https://example.vercel.app/v1/sessions/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: start.sessionToken, value: "blog" })
  }));
  const answer = await answerResponse.json();

  assert.equal(answerResponse.status, 200);
  assert.equal(answer.question.id, "persona");
  assert.deepEqual(answer.question.choices, [
    { id: "persona_a", name: "Persona A" },
    { id: "persona_b", name: "Persona B" },
    { id: "persona_c", name: "Persona C" }
  ]);
  assert.equal(typeof answer.sessionToken, "string");
});

test("guided sessions require a configured signing secret", async () => {
  const handler = createApiHandler({ sessionSecret: undefined });
  const response = await handler(new Request("https://example.vercel.app/v1/sessions", { method: "POST" }));

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /SESSION_SECRET/);
});
