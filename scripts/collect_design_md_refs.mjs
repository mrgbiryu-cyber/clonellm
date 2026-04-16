import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = path.join(ROOT, "data", "design-md");
const INDEX_PATH = path.join(OUT_ROOT, "index.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugLoose(input = "") {
  return String(input || "")
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseDesignMdUrl(rawUrl = "") {
  const parsed = new URL(String(rawUrl || "").trim());
  if (String(parsed.hostname || "").toLowerCase() !== "designmd.ai") {
    throw new Error(`unsupported_provider:${parsed.hostname}`);
  }
  const segments = String(parsed.pathname || "")
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`invalid_designmd_url:${rawUrl}`);
  }
  const author = segments[0];
  const slug = segments[1];
  return {
    provider: "designmd.ai",
    author,
    slug,
    url: parsed.toString(),
    downloadUrl: `https://designmd.ai/api/v1/kits/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/download`,
  };
}

async function downloadMarkdown(downloadUrl) {
  const response = await fetch(downloadUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; clonellm-design-md-collector/1.0)",
      accept: "text/markdown,text/plain;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`download_failed:${response.status}:${downloadUrl}`);
  }
  return response.text();
}

function extractFirstMatch(text = "", pattern) {
  const match = String(text || "").match(pattern);
  return match ? String(match[1] || "").trim() : "";
}

function extractAllMatches(text = "", pattern, limit = 24) {
  return Array.from(String(text || "").matchAll(pattern))
    .map((match) => String(match[1] || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseMarkdownSignals(markdown = "") {
  const source = String(markdown || "").replace(/\r\n/g, "\n");
  const title = extractFirstMatch(source, /^#\s+(.+)$/m);
  const sectionTitles = extractAllMatches(source, /^##\s+(.+)$/gm, 24);
  const colors = Array.from(source.matchAll(/#[0-9a-fA-F]{3,8}/g))
    .map((match) => String(match[0] || "").trim())
    .filter(Boolean);
  const componentHints = extractAllMatches(
    source,
    /-\s+\*\*([^*]+)\*\*\s*:\s*(.+)$/gm,
    32
  ).map((line) => line.split(":")[0].trim());
  const overview = source
    .split(/^##\s+/m)
    .slice(1, 3)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
  return {
    title,
    sectionTitles,
    colors: Array.from(new Set(colors)).slice(0, 16),
    componentHints: Array.from(new Set(componentHints)).slice(0, 16),
    overview,
  };
}

function deriveStyleSignals(markdown = "", signals = {}) {
  const corpus = `${signals.title || ""} ${signals.overview || ""} ${String(markdown || "").slice(0, 6000)}`.toLowerCase();
  const rules = [
    ["dark", ["dark", "black", "night", "midnight"]],
    ["premium", ["premium", "luxury", "elevated", "refined"]],
    ["editorial", ["editorial", "story", "magazine", "brand narrative"]],
    ["minimal", ["minimal", "clean", "simple", "restraint"]],
    ["bold", ["bold", "expressive", "assertive", "cinematic"]],
    ["warm", ["warm", "amber", "yellow", "orange"]],
    ["cool", ["cool", "blue", "teal", "slate"]],
    ["high-contrast", ["contrast", "high contrast", "dramatic"]],
    ["section-rhythm", ["section", "rhythm", "spacing", "cadence"]],
    ["card-system", ["card", "grid", "list", "carousel"]],
  ];
  return rules.filter(([, needles]) => needles.some((needle) => corpus.includes(needle))).map(([signal]) => signal);
}

function inferPageTypes(signals = {}) {
  const corpus = `${signals.title || ""} ${(signals.sectionTitles || []).join(" ")} ${(signals.componentHints || []).join(" ")}`.toLowerCase();
  const pageTypes = ["generic"];
  if (/hero|banner|section|brand|story|home/.test(corpus)) pageTypes.unshift("home");
  if (/product|detail|gallery|price|qna|review/.test(corpus)) pageTypes.unshift("pdp");
  if (/support|service|guide|faq|help/.test(corpus)) pageTypes.unshift("support");
  return Array.from(new Set(pageTypes));
}

function buildEntry(meta, markdown, signals) {
  const id = `${meta.provider}-${meta.author}-${meta.slug}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const pageTypes = inferPageTypes(signals);
  const collectFor = Array.from(
    new Set(
      pageTypes.flatMap((pageType) => {
        if (pageType === "home") return ["homepage", "promo", "brand"];
        if (pageType === "pdp") return ["product_pdp", "brand", "promo"];
        if (pageType === "support") return ["navigation", "search", "brand"];
        return ["brand"];
      })
    )
  );
  return {
    id,
    title: signals.title || `${meta.author} / ${meta.slug}`,
    provider: meta.provider,
    url: meta.url,
    downloadUrl: meta.downloadUrl,
    referenceType: "design-md",
    sampleClass: "system-reference",
    bucket: "design_md",
    pageTypes,
    viewportProfiles: ["pc", "ta", "mo"],
    collectFor,
    styleSignals: deriveStyleSignals(markdown, signals),
    recommendedFor: Array.from(new Set((signals.componentHints || []).slice(0, 8))),
    usageNotes: signals.overview ? [signals.overview.slice(0, 240)] : [],
    markdownPath: path.join("data", "design-md", meta.author, `${meta.slug}.md`),
    sectionTitles: signals.sectionTitles || [],
    colorCount: (signals.colors || []).length,
    componentCount: (signals.componentHints || []).length,
    collectedAt: new Date().toISOString(),
  };
}

function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  } catch {
    return { generatedAt: null, entries: [] };
  }
}

function writeIndex(entries = []) {
  ensureDir(path.dirname(INDEX_PATH));
  fs.writeFileSync(
    INDEX_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`,
    "utf-8"
  );
}

async function collectOne(rawUrl) {
  const meta = parseDesignMdUrl(rawUrl);
  const markdown = await downloadMarkdown(meta.downloadUrl);
  const signals = parseMarkdownSignals(markdown);
  const entry = buildEntry(meta, markdown, signals);
  const outputDir = path.join(OUT_ROOT, meta.author);
  ensureDir(outputDir);
  fs.writeFileSync(path.join(outputDir, `${meta.slug}.md`), markdown, "utf-8");
  return entry;
}

async function main() {
  const urls = process.argv.slice(2).map((item) => String(item || "").trim()).filter(Boolean);
  if (!urls.length) {
    console.error("usage: node scripts/collect_design_md_refs.mjs <designmd-url> [more-urls...]");
    process.exit(1);
  }
  const current = readIndex();
  const nextEntries = Array.isArray(current.entries) ? [...current.entries] : [];
  const byKey = new Map(nextEntries.map((entry) => [String(entry.id || entry.url || ""), entry]));
  for (const rawUrl of urls) {
    const entry = await collectOne(rawUrl);
    byKey.set(String(entry.id || entry.url), entry);
    console.log(`collected ${entry.id} -> ${entry.markdownPath}`);
  }
  const merged = Array.from(byKey.values()).sort((a, b) =>
    String(a.title || a.id || "").localeCompare(String(b.title || b.id || ""), "en")
  );
  writeIndex(merged);
  console.log(`design-md index updated: ${merged.length} entries`);
}

main().catch((error) => {
  console.error(String(error?.stack || error));
  process.exit(1);
});
