import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const ARCHIVE_INDEX_PATH = path.join(ROOT, "data", "raw", "archive-index.json");
const OUT_DIR = path.join(ROOT, "data", "normalized", "representative-urls");
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");

const DEFAULT_PAGE_IDS = ["category-tvs", "category-refrigerators"];
const DEFAULT_VIEWPORTS = [
  { profile: "pc", width: 1460, height: 2200 },
  { profile: "mo", width: 430, height: 2200 },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    pageIds: [],
    urls: [],
    debug: false,
    viewportProfile: "both",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--pageId" && args[index + 1]) parsed.pageIds.push(args[++index]);
    else if (arg === "--url" && args[index + 1]) parsed.urls.push(args[++index]);
    else if (arg === "--debug") parsed.debug = true;
    else if (arg === "--viewport" && args[index + 1]) parsed.viewportProfile = args[++index];
  }
  if (!parsed.pageIds.length && !parsed.urls.length) parsed.pageIds = DEFAULT_PAGE_IDS.slice();
  return parsed;
}

function slug(input) {
  return String(input)
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function waitForJson(url, attempts = 30, delay = 500) {
  let lastError = null;
  for (let index = 0; index < attempts; index += 1) {
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
  for (let index = 0; index < attempts; index += 1) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`).catch(() => []);
    if (Array.isArray(targets) && targets.length) {
      const pageTarget = targets.find((item) => item.type === "page") || targets[0];
      if (pageTarget?.webSocketDebuggerUrl) return { targets, pageTarget };
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
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = (error) => reject(error);
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (!message.id) {
          const handlers = this.listeners.get(message.method) || [];
          for (const handler of handlers) handler(message.params || {});
          return;
        }
        if (!message.id || !this.pending.has(message.id)) return;
        const { resolve: done, reject: fail } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) fail(new Error(message.error.message || JSON.stringify(message.error)));
        else done(message.result);
      };
      ws.onclose = () => {
        for (const { reject: fail } of this.pending.values()) {
          fail(new Error("CDP socket closed"));
        }
        this.pending.clear();
      };
    });
  }

  on(method, handler) {
    const current = this.listeners.get(method) || [];
    current.push(handler);
    this.listeners.set(method, current);
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

function buildCategoryMap() {
  const archive = readJson(ARCHIVE_INDEX_PATH);
  const byPageId = new Map();
  for (const item of archive) {
    const url = String(item.url || "");
    const parsed = (() => {
      try {
        return new URL(url);
      } catch {
        return null;
      }
    })();
    if (!parsed) continue;
    const pathname = parsed.pathname;
    const search = parsed.search;
    if (pathname === "/category/tvs" || pathname === "/tvs") {
      byPageId.set("category-tvs", url);
    }
    if (pathname === "/category/refrigerators" || pathname === "/refrigerators") {
      byPageId.set("category-refrigerators", url);
    }
    if (pathname === "/m/category/tvs") {
      byPageId.set("category-tvs-mo", url);
    }
    if (pathname === "/m/category/refrigerators") {
      byPageId.set("category-refrigerators-mo", url);
    }
    if (!search) continue;
  }
  if (!byPageId.has("category-tvs")) byPageId.set("category-tvs", "https://www.lge.co.kr/category/tvs");
  if (!byPageId.has("category-refrigerators"))
    byPageId.set("category-refrigerators", "https://www.lge.co.kr/category/refrigerators");
  if (!byPageId.has("category-tvs-mo")) byPageId.set("category-tvs-mo", "https://www.lge.co.kr/m/category/tvs");
  if (!byPageId.has("category-refrigerators-mo"))
    byPageId.set("category-refrigerators-mo", "https://www.lge.co.kr/m/category/refrigerators");
  return byPageId;
}

function resolveTargets(parsed) {
  const categoryMap = buildCategoryMap();
  const targets = [];
  for (const pageId of parsed.pageIds) {
    if (parsed.viewportProfile === "pc" || parsed.viewportProfile === "both") {
      const url = categoryMap.get(pageId);
      if (url) targets.push({ pageId, viewportProfile: "pc", url });
    }
    if (parsed.viewportProfile === "mo" || parsed.viewportProfile === "both") {
      const url = categoryMap.get(`${pageId}-mo`) || categoryMap.get(pageId);
      if (url) targets.push({ pageId, viewportProfile: "mo", url });
    }
  }
  for (const url of parsed.urls) {
    targets.push({
      pageId: slug(url),
      viewportProfile: parsed.viewportProfile === "mo" ? "mo" : "pc",
      url,
    });
  }
  return targets;
}

function viewportFor(profile) {
  return DEFAULT_VIEWPORTS.find((item) => item.profile === profile) || DEFAULT_VIEWPORTS[0];
}

function randomPort() {
  return 9400 + Math.floor(Math.random() * 400);
}

function collectCandidatesExpression() {
  return `(() => {
    const clean = (value) => String(value || "").replace(/\\s+/g, " ").trim();
    const skipPath = (pathname) => {
      const blocked = [
        "/home",
        "/my-page",
        "/shop/cart/index",
        "/company",
        "/business",
        "/support",
        "/search/result",
        "/benefits",
        "/story",
        "/brand",
        "/bestshop",
        "/care-solutions",
      ];
      return blocked.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
    };
    const priceLike = (text) => /원|혜택가|구매|구독|할인|월|리뷰|별점/.test(text);
    const classLikeProduct = (value) => /(ListUnit|list_unit|product|Product|prd|Prd|model|Model|sku|Sku)/.test(String(value || ""));
    const modelLike = (text) => /[A-Z0-9]{4,}/.test(String(text || ""));
    const validRect = (rect) => rect.width >= 120 && rect.height >= 120 && rect.y >= 300 && rect.y <= 6000;
    const allItems = Array.from(document.querySelectorAll("a[href]")).map((anchor) => {
      const href = anchor.href;
      const url = new URL(href, location.origin);
      const rect = anchor.getBoundingClientRect();
      const text = clean(anchor.innerText || anchor.textContent || "");
      const imgCount = anchor.querySelectorAll("img").length;
      const buttonCount = anchor.querySelectorAll("button").length;
      const descendants = anchor.querySelectorAll("*").length;
      return {
        href,
        pathname: url.pathname,
        search: url.search,
        text: text.slice(0, 160),
        className: String(anchor.className || ""),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        imgCount,
        buttonCount,
        descendants,
        area: Math.round(rect.width * rect.height),
        priceLike: priceLike(text),
        skipped: skipPath(url.pathname),
      };
    });
    const runtimeCards = Array.from(document.querySelectorAll("a[href], article, li, div, section"))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const text = clean(node.innerText || node.textContent || "");
        const className = String(node.className || "");
        const hrefNode = node.closest("a[href]") || node.querySelector("a[href]");
        const href = hrefNode ? hrefNode.href : "";
        let pathname = "";
        let search = "";
        try {
          if (href) {
            const parsed = new URL(href, location.origin);
            pathname = parsed.pathname;
            search = parsed.search;
          }
        } catch {}
        return {
          href,
          pathname,
          search,
          text: text.slice(0, 220),
          className,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          imgCount: node.querySelectorAll("img").length,
          buttonCount: node.querySelectorAll("button").length,
          descendants: node.querySelectorAll("*").length,
          area: Math.round(rect.width * rect.height),
          priceLike: priceLike(text),
          skipped: pathname ? skipPath(pathname) : false,
          dataset: {
            modelId: node.getAttribute("data-model-id") || "",
            sku: node.getAttribute("data-sku") || "",
            productId: node.getAttribute("data-product-id") || "",
          },
        };
      })
      .filter((item) => {
        if (!validRect(item.rect)) return false;
        if (item.rect.width > 460 || item.rect.height > 1400) return false;
        if (item.imgCount < 1) return false;
        if (item.descendants < 3) return false;
        if (item.skipped) return false;
        if (item.pathname && item.pathname.startsWith("/category/")) return false;
        return (
          classLikeProduct(item.className) ||
          item.priceLike ||
          modelLike(item.text) ||
          item.dataset.modelId ||
          item.dataset.sku ||
          item.dataset.productId
        );
      });
    const items = allItems.filter((item) => validRect(item.rect));
    const mergedMap = new Map();
    for (const item of [...items, ...runtimeCards]) {
      const key = item.href || [item.text, item.rect.x, item.rect.y, item.rect.width, item.rect.height].join("|");
      const current = mergedMap.get(key);
      if (!current || (item.area || 0) > (current.area || 0)) mergedMap.set(key, item);
    }
    const merged = Array.from(mergedMap.values());
    merged.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
    const topByArea = allItems
      .filter((item) => item.rect.width > 0 && item.rect.height > 0)
      .sort((a, b) => b.area - a.area)
      .slice(0, 30);
    const interestingBlocks = Array.from(document.querySelectorAll("div, li, article, section"))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const text = clean(node.innerText || node.textContent || "");
        return {
          className: String(node.className || ""),
          text: text.slice(0, 220),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          imgCount: node.querySelectorAll("img").length,
          area: Math.round(rect.width * rect.height),
          priceLike: priceLike(text),
        };
      })
      .filter((item) => validRect(item.rect) && item.imgCount >= 1 && item.priceLike)
      .sort((a, b) => b.area - a.area)
      .slice(0, 30);
    const interestingClassCounts = Array.from(document.querySelectorAll("[class]"))
      .map((node) => String(node.className || ""))
      .filter((value) => /(Plp|ListUnit|product|Product|prd|Prd|toolbar|filter|goods|item)/.test(value))
      .reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});
    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        duration: Math.round(entry.duration),
      }))
      .filter((entry) => ["fetch", "xmlhttprequest"].includes(entry.initiatorType));
    return JSON.stringify({
      viewport: { width: window.innerWidth, height: window.innerHeight },
      url: location.href,
      title: document.title,
      allAnchorCount: allItems.length,
      runtimeCardCount: runtimeCards.length,
      topByArea,
      interestingBlocks,
      interestingClassCounts,
      resources,
      candidates: merged,
    });
  })();`;
}

async function waitForPageReady(client, attempts = 20, delay = 1000) {
  for (let index = 0; index < attempts; index += 1) {
    await client.send("Runtime.evaluate", {
      expression: `(() => {
        if (document.documentElement) document.documentElement.style.visibility = "visible";
        if (document.body) document.body.style.visibility = "visible";
        return true;
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    const result = await client.send("Runtime.evaluate", {
      expression: `(() => JSON.stringify({
        href: location.href,
        title: document.title || "",
        readyState: document.readyState || "",
        bodyVisibility: document.body ? getComputedStyle(document.body).visibility : "",
        anchorCount: document.querySelectorAll("a[href]").length
      }))()`,
      returnByValue: true,
      awaitPromise: true,
    });
    const state = JSON.parse(result?.result?.value || "{}");
    if (state.title && state.anchorCount > 10) return state;
    await sleep(delay);
  }
  return null;
}

