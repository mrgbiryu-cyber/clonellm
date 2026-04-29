import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_TRACE_PATH = path.join(ROOT, "data", "runtime", "route-trace.jsonl");

function parseArgs(argv = []) {
  let tracePath = DEFAULT_TRACE_PATH;
  let limit = 40;
  argv.forEach((arg) => {
    if (arg.startsWith("--limit=")) {
      const nextLimit = Number(arg.slice("--limit=".length));
      if (Number.isFinite(nextLimit) && nextLimit > 0) limit = Math.floor(nextLimit);
      return;
    }
    if (arg.trim()) tracePath = path.resolve(arg);
  });
  return { tracePath, limit };
}

function readTraceEntries(tracePath) {
  if (!fs.existsSync(tracePath)) return [];
  const raw = fs.readFileSync(tracePath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function aggregateEntries(entries = []) {
  const summary = new Map();
  entries.forEach((entry) => {
    const key = [
      String(entry.routeKey || entry.pathname || "").trim(),
      String(entry.resolvedTarget || "").trim(),
      String(entry.method || "").trim(),
      entry.authenticated ? "auth" : "anon",
    ].join(" :: ");
    const current = summary.get(key) || {
      key,
      routeKey: String(entry.routeKey || entry.pathname || "").trim(),
      resolvedTarget: String(entry.resolvedTarget || "").trim(),
      method: String(entry.method || "").trim(),
      authMode: entry.authenticated ? "auth" : "anon",
      count: 0,
      lastSeenAt: "",
      samplePath: String(entry.pathname || "").trim(),
      samplePageId: String(entry.pageId || "").trim(),
      sampleViewportProfile: String(entry.viewportProfile || "").trim(),
    };
    current.count += 1;
    if (String(entry.recordedAt || "").trim() > current.lastSeenAt) current.lastSeenAt = String(entry.recordedAt || "").trim();
    if (!current.samplePageId && entry.pageId) current.samplePageId = String(entry.pageId || "").trim();
    if (!current.sampleViewportProfile && entry.viewportProfile) {
      current.sampleViewportProfile = String(entry.viewportProfile || "").trim();
    }
    summary.set(key, current);
  });
  return [...summary.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return String(right.lastSeenAt || "").localeCompare(String(left.lastSeenAt || ""));
  });
}

function printSection(title, rows = [], limit = 20) {
  console.log(`\n## ${title}`);
  if (!rows.length) {
    console.log("(no entries)");
    return;
  }
  rows.slice(0, limit).forEach((row) => {
    const meta = [
      row.samplePageId ? `page=${row.samplePageId}` : "",
      row.sampleViewportProfile ? `viewport=${row.sampleViewportProfile}` : "",
      row.samplePath ? `path=${row.samplePath}` : "",
      row.lastSeenAt ? `last=${row.lastSeenAt}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    console.log(`- ${row.count}x ${row.routeKey} -> ${row.resolvedTarget} [${row.method}/${row.authMode}]`);
    if (meta) console.log(`  ${meta}`);
  });
}

const { tracePath, limit } = parseArgs(process.argv.slice(2));
const entries = readTraceEntries(tracePath);

console.log(`Trace file: ${tracePath}`);
console.log(`Entries: ${entries.length}`);

if (!entries.length) {
  console.log("No route trace entries recorded yet.");
  process.exit(0);
}

const aggregated = aggregateEntries(entries);
const legacySensitive = aggregated.filter((entry) => {
  return (
    entry.routeKey === "/admin-legacy" ||
    entry.routeKey.startsWith("/api/llm/") ||
    entry.resolvedTarget.startsWith("retired-410:")
  );
});
const mainline = aggregated.filter((entry) => {
  return (
    entry.routeKey === "/admin" ||
    entry.routeKey === "/admin-research" ||
    entry.routeKey.startsWith("/api/workspace/") ||
    entry.routeKey === "/clone/:pageId" ||
    entry.routeKey === "/runtime-draft/:draftBuildId" ||
    entry.routeKey === "/runtime-compare/:draftBuildId"
  );
});

printSection("Top Routes", aggregated, limit);
printSection("Mainline Routes", mainline, limit);
printSection("Legacy-Sensitive Routes", legacySensitive, limit);
