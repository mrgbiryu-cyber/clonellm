import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const OUT_DIR = path.join(ROOT, "data", "visual", "home-lower");
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
const BASE_URL = process.env.VISUAL_BASE_URL || "http://localhost:3000";
const HOME_CLONE_MO_BASE = `${BASE_URL}/clone-content/home?viewportProfile=mo`;

const VIEWPORT = {
  width: 430,
  height: 4200,
  deviceScaleFactor: 3,
  mobile: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
};

const HOME_SMART_LIFE_ITEMS = [
  {
    title: "우리 가족의 생활 패턴에 알맞은 빌트인 스타일 냉장고는?",
    image: "https://www.lge.co.kr/kr/upload/admin/storyThumbnail/ListThumbnail_20260127_152537.jpg",
  },
  {
    title: "옷감 수축 걱정 없어 외출용 옷도 안심하고 건조해요",
    image: "https://www.lge.co.kr/kr/upload/admin/storyThumbnail/lglife-in-wash-combo-2-thumb-266x200_20241106_151959.jpg",
  },
  {
    title: "곧은 선 사이 간결하게 채운 컬러",
    image: "https://www.lge.co.kr/kr/story/lifestyle/interiortip/mmk_og/04/og.jpg",
  },
  {
    title: "요리부터 관리까지 손쉬운 광파오븐 노하우",
    image: "https://www.lge.co.kr/kr/upload/admin/storyThumbnail/smartway-stan-by-me-2-thumb-266x200_20260115_115830.jpg",
  },
];

