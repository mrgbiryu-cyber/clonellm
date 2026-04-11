import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const OUT_DIR = path.join(ROOT, "data", "visual", "service-pages");
const OUT_INDEX_PATH = path.join(OUT_DIR, "index.json");
const LOCK_PATH = path.join(ROOT, "tmp", "capture-service-pages.lock");
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
const PAGE_TARGETS = [
  { pageId: "support", sourceUrl: "https://www.lge.co.kr/support" },
  { pageId: "bestshop", sourceUrl: "https://www.lge.co.kr/bestshop" },
  { pageId: "care-solutions", sourceUrl: "https://www.lge.co.kr/care-solutions" },
];

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
      profile,
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
    profile,
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
  return 11000 + Math.floor(Math.random() * 600);
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
    const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-service-"));
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
      return {
        title: document.title || '',
        scrollHeight: Math.round(document.documentElement?.scrollHeight || document.body?.scrollHeight || 0)
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  await sleep(1200);
}

async function captureArtifacts(client, screenshotPath, htmlPath, viewport) {
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 },
  });
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));

  const htmlResult = await client.send("Runtime.evaluate", {
    expression: "document.documentElement.outerHTML",
    returnByValue: true,
    awaitPromise: true,
  });
  fs.writeFileSync(htmlPath, htmlResult?.result?.value || "", "utf8");

  const titleResult = await client.send("Runtime.evaluate", {
    expression: "document.title",
    returnByValue: true,
    awaitPromise: true,
  });
  return { title: titleResult?.result?.value || "" };
}

async function captureVariant(session, target, viewportProfile, sourceType, baseUrl) {
  const dir = path.join(OUT_DIR, target.pageId, viewportProfile);
  ensureDir(dir);
  const screenshotPath = path.join(dir, `${sourceType}.png`);
  const htmlPath = path.join(dir, `${sourceType}.html`);
  const metadataPath = path.join(dir, `${sourceType}.metadata.json`);
  const targetUrl = sourceType === "working"
    ? `${baseUrl}/clone-content/${encodeURIComponent(target.pageId)}?viewportProfile=${encodeURIComponent(viewportProfile)}`
    : `${baseUrl}/reference-content/${encodeURIComponent(target.pageId)}?viewportProfile=${encodeURIComponent(viewportProfile)}`;

  const client = session.client;
  await client.send("Page.navigate", { url: targetUrl });
  await waitForPageReady(client);
  await settlePage(client);
  const extra = await captureArtifacts(client, screenshotPath, htmlPath, viewportFor(viewportProfile));

  const payload = {
    pageId: target.pageId,
    viewportProfile,
    sourceType,
    targetType: "service-page",
    title: extra.title,
    capturedUrl: targetUrl,
    sourceUrl: target.sourceUrl,
    capturedAt: new Date().toISOString(),
    artifact: { screenshotPath, htmlPath, metadataPath },
  };
  writeJson(metadataPath, payload);
  return payload;
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

  const viewports = filterViewportProfile ? [filterViewportProfile] : ["pc", "mo"];
  const targets = PAGE_TARGETS.filter((item) => !filterPageId || item.pageId === filterPageId);
  const captures = [];
  const errors = [];

  for (const target of targets) {
    for (const viewportProfile of viewports) {
      let session = null;
      try {
        session = await launchChromeSession(viewportFor(viewportProfile));
        const capture = await captureVariant(session, target, viewportProfile, sourceType, baseUrl);
        captures.push(capture);
        console.log(`captured ${sourceType} ${target.pageId} ${viewportProfile}`);
      } catch (error) {
        errors.push({
          sourceType,
          pageId: target.pageId,
          viewportProfile,
          error: String(error),
          recordedAt: new Date().toISOString(),
        });
        console.error(`capture failed ${sourceType} ${target.pageId} ${viewportProfile}: ${String(error)}`);
      } finally {
        await closeChromeSession(session);
      }
    }
  }

  const existingIndex = readJson(OUT_INDEX_PATH, { captures: [] });
  const mergedMap = new Map();
  for (const item of existingIndex.captures || []) {
    mergedMap.set(`${item.sourceType}:${item.pageId}:${item.viewportProfile}`, item);
  }
  for (const item of captures) {
    mergedMap.set(`${item.sourceType}:${item.pageId}:${item.viewportProfile}`, item);
  }
  const mergedCaptures = Array.from(mergedMap.values()).sort((a, b) =>
    `${a.pageId}:${a.viewportProfile}:${a.sourceType}`.localeCompare(`${b.pageId}:${b.viewportProfile}:${b.sourceType}`)
  );

  writeJson(OUT_INDEX_PATH, {
    generatedAt: new Date().toISOString(),
    captureCount: mergedCaptures.length,
    captures: mergedCaptures,
    errors,
  });
  cleanup();
  console.log(JSON.stringify({ out: OUT_INDEX_PATH, captureCount: mergedCaptures.length, errorCount: errors.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
