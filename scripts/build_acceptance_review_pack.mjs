#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const BASE_URL = process.env.LGE_BASE_URL || "http://localhost:3000";

const USERS_PATH = path.join(ROOT, "data", "runtime", "users.json");
const WORKSPACES_PATH = path.join(ROOT, "data", "runtime", "workspaces.json");
const HOME_LOWER_DIR = path.join(ROOT, "data", "visual", "home-lower");
const SERVICE_INDEX_PATH = path.join(ROOT, "data", "visual", "service-pages", "index.json");
const PLP_INDEX_PATH = path.join(ROOT, "data", "visual", "plp", "index.json");
const OUT_PATH = path.join(ROOT, "docs", "acceptance-review-pack.md");

const BUNDLES = [
  {
    bundleId: "home-core",
    pageId: "home",
    title: "Home Core",
    compareUrl: `${BASE_URL}/compare/home`,
    sections: [],
  },
  {
    bundleId: "home-lower-primary",
    pageId: "home",
    title: "Home Lower Primary",
    compareUrl: `${BASE_URL}/compare/home`,
    sections: ["space-renewal", "subscription", "brand-showroom", "latest-product-news", "smart-life"],
  },
  {
    bundleId: "home-lower-secondary",
    pageId: "home",
    title: "Home Lower Secondary",
    compareUrl: `${BASE_URL}/compare/home`,
    sections: ["summary-banner-2", "missed-benefits", "lg-best-care", "bestshop-guide"],
  },
  {
    bundleId: "support-pcmo",
    pageId: "support",
    title: "Support PC/MO",
    compareUrl: `${BASE_URL}/compare/support`,
  },
  {
    bundleId: "bestshop-pcmo",
    pageId: "bestshop",
    title: "Bestshop PC/MO",
    compareUrl: `${BASE_URL}/compare/bestshop`,
  },
  {
    bundleId: "care-solutions-pcmo",
    pageId: "care-solutions",
    title: "Care Solutions PC/MO",
    compareUrl: `${BASE_URL}/compare/care-solutions`,
  },
  {
    bundleId: "category-tvs-pcmo",
    pageId: "category-tvs",
    title: "Category TVs PC/MO",
    compareUrl: `${BASE_URL}/compare/category-tvs`,
  },
  {
    bundleId: "category-refrigerators-pcmo",
    pageId: "category-refrigerators",
    title: "Category Refrigerators PC/MO",
    compareUrl: `${BASE_URL}/compare/category-refrigerators`,
  },
];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function pickWorkspace() {
  const users = readJson(USERS_PATH, { users: [] }).users || [];
  const workspaces = readJson(WORKSPACES_PATH, { workspaces: [] }).workspaces || [];
  const workspace = [...workspaces].sort((left, right) => {
    const leftCount = (left?.data?.acceptanceResults || []).length;
    const rightCount = (right?.data?.acceptanceResults || []).length;
    return rightCount - leftCount;
  })[0] || null;
  if (!workspace) return { user: null, workspace: null };
  const user = users.find((item) => item.userId === workspace.userId) || null;
  return { user, workspace };
}

function normalizeAcceptanceMap(workspace) {
  const items = workspace?.data?.acceptanceResults || [];
  return new Map(items.map((item) => [String(item.bundleId || ""), item]));
}

function readServiceArtifacts() {
  const payload = readJson(SERVICE_INDEX_PATH, {});
  const captures = Array.isArray(payload?.captures) ? payload.captures : [];
  const map = new Map();
  for (const item of captures) {
    const pageId = String(item?.pageId || "");
    const profile = String(item?.viewportProfile || "");
    const sourceType = String(item?.sourceType || "");
    if (!pageId || !profile || !sourceType) continue;
    const key = `${pageId}:${profile}:${sourceType}`;
    map.set(key, item?.artifact || null);
  }
  return map;
}

function readPlpArtifacts() {
  const payload = readJson(PLP_INDEX_PATH, {});
  const captures = Array.isArray(payload?.captures) ? payload.captures : [];
  const map = new Map();
  for (const item of captures) {
    const pageId = String(item?.pageId || "");
    const profile = String(item?.viewportProfile || "");
    const sourceType = String(item?.sourceType || "");
    if (!pageId || !profile || !sourceType) continue;
    const key = `${pageId}:${profile}:${sourceType}`;
    map.set(key, item?.artifact || null);
  }
  return map;
}

