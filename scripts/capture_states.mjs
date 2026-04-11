import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const RAW_DIR = path.join(ROOT, "data", "raw");
const STATE_DIR = path.join(RAW_DIR, "states");
const SEEDS_PATH = path.join(RAW_DIR, "seed-urls.json");

function slugFromUrl(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function saveState(page, url, slug, label) {
  const dir = path.join(STATE_DIR, slug);
  ensureDir(dir);
  const screenshotPath = path.join(dir, `${label}.png`);
  const htmlPath = path.join(dir, `${label}.html`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  fs.writeFileSync(htmlPath, await page.content(), "utf-8");
  return { label, screenshotPath, htmlPath };
}

async function capturePage(page, target) {
  const slug = slugFromUrl(target.url);
  const states = [];
  await page.goto(target.url, { waitUntil: "networkidle", timeout: 60000 });
  states.push(await saveState(page, target.url, slug, "default"));

  const selectors = [
    "[role='dialog']",
    "[aria-modal='true']",
    ".modal",
    ".popup",
    ".layer-popup",
    ".drawer",
    "[data-testid*='popup']",
    "[data-testid*='modal']",
  ];

  const clickCandidates = [
    "button",
    "[role='button']",
    "a",
    "[aria-haspopup='dialog']",
    "[aria-haspopup='menu']",
  ];

  const clicked = new Set();

  for (const selector of clickCandidates) {
    const elements = await page.locator(selector).elementHandles();
    for (let i = 0; i < Math.min(elements.length, 20); i += 1) {
      const el = elements[i];
      const text = ((await el.textContent()) || "").trim().replace(/\s+/g, " ").slice(0, 40);
      const key = `${selector}-${text}-${i}`;
      if (clicked.has(key)) continue;
      clicked.add(key);
      try {
        await el.scrollIntoViewIfNeeded();
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(1200);
        let overlayFound = false;
        for (const overlaySelector of selectors) {
          const count = await page.locator(overlaySelector).count();
          if (count > 0) {
            states.push(await saveState(page, target.url, slug, `overlay-${states.length}`));
            overlayFound = true;
            break;
          }
        }
        if (overlayFound) {
          await page.keyboard.press("Escape").catch(() => {});
          await page.waitForTimeout(500);
        } else {
          const current = page.url();
          if (current !== target.url) {
            await page.goBack({ waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    url: target.url,
    pageGroup: target.pageGroup,
    stateCount: states.length,
    states,
  };
}

async function main() {
  ensureDir(STATE_DIR);
  const seeds = JSON.parse(fs.readFileSync(SEEDS_PATH, "utf-8")).seedUrls.slice(0, 5);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: "ko-KR",
  });
  const page = await context.newPage();
  const results = [];

  for (const target of seeds) {
    try {
      const result = await capturePage(page, target);
      results.push(result);
      console.log(`Captured ${target.url} (${result.stateCount} states)`);
    } catch (error) {
      results.push({
        url: target.url,
        pageGroup: target.pageGroup,
        error: String(error),
      });
      console.log(`Failed ${target.url}: ${String(error)}`);
    }
  }

  fs.writeFileSync(
    path.join(STATE_DIR, "index.json"),
    JSON.stringify(results, null, 2),
    "utf-8",
  );
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
