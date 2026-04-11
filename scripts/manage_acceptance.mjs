#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const BASE_URL = process.env.LGE_BASE_URL || "http://localhost:3000";
const USERS_PATH = path.join(ROOT, "data", "runtime", "users.json");
const WORKSPACES_PATH = path.join(ROOT, "data", "runtime", "workspaces.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

function parseArgs(argv) {
  const [command = "list", ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = rest[index + 1] && !rest[index + 1].startsWith("--") ? rest[++index] : "true";
    args[key] = value;
  }
  return args;
}

async function fetchBundles() {
  const response = await fetch(`${BASE_URL}/api/final-acceptance-bundles`);
  if (!response.ok) throw new Error(`bundle_fetch_failed:${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.bundles) ? payload.bundles : [];
}

function getUsers() {
  return readJson(USERS_PATH, { users: [] }).users || [];
}

function getWorkspacesPayload() {
  return readJson(WORKSPACES_PATH, { workspaces: [] });
}

function findUserByLoginId(loginId) {
  const normalized = String(loginId || "").trim().toLowerCase();
  return getUsers().find((item) => String(item.loginId || "").trim().toLowerCase() === normalized) || null;
}

function getWorkspaceByUserId(userId) {
  const payload = getWorkspacesPayload();
  const workspace = (payload.workspaces || []).find((item) => item.userId === userId) || null;
  return { payload, workspace };
}

function ensureWorkspace(user) {
  const payload = getWorkspacesPayload();
  let workspace = (payload.workspaces || []).find((item) => item.userId === user.userId) || null;
  if (!workspace) {
    workspace = {
      userId: user.userId,
      updatedAt: new Date().toISOString(),
      base: "shared-default",
      data: {},
      llmUsageCount: 0,
      workHistory: [],
    };
    payload.workspaces.push(workspace);
    writeJson(WORKSPACES_PATH, payload);
  }
  workspace.data = workspace.data || {};
  workspace.data.acceptanceResults = Array.isArray(workspace.data.acceptanceResults) ? workspace.data.acceptanceResults : [];
  return { payload, workspace };
}

function printList(user, workspace, bundles) {
  const results = new Map((workspace?.data?.acceptanceResults || []).map((item) => [String(item.bundleId || ""), item]));
  console.log(`# Acceptance List`);
  console.log(`- workspaceUser: ${user.loginId}`);
  console.log(`- totalBundles: ${bundles.length}`);
  console.log("");
  for (const bundle of bundles) {
    const item = results.get(String(bundle.bundleId || ""));
    const status = item?.status || "unreviewed";
    console.log(`- ${bundle.bundleId} | page=${bundle.pageId} | status=${status} | compare=${bundle?.review?.compareUrl || ""}`);
    if (item?.note) console.log(`  note: ${item.note}`);
  }
}

function setAcceptance(user, payload, workspace, bundles, args) {
  const bundleId = String(args.bundle || "").trim();
  const status = String(args.status || "").trim().toLowerCase();
  const note = String(args.note || "").trim();
  if (!bundleId) throw new Error("bundle_required");
  if (!["pass", "fail", "pending"].includes(status)) throw new Error("invalid_status");
  if (status === "fail" && !note) throw new Error("fail_note_required");
  const bundle = bundles.find((item) => String(item.bundleId || "") === bundleId);
  if (!bundle) throw new Error(`bundle_not_found:${bundleId}`);
  workspace.data = workspace.data || {};
  workspace.data.acceptanceResults = Array.isArray(workspace.data.acceptanceResults) ? workspace.data.acceptanceResults : [];
  const next = {
    bundleId: bundle.bundleId,
    pageId: bundle.pageId,
    title: bundle.title,
    status,
    note,
    updatedAt: new Date().toISOString(),
  };
  const existingIndex = workspace.data.acceptanceResults.findIndex((item) => String(item.bundleId || "") === bundleId);
  if (existingIndex >= 0) workspace.data.acceptanceResults[existingIndex] = next;
  else workspace.data.acceptanceResults.push(next);
  workspace.updatedAt = next.updatedAt;
  workspace.workHistory = Array.isArray(workspace.workHistory) ? workspace.workHistory : [];
  workspace.workHistory.unshift({
    id: `${Date.now()}-${bundleId}`,
    summary: `acceptance_${status}:${bundleId}`,
    recordedAt: next.updatedAt,
  });
  workspace.workHistory = workspace.workHistory.slice(0, 100);
  writeJson(WORKSPACES_PATH, payload);
  console.log(JSON.stringify({
    ok: true,
    user: user.loginId,
    bundleId,
    status,
    note,
    compareUrl: bundle?.review?.compareUrl || "",
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loginId = String(args["login-id"] || "testuser1").trim();
  const user = findUserByLoginId(loginId);
  if (!user) throw new Error(`login_id_not_found:${loginId}`);
  const bundles = await fetchBundles();
  const { payload, workspace } = ensureWorkspace(user);
  if (args.command === "set") {
    setAcceptance(user, payload, workspace, bundles, args);
    return;
  }
  printList(user, workspace, bundles);
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
