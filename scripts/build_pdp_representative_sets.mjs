import fs from "node:fs";
import path from "node:path";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const IN_DIR = path.join(ROOT, "data", "normalized", "representative-urls");
const OUT_DIR = path.join(ROOT, "data", "normalized", "representative-pdps");
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

function normalizeProducts(payload) {
  const products = Array.isArray(payload.representativeProducts) ? payload.representativeProducts : [];
  return products
    .map((item) => {
      if (typeof item === "string") {
        return { href: item, pathname: "", text: "" };
      }
      return {
        href: item.href || "",
        pathname: item.pathname || "",
        text: item.text || "",
      };
    })
    .filter((item) => item.href);
}

function inferProductFamily(pathname = "") {
  if (pathname.startsWith("/tvs/")) return "tvs";
  if (pathname.startsWith("/refrigerators/")) return "refrigerators";
  return "unknown";
}

function withFallbackSets(sets) {
  const byKey = new Map(sets.map((set) => [`${set.pageId}:${set.viewportProfile}`, set]));
  return sets.map((set) => {
    if (set.selectedCount > 0) return set;
    if (set.viewportProfile !== "mo") return set;
    const pcSet = byKey.get(`${set.pageId}:pc`);
    if (!pcSet || pcSet.selectedCount === 0) return set;
    return {
      ...set,
      fallbackFromViewportProfile: "pc",
      fallbackReason: "mobile representative extraction returned empty set",
      selectedCount: pcSet.selectedCount,
      products: pcSet.products.map((item) => ({ ...item, fallbackFromViewportProfile: "pc" })),
    };
  });
}

function main() {
  ensureDir(OUT_DIR);
  const files = fs
    .readdirSync(IN_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const sets = [];
  for (const file of files) {
    const payload = readJson(path.join(IN_DIR, file));
    const products = normalizeProducts(payload);
    sets.push({
      pageId: payload.pageId,
      viewportProfile: payload.viewportProfile,
      sourceUrl: payload.url,
      selectedCount: products.length,
      products: products.map((item) => ({
        href: item.href,
        pathname: item.pathname,
        text: item.text,
        family: inferProductFamily(item.pathname),
      })),
    });
  }

  const effectiveSets = withFallbackSets(sets);

  const flatProducts = [];
  for (const set of effectiveSets) {
    for (const product of set.products) {
      flatProducts.push({
        pageId: set.pageId,
        viewportProfile: set.viewportProfile,
        href: product.href,
        pathname: product.pathname,
        text: product.text,
        family: product.family,
        fallbackFromViewportProfile: product.fallbackFromViewportProfile || set.fallbackFromViewportProfile || null,
      });
    }
  }

  const deduped = Array.from(
    flatProducts.reduce((acc, item) => {
      const key = `${item.viewportProfile}:${item.href}`;
      if (!acc.has(key)) acc.set(key, item);
      return acc;
    }, new Map()).values()
  );

  const output = {
    generatedAt: new Date().toISOString(),
    sourceDir: IN_DIR,
    setCount: effectiveSets.length,
    pdpCount: deduped.length,
    sets: effectiveSets,
    pdps: deduped,
  };

  writeJson(OUT_FILE, output);
  console.log(JSON.stringify({ out: OUT_FILE, setCount: output.setCount, pdpCount: output.pdpCount }, null, 2));
}

main();
