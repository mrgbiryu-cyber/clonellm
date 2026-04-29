import fs from "node:fs";
import process from "node:process";

const BASE_URL = String(process.env.OPENWEBUI_BUILDER_BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const TOKEN = String(process.env.OPENWEBUI_BUILDER_SERVICE_TOKEN || "dev-openwebui-builder-token");
const SAMPLE_PATH = String(process.env.OPENWEBUI_BUILDER_SAMPLE || "data/normalized/sample-openwebui-builder-request-v1.json");

function requestHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
    "X-OpenWebUI-User-Id": "owui-smoke-user",
    "X-OpenWebUI-Project-Id": "owui-smoke-project",
    "X-OpenWebUI-Request-Id": `owui-smoke-${Date.now()}`,
    ...extra,
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}: ${JSON.stringify(payload).slice(0, 1000)}`);
  return payload;
}

async function waitForJob(jobId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    const job = await requestJson(`${BASE_URL}/api/builder/lge/v1/jobs/${encodeURIComponent(jobId)}`, {
      headers: requestHeaders(),
    });
    if (job.status === "done") return job;
    if (job.status === "failed") throw new Error(`Builder job failed: ${JSON.stringify(job).slice(0, 2000)}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for job: ${jobId}`);
}

async function checkHtml(url, label) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed HTTP ${response.status}: ${text.slice(0, 500)}`);
  if (!text.includes("<html") && !text.includes("<!doctype")) throw new Error(`${label} did not return HTML`);
  return { status: response.status, bytes: Buffer.byteLength(text) };
}

async function main() {
  const created = await requestJson(`${BASE_URL}/api/builder/lge/v1/draft`, {
    method: "POST",
    headers: requestHeaders(),
    body: fs.readFileSync(SAMPLE_PATH, "utf8"),
  });
  if (created.status !== "queued") throw new Error(`Expected queued job, got: ${created.status}`);
  const job = await waitForJob(created.jobId);
  const preview = await checkHtml(`${BASE_URL}${job.previewPath}`, "preview");
  const compare = await checkHtml(`${BASE_URL}${job.comparePath}`, "compare");
  const ack = await requestJson(`${BASE_URL}/api/builder/lge/v1/jobs/${encodeURIComponent(created.jobId)}/ack`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({ stored: true }),
  });
  console.log(JSON.stringify({
    ok: true,
    jobId: created.jobId,
    builderRunId: job.builderRunId,
    preview,
    compare,
    acknowledged: ack.acknowledged === true,
    previewUrl: `${BASE_URL}${job.previewPath}`,
    compareUrl: `${BASE_URL}${job.comparePath}`,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
