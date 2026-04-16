import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_JSON_PATH = path.join(ROOT, "data", "normalized", "artifact-sidecar-audit.json");
const OUT_MD_PATH = path.join(ROOT, "data", "normalized", "artifact-sidecar-audit.md");
const COOKIE_NAME = "lge_workspace_session";

const PAGE_TARGETS = [
  ["home", "pc"],
  ["home", "ta"],
  ["support", "pc"],
  ["bestshop", "pc"],
  ["care-solutions", "pc"],
  ["care-solutions-pdp", "pc"],
  ["homestyle-home", "pc"],
  ["homestyle-pdp", "pc"],
  ["category-tvs", "pc"],
  ["category-refrigerators", "pc"],
  ["pdp-tv-general", "pc"],
  ["pdp-tv-premium", "pc"],
  ["pdp-refrigerator-general", "pc"],
  ["pdp-refrigerator-knockon", "pc"],
  ["pdp-refrigerator-glass", "pc"],
];

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    result[key] = value;
  }
  return result;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function computeStatus(summary) {
  if (summary.sectionCount === 0) return "fail";
  if (summary.missingReferenceMarkupCount === 0 && summary.missingReferenceGeometryCount === 0) return "pass";
  if (summary.referenceMarkupCount >= Math.max(1, Math.floor(summary.sectionCount / 2)) && summary.referenceGeometryCount >= Math.max(1, summary.sectionCount - 1)) {
    return "warning";
  }
  return "fail";
}

function buildMarkdownReport(payload) {
  const lines = [];
  lines.push("# Artifact Sidecar Audit");
  lines.push("");
  lines.push(`generatedAt: ${payload.generatedAt}`);
  lines.push(`baseUrl: ${payload.baseUrl}`);
  lines.push("");
  lines.push("| pageId | viewport | sections | markup | refRect | workRect | status |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | --- |");
  for (const item of payload.results) {
    lines.push(`| ${item.pageId} | ${item.viewportProfile} | ${item.sectionCount} | ${item.referenceMarkupCount} | ${item.referenceGeometryCount} | ${item.workingGeometryCount} | ${item.status} |`);
  }
  lines.push("");
  for (const item of payload.results.filter((entry) => entry.status !== "pass")) {
    lines.push(`## ${item.pageId} (${item.viewportProfile})`);
    lines.push("");
    lines.push(`- status: ${item.status}`);
    lines.push(`- missingReferenceMarkupCount: ${item.missingReferenceMarkupCount}`);
    lines.push(`- missingReferenceGeometryCount: ${item.missingReferenceGeometryCount}`);
    if (item.weakSections.length) {
      lines.push(`- weakSections: ${item.weakSections.map((section) => section.slotId).join(", ")}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = String(args.token || "").trim();
  const baseUrl = String(args.baseUrl || "http://127.0.0.1:3000").replace(/\/+$/, "");
  if (!token) {
    throw new Error("--token is required");
  }

  const results = [];
  for (const [pageId, viewportProfile] of PAGE_TARGETS) {
    const url = `${baseUrl}/api/workspace/artifact-sidecar-registry?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`;
    const response = await fetch(url, {
      headers: {
        cookie: `${COOKIE_NAME}=${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`artifact-sidecar-registry failed ${pageId}:${viewportProfile} -> HTTP ${response.status}`);
    }
    const payload = await response.json();
    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    const weakSections = sections
      .filter((section) => !section?.sourceFidelity?.hasReferenceMarkup || !section?.sourceFidelity?.hasReferenceMeasurement)
      .map((section) => ({
        slotId: section.slotId,
        label: section.label,
        hasReferenceMarkup: Boolean(section?.sourceFidelity?.hasReferenceMarkup),
        hasReferenceMeasurement: Boolean(section?.sourceFidelity?.hasReferenceMeasurement),
        selectorHints: Array.isArray(section?.artifact?.selectorHints) ? section.artifact.selectorHints : [],
        extractStatus: section?.artifact?.extractStatus || null,
      }));
    const summary = {
      pageId,
      viewportProfile,
      sectionCount: sections.length,
      referenceMarkupCount: sections.filter((section) => section?.sourceFidelity?.hasReferenceMarkup).length,
      referenceGeometryCount: sections.filter((section) => section?.sourceFidelity?.hasReferenceMeasurement).length,
      workingGeometryCount: sections.filter((section) => section?.sourceFidelity?.hasWorkingMeasurement).length,
    };
    summary.missingReferenceMarkupCount = summary.sectionCount - summary.referenceMarkupCount;
    summary.missingReferenceGeometryCount = summary.sectionCount - summary.referenceGeometryCount;
    summary.status = computeStatus(summary);
    summary.weakSections = weakSections;
    results.push(summary);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    results,
  };
  ensureDir(path.dirname(OUT_JSON_PATH));
  fs.writeFileSync(OUT_JSON_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUT_MD_PATH, buildMarkdownReport(output), "utf8");
  console.log(JSON.stringify({ outJson: OUT_JSON_PATH, outMd: OUT_MD_PATH, pageCount: results.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
