#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const USERS_PATH = path.join(ROOT, "data", "runtime", "users.json");
const DEFAULT_BASE_URL = process.env.COMPOSE_DRAFT_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_LOGIN_ID = process.env.COMPOSE_DRAFT_LOGIN_ID || "mrgbiryu";

const { findDraftBuildById, saveDraftBuild } = require("../auth");
const { renderRuntimeDraft } = require("../design-pipeline");

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

function uniqueBy(values = [], keyFn = (item) => item) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = String(keyFn(value) || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function findUserByLoginId(loginId = "") {
  const users = readJson(USERS_PATH, { users: [] }).users || [];
  return users.find((item) => String(item?.loginId || "").trim() === loginId) || null;
}

function getAuthoredPackage(draft = {}) {
  return draft?.snapshotData?.authoredSectionHtmlPackage && typeof draft.snapshotData.authoredSectionHtmlPackage === "object"
    ? draft.snapshotData.authoredSectionHtmlPackage
    : draft?.authoredSectionHtmlPackage && typeof draft.authoredSectionHtmlPackage === "object"
      ? draft.authoredSectionHtmlPackage
      : null;
}

function getReferencePageShell(drafts = []) {
  for (const draft of drafts) {
    const shell = draft?.snapshotData?.referencePageShell;
    if (shell && typeof shell === "object" && String(shell.rawShellHtml || "").trim()) return shell;
    const beforeHtml = String(draft?.snapshotData?.renderedHtmlReference?.beforeHtml || "").trim();
    if (shell && typeof shell === "object" && beforeHtml) {
      return {
        ...shell,
        rawShellHtml: beforeHtml,
        currentPageHtmlExcerpt: beforeHtml,
      };
    }
    if (beforeHtml) {
      return {
        pageId: String(draft?.pageId || "").trim(),
        viewportProfile: String(draft?.viewportProfile || "pc").trim() || "pc",
        rawShellHtml: beforeHtml,
        currentPageHtmlExcerpt: beforeHtml,
      };
    }
  }
  return null;
}

function summarizeProviderMeta(drafts = []) {
  return drafts.map((draft) => ({
    draftBuildId: String(draft?.id || "").trim(),
    providerMeta: draft?.snapshotData?.designAuthorProviderMeta && typeof draft.snapshotData.designAuthorProviderMeta === "object"
      ? draft.snapshotData.designAuthorProviderMeta
      : {},
  }));
}

function buildMergedPackage({ drafts, pageId, viewportProfile, label }) {
  const packages = drafts.map(getAuthoredPackage).filter(Boolean);
  const sections = uniqueBy(
    packages.flatMap((pkg) => Array.isArray(pkg.sections) ? pkg.sections : []),
    (section) => section?.slotId || section?.componentId
  );
  const componentIds = sections.map((section) => String(section?.componentId || "").trim()).filter(Boolean);
  const slotIds = sections.map((section) => String(section?.slotId || "").trim()).filter(Boolean);
  return {
    ...(packages[0] || {}),
    pageId,
    viewportProfile,
    targetGroup: {
      groupId: "page",
      groupLabel: label,
      componentIds,
      slotIds,
      replacementMode: "main",
      layoutIntent: [
        "Composed from approved batched Design Author drafts.",
        "Preserve authored section order and render through the canonical runtime shell.",
      ],
      boundary: {
        mode: "replace-main",
        preserveOutsideGroup: false,
        entrySlotId: slotIds[0] || "",
        exitSlotId: slotIds[slotIds.length - 1] || "",
      },
    },
    sections,
  };
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function collectRenderedSlots(html = "") {
  return Array.from(new Set(
    Array.from(String(html || "").matchAll(/data-codex-slot="([^"]+)"/g))
      .map((match) => String(match[1] || "").trim())
      .filter(Boolean)
  ));
}

function normalizeSectionHtml(section = {}) {
  const slotId = String(section?.slotId || "").trim();
  const componentId = String(section?.componentId || "").trim();
  const html = String(section?.html || "").trim();
  if (!html) return "";
  if (/^<section\b/i.test(html)) return html;
  const attrs = [
    slotId ? `data-codex-slot="${escapeHtml(slotId)}"` : "",
    componentId ? `data-codex-component-id="${escapeHtml(componentId)}"` : "",
    `data-design-author-source="runtime-authored"`,
  ].filter(Boolean).join(" ");
  return `<section ${attrs}>${html}</section>`;
}

function buildStandaloneComposedHtml({ pageId, viewportProfile, summary, sections }) {
  const body = sections
    .map((section) => normalizeSectionHtml(section))
    .filter(Boolean)
    .join("\n");
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(summary || `${pageId} ${viewportProfile} composed draft`)}</title>
    <style>
      html, body { margin: 0; min-height: 100%; background: #f5f5f5; }
      body { font-family: Pretendard, "Noto Sans KR", Arial, sans-serif; }
      main[data-composed-runtime-main] { max-width: ${viewportProfile === "mo" ? "430px" : "1440px"}; margin: 0 auto; background: #fff; min-height: 100vh; overflow: hidden; }
    </style>
  </head>
  <body data-runtime-page-id="${escapeHtml(pageId)}" data-runtime-viewport-profile="${escapeHtml(viewportProfile)}">
    <main data-composed-runtime-main="true">
${body}
    </main>
  </body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const loginId = String(args.login || args["login-id"] || DEFAULT_LOGIN_ID).trim();
  const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL).replace(/\/$/, "");
  const draftIds = splitList(args.drafts || args["draft-build-ids"] || args.ids || "");
  const label = String(args.label || "composed batched runtime draft").trim();
  const summary = String(args.summary || label).trim();
  const proposedVersionLabel = String(args["version-label"] || label).trim();

  if (!draftIds.length) throw new Error("draft ids required: --drafts id1,id2,id3");
  const user = findUserByLoginId(loginId);
  if (!user?.userId) throw new Error(`user_not_found:${loginId}`);
  const drafts = draftIds.map((id) => {
    const draft = findDraftBuildById(user.userId, id);
    if (!draft) throw new Error(`draft_not_found:${id}`);
    return draft;
  });
  const pageId = String(args.page || drafts[0]?.pageId || "").trim();
  const viewportProfile = String(args.viewport || drafts[0]?.viewportProfile || "pc").trim() || "pc";
  const mismatched = drafts.filter((draft) => String(draft?.pageId || "").trim() !== pageId || String(draft?.viewportProfile || "").trim() !== viewportProfile);
  if (mismatched.length) {
    throw new Error(`draft_scope_mismatch:${mismatched.map((draft) => draft.id).join(",")}`);
  }
  const referencePageShell = getReferencePageShell(drafts);
  if (!referencePageShell) throw new Error("reference_page_shell_missing");
  const authoredSectionHtmlPackage = buildMergedPackage({ drafts, pageId, viewportProfile, label });
  const runtimeResult = renderRuntimeDraft({
    referencePageShell,
    authoredSectionHtmlPackage,
    runtimeContext: {
      composedFromDraftBuildIds: draftIds,
    },
  });
  const expectedSlots = authoredSectionHtmlPackage.sections.map((section) => String(section?.slotId || "").trim()).filter(Boolean);
  const renderedSlots = collectRenderedSlots(runtimeResult.afterHtml);
  const hasAllRenderedSlots = expectedSlots.every((slotId) => renderedSlots.includes(slotId));
  const afterHtml = hasAllRenderedSlots
    ? runtimeResult.afterHtml
    : buildStandaloneComposedHtml({ pageId, viewportProfile, summary, sections: authoredSectionHtmlPackage.sections });
  const now = Date.now();
  const draftItem = {
    ...runtimeResult.draftBuild,
    id: String(args.id || `runtime-draft-composed-${now}`).trim(),
    pageId,
    viewportProfile,
    planId: String(args["plan-id"] || drafts[0]?.planId || "").trim(),
    summary,
    proposedVersionLabel,
    report: {
      ...(runtimeResult.draftBuild?.report && typeof runtimeResult.draftBuild.report === "object" ? runtimeResult.draftBuild.report : {}),
      composedFromDraftBuildIds: draftIds,
      composedRenderMode: hasAllRenderedSlots ? "reference-shell-insert" : "standalone-composed-main",
      authoredSections: authoredSectionHtmlPackage.sections.map((section) => ({
        slotId: String(section?.slotId || "").trim(),
        componentId: String(section?.componentId || "").trim(),
      })),
    },
    snapshotData: {
      ...(runtimeResult.draftBuild?.snapshotData && typeof runtimeResult.draftBuild.snapshotData === "object" ? runtimeResult.draftBuild.snapshotData : {}),
      source: "design-runtime-composed-batched-draft",
      pageId,
      viewportProfile,
      referencePageShell,
      authoredSectionHtmlPackage,
      renderedHtmlReference: {
        beforeHtml: runtimeResult.beforeHtml,
        afterHtml,
      },
      composedFromDraftBuildIds: draftIds,
      composedProviderMeta: summarizeProviderMeta(drafts),
    },
    advisory: [
      ...(Array.isArray(runtimeResult.advisory) ? runtimeResult.advisory : []),
      ...(hasAllRenderedSlots ? [] : ["composed_standalone_after_html"]),
      `composed_from:${draftIds.join(",")}`,
    ],
  };
  const saved = saveDraftBuild(user.userId, draftItem);
  const previewPath = `/runtime-draft/${encodeURIComponent(String(saved?.id || "").trim())}`;
  const comparePath = `/runtime-compare/${encodeURIComponent(String(saved?.id || "").trim())}?viewportProfile=${encodeURIComponent(viewportProfile)}`;
  const result = {
    ok: true,
    loginId,
    pageId,
    viewportProfile,
    draftBuildId: saved.id,
    sourceDraftBuildIds: draftIds,
    sectionSlots: authoredSectionHtmlPackage.sections.map((section) => String(section?.slotId || "").trim()),
    renderMode: hasAllRenderedSlots ? "reference-shell-insert" : "standalone-composed-main",
    previewUrl: `${baseUrl}${previewPath}`,
    compareUrl: `${baseUrl}${comparePath}`,
    advisory: draftItem.advisory,
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
