import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "normalized", "service-groups");
const OUT_INDEX_PATH = path.join(OUT_DIR, "index.json");
const LOCK_PATH = path.join(ROOT, "tmp", "extract-service-groups.lock");
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");

const PAGE_CONFIG = {
  support: {
    sourceUrl: "https://www.lge.co.kr/support",
    groups: [
      { groupId: "mainService", selectors: [".main-service-wrap", ".main-service"], mode: "first" },
      { groupId: "notice", selectors: [".home-notice-wrap", ".home-notice"], mode: "first" },
      { groupId: "tipsBanner", selectors: [".common-banner.related-pages", ".common-banner"], mode: "first" },
      { groupId: "bestcare", selectors: [".bestcare-section", ".bestcare-content"], mode: "first" },
    ],
  },
  bestshop: {
    sourceUrl: "https://www.lge.co.kr/bestshop",
    groups: [
      { groupId: "hero", selectors: [".hero-banner"], mode: "first" },
      { groupId: "shortcut", selectors: [".sub-main", ".shortcut-service-link"], mode: "first" },
      { groupId: "review", selectors: [".main-review"], mode: "first" },
      { groupId: "brandBanner", selectors: [".brand-banner", ".guide-link-banner"], mode: "first" },
    ],
  },
  "care-solutions": {
    sourceUrl: "https://www.lge.co.kr/care-solutions",
    groups: [
      { groupId: "hero", selectors: [".new-hero-banner", ".hero-banner"], mode: "first" },
      { groupId: "ranking", selectors: [".caresolution-main-bestranking"], mode: "first" },
      { groupId: "benefit", selectors: [".caresolution-benefit"], mode: "first" },
      { groupId: "tabs", selectors: [".tabs-wrap-new", ".ui_smooth_scrolltab", ".tabs"], mode: "first" },
      { groupId: "careBanner", selectors: [".care-banner-wrap"], mode: "first" },
    ],
  },
  "care-solutions-pdp": {
    sourceUrl: "https://www.lge.co.kr/care-solutions/water-purifiers/wd523vc?dpType=careTab&subscCategoryKeyId=246021",
    groups: [
      { groupId: "visual", selectors: [".pdp-visual-wrap", ".pdp-visual-area"], mode: "first" },
      { groupId: "detailInfo", selectors: [".pdp-info-area", ".pdp-data"], mode: "first" },
      { groupId: "noticeBanner", selectors: [".pdp-notice-banner"], mode: "first" },
      { groupId: "reviewInfo", selectors: [".review-info", ".review-wrap"], mode: "first" },
    ],
  },
  "homestyle-home": {
    sourceUrl: "https://homestyle.lge.co.kr/home",
    groups: [
      { groupId: "quickMenu", selectors: [".PcQuickMenu_quickMenuSection__6lq5j", "[class*='PcQuickMenu_quickMenuSection']"], mode: "first" },
      { groupId: "labelBanner", selectors: [".PcLabelBanner_labelBannerSection__Pwzkj", "[class*='PcLabelBanner_labelBannerSection']"], mode: "first" },
      { groupId: "brandStory", selectors: [".PcBrandStory_brandSection__KX7A_", "[class*='PcBrandStory_brandSection']"], mode: "first" },
    ],
  },
  "homestyle-pdp": {
    sourceUrl: "https://homestyle.lge.co.kr/item?productId=G26030036505",
    groups: [
      { groupId: "detailInfo", selectors: [".PcProductDetailInfoV2_detailSection__D_jC3", "[class*='PcProductDetailInfoV2_detailSection']"], mode: "first" },
      { groupId: "bestProduct", selectors: [".PcBestProduct_bestSection___UO0t", "[class*='PcBestProduct_bestSection']"], mode: "first" },
      { groupId: "review", selectors: [".PcReviewSection_reviewContainer__Ile3G", "[class*='PcReviewSection_reviewContainer']"], mode: "first" },
      { groupId: "qna", selectors: [".PcProductDetailQnA_container___mN4P", "[class*='PcProductDetailQnA_container']"], mode: "first" },
      { groupId: "guides", selectors: [".PcProductDetailGuides_container__3dHy4", "[class*='PcProductDetailGuides_container']"], mode: "first" },
      { groupId: "seller", selectors: [".PcSeller_sellerSection__aJ1Mx", "[class*='PcSeller_sellerSection']"], mode: "first" },
    ],
  },
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function acquireLock(lockPath) {
  ensureDir(path.dirname(lockPath));
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(fd, String(process.pid));
    return () => {
      try { fs.closeSync(fd); } catch {}
      try { fs.unlinkSync(lockPath); } catch {}
    };
  } catch {
    throw new Error(`lock_exists:${lockPath}`);
  }
}

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

