import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const OUT_DIR = path.join(ROOT, "data", "reports");
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
const BASE_URL = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const TARGET_URL = `${BASE_URL}/clone/home`;

const VIEWPORT = {
  width: 1460,
  height: 2200,
  deviceScaleFactor: 1,
  mobile: false,
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  platform: "Linux x86_64",
};

const SLOT_IDS = [
  "md-choice",
  "timedeal",
  "best-ranking",
  "space-renewal",
  "subscription",
  "brand-showroom",
  "latest-product-news",
  "smart-life",
  "summary-banner-2",
  "missed-benefits",
  "lg-best-care",
  "bestshop-guide",
];

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

async function waitForJson(url, attempts = 30, delay = 300) {
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

async function waitForPageTarget(port, attempts = 30, delay = 300) {
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
  return 15000 + Math.floor(Math.random() * 500);
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
  await client.send("Emulation.setUserAgentOverride", {
    userAgent: VIEWPORT.userAgent,
    platform: VIEWPORT.platform,
    acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  });
}

async function launchChromeSession() {
  const port = randomPort();
  const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-home-links-"));
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
    } catch {}
  }

  return { client, close };
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await sleep(3500);
}

async function evaluateJson(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result?.result?.value ?? null;
}

async function collectCoverage(client) {
  const expression = `
    (() => {
      const slotIds = ${JSON.stringify(SLOT_IDS)};
      const frame = document.getElementById('clone-frame');
      const doc = frame && frame.contentDocument ? frame.contentDocument : document;
      const normalize = (href) => String(href || '');
      return slotIds.map((slotId) => {
        const root = doc.querySelector('[data-codex-slot="' + slotId + '"]');
        if (!root) return { slotId, present: false };
        const anchors = Array.from(root.querySelectorAll('a[href]'));
        const items = anchors.map((anchor) => {
          const href = normalize(anchor.getAttribute('href'));
          const originHref = normalize(anchor.getAttribute('data-codex-origin-href'));
          const blocked = anchor.getAttribute('data-codex-blocked-link');
          let linkType = 'other';
          if (href.startsWith('/clone-product')) linkType = 'clone-product';
          else if (href.startsWith('/clone/')) linkType = 'clone-page';
          else if (href === '#' && blocked) linkType = 'blocked';
          else if (/^https?:\\/\\//.test(href)) linkType = 'external';
          else if (href.startsWith('#')) linkType = 'hash';
          return {
            href,
            originHref,
            blocked: blocked || '',
            linkType,
            text: String(anchor.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
          };
        });
        const counts = items.reduce((acc, item) => {
          acc[item.linkType] = (acc[item.linkType] || 0) + 1;
          return acc;
        }, {});
        return {
          slotId,
          present: true,
          anchorCount: items.length,
          counts,
          samples: items.slice(0, 12),
        };
      });
    })()
  `;
  return evaluateJson(client, expression);
}

async function main() {
  ensureDir(OUT_DIR);
  const session = await launchChromeSession();
  try {
    await navigate(session.client, TARGET_URL);
    await sleep(1500);
    const coverage = await collectCoverage(session.client);
    const payload = {
      generatedAt: new Date().toISOString(),
      targetUrl: TARGET_URL,
      coverage,
    };
    const outputPath = path.join(OUT_DIR, "home-link-coverage.json");
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
    console.log(`saved ${outputPath}`);
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
