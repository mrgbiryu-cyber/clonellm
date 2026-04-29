#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, "..");
const USERS_PATH = path.join(ROOT, "data", "runtime", "users.json");
const SESSIONS_PATH = path.join(ROOT, "data", "runtime", "sessions.json");
const SOURCE_AUDIT_PATH = path.join(ROOT, "data", "normalized", "admin-design-target-audit-final.json");
const OUTPUT_JSON = path.join(ROOT, "data", "normalized", "asset-authoring-contract-audit.json");
const OUTPUT_MD = path.join(ROOT, "data", "normalized", "asset-authoring-contract-audit.md");
const FALLBACK_POLICIES_PATH = path.join(ROOT, "data", "normalized", "asset-fallback-policies.json");
const DEFAULT_BASE_URL = process.env.ASSET_AUTHORING_AUDIT_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_LOGIN_ID = process.env.ASSET_AUTHORING_AUDIT_LOGIN_ID || "mrgbiryu";
const COOKIE_NAME = "lge_workspace_session";
const { resolveAssetRegistryCardsForSection } = require("../design-pipeline/asset-registry");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function parseArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "").trim();
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function splitList(value = "") {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function findSessionToken(loginId) {
  const users = readJson(USERS_PATH, { users: [] }).users || [];
  const sessions = readJson(SESSIONS_PATH, { sessions: [] }).sessions || [];
  const user = users.find((item) => String(item?.loginId || "").trim() === loginId);
  if (!user) throw new Error(`user_not_found:${loginId}`);
  const session = sessions
    .filter((item) => item.userId === user.userId)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))[0];
  if (!session?.token) throw new Error(`session_not_found:${loginId}`);
  return session.token;
}

