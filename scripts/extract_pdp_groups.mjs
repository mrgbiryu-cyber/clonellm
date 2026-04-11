import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const PDP_VISUAL_INDEX_PATH = path.join(ROOT, "data", "visual", "pdp", "index.json");
const OUT_DIR = path.join(ROOT, "data", "normalized", "pdp-groups");
const OUT_INDEX_PATH = path.join(OUT_DIR, "index.json");
const LOCK_PATH = path.join(ROOT, "tmp", "extract-pdp-groups.lock");
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
      try {
        fs.closeSync(fd);
      } catch {}
      try {
        fs.unlinkSync(lockPath);
      } catch {}
    };
  } catch {
    const holder = readJson(lockPath, null);
    throw new Error(`lock_exists:${lockPath}${holder ? ` holder=${JSON.stringify(holder)}` : ""}`);
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
      height: 3200,
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
    height: 3200,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    platform: "Linux x86_64",
  };
}

function randomPort() {
  return 10800 + Math.floor(Math.random() * 500);
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
    console.log(`launch chrome attempt=${attempt + 1} viewport=${viewport.profile}`);
    const port = randomPort();
    const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-pdp-group-"));
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
      console.log(`connected cdp port=${port} viewport=${viewport.profile}`);
      client = new CdpClient(pageTarget.webSocketDebuggerUrl);
      await client.connect();
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await applyViewport(client, viewport);
      return { chrome, client };
    } catch (error) {
      lastError = error;
      console.error(`launch failed viewport=${viewport.profile}: ${String(error)}`);
      try {
        await client?.close();
      } catch {}
      try {
        chrome.kill("SIGKILL");
      } catch {}
      await sleep(300);
    }
  }
  throw lastError || new Error("launchChromeSession failed");
}

async function closeChromeSession(session) {
  try {
    await session?.client?.close();
  } catch {}
  try {
    session?.chrome?.kill("SIGKILL");
  } catch {}
  await sleep(200);
}

async function waitForPageReady(client) {
  for (let i = 0; i < 30; i += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression: `(() => JSON.stringify({
        href: location.href || "",
        readyState: document.readyState || "",
        title: document.title || "",
        body: !!document.body
      }))()`,
      returnByValue: true,
      awaitPromise: true,
    });
    const state = JSON.parse(result?.result?.value || "{}");
    if (state.href && state.readyState && state.body) return state;
    await sleep(500);
  }
  return null;
}

