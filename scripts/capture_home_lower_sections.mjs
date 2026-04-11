import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const OUT_DIR = path.join(ROOT, "data", "visual", "home-lower");
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
const BASE_URL = process.env.VISUAL_BASE_URL || "http://localhost:3000";

const VIEWPORT = {
  width: 430,
  height: 4200,
  deviceScaleFactor: 3,
  mobile: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
};

const SECTION_CONFIG = {
  "brand-showroom": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 브랜드 쇼룸 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?homeSandbox=brand-showroom`,
    cloneSelector: '[data-codex-slot="brand-showroom"]',
  },
  "latest-product-news": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 최신 제품 소식 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?homeSandbox=latest-product-news`,
    cloneSelector: '[data-codex-slot="latest-product-news"]',
  },
  "space-renewal": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 추천 상품 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?homeSandbox=space-renewal`,
    cloneSelector: '[data-codex-slot="space-renewal"], .codex-home-space-renewal',
  },
  subscription: {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 가전 구독 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?device=pc`,
    cloneSelector: '[data-codex-slot="subscription"]',
  },
  "smart-life": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 슬기로운 가전생활 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?homeSandbox=smart-life`,
    cloneSelector: '[data-codex-slot="smart-life"]',
  },
  "missed-benefits": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 놓치면 아쉬운 혜택 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?homeSandbox=missed-benefits`,
    cloneSelector: '[data-codex-slot="missed-benefits"]',
  },
  "lg-best-care": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 베스트 케어 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?homeSandbox=lg-best-care`,
    cloneSelector: '[data-codex-slot="lg-best-care"]',
  },
  "bestshop-guide": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 베스트샵 이용안내 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?homeSandbox=bestshop-guide`,
    cloneSelector: '[data-codex-slot="bestshop-guide"]',
  },
  "summary-banner-2": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 하단 배너 영역"]',
    cloneUrl: `${BASE_URL}/clone-content/home?device=pc`,
    cloneSelector: '[data-codex-slot="summary-banner-2"]',
  },
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return 13000 + Math.floor(Math.random() * 500);
}

async function applyViewport(client) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
    mobile: VIEWPORT.mobile,
    screenWidth: VIEWPORT.width,
    screenHeight: VIEWPORT.height,
  });
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await client.send("Emulation.setUserAgentOverride", {
    userAgent: VIEWPORT.userAgent,
    platform: VIEWPORT.platform,
    acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  });
}

async function launchChromeSession() {
  const port = randomPort();
  const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-home-lower-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    ],
    { stdio: "ignore" }
  );

  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, 60, 300);
  if (!version) throw new Error("chrome debug endpoint unavailable");
  const pageTarget = await waitForPageTarget(port, 60, 300);
  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await applyViewport(client);

  async function close() {
    await client.close().catch(() => {});
    chrome.kill("SIGKILL");
    await sleep(200);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup failures on WSL/Windows mounts.
    }
  }

  return { client, close };
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await sleep(2500);
}

async function getSelectorRect(client, selector) {
  const expression = `
    (() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result?.result?.value || null;
}

function padClip(rect) {
  const pad = 16;
  return {
    x: Math.max(0, Math.floor(rect.x - pad)),
    y: Math.max(0, Math.floor(rect.y - pad)),
    width: Math.max(1, Math.ceil(rect.width + pad * 2)),
    height: Math.max(1, Math.ceil(rect.height + pad * 2)),
    scale: 1,
  };
}

async function captureClip(client, clip, outputPath) {
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip,
  });
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, "base64"));
}

async function captureSection(url, selector, outputPath) {
  const session = await launchChromeSession();
  try {
    await navigate(session.client, url);
    let rect = null;
    for (let i = 0; i < 12; i += 1) {
      rect = await getSelectorRect(session.client, selector);
      if (rect) break;
      await sleep(500);
    }
    if (!rect) throw new Error(`selector_not_found:${selector}`);
    const clip = padClip(rect);
    await captureClip(session.client, clip, outputPath);
    return { url, selector, rect, clip, path: outputPath };
  } finally {
    await session.close();
  }
}

async function main() {
  const requested = process.argv.slice(2);
  const sectionIds = requested.length ? requested : Object.keys(SECTION_CONFIG);
  ensureDir(OUT_DIR);

  for (const sectionId of sectionIds) {
    const config = SECTION_CONFIG[sectionId];
    if (!config) {
      console.error(`Unknown section: ${sectionId}`);
      process.exitCode = 1;
      continue;
    }
    const dir = path.join(OUT_DIR, sectionId);
    ensureDir(dir);
    try {
      const live = await captureSection(
        config.liveUrl,
        config.liveSelector,
        path.join(dir, "live-reference.png"),
      );
      const clone = await captureSection(
        config.cloneUrl,
        config.cloneSelector,
        path.join(dir, "working.png"),
      );
      fs.writeFileSync(
        path.join(dir, "metadata.json"),
        JSON.stringify(
          {
            sectionId,
            capturedAt: new Date().toISOString(),
            viewport: VIEWPORT,
            live,
            clone,
          },
          null,
          2,
        ),
        "utf-8",
      );
      console.log(`${sectionId}: ok`);
    } catch (error) {
      fs.writeFileSync(path.join(dir, "error.txt"), String(error?.stack || error), "utf-8");
      console.log(`${sectionId}: failed`);
      process.exitCode = 1;
    }
  }
}

main()
  .then(() => {
    process.exit(process.exitCode || 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
