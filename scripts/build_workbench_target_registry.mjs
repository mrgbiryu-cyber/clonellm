import fs from "node:fs";
import path from "node:path";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const REPRESENTATIVE_URLS_DIR = path.join(ROOT, "data", "normalized", "representative-urls");
const REPRESENTATIVE_PDPS_PATH = path.join(ROOT, "data", "normalized", "representative-pdps", "index.json");
const OUT_DIR = path.join(ROOT, "data", "normalized", "workbench-targets");
const OUT_FILE = path.join(OUT_DIR, "index.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function readRepresentativeUrlSets() {
  if (!fs.existsSync(REPRESENTATIVE_URLS_DIR)) return [];
  return fs
    .readdirSync(REPRESENTATIVE_URLS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => readJson(path.join(REPRESENTATIVE_URLS_DIR, name)));
}

function buildPlpTargets(representativeSets) {
  return representativeSets.map((set) => ({
    targetId: `plp:${set.pageId}:${set.viewportProfile}`,
    targetType: "plp",
    pageId: set.pageId,
    viewportProfile: set.viewportProfile,
    sourceUrl: set.url,
    title: set.title,
    representativeCount: set.selectedCount || 0,
    representativeProducts: (set.representativeProducts || []).map((item, index) => ({
      order: index + 1,
      href: item.href || "",
      pathname: item.pathname || "",
      text: item.text || "",
      rect: item.rect || null,
    })),
  }));
}

function applyPlpFallbacks(targets) {
  const byKey = new Map(targets.map((item) => [`${item.pageId}:${item.viewportProfile}`, item]));
  return targets.map((target) => {
    if (target.representativeCount > 0) return target;
    if (target.viewportProfile !== "mo") return target;
    const pcTarget = byKey.get(`${target.pageId}:pc`);
    if (!pcTarget || pcTarget.representativeCount === 0) return target;
    return {
      ...target,
      representativeCount: pcTarget.representativeCount,
      representativeProducts: pcTarget.representativeProducts.map((item) => ({
        ...item,
        fallbackFromViewportProfile: "pc",
      })),
      fallbackFromViewportProfile: "pc",
      fallbackReason: "mobile representative extraction returned empty set",
    };
  });
}

function buildPdpTargets(pdpIndex) {
  const grouped = new Map();
  for (const item of pdpIndex.pdps || []) {
    const key = `${item.pageId}:${item.viewportProfile}`;
    const current = grouped.get(key) || [];
    current.push(item);
    grouped.set(key, current);
  }
  return Array.from(grouped.entries()).map(([key, products]) => {
    const [pageId, viewportProfile] = key.split(":");
    return {
      targetId: `pdp:${pageId}:${viewportProfile}`,
      targetType: "pdp",
      pageId,
      viewportProfile,
      representativeCount: products.length,
      fallbackUsed: products.some((item) => item.fallbackFromViewportProfile),
      representativeProducts: products.map((item, index) => ({
        order: index + 1,
        href: item.href,
        pathname: item.pathname,
        text: item.text,
        family: item.family,
        fallbackFromViewportProfile: item.fallbackFromViewportProfile || null,
      })),
    };
  });
}

function main() {
  const representativeSets = readRepresentativeUrlSets();
  const pdpIndex = fs.existsSync(REPRESENTATIVE_PDPS_PATH) ? readJson(REPRESENTATIVE_PDPS_PATH) : { pdps: [] };

  const plpTargets = applyPlpFallbacks(buildPlpTargets(representativeSets));
  const pdpTargets = buildPdpTargets(pdpIndex);

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      representativeUrlsDir: REPRESENTATIVE_URLS_DIR,
      representativePdpsPath: REPRESENTATIVE_PDPS_PATH,
    },
    plpTargets,
    pdpTargets,
  };

  writeJson(OUT_FILE, output);
  console.log(
    JSON.stringify(
      {
        out: OUT_FILE,
        plpTargetCount: plpTargets.length,
        pdpTargetCount: pdpTargets.length,
      },
      null,
      2
    )
  );
}

main();