async function settleProductPage(client) {
  await sleep(5000);
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const hidden = [
        '.chatbot','.floating','.sticky-banner','.layer-popup','.toast','[class*="chat"]','[class*="Chat"]','[class*="toast"]'
      ];
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

function buildEntries(filterPageId, filterViewportProfile, filterSourceType) {
  const index = readJson(PDP_VISUAL_INDEX_PATH, { captures: [] });
  return (index.captures || []).filter((item) => {
    if (filterPageId && item.pageId !== filterPageId) return false;
    if (filterViewportProfile && item.viewportProfile !== filterViewportProfile) return false;
    if (filterSourceType && (item.sourceType || "reference") !== filterSourceType) return false;
    return true;
  });
}

function buildTargetUrl(entry, baseUrl) {
  if ((entry.sourceType || "reference") === "working") {
    return `${baseUrl}/clone-product-content?pageId=${encodeURIComponent(entry.pageId)}&viewportProfile=${encodeURIComponent(entry.viewportProfile)}&href=${encodeURIComponent(entry.href)}`;
  }
  return entry.href;
}

function artifactKey(item) {
  return `${item.sourceType || "reference"}:${item.pageId}:${item.viewportProfile}:${item.href}`;
}

async function extractGroups(client, viewportProfile) {
  const result = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const rectOf = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        const style = window.getComputedStyle(node);
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          display: style.display,
          position: style.position,
          zIndex: style.zIndex,
        };
      };
      const findFirst = (selectors) => {
        for (const selector of selectors) {
          const node = document.querySelector(selector);
          if (node && rectOf(node)) return { node, selector };
        }
        for (const selector of selectors) {
          const node = document.querySelector(selector);
          if (node) return { node, selector };
        }
        return { node: null, selector: null };
      };
      const scoreNode = (node, tokens) => {
        const haystack = ((node?.textContent || '') + ' ' + (node?.className || '') + ' ' + (node?.id || '')).toLowerCase();
        return tokens.reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);
      };
      const findBestDescendant = (root, selectors, tokens) => {
        if (!root) return { node: null, selector: null };
        const candidates = [];
        selectors.forEach((selector) => {
          root.querySelectorAll(selector).forEach((node) => {
            const rect = rectOf(node);
            if (!rect) return;
            candidates.push({
              node,
              selector,
              score: scoreNode(node, tokens),
              area: rect.width * rect.height,
              y: rect.y,
            });
          });
        });
        candidates.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.area !== a.area) return b.area - a.area;
          return a.y - b.y;
        });
        return candidates[0] || { node: null, selector: null };
      };
      const galleryPrimary = ${viewportProfile === "mo" ? "findFirst(['#mobile_summary_gallery','#desktop_summary_gallery','.pdp-visual-area','[id*=\"summary_gallery\"]'])" : "findFirst(['#desktop_summary_gallery','#mobile_summary_gallery','.pdp-visual-area','[id*=\"summary_gallery\"]'])"};
      const summaryPrimary = findFirst(['.pdp-info-area','[class*=\"pdp-info-area\"]','[class*=\"product-info\"]','[class*=\"pdp_detail\"]']);
      const pricePrimary = findBestDescendant(
        summaryPrimary.node,
        ['[class*=\"price\"]','[id*=\"price\"]','[class*=\"benefit\"]','[id*=\"benefit\"]','[data-model-price]'],
        ['price','sale','benefit','혜택','가격']
      );
      const optionPrimary = findBestDescendant(
        summaryPrimary.node,
        ['[class*=\"option\"]','[id*=\"option\"]','select','[role=\"radiogroup\"]','[class*=\"select\"]','[class*=\"model\"]'],
        ['option','옵션','color','색상','size','용량','모델']
      );
      const stickyPrimary = (() => {
        const candidates = Array.from(document.querySelectorAll('[class*=\"sticky\"],[id*=\"sticky\"],[class*=\"purchase\"],[class*=\"buy\"],[class*=\"cart\"],[class*=\"cta\"]'));
        const visible = candidates
          .map((node) => ({ node, rect: rectOf(node), style: window.getComputedStyle(node) }))
          .filter((item) => item.rect);
        visible.sort((a, b) => {
          const aScore = ((a.style.position === 'sticky' || a.style.position === 'fixed') ? 4 : 0) + Math.max(0, window.innerHeight - a.rect.y);
          const bScore = ((b.style.position === 'sticky' || b.style.position === 'fixed') ? 4 : 0) + Math.max(0, window.innerHeight - b.rect.y);
          return bScore - aScore;
        });
        const picked = visible[0];
        return picked ? { node: picked.node, selector: picked.node.id ? '#' + picked.node.id : null } : { node: null, selector: null };
      })();
      const reviewPrimary = findFirst(['#review','[id*=\"review\"]','[class*=\"review\"]','[data-tab-id*=\"review\"]']);
      const qnaPrimary = findFirst(['#qna','[id*=\"qna\"]','[class*=\"qna\"]','[data-tab-id*=\"qna\"]']);
      const summarize = (id, found) => ({
        groupId: id,
        found: !!found?.node,
        selector: found?.selector || null,
        rect: rectOf(found?.node || null),
      });
      return {
        page: {
          title: document.title || '',
          href: location.href || '',
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
        groups: {
          gallery: summarize('gallery', galleryPrimary),
          summary: summarize('summary', summaryPrimary),
          price: summarize('price', pricePrimary),
          option: summarize('option', optionPrimary),
          sticky: summarize('sticky', stickyPrimary),
          review: summarize('review', reviewPrimary),
          qna: summarize('qna', qnaPrimary),
        },
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
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });
  const args = parseArgs(process.argv.slice(2));
  const filterPageId = args.pageId || null;
  const filterViewportProfile = args.viewportProfile || null;
  const filterSourceType = args.source || null;
  const baseUrl = String(args.baseUrl || "http://localhost:3000").replace(/\/+$/, "");
  const limit = Number(args.limit || 0);

  const entries = buildEntries(filterPageId, filterViewportProfile, filterSourceType);
  const selectedEntries = limit > 0 ? entries.slice(0, limit) : entries;
  console.log(`extract_pdp_groups entries=${selectedEntries.length} pageId=${filterPageId || "all"} viewport=${filterViewportProfile || "all"} source=${filterSourceType || "all"}`);
  const groups = new Map();
  for (const item of selectedEntries) {
    const key = `${item.viewportProfile}:${item.sourceType || "reference"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const results = [];
  const errors = [];
  for (const [key, items] of groups.entries()) {
    const [viewportProfile] = key.split(":");
    let session = null;
    try {
      session = await launchChromeSession(viewportFor(viewportProfile));
      for (const item of items) {
        try {
          console.log(`navigate ${(item.sourceType || "reference")} ${item.pageId} ${item.viewportProfile} ${item.pathname || item.href}`);
          const targetUrl = buildTargetUrl(item, baseUrl);
          await session.client.send("Page.navigate", { url: targetUrl });
          await waitForPageReady(session.client);
          await settleProductPage(session.client);
          const extracted = await extractGroups(session.client, viewportProfile);
          const currentHref = String(extracted?.page?.href || "");
          if (!currentHref || currentHref.startsWith("chrome-error://")) {
            throw new Error(`page_load_failed:${currentHref || "empty"}`);
          }
          results.push({
            pageId: item.pageId,
            viewportProfile: item.viewportProfile,
            href: item.href,
            pathname: item.pathname || "",
            sourceType: item.sourceType || "reference",
            extractedAt: new Date().toISOString(),
            capturedUrl: targetUrl,
            fallbackFromViewportProfile: item.fallbackFromViewportProfile || null,
            page: extracted?.page || null,
            groups: extracted?.groups || {},
          });
          console.log(`grouped ${(item.sourceType || "reference")} ${item.pageId} ${item.viewportProfile} ${item.pathname || item.href}`);
        } catch (error) {
          errors.push({
            pageId: item.pageId,
            viewportProfile: item.viewportProfile,
            href: item.href,
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
  const mergedEntries = Array.from(merged.values()).sort((a, b) => {
    const left = `${a.pageId}:${a.viewportProfile}:${a.sourceType}:${a.pathname || a.href}`;
    const right = `${b.pageId}:${b.viewportProfile}:${b.sourceType}:${b.pathname || b.href}`;
    return left.localeCompare(right);
  });
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
