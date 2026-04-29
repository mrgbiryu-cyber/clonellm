import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_PATH = path.join(ROOT, "data", "raw", "reference-live", "home.mobile.html");
const TARGET_URL = "https://www.lge.co.kr/home";
const CHROME = path.join(process.env.HOME || "", ".cache", "ms-playwright", "chromium-1217", "chrome-linux64", "chrome");

const TARGET_SELECTORS = [
  ".HomeMoListVerticaltype_list_verticaltype__txQWx",
  ".HomeMoListRectangletype_list_rectangle__LVuQv",
  ".HomeMoListVerticaltypeFill_list_verticaltype_fill__3OsbB",
  ".HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__DxwUS",
];

async function waitForVisible(page, selector, timeout = 20000) {
  await page.waitForSelector(selector, { state: "attached", timeout });
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
}

async function captureHomeMobileHtml() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  });
  const context = await browser.newContext({
    ...devices["iPhone 12"],
  });
  const page = await context.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(7000);

    for (const selector of TARGET_SELECTORS) {
      await waitForVisible(page, selector).catch(() => {});
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);

    const html = await page.content();
    const metrics = await page.evaluate(() => ({
      smartLifeImages: document.querySelectorAll(".HomeMoListVerticaltype_list_verticaltype__txQWx img").length,
      benefitsImages: document.querySelectorAll(".HomeMoListRectangletype_list_rectangle__LVuQv img").length,
      bestCareImages: document.querySelectorAll(".HomeMoListVerticaltypeFill_list_verticaltype_fill__3OsbB img").length,
      bestshopGuideImages: document.querySelectorAll(".HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__DxwUS img").length,
      bailoutCount: (document.documentElement.outerHTML.match(/BAILOUT_TO_CLIENT_SIDE_RENDERING/g) || []).length,
      title: document.title,
    }));

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, html, "utf8");
    return metrics;
  } finally {
    await browser.close();
  }
}

captureHomeMobileHtml()
  .then((metrics) => {
    console.log(JSON.stringify({ ok: true, outPath: OUT_PATH, metrics }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