function normalizeSourceType(value) {
  return value === "working" ? "working" : "reference";
}

function viewportFor(profile) {
  if (profile === "mo") {
    return {
      width: 430,
      height: 2200,
      deviceScaleFactor: 3,
      mobile: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    };
  }
  return {
    width: 1460,
    height: 2200,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    platform: "Linux x86_64",
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function waitForJson(url, attempts = 30, delay = 500) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
      await sleep(delay);
    }
  }
  throw lastError || new Error(`failed to fetch ${url}`);
}

async function waitForPageTarget(port, attempts = 30, delay = 500) {
  for (let i = 0; i < attempts; i += 1) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`).catch(() => []);
    if (Array.isArray(targets) && targets.length) {
      const pageTarget = targets.find((item) => item.type === "page") || targets[0];
      if (pageTarget?.webSocketDebuggerUrl) return pageTarget;
    }
    await sleep(delay);
  }
  throw new Error("page target not found");
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.ws = null;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = (error) => reject(error);
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (!message.id || !this.pending.has(message.id)) return;
        const { resolve: done, reject: fail } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) fail(new Error(message.error.message || JSON.stringify(message.error)));
        else done(message.result);
      };
      ws.onclose = () => {
        for (const { reject: fail } of this.pending.values()) fail(new Error("CDP socket closed"));
        this.pending.clear();
      };
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    if (!this.ws) return;
    this.ws.close();
    await sleep(100);
  }
}

function randomPort() {
  return 11600 + Math.floor(Math.random() * 600);
}

async function applyViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  if (viewport.mobile) {
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });
  }
  await client.send("Emulation.setUserAgentOverride", {
    userAgent: viewport.userAgent,
    platform: viewport.platform,
    acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  });
}

async function launchChromeSession(viewport) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const port = randomPort();
    const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-service-groups-"));
    const chrome = spawn(
      CHROME,
      [
        "--headless",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        `--window-size=${viewport.width},${viewport.height}`,
      ],
      { stdio: "ignore" }
    );
    let client = null;
    try {
      await sleep(1500);
      await waitForJson(`http://127.0.0.1:${port}/json/version`, 120, 500);
      const pageTarget = await waitForPageTarget(port, 120, 300);
      client = new CdpClient(pageTarget.webSocketDebuggerUrl);
      await client.connect();
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await applyViewport(client, viewport);
      return { chrome, client };
    } catch (error) {
      lastError = error;
      try { await client?.close(); } catch {}
      try { chrome.kill("SIGKILL"); } catch {}
      await sleep(300);
    }
  }
  throw lastError || new Error("launchChromeSession failed");
}

async function closeChromeSession(session) {
  try { await session?.client?.close(); } catch {}
  try { session?.chrome?.kill("SIGKILL"); } catch {}
  await sleep(200);
}

async function waitForPageReady(client) {
  for (let i = 0; i < 30; i += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression: `(() => JSON.stringify({ href: location.href || "", readyState: document.readyState || "", title: document.title || "", body: !!document.body }))()`,
      returnByValue: true,
      awaitPromise: true,
    });
    const state = JSON.parse(result?.result?.value || "{}");
    if (state.href && state.readyState && state.body) return state;
    await sleep(500);
  }
  return null;
}

async function settlePage(client) {
  await sleep(5000);
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const hidden = ['.chatbot','.floating','.sticky-banner','.layer-popup','.toast','[class*="chat"]','[class*="Chat"]','[class*="toast"]'];
      hidden.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => {
          node.style.visibility = 'hidden';
          node.style.opacity = '0';
          node.style.pointerEvents = 'none';
        });
      });
      window.scrollTo(0, 0);
      return true;
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  await sleep(1200);
}

function buildExtractExpression(config) {
  return `(() => {
    const groups = ${JSON.stringify(config.groups)};
    const rect = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const pick = (selectors, mode) => {
      for (const selector of selectors || []) {
        const nodes = Array.from(document.querySelectorAll(selector)).filter((node) => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (!nodes.length) continue;
        if (mode === 'union') {
          const xs = nodes.map((n) => n.getBoundingClientRect().x);
          const ys = nodes.map((n) => n.getBoundingClientRect().y);
          const rights = nodes.map((n) => n.getBoundingClientRect().x + n.getBoundingClientRect().width);
          const bottoms = nodes.map((n) => n.getBoundingClientRect().y + n.getBoundingClientRect().height);
          return {
            selector,
            rect: {
              x: Math.round(Math.min(...xs)),
              y: Math.round(Math.min(...ys)),
              width: Math.round(Math.max(...rights) - Math.min(...xs)),
              height: Math.round(Math.max(...bottoms) - Math.min(...ys)),
            },
            matchCount: nodes.length,
          };
        }
        return { selector, rect: rect(nodes[0]), matchCount: nodes.length };
      }
      return null;
    };
    return JSON.stringify({
      title: document.title || '',
      groups: groups.map((group) => {
        const matched = pick(group.selectors, group.mode || 'first');
        return {
          groupId: group.groupId,
          selectors: group.selectors,
          matched: matched || null,
        };
      }),
    });
  })();`;
}