async function navigateToUrl(client, url) {
  await client.send("Page.navigate", { url });
  for (let index = 0; index < 30; index += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression: `(() => JSON.stringify({
        href: location.href || "",
        readyState: document.readyState || "",
        title: document.title || ""
      }))()`,
      returnByValue: true,
      awaitPromise: true,
    });
    const state = JSON.parse(result?.result?.value || "{}");
    if (state.href && state.href.startsWith("http")) return state;
    await sleep(500);
  }
  return null;
}

async function applyViewportProfile(client, viewport) {
  if (viewport.profile === "mo") {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 3,
      mobile: true,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });
    await client.send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    });
    return;
  }
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await client.send("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    platform: "Linux x86_64",
    acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  });
}

async function scrollToPlpList(client) {
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      if (document.documentElement) document.documentElement.style.visibility = "visible";
      if (document.body) document.body.style.visibility = "visible";
      const target =
        document.querySelector(".PlpPcContainer_list_cont__tBF9C") ||
        document.querySelector(".PlpPcContainer_container__L8y3U") ||
        document.querySelector("[data-area='PLP 제품 카테고리 영역']") ||
        document.querySelector("[data-area='PLP 구매가이드 영역']");
      if (target) {
        target.scrollIntoView({ block: "start", inline: "nearest" });
        return true;
      }
      window.scrollTo(0, 1800);
      return false;
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  for (let index = 0; index < 8; index += 1) {
    await sleep(600);
    await client.send("Runtime.evaluate", {
      expression: `(() => {
        window.scrollBy(0, 480);
        return {
          y: Math.round(window.scrollY),
          height: Math.round(document.body?.scrollHeight || 0)
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
  }
}

async function waitForProductContent(client, attempts = 20, delay = 1500) {
  for (let index = 0; index < attempts; index += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression: `(() => JSON.stringify({
        href: location.href || "",
        title: document.title || "",
        skeletonCount: document.querySelectorAll("[class*='Skeleton']").length,
        productLikeCount: document.querySelectorAll("[class*='ListUnit'], [class*='list_unit'], [data-model-id], [data-sku], [data-product-id]").length
      }))()`,
      returnByValue: true,
      awaitPromise: true,
    });
    const state = JSON.parse(result?.result?.value || "{}");
    if ((state.productLikeCount || 0) > 0 && (state.skeletonCount || 0) < 10) return state;
    await sleep(delay);
  }
  return null;
}

function scoreCandidate(item) {
  let score = 0;
  if (!item.skipped) score += 3;
  if (item.imgCount >= 1) score += 2;
  if (item.priceLike) score += 3;
  if (item.rect.width >= 180 && item.rect.width <= 420) score += 2;
  if (item.rect.height >= 220 && item.rect.height <= 900) score += 2;
  if (item.area >= 80000) score += 1;
  if (item.descendants >= 6) score += 1;
  if (item.pathname.includes("/category/")) score -= 4;
  if (item.pathname === "/" || item.pathname === "/home") score -= 6;
  if (item.pathname.startsWith("/story/")) score -= 6;
  if (item.pathname.startsWith("/benefits/")) score -= 6;
  return score;
}

function buildRows(candidates) {
  const rows = [];
  const sorted = candidates.slice().sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  for (const item of sorted) {
    const row = rows.find((current) => Math.abs(current.y - item.rect.y) <= 24);
    if (row) row.items.push(item);
    else rows.push({ y: item.rect.y, items: [item] });
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.rect.x - b.rect.x);
    row.count = row.items.length;
    row.averageScore = row.items.reduce((sum, item) => sum + item.score, 0) / Math.max(1, row.items.length);
    row.uniquePaths = [...new Set(row.items.map((item) => `${item.pathname}${item.search || ""}`))];
  }
  return rows;
}

function chooseRepresentativeRow(candidates, viewportProfile) {
  const scored = candidates
    .map((item) => ({ ...item, score: scoreCandidate(item) }))
    .filter((item) => item.score >= 5 && !item.skipped);
  const rows = buildRows(scored).filter((row) => row.count >= (viewportProfile === "mo" ? 2 : 3));
  rows.sort((a, b) => a.y - b.y || b.averageScore - a.averageScore);
  const best = rows[0] || null;
  return {
    rows,
    selectedRow: best,
    selectedProducts: best
      ? best.items.map((item) => ({
          href: item.href,
          pathname: item.pathname,
          search: item.search,
          text: item.text,
          rect: item.rect,
          score: item.score,
        }))
      : [],
  };
}

async function captureCandidates(url, viewport) {
  ensureDir(path.join(ROOT, "tmp"));
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const port = randomPort();
    const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-representative-"));
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

    try {
      console.error(`[representatives] waiting for cdp version port=${port}`);
      await waitForJson(`http://127.0.0.1:${port}/json/version`, 30, 500);
      console.error("[representatives] cdp version ok");
      await sleep(3500);
      const { targets, pageTarget: initialPageTarget } = await waitForPageTarget(port, 30, 300);
      console.error(`[representatives] target count=${targets.length}`);
      const pageTarget =
        targets.find((item) => item.type === "page" && item.url && item.url.startsWith(url)) ||
        targets.find((item) => item.type === "page" && item.url && item.url.includes("www.lge.co.kr")) ||
        initialPageTarget;
      if (!pageTarget?.webSocketDebuggerUrl) throw new Error("page target not found");
      console.error(`[representatives] using target=${pageTarget.url || "about:blank"}`);
      const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
      const networkResponses = [];
      await client.connect();
      console.error("[representatives] cdp connected");
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Network.enable");
      await client.send("Emulation.enable").catch(() => {});
      await applyViewportProfile(client, viewport);
      client.on("Network.responseReceived", (params) => {
        networkResponses.push({
          requestId: params.requestId,
          url: params.response?.url || "",
          mimeType: params.response?.mimeType || "",
          type: params.type || "",
          status: params.response?.status || 0,
        });
      });
      await navigateToUrl(client, url);
      const ready = await waitForPageReady(client);
      console.error(`[representatives] page ready title=${ready?.title || ""} anchors=${ready?.anchorCount || 0} visibility=${ready?.bodyVisibility || ""}`);
      await scrollToPlpList(client);
      const productReady = await waitForProductContent(client);
      console.error(
        `[representatives] product wait skeletons=${productReady?.skeletonCount ?? "na"} productLike=${productReady?.productLikeCount ?? "na"}`
      );
      await sleep(2500);
      const result = await client.send("Runtime.evaluate", {
        expression: collectCandidatesExpression(),
        returnByValue: true,
        awaitPromise: true,
      });
      console.error("[representatives] evaluate done");
      const raw = result?.result?.value;
      console.error(`[representatives] raw length=${typeof raw === "string" ? raw.length : -1}`);
      const parsed = JSON.parse(raw);
      const networkBodies = [];
      for (const entry of networkResponses) {
        if (!entry.url || entry.status < 200 || entry.status >= 400) continue;
        const isInteresting =
          entry.mimeType.includes("json") ||
          /graphql|api|product|plp|category|goods|display|model|sku/i.test(entry.url);
        if (!isInteresting) continue;
        try {
          const body = await client.send("Network.getResponseBody", { requestId: entry.requestId });
          const text = body?.base64Encoded ? Buffer.from(body.body || "", "base64").toString("utf8") : body?.body || "";
          networkBodies.push({
            url: entry.url,
            mimeType: entry.mimeType,
            type: entry.type,
            length: text.length,
            sample: text.slice(0, 1200),
          });
        } catch {}
      }
      console.error(
        `[representatives] parsed title=${parsed?.title || ""} allAnchors=${parsed?.allAnchorCount || 0} candidates=${(parsed?.candidates || []).length}`
      );
      parsed.networkBodies = networkBodies.slice(0, 20);
      return parsed;
    } catch (error) {
      lastError = error;
      console.error(`[representatives] attempt ${attempt + 1} failed: ${error.message}`);
    } finally {
      try {
        chrome.kill("SIGKILL");
      } catch {}
      await sleep(200);
    }
  }
  throw lastError || new Error("capture failed");
}

async function main() {
  const parsed = parseArgs();
  const targets = resolveTargets(parsed);
  const results = [];
  ensureDir(OUT_DIR);

  for (const target of targets) {
    const viewport = viewportFor(target.viewportProfile);
    console.error(`[representatives] capture start pageId=${target.pageId} viewport=${target.viewportProfile} url=${target.url}`);
    const captured = await captureCandidates(target.url, viewport);
    const rowResult = chooseRepresentativeRow(captured.candidates || [], target.viewportProfile);
    const payload = {
      pageId: target.pageId,
      viewportProfile: target.viewportProfile,
      url: target.url,
      viewport,
      capturedAt: new Date().toISOString(),
      title: captured.title,
      candidateCount: (captured.candidates || []).length,
      selectedRowY: rowResult.selectedRow?.y || null,
      selectedCount: rowResult.selectedProducts.length,
      representativeProducts: rowResult.selectedProducts,
      debug: parsed.debug
        ? {
            allAnchorCount: captured.allAnchorCount || 0,
            runtimeCardCount: captured.runtimeCardCount || 0,
            topByArea: (captured.topByArea || []).slice(0, 12),
            interestingBlocks: (captured.interestingBlocks || []).slice(0, 12),
            interestingClassCounts: captured.interestingClassCounts || {},
            resources: (captured.resources || []).slice(0, 40),
            networkBodies: (captured.networkBodies || []).slice(0, 10),
            topCandidates: (captured.candidates || []).slice(0, 20).map((item) => ({
              href: item.href,
              pathname: item.pathname,
              text: item.text,
              className: item.className,
              rect: item.rect,
              imgCount: item.imgCount,
              priceLike: item.priceLike,
              dataset: item.dataset,
            })),
            firstRows: rowResult.rows.slice(0, 8).map((row) => ({
              y: row.y,
              count: row.count,
              averageScore: row.averageScore,
              items: row.items.slice(0, 8).map((item) => ({
                href: item.href,
                text: item.text,
                rect: item.rect,
                score: item.score,
                priceLike: item.priceLike,
                imgCount: item.imgCount,
              })),
            })),
          }
        : undefined,
    };
    const outputPath = path.join(OUT_DIR, `${target.pageId}.${target.viewportProfile}.json`);
    writeJson(outputPath, payload);
    console.error(
      `[representatives] capture done pageId=${target.pageId} viewport=${target.viewportProfile} candidates=${payload.candidateCount} selected=${payload.selectedCount} out=${outputPath}`
    );
    results.push({
      pageId: target.pageId,
      viewportProfile: target.viewportProfile,
      url: target.url,
      selectedCount: payload.selectedCount,
      selectedRowY: payload.selectedRowY,
      representativeProducts: payload.representativeProducts.map((item) => item.href),
    });
  }

  console.log(JSON.stringify({ targets: results }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
