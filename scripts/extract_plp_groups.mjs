import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const WORKBENCH_TARGETS_PATH = path.join(ROOT, "data", "normalized", "workbench-targets", "index.json");
const OUT_DIR = path.join(ROOT, "data", "normalized", "plp-groups");
const OUT_INDEX_PATH = path.join(OUT_DIR, "index.json");
const LOCK_PATH = path.join(ROOT, "tmp", "extract-plp-groups.lock");
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");

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

function viewportFor(profile) {
  if (profile === "mo") {
    return {
      profile,
      width: 430,
      height: 2400,
      deviceScaleFactor: 3,
      mobile: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    };
  }
  return {
    profile,
    width: 1460,
    height: 2400,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    platform: "Linux x86_64",
  };
}

function randomPort() {
  return 11200 + Math.floor(Math.random() * 500);
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
    const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-plp-group-"));
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

async function settlePlpPage(client) {
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
      const target = document.querySelector('[data-area*="PLP"]') || document.querySelector('[class*="Plp"]') || document.querySelector('[class*="product"]');
      if (target) target.scrollIntoView({ block: 'start' });
      window.scrollTo(0, Math.max(0, Math.round(window.scrollY || 0) - 120));
      return true;
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  await sleep(1200);
}

function buildEntries(targets, pageId, viewportProfile, sourceType) {
  return (targets.plpTargets || []).filter((item) => {
    if (pageId && item.pageId !== pageId) return false;
    if (viewportProfile && item.viewportProfile !== viewportProfile) return false;
    return true;
  }).map((item) => ({ ...item, sourceType: sourceType || "reference" }));
}

function artifactKey(item) {
  return `${item.sourceType || "reference"}:${item.pageId}:${item.viewportProfile}`;
}

function buildTargetUrl(entry, baseUrl) {
  if ((entry.sourceType || "reference") === "working") {
    return `${baseUrl}/clone-content/${encodeURIComponent(entry.pageId)}?viewportProfile=${encodeURIComponent(entry.viewportProfile)}`;
  }
  if (String(entry.pageId || "").startsWith("category-")) {
    return `${baseUrl}/reference-content/${encodeURIComponent(entry.pageId)}?viewportProfile=${encodeURIComponent(entry.viewportProfile)}`;
  }
  return entry.sourceUrl;
}

async function extractGroups(client, entry) {
  const hrefs = JSON.stringify((entry.representativeProducts || []).map((item) => item.href || "").filter(Boolean));
  const pathnames = JSON.stringify((entry.representativeProducts || []).map((item) => item.pathname || "").filter(Boolean));
  const result = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const hrefs = ${hrefs};
      const pathnames = ${pathnames};
      const rootDoc = document;
      const rootWin = window;
      const rectOf = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        const style = window.getComputedStyle(node);
        return {
          x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height),
          right: Math.round(rect.right), bottom: Math.round(rect.bottom),
          display: style.display, position: style.position, zIndex: style.zIndex,
        };
      };
      const summarize = (groupId, node, selector = null) => ({ groupId, found: !!node, selector, rect: rectOf(node) });
      const findFirst = (selectors) => {
        for (const selector of selectors) {
          const node = rootDoc.querySelector(selector);
          if (node) return { node, selector };
        }
        return { node: null, selector: null };
      };
      const allAnchors = Array.from(rootDoc.querySelectorAll('a[href]'));
      const normalizePath = (href) => {
        try {
          const url = new URL(href, rootWin.location.origin);
          return url.pathname || '';
        } catch {}
        return '';
      };
      const matchAnchor = (anchor) => {
        const originalHref = anchor.getAttribute('data-codex-origin-href') || anchor.href || '';
        const path = normalizePath(originalHref);
        if (!path) return false;
        if (hrefs.includes(originalHref) || hrefs.includes(anchor.href)) return true;
        if (pathnames.includes(path)) return true;
        return false;
      };
      const toCardNode = (anchor) => {
        return (
          anchor.closest('[data-product]') ||
          anchor.closest('[class*="ListUnitProduct"]') ||
          anchor.closest('[class*="Bestranking_unit_item"]') ||
          anchor.closest('[class*="product-card"]') ||
          anchor.closest('article') ||
          anchor.closest('li') ||
          anchor.parentElement ||
          anchor
        );
      };
      const collectAncestorCandidates = (node, maxDepth = 8) => {
        const nodes = [];
        let current = node;
        let depth = 0;
        while (current && depth < maxDepth) {
          nodes.push(current);
          current = current.parentElement;
          depth += 1;
        }
        return nodes;
      };
      const productAnchors = allAnchors.filter(matchAnchor);
      const productCards = productAnchors.map((anchor) => toCardNode(anchor)).filter(Boolean);
      const uniqueCards = Array.from(new Set(productCards));
      const cardEntries = uniqueCards.map((node) => ({ node, rect: rectOf(node) })).filter((item) => item.rect);
      cardEntries.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
      const unionRect = (nodes) => {
        const rects = nodes.map((node) => rectOf(node)).filter(Boolean);
        if (!rects.length) return null;
        const left = Math.min(...rects.map((item) => item.x));
        const top = Math.min(...rects.map((item) => item.y));
        const right = Math.max(...rects.map((item) => item.right));
        const bottom = Math.max(...rects.map((item) => item.bottom));
        return {
          x: left, y: top, width: right - left, height: bottom - top,
          right, bottom, display: 'block', position: 'relative', zIndex: 'auto'
        };
      };
      const firstCardTop = cardEntries[0]?.rect?.y ?? null;
      const firstRowEntries = firstCardTop == null
        ? []
        : cardEntries.filter((item) => Math.abs(item.rect.y - firstCardTop) <= 48);
      const rowRect = unionRect(firstRowEntries.map((item) => item.node));
      const firstProductRect = firstRowEntries[0]?.rect || cardEntries[0]?.rect || null;
      const findNearTopControl = (selectors, side = 'any') => {
        const nodes = selectors.flatMap((selector) => Array.from(rootDoc.querySelectorAll(selector)).map((node) => ({ node, selector })));
        const candidates = nodes
          .map(({ node, selector }) => ({ node, selector, rect: rectOf(node) }))
          .filter((item) => item.rect)
          .filter((item) => firstCardTop == null || item.rect.y <= firstCardTop + 220)
          .filter((item) => item.rect.y < (rootWin.innerHeight * 3));
        if (side === 'right') {
          candidates.sort((a, b) => (Math.abs(rootWin.innerWidth - a.rect.right) - Math.abs(rootWin.innerWidth - b.rect.right)) || (a.rect.y - b.rect.y));
        } else {
          candidates.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
        }
        return { node: candidates[0]?.node || null, selector: candidates[0]?.selector || null };
      };
      const filterPrimary = findNearTopControl(['[class*="filter"]','[data-area*="필터"]','[aria-label*="필터"]','button[aria-label*="필터"]']);
      const sortPrimary = findNearTopControl(['[class*="sort"]','button[aria-haspopup="listbox"]','button[aria-expanded][aria-controls]','[class*="dropdown"]'], 'right');
      const gridNode = (() => {
        const candidateMap = new Map();
        for (const { node } of cardEntries) {
          for (const candidate of collectAncestorCandidates(node)) {
            if (!candidate || !candidate.tagName) continue;
            const tag = String(candidate.tagName || '').toLowerCase();
            if (tag === 'html' || tag === 'body') continue;
            const rect = rectOf(candidate);
            if (!rect) continue;
            if (rect.width < Math.max(320, (cardEntries[0]?.rect?.width || 0) * 2)) continue;
            if (firstCardTop != null && rect.y > firstCardTop + 120) continue;
            const key = candidate;
            if (!candidateMap.has(key)) {
              const matchedCards = uniqueCards.filter((card) => candidate.contains(card)).length;
              candidateMap.set(key, { node: candidate, rect, matchedCards, area: rect.width * rect.height });
            }
          }
        }
        const candidates = Array.from(candidateMap.values()).filter((item) => item.matchedCards >= Math.min(2, uniqueCards.length || 1));
        candidates.sort((a, b) => (b.matchedCards - a.matchedCards) || (a.area - b.area) || (a.rect.y - b.rect.y));
        return candidates[0]?.node || null;
      })();
      const gridRect = (() => {
        const cardUnion = unionRect(uniqueCards);
        const candidateRect = rectOf(gridNode);
        if (!cardUnion) return candidateRect;
        if (!candidateRect) return cardUnion;
        const candidateArea = candidateRect.width * candidateRect.height;
        const cardArea = cardUnion.width * cardUnion.height;
        if (candidateArea > cardArea * 1.6) return cardUnion;
        return candidateRect;
      })();
      const bannerPrimary = (() => {
        const selectorGroups = [
          ['[data-area*="구매가이드"]', '[class*="guide"]'],
          ['[class*="banner"][data-area]', '[class*="tab"][data-area]'],
          ['[class*="banner"]', '[class*="tab"]']
        ];
        for (const selectors of selectorGroups) {
          const nodes = selectors.flatMap((selector) => Array.from(rootDoc.querySelectorAll(selector)).map((node) => ({ node, selector })));
          const candidates = nodes
            .map(({ node, selector }) => ({ node, selector, rect: rectOf(node) }))
            .filter((item) => item.rect)
            .filter((item) => firstCardTop == null || (item.rect.y >= Math.max(0, firstCardTop - 260) && item.rect.y <= firstCardTop + 120))
            .filter((item) => item.rect.width >= 220 && item.rect.height >= 60)
            .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
          if (candidates.length) {
            return { node: candidates[0].node, selector: candidates[0].selector };
          }
        }
        return { node: null, selector: null };
      })();
      return {
        page: { title: rootDoc.title || document.title || '', href: rootWin.location.href || location.href || '', viewportWidth: rootWin.innerWidth || window.innerWidth, viewportHeight: rootWin.innerHeight || window.innerHeight },
        groups: {
          filter: summarize('filter', filterPrimary.node, filterPrimary.selector),
          sort: summarize('sort', sortPrimary.node, sortPrimary.selector),
          productGrid: { groupId: 'productGrid', found: !!gridRect, selector: null, rect: gridRect },
          firstRow: { groupId: 'firstRow', found: !!rowRect, selector: 'representativeProducts', rect: rowRect },
          firstProduct: { groupId: 'firstProduct', found: !!firstProductRect, selector: 'representativeProducts[0]', rect: firstProductRect },
          banner: summarize('banner', bannerPrimary.node, bannerPrimary.selector),
        },
        matchedProductCount: uniqueCards.length,
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  return result?.result?.value || null;
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
  const filterSourceType = args.source || null;
  const baseUrl = String(args.baseUrl || "http://localhost:3000").replace(/\/+$/, "");
  const limit = Number(args.limit || 0);
  const targets = readJson(WORKBENCH_TARGETS_PATH, { plpTargets: [] });
  const sourceTypes = filterSourceType ? [filterSourceType] : ["reference", "working"];
  const entries = sourceTypes.flatMap((sourceType) => buildEntries(targets, filterPageId, filterViewportProfile, sourceType));
  const selectedEntries = limit > 0 ? entries.slice(0, limit) : entries;

  const grouped = new Map();
  for (const item of selectedEntries) {
    const key = `${item.viewportProfile}:${item.sourceType}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const results = [];
  const errors = [];
  for (const [key, items] of grouped.entries()) {
    const [viewportProfile] = key.split(":");
    let session = null;
    try {
      session = await launchChromeSession(viewportFor(viewportProfile));
      for (const item of items) {
        try {
          const targetUrl = buildTargetUrl(item, baseUrl);
          await session.client.send("Page.navigate", { url: targetUrl });
          await waitForPageReady(session.client);
          await settlePlpPage(session.client);
          const extracted = await extractGroups(session.client, item);
          const currentHref = String(extracted?.page?.href || "");
          if (!currentHref || currentHref.startsWith("chrome-error://")) throw new Error(`page_load_failed:${currentHref || "empty"}`);
          results.push({
            pageId: item.pageId,
            viewportProfile: item.viewportProfile,
            sourceType: item.sourceType || "reference",
            extractedAt: new Date().toISOString(),
            capturedUrl: targetUrl,
            sourceUrl: item.sourceUrl,
            fallbackFromViewportProfile: item.fallbackFromViewportProfile || null,
            page: extracted?.page || null,
            matchedProductCount: extracted?.matchedProductCount || 0,
            groups: extracted?.groups || {},
          });
          console.log(`grouped ${item.sourceType || "reference"} ${item.pageId} ${item.viewportProfile}`);
        } catch (error) {
          errors.push({
            pageId: item.pageId,
            viewportProfile: item.viewportProfile,
            sourceType: item.sourceType || "reference",
            error: String(error),
            recordedAt: new Date().toISOString(),
          });
        }
      }
    } finally {
      await closeChromeSession(session);
    }
  }

  const existing = readJson(OUT_INDEX_PATH, { entries: [] });
  const merged = new Map();
  for (const item of existing.entries || []) merged.set(artifactKey(item), item);
  for (const item of results) merged.set(artifactKey(item), item);
  const mergedEntries = Array.from(merged.values()).sort((a, b) => `${a.pageId}:${a.viewportProfile}:${a.sourceType}`.localeCompare(`${b.pageId}:${b.viewportProfile}:${b.sourceType}`));
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
