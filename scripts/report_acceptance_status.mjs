#!/usr/bin/env node

import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const USERS_PATH = path.join(ROOT, "data", "runtime", "users.json");
const WORKSPACES_PATH = path.join(ROOT, "data", "runtime", "workspaces.json");
const BASE_URL = process.env.LGE_BASE_URL || "http://localhost:3000";

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const args = { loginId: "", write: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--login-id") args.loginId = String(argv[index + 1] || "").trim();
    if (value === "--write") args.write = String(argv[index + 1] || "").trim();
  }
  return args;
}

async function fetchBundles() {
  const response = await fetch(`${BASE_URL}/api/final-acceptance-bundles`);
  if (!response.ok) {
    throw new Error(`bundle_fetch_failed:${response.status}`);
  }
  return response.json();
}

function pickWorkspace(workspaces, users, loginId) {
  if (loginId) {
    const user = users.find((item) => item.loginId === loginId);
    if (!user) throw new Error(`login_id_not_found:${loginId}`);
    return workspaces.find((item) => item.userId === user.userId) || null;
  }
  return [...workspaces].sort((left, right) => {
    const leftCount = (left?.data?.acceptanceResults || []).length;
    const rightCount = (right?.data?.acceptanceResults || []).length;
    return rightCount - leftCount;
  })[0] || null;
}

function buildReport({ workspace, user, bundlesPayload }) {
  const results = workspace?.data?.acceptanceResults || [];
  const resultMap = new Map(results.map((item) => [String(item.bundleId || ""), item]));
  const bundles = Array.isArray(bundlesPayload?.bundles) ? bundlesPayload.bundles : [];
  const items = bundles.map((bundle) => {
    const recorded = resultMap.get(String(bundle.bundleId || ""));
    return {
      bundleId: bundle.bundleId,
      pageId: bundle.pageId,
      title: bundle.title,
      status: recorded?.status || "unreviewed",
      note: recorded?.note || "",
      updatedAt: recorded?.updatedAt || null,
      compareUrl: bundle?.review?.compareUrl || null,
      itemCount: Array.isArray(bundle.items) ? bundle.items.length : 0,
    };
  });
  const counts = items.reduce((acc, item) => {
    acc[item.status] = Number(acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const next = items.find((item) => item.status === "fail")
    || items.find((item) => item.status === "pending")
    || items.find((item) => item.status === "unreviewed")
    || null;
  return {
    generatedAt: new Date().toISOString(),
    workspaceUser: {
      userId: user?.userId || workspace?.userId || null,
      loginId: user?.loginId || null,
      displayName: user?.displayName || null,
    },
    counts: {
      pass: Number(counts.pass || 0),
      fail: Number(counts.fail || 0),
      pending: Number(counts.pending || 0),
      unreviewed: Number(counts.unreviewed || 0),
      total: items.length,
    },
    nextActionableBundle: next,
    items,
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push("# Acceptance Current State");
  lines.push("");
  lines.push(`- generatedAt: \`${report.generatedAt}\``);
  lines.push(`- workspaceUser: \`${report.workspaceUser.loginId || "unknown"}\``);
  lines.push(`- pass: \`${report.counts.pass}\``);
  lines.push(`- fail: \`${report.counts.fail}\``);
  lines.push(`- pending: \`${report.counts.pending}\``);
  lines.push(`- unreviewed: \`${report.counts.unreviewed}\``);
  lines.push(`- total: \`${report.counts.total}\``);
  lines.push("");
  if (report.nextActionableBundle) {
    lines.push("## Next Actionable Bundle");
    lines.push("");
    lines.push(`- bundleId: \`${report.nextActionableBundle.bundleId}\``);
    lines.push(`- pageId: \`${report.nextActionableBundle.pageId}\``);
    lines.push(`- status: \`${report.nextActionableBundle.status}\``);
    lines.push(`- compare: \`${report.nextActionableBundle.compareUrl || ""}\``);
    lines.push("");
  }
  lines.push("## Bundles");
  lines.push("");
  for (const item of report.items) {
    lines.push(`- \`${item.bundleId}\` | page=\`${item.pageId}\` | status=\`${item.status}\` | items=\`${item.itemCount}\` | compare=\`${item.compareUrl || ""}\``);
    if (item.note) lines.push(`  note: ${item.note}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const users = readJson(USERS_PATH, { users: [] }).users || [];
  const workspaces = readJson(WORKSPACES_PATH, { workspaces: [] }).workspaces || [];
  const workspace = pickWorkspace(workspaces, users, args.loginId);
  if (!workspace) throw new Error("workspace_not_found");
  const user = users.find((item) => item.userId === workspace.userId) || null;
  const bundlesPayload = await fetchBundles();
  const report = buildReport({ workspace, user, bundlesPayload });
  const markdown = toMarkdown(report);
  if (args.write) {
    fs.writeFileSync(path.resolve(ROOT, args.write), `${markdown}\n`, "utf-8");
  }
  process.stdout.write(`${markdown}\n`);
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
