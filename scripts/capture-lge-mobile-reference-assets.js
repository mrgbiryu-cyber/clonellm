"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const REFERENCE_LIVE_DIR = path.join(ROOT, "data", "raw", "reference-live");
const ASSET_DIR = path.join(ROOT, "data", "raw", "assets");
const REPORT_PATH = path.join(ROOT, "data", "normalized", "lge-mobile-reference-assets.json");
const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DISPLAY_OBJECT_RE = /^https:\/\/www\.lge\.co\.kr\/kr\/upload\/admin\/display\/displayObject\//i;

function hash(value = "") {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}

function pageIdFromFileName(fileName = "") {
  return String(fileName || "").replace(/\.mobile\.html$/i, "").trim() || "unknown";
}

function publicPageUrl(pageId = "") {
  const map = {
    home: "https://www.lge.co.kr/home",
    bestshop: "https://www.lge.co.kr/bestshop",
    support: "https://www.lge.co.kr/support",
    "care-solutions": "https://www.lge.co.kr/care-solutions",
    "care-solutions-pdp": "https://www.lge.co.kr/care-solutions/water-purifiers/wd523vc?dpType=careTab&subscCategoryKeyId=246021",
    "category-tvs": "https://www.lge.co.kr/category/tvs",
    "category-refrigerators": "https://www.lge.co.kr/category/refrigerators",
    "homestyle-home": "https://homestyle.lge.co.kr/home",
    "homestyle-pdp": "https://homestyle.lge.co.kr/item?productId=G26030036505",
  };
  return map[pageId] || `https://www.lge.co.kr/${pageId}`;
}

function decodeHtmlEntities(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeSourceUrl(value = "") {
  const decoded = decodeHtmlEntities(String(value || "").trim());
  if (!decoded) return "";
  try {
    return new URL(decoded, "https://www.lge.co.kr").toString();
  } catch {
    return decoded;
  }
}

function attrValue(tag = "", attrName = "") {
  const pattern = new RegExp(`${attrName}\\s*=\\s*([\"'])(.*?)\\1`, "i");
  const match = tag.match(pattern);
  return match ? decodeHtmlEntities(match[2]) : "";
}

function extractNearbyContext(html = "", index = 0) {
  const start = Math.max(0, index - 700);
  const end = Math.min(html.length, index + 700);
  const text = decodeHtmlEntities(html.slice(start, end))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 500);
}

function extensionFromUrl(sourceUrl = "") {
  try {
    const ext = path.extname(new URL(sourceUrl).pathname).toLowerCase().replace(".", "");
    if (/^(png|jpg|jpeg|gif|webp|svg)$/.test(ext)) return ext;
  } catch {
    // fall through
  }
  const match = String(sourceUrl || "").match(/\.(png|jpg|jpeg|gif|webp|svg)(?:$|[?#])/i);
  return match ? match[1].toLowerCase() : "";
}

function localAssetName(pageId = "", sourceUrl = "") {
  const ext = extensionFromUrl(sourceUrl) || "bin";
  const safePageId = String(pageId || "page").replace(/[^a-z0-9가-힣_-]+/gi, "-").replace(/^-+|-+$/g, "") || "page";
  return `${safePageId}__mo__${hash(sourceUrl)}.${ext}`;
}

function requestUrl(sourceUrl = "", redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error("too_many_redirects"));
      return;
    }
    let url;
    try {
      url = new URL(encodeURI(sourceUrl));
    } catch (error) {
      reject(error);
      return;
    }
    const client = url.protocol === "http:" ? http : https;
    const req = client.get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).toString();
        requestUrl(nextUrl, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`http_${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(30000, () => {
      req.destroy(new Error("request_timeout"));
    });
    req.on("error", reject);
  });
}

async function downloadAsset(pageId = "", sourceUrl = "") {
  const fileName = localAssetName(pageId, sourceUrl);
  const filePath = path.join(ASSET_DIR, fileName);
  if (fs.existsSync(filePath)) return { localPath: filePath, downloaded: false };
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const body = await requestUrl(sourceUrl);
  fs.writeFileSync(filePath, body);
  return { localPath: filePath, downloaded: true };
}

function extractImgRows(filePath = "") {
  const fileName = path.basename(filePath);
  const pageId = pageIdFromFileName(fileName);
  const pageUrl = publicPageUrl(pageId);
  const html = fs.readFileSync(filePath, "utf8");
  const rows = [];
  const seen = new Set();
  const imgRe = /<img\b[^>]*>/gi;
  let match;
  while ((match = imgRe.exec(html))) {
    const tag = match[0];
    const sourceUrl = normalizeSourceUrl(attrValue(tag, "src"));
    if (!DISPLAY_OBJECT_RE.test(sourceUrl)) continue;
    if (!extensionFromUrl(sourceUrl)) continue;
    const key = `${pageId}|${sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      pageId,
      pageUrl,
      viewportProfile: "mo",
      sourceUrl,
      altText: attrValue(tag, "alt"),
      contextText: extractNearbyContext(html, match.index),
      sourceFile: path.relative(ROOT, filePath),
    });
  }
  return rows;
}

async function main() {
  const files = fs.readdirSync(REFERENCE_LIVE_DIR)
    .filter((fileName) => /\.mobile\.html$/i.test(fileName))
    .sort()
    .map((fileName) => path.join(REFERENCE_LIVE_DIR, fileName));
  const rows = files.flatMap(extractImgRows);
  const downloaded = [];
  const failed = [];
  const nextRows = [];
  for (const row of rows) {
    try {
      const result = await downloadAsset(row.pageId, row.sourceUrl);
      downloaded.push({ sourceUrl: row.sourceUrl, localPath: result.localPath, downloaded: result.downloaded });
      nextRows.push({
        ...row,
        localPath: result.localPath,
        localAssetPath: path.relative(ROOT, result.localPath),
      });
    } catch (error) {
      failed.push({ sourceUrl: row.sourceUrl, pageId: row.pageId, error: String(error?.message || error) });
      nextRows.push(row);
    }
  }
  const byPage = nextRows.reduce((acc, row) => {
    acc[row.pageId] = Number(acc[row.pageId] || 0) + 1;
    return acc;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    source: "data/raw/reference-live/*.mobile.html",
    viewportProfile: "mo",
    fileCount: files.length,
    assetCount: nextRows.length,
    downloadedCount: downloaded.filter((item) => item.downloaded).length,
    reusedCount: downloaded.filter((item) => !item.downloaded).length,
    failedCount: failed.length,
    byPage,
    assets: nextRows,
    failed,
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    reportPath: path.relative(ROOT, REPORT_PATH),
    fileCount: report.fileCount,
    assetCount: report.assetCount,
    downloadedCount: report.downloadedCount,
    reusedCount: report.reusedCount,
    failedCount: report.failedCount,
    byPage,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