async function apiFetch({ baseUrl, token, pathname }) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Cookie: `${COOKIE_NAME}=${token}` },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`api_failed:${response.status}:${pathname}:${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

function countStatus(items = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const status = String(item?.status || "unknown").trim() || "unknown";
    acc[status] = Number(acc[status] || 0) + 1;
    return acc;
  }, {});
}

function normalizeScopeToken(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function readFallbackPolicies() {
  const payload = readJson(FALLBACK_POLICIES_PATH, { policies: [] });
  return Array.isArray(payload.policies) ? payload.policies : [];
}

function resolveFallbackPolicy(slotId = "", policies = []) {
  const normalizedSlot = normalizeScopeToken(slotId);
  return policies.find((policy) =>
    (Array.isArray(policy?.targetSlots) ? policy.targetSlots : []).some((item) => normalizeScopeToken(item) === normalizedSlot)
  ) || null;
}

function isCssSafeImageFallback(policy = null) {
  const preferred = String(policy?.preferred || "").trim();
  const fallback = String(policy?.fallback || "").trim();
  const finalFallback = String(policy?.finalFallback || "").trim();
  return preferred === "css-composition" || fallback === "css-composition" || finalFallback === "css-composition";
}

function summarizeSection(section = {}, options = {}) {
  const fallbackPolicies = Array.isArray(options.fallbackPolicies) ? options.fallbackPolicies : [];
  const fallbackPolicy = resolveFallbackPolicy(section.slotId, fallbackPolicies);
  const images = Array.isArray(section?.cards?.images) ? section.cards.images : [];
  const iconFamilies = Array.isArray(section?.cards?.iconFamilies) ? section.cards.iconFamilies : [];
  const interactions = Array.isArray(section?.cards?.interactionComponents) ? section.cards.interactionComponents : [];
  const approvedImages = images.filter((item) => String(item?.status || "").trim() === "approved");
  const candidateImages = images.filter((item) => String(item?.status || "").trim() === "candidate");
  const approvedIconFamilies = iconFamilies.filter((item) => String(item?.status || "").trim() === "approved");
  const approvedInteractions = interactions.filter((item) => String(item?.status || "").trim() === "approved");
  const needs = [];
  const advisories = [];
  if (images.length && !approvedImages.length) {
    if (isCssSafeImageFallback(fallbackPolicy)) {
      advisories.push(`image-css-fallback:${fallbackPolicy?.policyId || "policy"}`);
    } else {
      needs.push("image-approved-missing");
    }
  }
  if ((String(section.slotId || "").toLowerCase().includes("quick") || String(section.slotId || "").toLowerCase().includes("shortcut")) && !approvedIconFamilies.length) {
    needs.push("icon-family-approved-missing");
  }
  return {
    componentId: String(section.componentId || "").trim(),
    slotId: String(section.slotId || "").trim(),
    totalAssets: images.length + iconFamilies.length + interactions.length,
    imageStatus: countStatus(images),
    iconFamilyStatus: countStatus(iconFamilies),
    interactionStatus: countStatus(interactions),
    approvedImages: approvedImages.length,
    candidateImages: candidateImages.length,
    approvedIconFamilies: approvedIconFamilies.length,
    approvedInteractions: approvedInteractions.length,
    needs,
    advisories,
    fallbackPolicyId: String(fallbackPolicy?.policyId || "").trim(),
  };
}

function toMarkdown(report) {
  const lines = [
    "# Asset Authoring Contract Audit",
    "",
    `- GeneratedAt: ${report.generatedAt}`,
    `- BaseUrl: ${report.baseUrl}`,
    `- LoginId: ${report.loginId}`,
    `- Pages: ${report.pages.length}`,
    `- Viewports: ${report.viewports.join(", ")}`,
    "",
    "## Summary",
    "",
    `- Component rows: ${report.summary.componentRows}`,
    `- Rows with any asset cards: ${report.summary.rowsWithAssets}`,
    `- Rows with approved image: ${report.summary.rowsWithApprovedImage}`,
    `- Rows with approved icon family: ${report.summary.rowsWithApprovedIconFamily}`,
    `- Rows with approved interaction: ${report.summary.rowsWithApprovedInteraction}`,
    `- Rows needing review: ${report.summary.rowsNeedingReview}`,
    "",
    "## Page Coverage",
    "",
    "| page | viewport | components | assets | approved image | approved icon | approved interaction | review |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  report.pages.forEach((page) => {
    page.viewports.forEach((viewport) => {
      lines.push(`| ${page.pageId} | ${viewport.viewportProfile} | ${viewport.componentCount} | ${viewport.rowsWithAssets} | ${viewport.rowsWithApprovedImage} | ${viewport.rowsWithApprovedIconFamily} | ${viewport.rowsWithApprovedInteraction} | ${viewport.rowsNeedingReview} |`);
    });
  });
  lines.push("");
  lines.push("## Review Targets");
  lines.push("");
  report.reviewTargets.slice(0, 120).forEach((item) => {
    lines.push(`- ${item.pageId}/${item.viewportProfile}/${item.slotId}: ${item.needs.join(", ")}`);
  });
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL).replace(/\/$/, "");
  const loginId = String(args.login || args["login-id"] || DEFAULT_LOGIN_ID).trim();
  const viewports = splitList(args.viewports || "pc,mo");
  const outputJson = path.resolve(ROOT, args.output || OUTPUT_JSON);
  const outputMd = path.resolve(ROOT, args["output-md"] || OUTPUT_MD);
  const useApi = args.api === true || String(args.api || "").trim() === "1";
  const token = useApi ? findSessionToken(loginId) : "";
  const sourceAudit = readJson(SOURCE_AUDIT_PATH, { results: [] });
  const fallbackPolicies = readFallbackPolicies();
  const auditRows = Array.isArray(sourceAudit.results) ? sourceAudit.results : [];
  const pageIds = Array.from(new Set(
    auditRows.map((row) => String(row?.pageId || "").trim()).filter(Boolean)
  ));
  const pages = [];
  const reviewTargets = [];
  for (const pageId of pageIds) {
    const page = { pageId, viewports: [] };
    for (const viewportProfile of viewports) {
      const sourceRow = auditRows.find((row) =>
        String(row?.pageId || "").trim() === pageId &&
        String(row?.viewportProfile || "").trim() === viewportProfile
      ) || null;
      const registry = useApi
        ? await apiFetch({
            baseUrl,
            token,
            pathname: `/api/workspace/asset-registry-cards?pageId=${encodeURIComponent(pageId)}&viewportProfile=${encodeURIComponent(viewportProfile)}&includeEmpty=1`,
          })
        : null;
      const sourceSections = useApi
        ? (Array.isArray(registry?.sections) ? registry.sections : [])
        : (Array.isArray(sourceRow?.editableSlots) ? sourceRow.editableSlots.map((slotId) => ({
            slotId,
            componentId: `${pageId}.${slotId}`,
          })) : []);
      const sections = sourceSections.map((section) => {
        const slotId = String(section?.slotId || String(section?.componentId || "").split(".").pop() || "").trim();
        const componentId = String(section?.componentId || `${pageId}.${slotId}`).trim();
        const cards = section?.cards && typeof section.cards === "object"
          ? section.cards
          : resolveAssetRegistryCardsForSection({ pageId, slotId, componentId, viewportProfile });
        return summarizeSection({ ...section, slotId, componentId, cards }, { fallbackPolicies });
      });
      sections.forEach((section) => {
        if (section.needs.length) reviewTargets.push({ pageId, viewportProfile, slotId: section.slotId, componentId: section.componentId, needs: section.needs });
      });
      page.viewports.push({
        viewportProfile,
        componentCount: sections.length,
        rowsWithAssets: sections.filter((section) => section.totalAssets > 0).length,
        rowsWithApprovedImage: sections.filter((section) => section.approvedImages > 0).length,
        rowsWithApprovedIconFamily: sections.filter((section) => section.approvedIconFamilies > 0).length,
        rowsWithApprovedInteraction: sections.filter((section) => section.approvedInteractions > 0).length,
        rowsNeedingReview: sections.filter((section) => section.needs.length).length,
        sections,
      });
    }
    pages.push(page);
  }
  const allViewports = pages.flatMap((page) => page.viewports);
  const summary = {
    componentRows: allViewports.reduce((sum, viewport) => sum + viewport.componentCount, 0),
    rowsWithAssets: allViewports.reduce((sum, viewport) => sum + viewport.rowsWithAssets, 0),
    rowsWithApprovedImage: allViewports.reduce((sum, viewport) => sum + viewport.rowsWithApprovedImage, 0),
    rowsWithApprovedIconFamily: allViewports.reduce((sum, viewport) => sum + viewport.rowsWithApprovedIconFamily, 0),
    rowsWithApprovedInteraction: allViewports.reduce((sum, viewport) => sum + viewport.rowsWithApprovedInteraction, 0),
    rowsNeedingReview: allViewports.reduce((sum, viewport) => sum + viewport.rowsNeedingReview, 0),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    loginId,
    viewports,
    summary,
    pages,
    reviewTargets,
  };
  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(outputMd, toMarkdown(report), "utf8");
  console.log(JSON.stringify({ ok: true, outputJson, outputMd, summary, reviewTargets: reviewTargets.length }, null, 2));
}

main().catch((error) => {
  console.error(`[asset-audit] failed ${error?.stack || error}`);
  process.exitCode = 1;
});
