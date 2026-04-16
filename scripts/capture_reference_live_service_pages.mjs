import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(ROOT, "data", "raw", "reference-live");

const PAGE_TARGETS = [
  { pageId: "support", url: "https://www.lge.co.kr/support" },
  { pageId: "bestshop", url: "https://www.lge.co.kr/bestshop" },
  { pageId: "care-solutions", url: "https://www.lge.co.kr/care-solutions" },
  { pageId: "care-solutions-pdp", url: "https://www.lge.co.kr/care-solutions/water-purifiers/wd523vc?dpType=careTab&subscCategoryKeyId=246021" },
  { pageId: "homestyle-home", url: "https://homestyle.lge.co.kr/home", postWaitMs: 8000 },
  { pageId: "homestyle-pdp", url: "https://homestyle.lge.co.kr/item?productId=G26030036505", postWaitMs: 8000 },
  {
    pageId: "category-tvs",
    url: "https://www.lge.co.kr/category/tvs",
    mobileUrl: "https://www.lge.co.kr/m/category/tvs",
    waitUntil: "commit",
    postWaitMs: 8000,
  },
  {
    pageId: "category-refrigerators",
    url: "https://www.lge.co.kr/category/refrigerators",
    mobileUrl: "https://www.lge.co.kr/m/category/refrigerators",
    waitUntil: "commit",
    postWaitMs: 8000,
  },
  { pageId: "pdp-tv-general", url: "https://www.lge.co.kr/tvs/32lq635bkna-stand", waitUntil: "commit", postWaitMs: 7000 },
  { pageId: "pdp-tv-premium", url: "https://www.lge.co.kr/tvs/oled97g5kna-stand", waitUntil: "commit", postWaitMs: 7000 },
  { pageId: "pdp-refrigerator-general", url: "https://www.lge.co.kr/refrigerators/t873mee111", waitUntil: "commit", postWaitMs: 8000 },
  { pageId: "pdp-refrigerator-knockon", url: "https://www.lge.co.kr/refrigerators/t875mee412", waitUntil: "commit", postWaitMs: 8000 },
  { pageId: "pdp-refrigerator-glass", url: "https://www.lge.co.kr/refrigerators/h875gbb111", waitUntil: "commit", postWaitMs: 8000 },
];

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    result[key] = value;
  }
  return result;
}

function viewportFor(profile) {
  if (profile === "mo") {
    return {
      profile,
      width: 430,
      height: 2200,
      deviceScaleFactor: 3,
      isMobile: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    };
  }
  return {
    profile: "pc",
    width: 1460,
    height: 2200,
    deviceScaleFactor: 1,
    isMobile: false,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  };
}

function suffixFor(profile) {
  return profile === "mo" ? "mobile" : "desktop";
}

async function capturePage(page, target, viewportProfile) {
  const targetUrl = viewportProfile === "mo" && target.mobileUrl ? target.mobileUrl : target.url;
  const waitUntil = String(target.waitUntil || "").trim() || "networkidle";
  const postWaitMs = Number.isFinite(Number(target.postWaitMs)) ? Number(target.postWaitMs) : 2500;
  try {
    await page.goto(targetUrl, { waitUntil, timeout: 45000 });
  } catch {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  await page.waitForTimeout(postWaitMs);
  if (target.pageId === "homestyle-home") {
    try {
      await page.waitForFunction(
        () =>
          document.body &&
          document.body.innerText.includes("Brand Pick") &&
          document.querySelectorAll("img").length >= 100,
        { timeout: 15000 }
      );
      await page.waitForTimeout(1500);
    } catch {}
  }
  const html = await page.content();
  const filePath = path.join(OUT_DIR, `${target.pageId}.${suffixFor(viewportProfile)}.html`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, "utf8");
  const meta = await page.evaluate(() => ({
    title: document.title || "",
    imageCount: document.querySelectorAll("img").length,
    linkCount: document.querySelectorAll("a").length,
    buttonCount: document.querySelectorAll("button").length,
  }));
  return { filePath, ...meta };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filterPageId = String(args.pageId || "").trim();
  const viewportProfile = String(args.viewportProfile || "pc").trim() === "mo" ? "mo" : "pc";
  const viewport = viewportFor(viewportProfile);
  const targets = PAGE_TARGETS.filter((item) => !filterPageId || item.pageId === filterPageId);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
  });
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    userAgent: viewport.userAgent,
  });

  const results = [];
  try {
    for (const target of targets) {
      const result = await capturePage(page, target, viewportProfile);
      results.push({
        pageId: target.pageId,
        viewportProfile,
        url: viewportProfile === "mo" && target.mobileUrl ? target.mobileUrl : target.url,
        ...result,
      });
      console.log(`captured live ${target.pageId} ${viewportProfile} -> ${result.filePath}`);
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