const SECTION_CONFIG = {
  "brand-showroom": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 브랜드 쇼룸 영역"]',
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=brand-showroom`,
    cloneSelector: '[data-codex-slot="brand-showroom"]',
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
  },
  "latest-product-news": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 최신 제품 소식 영역"]',
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=latest-product-news`,
    cloneSelector: '[data-codex-slot="latest-product-news"]',
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
  },
  "space-renewal": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 추천 상품 영역"]',
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=space-renewal`,
    cloneSelector: '[data-codex-slot="space-renewal"], .codex-home-space-renewal',
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
  },
  subscription: {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 가전 구독 영역"]',
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=subscription`,
    cloneSelector: '[data-codex-slot="subscription"]',
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
  },
  "smart-life": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 슬기로운 가전생활 영역"]',
    liveAwaitVisualReady: true,
    liveTemplateImages: HOME_SMART_LIFE_ITEMS,
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=smart-life`,
    cloneSelector: '[data-codex-slot="smart-life"]',
    cloneAwaitVisualReady: true,
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
  },
  "missed-benefits": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 놓치면 아쉬운 혜택 영역"]',
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=missed-benefits`,
    cloneSelector: '[data-codex-slot="missed-benefits"]',
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
  },
  "lg-best-care": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 베스트 케어 영역"]',
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=lg-best-care`,
    cloneSelector: '[data-codex-slot="lg-best-care"]',
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
  },
  "bestshop-guide": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 베스트샵 이용안내 영역"]',
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=bestshop-guide`,
    cloneSelector: '[data-codex-slot="bestshop-guide"]',
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
  },
  "summary-banner-2": {
    liveUrl: "https://www.lge.co.kr/m/home",
    liveSelector: 'section[data-area="메인 하단 배너 영역"]',
    livePrepareMode: "isolate-mobile-section",
    liveCaptureSelector: "#__codex_capture_target",
    cloneUrl: `${HOME_CLONE_MO_BASE}&homeSandbox=summary-banner-2`,
    cloneSelector: '[data-codex-slot="summary-banner-2"]',
    clonePrepareMode: "isolate-mobile-section",
    cloneCaptureSelector: "#__codex_capture_target",
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

async function prepareCaptureSurface(client, selector, mode) {
  if (mode !== "isolate-mobile-section") return;
  const expression = `
    (() => {
      const source = document.querySelector(${JSON.stringify(selector)});
      if (!source) return { ok: false, reason: 'source_not_found' };
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.documentElement.style.background = '#fff';
      document.body.style.background = '#fff';
      Array.from(document.body.children).forEach((node) => {
        node.style.display = 'none';
      });
      const existing = document.getElementById('__codex_capture_root');
      if (existing) existing.remove();
      const root = document.createElement('div');
      root.id = '__codex_capture_root';
      root.style.position = 'relative';
      root.style.width = '430px';
      root.style.maxWidth = '430px';
      root.style.margin = '0';
      root.style.padding = '0';
      root.style.background = '#fff';
      root.style.boxSizing = 'border-box';
      root.style.display = 'block';
      source.id = '__codex_capture_target';
      source.style.width = '430px';
      source.style.maxWidth = '430px';
      source.style.margin = '0';
      source.style.left = '0';
      source.style.right = 'auto';
      source.style.boxSizing = 'border-box';
      document.body.appendChild(root);
      root.appendChild(source);
      root.style.display = 'block';
      return { ok: true };
    })()
  `;
  await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  await sleep(200);
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

async function waitForImages(client, selector) {
  const expression = `
    (async () => {
      const root = document.querySelector(${JSON.stringify(selector)});
      if (!root) return { ok: false, reason: 'root_not_found' };
      const images = Array.from(root.querySelectorAll('img'));
      await Promise.all(images.map(async (img) => {
        if (!img.getAttribute('src') && img.getAttribute('data-src')) {
          img.setAttribute('src', img.getAttribute('data-src'));
        }
        if (img.loading === 'lazy') img.loading = 'eager';
        try { await img.decode?.(); } catch {}
        if (!img.complete) {
          await new Promise((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(resolve, 2000);
          });
        }
      }));
      return { ok: true, imageCount: images.length };
    })()
  `;
  await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  await sleep(400);
}

async function primeSection(client, selector) {
  const expression = `
    (() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return { ok: false, reason: 'source_not_found' };
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
      return { ok: true };
    })()
  `;
  await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  await sleep(1200);
  await waitForImages(client, selector);
}

async function waitForVisualReady(client, selector, attempts = 12, delay = 500) {
  const expression = `
    (() => {
      const root = document.querySelector(${JSON.stringify(selector)});
      if (!root) return { ok: false, reason: 'root_not_found' };
      const templates = root.querySelectorAll('template[data-dgst]').length;
      const images = root.querySelectorAll('img').length;
      const pictures = root.querySelectorAll('picture').length;
      const backgroundNodes = Array.from(root.querySelectorAll('*')).filter((node) => {
        const style = window.getComputedStyle(node);
        return style && style.backgroundImage && style.backgroundImage !== 'none';
      }).length;
      const ready = templates === 0 || images > 0 || pictures > 0 || backgroundNodes > 0;
      return { ok: true, ready, templates, images, pictures, backgroundNodes };
    })()
  `;
  for (let index = 0; index < attempts; index += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    const value = result?.result?.value || null;
    if (value?.ready) {
      await sleep(400);
      return value;
    }
    await sleep(delay);
  }
  return null;
}

async function injectTemplateImages(client, selector, products = []) {
  if (!Array.isArray(products) || !products.length) return;
  const expression = `
    (() => {
      const root = document.querySelector(${JSON.stringify(selector)});
      if (!root) return { ok: false, reason: 'root_not_found' };
      const templates = Array.from(root.querySelectorAll('template[data-dgst]'));
      let imageIndex = 0;
      for (const template of templates) {
        const parent = template.parentElement;
        if (!parent) continue;
        const product = ${JSON.stringify(products)}[imageIndex] || {};
        imageIndex += 1;
        const existingImage = parent.querySelector('img');
        if (existingImage) continue;
        const img = document.createElement('img');
        img.src = product.image || '';
        img.alt = product.title || '';
        img.loading = 'eager';
        img.style.display = 'block';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = 'inherit';
        parent.innerHTML = '';
        parent.appendChild(img);
      }
      return { ok: true, templateCount: templates.length };
    })()
  `;
  await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  await sleep(400);
}

async function fillMissingImageSources(client, selector, products = []) {
  if (!Array.isArray(products) || !products.length) return;
  const expression = `
    (() => {
      const root = document.querySelector(${JSON.stringify(selector)});
      if (!root) return { ok: false, reason: 'root_not_found' };
      const seeds = ${JSON.stringify(products)};
      const images = Array.from(root.querySelectorAll('img')).filter((img) => {
        const src = img.getAttribute('src') || '';
        return !src.trim();
      });
      images.forEach((img, index) => {
        const seed = seeds[index];
        if (!seed?.image) return;
        img.setAttribute('src', seed.image);
        img.setAttribute('loading', 'eager');
        img.style.visibility = 'visible';
        img.style.opacity = '1';
      });
      return { ok: true, imageCount: images.length };
    })()
  `;
  await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  await sleep(400);
}

async function captureSection(url, selector, outputPath, options = {}) {
  const session = await launchChromeSession();
  try {
    await navigate(session.client, url);
    await primeSection(session.client, selector);
    if (options.awaitVisualReady) {
      await waitForVisualReady(session.client, selector);
    }
    if (options.templateImages) {
      await injectTemplateImages(session.client, selector, options.templateImages);
      await fillMissingImageSources(session.client, selector, options.templateImages);
    }
    await prepareCaptureSurface(session.client, selector, options.prepareMode);
    const captureSelector = options.captureSelector || selector;
    if (options.awaitVisualReady) {
      await waitForVisualReady(session.client, captureSelector, 8, 400);
    }
    await waitForImages(session.client, captureSelector);
    let rect = null;
    for (let i = 0; i < 12; i += 1) {
      rect = await getSelectorRect(session.client, captureSelector);
      if (rect) break;
      await sleep(500);
    }
    if (!rect) throw new Error(`selector_not_found:${captureSelector}`);
    const clip = padClip(rect);
    await captureClip(session.client, clip, outputPath);
    return { url, selector: captureSelector, rect, clip, path: outputPath };
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
        {
          awaitVisualReady: config.liveAwaitVisualReady,
          templateImages: config.liveTemplateImages,
          prepareMode: config.livePrepareMode,
          captureSelector: config.liveCaptureSelector,
        },
      );
      const clone = await captureSection(
        config.cloneUrl,
        config.cloneSelector,
        path.join(dir, "working.png"),
        {
          awaitVisualReady: config.cloneAwaitVisualReady,
          templateImages: config.cloneTemplateImages,
          prepareMode: config.clonePrepareMode,
          captureSelector: config.cloneCaptureSelector,
        },
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
