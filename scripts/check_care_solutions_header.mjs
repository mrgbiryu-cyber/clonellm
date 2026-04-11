import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
const BASE_URL = process.env.VISUAL_BASE_URL || "http://localhost:3000";
const OUT_PATH = path.join(ROOT, "docs", "care-solutions-header-check.md");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function waitForJson(url, attempts = 40, delay = 300) {
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

async function waitForPageTarget(port, attempts = 40, delay = 300) {
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
  return 15000 + Math.floor(Math.random() * 400);
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

async function launchChromeSession(viewport) {
  const port = randomPort();
  const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-care-header-"));
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

  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, 60, 300);
  if (!version) throw new Error("chrome debug endpoint unavailable");
  const pageTarget = await waitForPageTarget(port, 60, 300);
  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await client.send("Emulation.setUserAgentOverride", {
    userAgent: viewport.userAgent,
    platform: viewport.platform,
    acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  });
  if (viewport.mobile) {
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });
  }

  async function close() {
    await client.close().catch(() => {});
    try { chrome.kill("SIGKILL"); } catch {}
    await sleep(200);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  return { client, close };
}

async function inspectProfile(profile) {
  const viewport = viewportFor(profile);
  const session = await launchChromeSession(viewport);
  try {
    await session.client.send("Page.navigate", {
      url: `${BASE_URL}/clone/care-solutions?viewportProfile=${profile}`,
    });
    await sleep(3500);
    const result = await session.client.send("Runtime.evaluate", {
      expression: `(() => {
        const isVisible = (node) => {
          if (!node) return false;
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
        };
        const captureSelectors = ['.CommonPcGnb_header__MMuNW', '.header-wrap', '.header-top'];
        const shellSelectors = ['.shell-top', '.shell-bottom'];
        const capture = captureSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((node) => ({
          selector,
          visible: isVisible(node),
          top: Math.round(node.getBoundingClientRect().top),
          height: Math.round(node.getBoundingClientRect().height)
        })));
        const shell = shellSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((node) => ({
          selector,
          visible: isVisible(node),
          top: Math.round(node.getBoundingClientRect().top),
          height: Math.round(node.getBoundingClientRect().height)
        })));
        return {
          href: location.href,
          title: document.title,
          captureVisibleCount: capture.filter((item) => item.visible).length,
          shellVisibleCount: shell.filter((item) => item.visible).length,
          capture,
          shell
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    return { profile, ...(result?.result?.value || {}) };
  } finally {
    await session.close();
  }
}

function toMarkdown(results) {
  const lines = [];
  lines.push("# Care Solutions Header Check");
  lines.push("");
  lines.push(`- generatedAt: \`${new Date().toISOString()}\``);
  lines.push(`- baseUrl: \`${BASE_URL}\``);
  lines.push("");
  for (const item of results) {
    lines.push(`## ${item.profile.toUpperCase()}`);
    lines.push("");
    lines.push(`- href: \`${item.href || ""}\``);
    lines.push(`- shellVisibleCount: \`${item.shellVisibleCount}\``);
    lines.push(`- captureVisibleCount: \`${item.captureVisibleCount}\``);
    lines.push(`- status: \`${item.captureVisibleCount === 0 ? "pass" : "fail"}\``);
    lines.push("");
    lines.push("### Capture Selectors");
    lines.push("");
    for (const capture of item.capture || []) {
      lines.push(`- \`${capture.selector}\` visible=\`${capture.visible}\` top=\`${capture.top}\` height=\`${capture.height}\``);
    }
    lines.push("");
    lines.push("### Shell Selectors");
    lines.push("");
    for (const shell of item.shell || []) {
      lines.push(`- \`${shell.selector}\` visible=\`${shell.visible}\` top=\`${shell.top}\` height=\`${shell.height}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const results = [];
for (const profile of ["pc", "mo"]) {
  results.push(await inspectProfile(profile));
}
const markdown = toMarkdown(results);
fs.writeFileSync(OUT_PATH, `${markdown}\n`, "utf-8");
process.stdout.write(`${markdown}\n`);
