import { chromium } from "playwright";

const PAGE_TARGETS = [
  ["home", "pc"],
  ["home", "ta"],
  ["support", "pc"],
  ["bestshop", "pc"],
  ["care-solutions", "pc"],
  ["care-solutions-pdp", "pc"],
  ["homestyle-home", "pc"],
  ["homestyle-pdp", "pc"],
  ["category-tvs", "pc"],
  ["category-refrigerators", "pc"],
  ["pdp-tv-general", "pc"],
  ["pdp-tv-premium", "pc"],
  ["pdp-refrigerator-general", "pc"],
  ["pdp-refrigerator-knockon", "pc"],
  ["pdp-refrigerator-glass", "pc"],
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
      width: 430,
      height: 2200,
      isMobile: true,
      deviceScaleFactor: 3,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    };
  }
  if (profile === "ta") {
    return {
      width: 1024,
      height: 2200,
      isMobile: false,
      deviceScaleFactor: 1,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    };
  }
  return {
    width: 1460,
    height: 2200,
    isMobile: false,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  };
}

async function visit(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4200);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.baseUrl || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const filterPageId = String(args.pageId || "").trim();
  const targets = PAGE_TARGETS.filter(([pageId]) => !filterPageId || pageId === filterPageId);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
  });
  try {
    for (const [pageId, viewportProfile] of targets) {
      const viewport = viewportFor(viewportProfile);
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        deviceScaleFactor: viewport.deviceScaleFactor,
        userAgent: viewport.userAgent,
      });
      try {
        await visit(page, `${baseUrl}/reference-content/${encodeURIComponent(pageId)}?viewportProfile=${encodeURIComponent(viewportProfile)}`);
        await visit(page, `${baseUrl}/clone-content/${encodeURIComponent(pageId)}?viewportProfile=${encodeURIComponent(viewportProfile)}`);
        console.log(`measured ${pageId} ${viewportProfile}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