async function extractGroups(client, config) {
  const result = await client.send("Runtime.evaluate", {
    expression: buildExtractExpression(config),
    returnByValue: true,
    awaitPromise: true,
  });
  return JSON.parse(result?.result?.value || "{}");
}

async function processEntry(pageId, viewportProfile, sourceType, baseUrl) {
  const config = PAGE_CONFIG[pageId];
  if (!config) throw new Error(`unsupported_page:${pageId}`);
  const targetUrl = sourceType === "working"
    ? `${baseUrl}/clone-content/${encodeURIComponent(pageId)}?viewportProfile=${encodeURIComponent(viewportProfile)}`
    : `${baseUrl}/reference-content/${encodeURIComponent(pageId)}?viewportProfile=${encodeURIComponent(viewportProfile)}`;
  const session = await launchChromeSession(viewportFor(viewportProfile));
  try {
    await session.client.send("Page.navigate", { url: targetUrl });
    await waitForPageReady(session.client);
    await settlePage(session.client);
    const extracted = await extractGroups(session.client, config);
    return {
      pageId,
      viewportProfile,
      sourceType,
      sourceUrl: config.sourceUrl,
      capturedUrl: targetUrl,
      extractedAt: new Date().toISOString(),
      title: extracted.title || "",
      groups: Object.fromEntries((extracted.groups || []).map((item) => [item.groupId, {
        groupId: item.groupId,
        selector: item.matched?.selector || null,
        matchCount: item.matched?.matchCount || 0,
        rect: item.matched?.rect || null,
      }])),
    };
  } finally {
    await closeChromeSession(session);
  }
}

async function main() {
  const releaseLock = acquireLock(LOCK_PATH);
  const cleanup = () => releaseLock();
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });
  process.on("SIGTERM", () => { cleanup(); process.exit(143); });

  const args = parseArgs(process.argv.slice(2));
  const filterPageId = args.pageId || null;
  const filterViewportProfile = args.viewportProfile || null;
  const sourceType = normalizeSourceType(args.source);
  const baseUrl = String(args.baseUrl || "http://localhost:3000").replace(/\/+$/, "");
  const pages = Object.keys(PAGE_CONFIG).filter((pageId) => !filterPageId || pageId === filterPageId);
  const viewports = filterViewportProfile ? [filterViewportProfile] : ["pc", "mo"];
  const entries = [];
  const errors = [];

  for (const pageId of pages) {
    for (const viewportProfile of viewports) {
      try {
        const entry = await processEntry(pageId, viewportProfile, sourceType, baseUrl);
        entries.push(entry);
        console.log(`extracted ${sourceType} ${pageId} ${viewportProfile}`);
      } catch (error) {
        errors.push({
          pageId,
          viewportProfile,
          sourceType,
          error: String(error),
          recordedAt: new Date().toISOString(),
        });
        console.error(`extract failed ${sourceType} ${pageId} ${viewportProfile}: ${String(error)}`);
      }
    }
  }

  const existing = readJson(OUT_INDEX_PATH, { entries: [] });
  const merged = new Map();
  for (const item of existing.entries || []) merged.set(`${item.pageId}:${item.viewportProfile}:${item.sourceType}`, item);
  for (const item of entries) merged.set(`${item.pageId}:${item.viewportProfile}:${item.sourceType}`, item);
  const mergedEntries = Array.from(merged.values()).sort((a, b) =>
    `${a.pageId}:${a.viewportProfile}:${a.sourceType}`.localeCompare(`${b.pageId}:${b.viewportProfile}:${b.sourceType}`)
  );
  writeJson(OUT_INDEX_PATH, {
    generatedAt: new Date().toISOString(),
    entryCount: mergedEntries.length,
    entries: mergedEntries,
    errors,
  });
  cleanup();
  console.log(JSON.stringify({ out: OUT_INDEX_PATH, entryCount: mergedEntries.length, errorCount: errors.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
