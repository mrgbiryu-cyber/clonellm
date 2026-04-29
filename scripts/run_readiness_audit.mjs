import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const OUT_JSON = path.join(ROOT, "data", "normalized", "readiness-audit.json");
const OUT_MD = path.join(ROOT, "data", "normalized", "readiness-audit.md");

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

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getTokenForLogin(loginId) {
  const users = readJson(path.join(RUNTIME_DIR, "users.json")).users || [];
  const sessions = readJson(path.join(RUNTIME_DIR, "sessions.json")).sessions || [];
  const user = users.find((item) => item.loginId === loginId);
  if (!user) return null;
  const session = [...sessions].reverse().find((item) => item.userId === user.userId);
  return session?.token || null;
}

async function fetchJson(baseUrl, token, pathname, timeoutMs = 20_000) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      cookie: `lge_workspace_session=${token}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: response.ok, status: response.status, text, json: parsed };
}

function countRepeaters(sections = []) {
  let repeaterCount = 0;
  let itemCount = 0;
  for (const section of sections) {
    for (const region of section?.regions || []) {
      if (region?.repeater) {
        repeaterCount += 1;
        itemCount += Number(region.repeater.itemCount || 0);
      }
    }
  }
  return { repeaterCount, itemCount };
}

function summarizePlanDocs(items = []) {
  const latest = items[0] || null;
  const plan =
    (latest?.output && typeof latest.output === "object" ? latest.output.requirementPlan : null) ||
    latest?.requirementPlan ||
    {};
  return {
    count: items.length,
    latestPlanId: latest?.id || null,
    builderMarkdownLength: String(plan.builderMarkdown || "").trim().length,
    layoutMockupMarkdownLength: String(plan.layoutMockupMarkdown || "").trim().length,
    designSpecMarkdownLength: String(plan.designSpecMarkdown || "").trim().length,
    sectionBlueprintCount: Array.isArray(plan.sectionBlueprints) ? plan.sectionBlueprints.length : 0,
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Readiness Audit");
  lines.push("");
  lines.push(`generatedAt: ${report.generatedAt}`);
  lines.push(`baseUrl: ${report.baseUrl}`);
  lines.push("");
  lines.push("## Account Isolation");
  lines.push("");
  for (const [loginId, summary] of Object.entries(report.accountIsolation)) {
    lines.push(`- ${loginId}: plans=${summary.planCount}, drafts=${summary.draftCount}, versions=${summary.versionCount}`);
  }
  lines.push("");
  lines.push("## Page Summary");
  lines.push("");
  lines.push("| pageId | viewport | clone | sections | repeaters | items | renderable | issues | refs | latestPlanDocs |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const page of report.pages) {
    const docs = page.planDocs;
    const docFlag =
      docs.designSpecMarkdownLength > 0 && docs.sectionBlueprintCount > 0
        ? "latest"
        : docs.count > 0
          ? "legacy"
          : "none";
    lines.push(
      `| ${page.pageId} | ${page.viewportProfile} | ${page.cloneStatus} | ${page.sidecar.sectionCount} | ${page.sidecar.repeaterCount} | ${page.sidecar.totalRepeaterItems} | ${page.builder.renderableComponentCount} | ${page.builder.issueCount} | ${page.references.count} | ${docFlag} |`
    );
  }
  lines.push("");
  lines.push("## Failures / Gaps");
  lines.push("");
  for (const page of report.pages) {
    const findings = [];
    if (page.cloneStatus !== 200) findings.push(`clone ${page.cloneStatus}`);
    if (page.builder.issueCount > 0) findings.push(`builder issues ${page.builder.issueCount}`);
    if (page.planDocs.count > 0 && page.planDocs.designSpecMarkdownLength === 0) findings.push("legacy plan format");
    if (page.sidecar.totalRepeaterItems === 0 && page.sidecar.repeaterCount > 0) findings.push("repeaters without items");
    if (!findings.length) continue;
    lines.push(`### ${page.pageId} (${page.viewportProfile})`);
    for (const finding of findings) {
      lines.push(`- ${finding}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const baseUrl = process.argv[2] || "http://127.0.0.1:3000";
  const mrgbiryuToken = getTokenForLogin("mrgbiryu");
  const codexreviewToken = getTokenForLogin("codexreview");
  if (!mrgbiryuToken || !codexreviewToken) {
    throw new Error("missing tokens for mrgbiryu or codexreview");
  }

  const pages = [];
  for (const [pageId, viewportProfile] of PAGE_TARGETS) {
    const clonePath =
      pageId === "home"
        ? `/clone/${pageId}?viewportProfile=${encodeURIComponent(viewportProfile)}`
        : `/clone/${pageId}`;
    const cloneResp = await fetch(`${baseUrl}${clonePath}`, { signal: AbortSignal.timeout(20_000) });
    const sidecarResp = await fetchJson(
      baseUrl,
      mrgbiryuToken,
      `/api/workspace/artifact-sidecar-registry?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`
    );
    const builderResp = await fetchJson(
      baseUrl,
      mrgbiryuToken,
      `/api/workspace/builder-audit?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`
    );
    const refsResp = await fetchJson(
      baseUrl,
      mrgbiryuToken,
      `/api/workspace/design-reference-library?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`
    );
    const plansResp = await fetchJson(
      baseUrl,
      mrgbiryuToken,
      `/api/workspace/plans?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}`
    );

    const sections = sidecarResp.json?.sections || [];
    const repeaterSummary = countRepeaters(sections);
    const components = builderResp.json?.components || [];
    const issueCount = components.reduce((sum, item) => sum + ((item?.issues || []).length > 0 ? 1 : 0), 0);
    const topRefs = (refsResp.json?.entries || []).slice(0, 5).map((entry) => ({
      id: entry.id,
      score: entry.score,
      identityOverlap: entry.identityOverlap || [],
      sampleClass: entry.sampleClass || null,
    }));

    pages.push({
      pageId,
      viewportProfile,
      cloneStatus: cloneResp.status,
      sidecar: {
        sectionCount: sections.length,
        repeaterCount: repeaterSummary.repeaterCount,
        totalRepeaterItems: repeaterSummary.itemCount,
      },
      builder: {
        renderableComponentCount: Number(builderResp.json?.summary?.renderableComponentCount || 0),
        emptyPatchSchemaCount: Number(builderResp.json?.summary?.emptyPatchSchemaCount || 0),
        issueCount,
      },
      references: {
        count: Number(refsResp.json?.count || 0),
        identitySignals: refsResp.json?.identitySignals || [],
        topEntries: topRefs,
      },
      planDocs: summarizePlanDocs(plansResp.json?.items || []),
    });
  }

  const mrgbiryuPlans = await fetchJson(baseUrl, mrgbiryuToken, "/api/workspace/plans?pageId=home&viewportProfile=pc");
  const mrgbiryuDrafts = await fetchJson(baseUrl, mrgbiryuToken, "/api/workspace/draft-builds?pageId=home&viewportProfile=pc");
  const mrgbiryuVersions = await fetchJson(baseUrl, mrgbiryuToken, "/api/workspace/versions?pageId=home&viewportProfile=pc");
  const codexreviewPlans = await fetchJson(baseUrl, codexreviewToken, "/api/workspace/plans?pageId=home&viewportProfile=pc");
  const codexreviewDrafts = await fetchJson(baseUrl, codexreviewToken, "/api/workspace/draft-builds?pageId=home&viewportProfile=pc");
  const codexreviewVersions = await fetchJson(baseUrl, codexreviewToken, "/api/workspace/versions?pageId=home&viewportProfile=pc");

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    accountIsolation: {
      mrgbiryu: {
        planCount: (mrgbiryuPlans.json?.items || []).length,
        draftCount: (mrgbiryuDrafts.json?.items || []).length,
        versionCount: (mrgbiryuVersions.json?.items || []).length,
      },
      codexreview: {
        planCount: (codexreviewPlans.json?.items || []).length,
        draftCount: (codexreviewDrafts.json?.items || []).length,
        versionCount: (codexreviewVersions.json?.items || []).length,
      },
    },
    pages,
  };

  ensureDir(OUT_JSON);
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUT_MD, buildMarkdown(report), "utf8");
  console.log(JSON.stringify({ outJson: OUT_JSON, outMd: OUT_MD, pageCount: pages.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