function buildHomeSectionArtifacts(slotId) {
  const dir = path.join(HOME_LOWER_DIR, slotId);
  return {
    liveReference: path.join(dir, "live-reference.png"),
    working: path.join(dir, "working.png"),
    metadata: path.join(dir, "metadata.json"),
  };
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function bundleArtifacts(bundle, serviceMap, plpMap) {
  if (bundle.pageId === "home" && bundle.sections?.length) {
    return bundle.sections.map((slotId) => ({
      slotId,
      artifacts: buildHomeSectionArtifacts(slotId),
    }));
  }
  if (bundle.pageId === "home") return [];
  const sourceMap = bundle.pageId.startsWith("category-") ? plpMap : serviceMap;
  return ["pc", "mo"].map((profile) => ({
    profile,
    reference: sourceMap.get(`${bundle.pageId}:${profile}:reference`) || null,
    working: sourceMap.get(`${bundle.pageId}:${profile}:working`) || null,
  }));
}

function renderBundle(bundle, acceptanceMap, serviceMap, plpMap) {
  const recorded = acceptanceMap.get(bundle.bundleId);
  const status = recorded?.status || "unreviewed";
  const lines = [];
  lines.push(`## ${bundle.title}`);
  lines.push("");
  lines.push(`- bundleId: \`${bundle.bundleId}\``);
  lines.push(`- pageId: \`${bundle.pageId}\``);
  lines.push(`- status: \`${status}\``);
  if (recorded?.note) lines.push(`- note: ${recorded.note}`);
  lines.push(`- compare: \`${bundle.compareUrl}\``);
  lines.push("");
  const artifacts = bundleArtifacts(bundle, serviceMap, plpMap);
  if (bundle.pageId === "home" && bundle.sections?.length) {
    lines.push("### Section Artifacts");
    lines.push("");
    for (const item of artifacts) {
      lines.push(`- \`${item.slotId}\``);
      lines.push(`  live: \`${item.artifacts.liveReference}\`${fileExists(item.artifacts.liveReference) ? "" : " (missing)"}`);
      lines.push(`  working: \`${item.artifacts.working}\`${fileExists(item.artifacts.working) ? "" : " (missing)"}`);
      lines.push(`  metadata: \`${item.artifacts.metadata}\`${fileExists(item.artifacts.metadata) ? "" : " (missing)"}`);
    }
    lines.push("");
    return lines.join("\n");
  }
  if (bundle.pageId === "home") {
    lines.push("### Compare Entry");
    lines.push("");
    lines.push("- Use the page compare and acceptance bundle in `/admin`.");
    lines.push("");
    return lines.join("\n");
  }
  lines.push("### Page Artifacts");
  lines.push("");
  for (const item of artifacts) {
    lines.push(`- \`${item.profile}\``);
    lines.push(`  reference: \`${item.reference?.screenshotPath || ""}\`${item.reference?.screenshotPath && fileExists(item.reference.screenshotPath) ? "" : " (missing)"}`);
    lines.push(`  working: \`${item.working?.screenshotPath || ""}\`${item.working?.screenshotPath && fileExists(item.working.screenshotPath) ? "" : " (missing)"}`);
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const { user, workspace } = pickWorkspace();
  const acceptanceMap = normalizeAcceptanceMap(workspace);
  const serviceMap = readServiceArtifacts();
  const plpMap = readPlpArtifacts();
  const lines = [];
  lines.push("# Acceptance Review Pack");
  lines.push("");
  lines.push(`- generatedAt: \`${new Date().toISOString()}\``);
  lines.push(`- workspaceUser: \`${user?.loginId || "unknown"}\``);
  lines.push(`- baseUrl: \`${BASE_URL}\``);
  lines.push("");
  for (const bundle of BUNDLES) {
    lines.push(renderBundle(bundle, acceptanceMap, serviceMap, plpMap));
  }
  const markdown = `${lines.join("\n")}\n`;
  fs.writeFileSync(OUT_PATH, markdown, "utf-8");
  process.stdout.write(markdown);
}

main();
