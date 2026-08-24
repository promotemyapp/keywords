import { readFile, writeFile } from "node:fs/promises";
import { createApiHandler } from "../../src/handler.js";

const topicsPath = new URL("../topics/topics-100-cs.json", import.meta.url);
const outputPath = process.argv[2] ?? "testing/benchmarks/2026-08-24/benchmark.md";
const limit = Number(process.argv[3] ?? 100);
const concurrency = 5;
const topics = (JSON.parse(await readFile(topicsPath, "utf8"))).slice(0, limit);
const handler = createApiHandler();
const results = [];

for (let start = 0; start < topics.length; start += concurrency) {
  const batch = topics.slice(start, start + concurrency);
  const batchResults = await Promise.all(batch.map(async (topic) => {
    const started = Date.now();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await handler(new Request("https://local.test/v1/keywords/recommended", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topic, configuration: { language: "Czech", country: "Czech Republic" } })
        }));
        const result = await response.json();
        if (response.status === 200 || response.status < 500 || attempt === 3) return { topic, status: response.status, attempts: attempt, elapsed_ms: Date.now() - started, result };
        await new Promise((resolve) => setTimeout(resolve, attempt * 150));
      } catch (error) {
        if (attempt === 3) return { topic, status: 0, attempts: attempt, elapsed_ms: Date.now() - started, error: error.message };
        await new Promise((resolve) => setTimeout(resolve, attempt * 150));
      }
    }
  }));
  results.push(...batchResults);
  console.log(`Completed ${results.length}/${topics.length}`);
}

const successful = results.filter((item) => item.status === 200);
const resultOf = (item) => item.result ?? {};
const supportingCount = successful.reduce((sum, item) => sum + (resultOf(item).supporting_keywords?.length ?? 0), 0);
const diversityCount = successful.reduce((sum, item) => sum + (resultOf(item).diversity_keywords?.length ?? 0), 0);
const noEvidenceCount = successful.filter((item) => resultOf(item).primary_keyword?.score === "no evidence").length;
const withSupporting = successful.filter((item) => (resultOf(item).supporting_keywords?.length ?? 0) > 0).length;
const identicalPrimary = successful.filter((item) => resultOf(item).primary_keyword?.keyword?.toLocaleLowerCase() === item.topic.toLocaleLowerCase()).length;
const avgLatency = successful.length ? Math.round(successful.reduce((sum, item) => sum + item.elapsed_ms, 0) / successful.length) : 0;

const lines = [
  `# Live keyword-research benchmark — ${topics.length} českých témat`,
  "",
  `Datum běhu: ${new Date().toISOString()}`,
  "Endpoint: `POST /v1/keywords/recommended`",
  "Konfigurace: `language: Czech`, `country: Czech Republic`",
  `Počet témat: ${topics.length}`,
  "",
  "## Souhrnné metriky",
  "",
  `- HTTP 200: **${successful.length}/${topics.length}**` ,
  `- Supporting keywords celkem: **${supportingCount}**`,
  `- Témata s alespoň jedním supporting keywordem: **${withSupporting}/${successful.length}**`,
  `- Diversity keywords celkem: **${diversityCount}**`,
  `- Primární keyword s hodnocením ` + "`no evidence`" + `: **${noEvidenceCount}/${successful.length}**`,
  `- Primární keyword shodný se vstupem: **${identicalPrimary}/${successful.length}**`,
  `- Průměrná doba odpovědi úspěšných požadavků: **${avgLatency} ms**`,
  "",
  "## Témata a odpovědi",
  ""
];

for (const [index, item] of results.entries()) {
  lines.push(`### ${index + 1}. ${item.topic}`, "", "```json", JSON.stringify(item, null, 2), "```", "");
}

lines.push("## První interpretace", "", "Tento soubor zachycuje raw výsledky a základní metriky. Detailní kvalitativní vyhodnocení a rozhodnutí o změnách ranking logic následuje v samostatném evaluation souboru.", "");
await writeFile(outputPath, lines.join("\n"));
console.log(JSON.stringify({ outputPath, topics: topics.length, successful: successful.length, supportingCount, diversityCount, noEvidenceCount, withSupporting, identicalPrimary, avgLatency }));
