import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const casesPath = path.join(here, "pilot-cases.json");
const endpoint =
  process.env.DEMOSCOPE_API_URL ||
  "https://willschulz.com/demoscope-api/v1/search";
const token = process.env.DEMOSCOPE_API_TOKEN;
const outputPath =
  process.argv[2] || path.join(here, "results", "latest.json");

if (!token) {
  console.error("Set DEMOSCOPE_API_TOKEN without committing or printing it.");
  process.exit(2);
}

const cases = JSON.parse(await fs.readFile(casesPath, "utf8"));
const results = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function automaticAssessment(testCase, body) {
  if (body.weak_match || body.bm25_only || !body.hits?.length) {
    return "suppressed";
  }
  const topText = String(body.hits[0].q_text || "").toLowerCase();
  return testCase.expected_terms.some((term) =>
    topText.includes(term.toLowerCase())
  )
    ? "relevant"
    : "manual_review";
}

for (let index = 0; index < cases.length; index += 1) {
  const testCase = cases[index];
  const started = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: testCase.text, k: 3, min_n: 500 }),
  });

  let body;
  try {
    body = await response.json();
  } catch (_error) {
    body = { error: "non_json_response" };
  }
  const latencyMs = Math.round(performance.now() - started);
  if (!response.ok) {
    results.push({
      id: testCase.id,
      category: testCase.category,
      text: testCase.text,
      status: response.status,
      latency_ms: latencyMs,
      assessment: "error",
      error: body.error || body.detail || "request_failed",
    });
  } else {
    results.push({
      id: testCase.id,
      category: testCase.category,
      text: testCase.text,
      status: response.status,
      latency_ms: latencyMs,
      weak_match: body.weak_match,
      bm25_only: body.bm25_only,
      assessment: automaticAssessment(testCase, body),
      top_hits: body.hits.slice(0, 3),
    });
  }

  if (index < cases.length - 1) await sleep(2100);
}

const summary = {
  cases: results.length,
  relevant: results.filter((result) => result.assessment === "relevant").length,
  suppressed: results.filter((result) => result.assessment === "suppressed")
    .length,
  manual_review: results.filter(
    (result) => result.assessment === "manual_review"
  ).length,
  errors: results.filter((result) => result.assessment === "error").length,
  median_latency_ms: [...results]
    .map((result) => result.latency_ms)
    .sort((a, b) => a - b)[Math.floor(results.length / 2)],
};

const artifact = {
  generated_at: new Date().toISOString(),
  endpoint,
  method:
    "Synthetic post-like statements; server weak-match gate plus a lexical top-hit relevance check. Manual review is still required.",
  summary,
  results,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify(summary));
