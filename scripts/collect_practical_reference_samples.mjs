import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED_PATH = path.join(ROOT, "data", "normalized", "design-reference-source-seeds.json");
const OUT_ROOT = path.join(ROOT, "data", "reference-samples", "practical");
const INDEX_PATH = path.join(OUT_ROOT, "index.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstMatch(text = "", pattern) {
  const match = String(text || "").match(pattern);
  return match ? String(match[1] || "").trim() : "";
}

function extractMetaDescription(html = "") {
  const source = String(html || "");
  const patterns = [
    /<meta[^>]+name=(["'])description\1[^>]+content=(["'])([\s\S]*?)\2/i,
    /<meta[^>]+content=(["'])([\s\S]*?)\1[^>]+name=(["'])description\3/i,
    /<meta[^>]+property=(["'])og:description\1[^>]+content=(["'])([\s\S]*?)\2/i,
    /<meta[^>]+content=(["'])([\s\S]*?)\1[^>]+property=(["'])og:description\3/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const value = String(match?.[3] || match?.[2] || "").replace(/\s+/g, " ").trim();
    if (value && value !== '"' && value !== "'") return value;
  }
  return "";
}

function normalizeTags(values = []) {
  const map = {
    homepage: "homepage",
    home: "homepage",
    category_plp: "plp",
    collection_page: "plp",
    category_pages: "plp",
    product_listing: "plp",
    product_page: "pdp",
    product_pages: "pdp",
    product_detail: "pdp",
    product_pdp: "pdp",
    cart: "cart",
    checkout: "checkout",
    promo: "promo",
    brand: "brand",
    brand_tone: "brand",
    navigation: "navigation",
    search: "search",
    filters: "filter",
    filter: "filter",
    browse_to_pdp: "navigation",
    pdp_to_cart: "cart",
    cart_to_checkout: "checkout",
    purchase_flow: "checkout",
    onboarding: "navigation",
  };
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => map[String(item || "").trim()] || "").filter(Boolean)));
}

function tagsToPageTypes(tags = []) {
  const pageTypes = [];
  const source = new Set(tags);
  if (source.has("homepage") || source.has("promo") || source.has("brand") || source.has("navigation")) pageTypes.push("home");
  if (source.has("plp") || source.has("search") || source.has("filter")) pageTypes.push("plp");
  if (source.has("pdp")) pageTypes.push("pdp");
  if (source.has("cart")) pageTypes.push("cart");
  if (source.has("checkout")) pageTypes.push("checkout");
  return Array.from(new Set(pageTypes.length ? pageTypes : ["generic"]));
}

function escapeRegex(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsNeedle(corpus = "", needle = "") {
  const normalizedCorpus = String(corpus || "").toLowerCase();
  const normalizedNeedle = String(needle || "").toLowerCase().trim();
  if (!normalizedNeedle) return false;
  if (/^[a-z0-9][a-z0-9\s-&]+$/.test(normalizedNeedle)) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedNeedle).replace(/\\ /g, "\\s+")}([^a-z0-9]|$)`, "i");
    return pattern.test(normalizedCorpus);
  }
  return normalizedCorpus.includes(normalizedNeedle);
}

function inferSampleTags(url = "", text = "", seedTags = []) {
  const corpus = `${String(url || "").toLowerCase()} ${String(text || "").toLowerCase()}`;
  const normalizedUrl = String(url || "").toLowerCase();
  const detected = new Set();
  const tagRules = {
    homepage: ["homepage", "landing page", "home page"],
    plp: ["product list", "product listings", "plp", "category page", "sub-category", "collection", "listing", "browse", "product grid"],
    pdp: ["product page", "product details", "pdp", "item", "spec sheet", "image gallery", "user reviews"],
    cart: ["cart", "shopping cart", "shopping basket", "shopping bag", "added to cart", "added to basket", "added to bag"],
    checkout: [
      "checkout",
      "payment",
      "delivery",
      "shipping",
      "billing",
      "order review",
      "receipt",
      "order confirmation",
      "thank you",
      "guest checkout",
    ],
    search: ["search", "autocomplete", "query suggestions", "predictive search", "typeahead", "no results"],
    filter: ["filter", "faceted", "facet", "sorting", "sort"],
    navigation: ["navigation", "nav", "menu", "drop-down", "dropdown", "mega menu", "my account"],
    promo: ["cross-sell", "upsell", "offer", "sale", "campaign", "promotion", "plan matrix"],
    brand: ["brand", "story", "about", "features page", "how it works"],
  };
  for (const [tag, needles] of Object.entries(tagRules)) {
    if (needles.some((needle) => containsNeedle(corpus, needle))) detected.add(tag);
  }
  for (const tag of Array.isArray(seedTags) ? seedTags : []) {
    if (detected.size >= 3) break;
    if (!detected.has(tag) && containsNeedle(corpus, tag)) detected.add(tag);
  }
  if (!detected.size && /mobbin\.com\/explore(?:[/?#]|$)/.test(normalizedUrl)) {
    return ["homepage", "plp", "pdp", "navigation"];
  }
  return Array.from(detected.size ? detected : new Set(seedTags));
}

function shouldKeepSampleUrl(absolute = "", text = "", host = "") {
  const urlText = String(absolute || "").toLowerCase();
  const labelText = String(text || "").toLowerCase();
  const corpus = `${urlText} ${labelText}`;
  const genericBlocked = [
    "blog",
    "awards",
    "pricing",
    "privacy",
    "terms",
    "changelog",
    "glossary",
    "login",
    "sign up",
    "signup",
    "register",
    "contact",
    "jobs",
    "help",
    "support",
    "cookie",
    "press",
    "newsletter",
  ];
  if (genericBlocked.some((needle) => corpus.includes(needle))) return false;
  if (host.includes("mobbin.com")) {
    return /\/explore(?:[/?#]|$)/.test(urlText);
  }
  if (host.includes("baymard.com")) {
    return (
      /\/ecommerce-design-examples\//.test(urlText) ||
      /\/checkout-usability\/benchmark\//.test(urlText) ||
      /\/homepage-and-category-usability\/benchmark\//.test(urlText) ||
      /\/mcommerce-usability\/benchmark\//.test(urlText) ||
      /\/research\/(checkout-usability|homepage-and-category-usability|ecommerce-search|ecommerce-product-lists|product-page)\b/.test(urlText)
    );
  }
  return true;
}

function scoreLink(url = "", text = "", tags = []) {
  const corpus = `${String(url || "").toLowerCase()} ${String(text || "").toLowerCase()}`;
  let score = 0;
  const ruleMap = {
    homepage: ["home", "homepage", "landing"],
    plp: ["collection", "category", "listing", "browse", "shop"],
    pdp: ["product", "detail", "item"],
    cart: ["cart", "bag", "basket"],
    checkout: ["checkout", "purchase", "payment"],
    search: ["search"],
    filter: ["filter", "facet"],
    navigation: ["nav", "menu", "browse"],
    promo: ["promo", "campaign", "sale", "offer"],
    brand: ["brand", "story", "about"],
  };
  for (const tag of tags) {
    const needles = ruleMap[tag] || [];
    if (needles.some((needle) => containsNeedle(corpus, needle))) score += 10;
  }
  if (/example|examples|flow|screen|pattern/.test(corpus)) score += 4;
  if (/benchmark|annotated|designs|checkout-usability|homepage-and-category-usability|product page|product list/.test(corpus)) score += 6;
  if (/\/explore(?:[/?#]|$)/.test(String(url || "").toLowerCase())) score += 8;
  if (/login|signup|sign-up|register|account/.test(corpus)) score -= 8;
  return score;
}

function extractSampleLinks(html = "", baseUrl = "", normalizedTags = []) {
  const matches = Array.from(String(html || "").matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi));
  const seen = new Set();
  const links = [];
  const baseHost = new URL(baseUrl).hostname;
  for (const match of matches) {
    const href = String(match[2] || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    let absolute;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const absoluteHost = new URL(absolute).hostname;
    if (absoluteHost !== baseHost) continue;
    if (seen.has(absolute)) continue;
    const label = stripHtml(match[3] || "");
    if (!shouldKeepSampleUrl(absolute, label, baseHost)) continue;
    const tags = inferSampleTags(absolute, label, normalizedTags);
    const score = scoreLink(absolute, label, tags);
    if (score < 0) continue;
    seen.add(absolute);
    links.push({
      url: absolute,
      label,
      score,
      tags,
      pageTypes: tagsToPageTypes(tags),
    });
  }
  return links.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url, "en")).slice(0, 20);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; clonellm-practical-reference-collector/1.0)",
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url || url,
    html: text,
  };
}

async function collectOne(seed) {
  const normalizedTags = normalizeTags(seed.collectFor);
  const outputDir = path.join(OUT_ROOT, seed.id);
  ensureDir(outputDir);
  const result = {
    id: seed.id,
    title: seed.name,
    provider: seed.name,
    url: seed.url,
    referenceType: "practical-sample-source",
    sampleClass: seed.sampleClass || "practical",
    bucket: seed.bucket || "practical_ux_pattern",
    priority: Number(seed.priority || 99),
    role: seed.role || "",
    note: seed.note || "",
    collectFor: Array.isArray(seed.collectFor) ? seed.collectFor : [],
    tags: normalizedTags,
    pageTypes: tagsToPageTypes(normalizedTags),
    viewportProfiles: ["pc"],
    recommendedFor: normalizedTags,
    usageNotes: [seed.role || "", seed.note || ""].filter(Boolean),
    collectedAt: new Date().toISOString(),
    fetchStatus: "pending",
    sampleUrls: [],
    htmlPath: "",
  };
  try {
    const fetched = await fetchHtml(seed.url);
    result.fetchStatus = fetched.ok ? "ok" : `http_${fetched.status}`;
    result.title = extractFirstMatch(fetched.html, /<title[^>]*>([\s\S]*?)<\/title>/i) || result.title;
    const description = extractMetaDescription(fetched.html);
    if (description) result.usageNotes = Array.from(new Set([description, ...result.usageNotes])).slice(0, 4);
    const htmlPath = path.join(outputDir, "source.html");
    fs.writeFileSync(htmlPath, fetched.html, "utf-8");
    result.htmlPath = path.relative(ROOT, htmlPath);
    result.sampleUrls = extractSampleLinks(fetched.html, fetched.finalUrl || seed.url, normalizedTags);
  } catch (error) {
    result.fetchStatus = `error:${String(error?.message || error).slice(0, 160)}`;
  }
  return result;
}

async function main() {
  const payload = readJson(SEED_PATH, { entries: [] });
  const seeds = (Array.isArray(payload.entries) ? payload.entries : []).filter(
    (entry) => String(entry.sampleClass || "").trim() === "practical" || String(entry.bucket || "").trim() === "practical_ux_pattern"
  );
  if (!seeds.length) {
    console.error("no practical seeds found");
    process.exit(1);
  }
  ensureDir(OUT_ROOT);
  const entries = [];
  for (const seed of seeds) {
    const entry = await collectOne(seed);
    entries.push(entry);
    console.log(`collected ${entry.id} status=${entry.fetchStatus} samples=${entry.sampleUrls.length}`);
  }
  const output = {
    generatedAt: new Date().toISOString(),
    entries,
  };
  fs.writeFileSync(INDEX_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(`practical reference index updated: ${entries.length} entries`);
}

main().catch((error) => {
  console.error(String(error?.stack || error));
  process.exit(1);
});
