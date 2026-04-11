import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const OUT_DIR = path.join(ROOT, "data", "debug", "gnb-state");
const CHROME = path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
const PORT = 9224;

const DEFAULT_URL = "https://www.lge.co.kr/home";
const DEFAULT_MENU = "제품/소모품";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(input) {
  return String(input)
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { url: DEFAULT_URL, menu: DEFAULT_MENU };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--url" && args[i + 1]) parsed.url = args[++i];
    else if (arg === "--menu" && args[i + 1]) parsed.menu = args[++i];
  }
  return parsed;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
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
        if (message.id && this.pending.has(message.id)) {
          const { resolve, reject } = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
          else resolve(message.result);
        }
      };
      ws.onclose = () => {
        for (const { reject } of this.pending.values()) {
          reject(new Error("CDP socket closed"));
        }
        this.pending.clear();
      };
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async close() {
    if (!this.ws) return;
    this.ws.close();
    await sleep(100);
  }
}

function collectSummaryExpression(menuLabel) {
  return `(() => {
    const targetLabel = ${JSON.stringify(menuLabel)};
    const text = (node) => (node?.textContent || '').replace(/\\s+/g, ' ').trim();
    const rect = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const style = (node) => {
      if (!node) return null;
      const s = window.getComputedStyle(node);
      return {
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        position: s.position,
        zIndex: s.zIndex,
        top: s.top,
        left: s.left,
        right: s.right,
        bottom: s.bottom,
        marginTop: s.marginTop,
        paddingTop: s.paddingTop,
        transform: s.transform,
      };
    };
    const unionRects = (rects) => {
      const filtered = (rects || []).filter((item) => item && item.width > 0 && item.height > 0);
      if (!filtered.length) return null;
      const left = Math.min(...filtered.map((item) => item.x));
      const top = Math.min(...filtered.map((item) => item.y));
      const right = Math.max(...filtered.map((item) => item.x + item.width));
      const bottom = Math.max(...filtered.map((item) => item.y + item.height));
      return { x: left, y: top, width: right - left, height: bottom - top };
    };
    const menuAnchors = Array.from(document.querySelectorAll('.CommonPcGnb_item__ooPqg'));
    const menus = menuAnchors.map((anchor) => {
      const navItem = anchor.closest('li');
      const wrapper = navItem?.querySelector(':scope > div') || anchor.parentElement?.querySelector(':scope > div') || null;
      const topStrip =
        (wrapper?.matches?.('.CommonPcGnb_nav_cate__KkLVL') ? wrapper : null) ||
        wrapper?.querySelector(':scope > .CommonPcGnb_nav_cate__KkLVL') ||
        wrapper?.querySelector('.CommonPcGnb_nav_cate__KkLVL') ||
        null;
      const superWrap =
        (wrapper?.matches?.('.CommonPcGnb_super_category_wrap__1fxja') ? wrapper : null) ||
        wrapper?.querySelector(':scope > .CommonPcGnb_super_category_wrap__1fxja') ||
        wrapper?.querySelector('.CommonPcGnb_super_category_wrap__1fxja') ||
        null;
      const depth2 = topStrip ? Array.from(topStrip.querySelectorAll('.CommonPcGnb_scroll_item__bXHY9')).map((item) => ({
        label: text(item),
        controls: item.getAttribute('aria-controls') || '',
        classes: item.className,
        rect: rect(item)
      })) : [];
      const depth3Panels = (superWrap || navItem) ? Array.from((superWrap || navItem).querySelectorAll('.CommonPcGnb_nav_cate_list__BYpir')).map((node) => ({
        id: node.id || '',
        classes: node.className,
        style: style(node),
        rect: rect(node),
        columnCount: node.querySelectorAll('.CommonPcGnb_column__xtPmi').length,
        itemCount: node.querySelectorAll('.CommonPcGnb_sub_cate_list__MNtPR li').length
      })) : [];
      const visibleDepth3Panels = depth3Panels.filter((node) => {
        const width = node?.rect?.width || 0;
        const height = node?.rect?.height || 0;
        return (
          node?.style?.display !== 'none' &&
          node?.style?.visibility !== 'hidden' &&
          node?.style?.opacity !== '0' &&
          width > 0 &&
          height > 0
        );
      });
      const topStripRect = rect(topStrip);
      const superWrapRect = rect(superWrap);
      const backgroundRect = rect(document.querySelector('.CommonPcGnb_bg___BHPF') || null);
      const panelFootprintRect = unionRects([
        topStripRect,
        superWrapRect,
        ...visibleDepth3Panels.map((node) => node.rect),
      ]);
      return {
        label: text(anchor),
        href: anchor.getAttribute('href') || '',
        ariaExpanded: anchor.getAttribute('aria-expanded') || '',
        classes: anchor.className,
        rect: rect(anchor),
        navItemClasses: navItem?.className || '',
        panelExists: !!topStrip || !!superWrap,
        panelClasses: wrapper?.className || [topStrip?.className || '', superWrap?.className || ''].filter(Boolean).join(' | '),
        panelStyle: style(wrapper || topStrip || superWrap),
        panelRect: panelFootprintRect,
        topStripRect,
        topStripStyle: style(topStrip),
        depth2,
        depth3Panels
        ,
        visibleDepth3Panels,
        superWrapRect,
        backgroundRect
      };
    });
    const matched = menus.find((item) => item.label === targetLabel) || null;
    return JSON.stringify({
      viewport: { width: window.innerWidth, height: window.innerHeight },
      targetMenu: targetLabel,
      matched,
      allMenus: menus.map((item) => ({
        label: item.label,
        ariaExpanded: item.ariaExpanded,
        classes: item.classes,
        navItemClasses: item.navItemClasses,
        panelStyle: item.panelStyle
      }))
    });
  })();`;
}

function hoverExpression(menuLabel) {
  return `(() => {
    const targetLabel = ${JSON.stringify(menuLabel)};
    const anchor = Array.from(document.querySelectorAll('.CommonPcGnb_item__ooPqg'))
      .find((node) => (node.textContent || '').replace(/\\s+/g, ' ').trim() === targetLabel);
    if (!anchor) return 'anchor-not-found';
    const li = anchor.closest('li');
    ['mouseenter','mouseover','pointerenter','pointerover','focusin'].forEach((type) => {
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
      anchor.dispatchEvent(ev);
      li?.dispatchEvent(ev);
    });
    return 'ok';
  })();`;
}

function clickExpression(menuLabel) {
  return `(() => {
    const targetLabel = ${JSON.stringify(menuLabel)};
    const anchor = Array.from(document.querySelectorAll('.CommonPcGnb_item__ooPqg'))
      .find((node) => (node.textContent || '').replace(/\\s+/g, ' ').trim() === targetLabel);
    if (!anchor) return 'anchor-not-found';
    const li = anchor.closest('li');
    ['pointerdown','mousedown','pointerup','mouseup','click','focus'].forEach((type) => {
      const ctor = type === 'focus' ? FocusEvent : MouseEvent;
      const ev = new ctor(type, { bubbles: true, cancelable: true, view: window });
      anchor.dispatchEvent(ev);
      li?.dispatchEvent(ev);
    });
    anchor.focus?.();
    return 'ok';
  })();`;
}

async function moveMouseAway(client) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 1,
    y: 1,
    button: "none",
  });
}

async function evaluateJson(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  const raw = result?.result?.value;
  if (typeof raw !== "string") throw new Error("evaluation did not return JSON string");
  return JSON.parse(raw);
}

async function evaluateValue(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result?.result?.value;
}

async function captureScreenshot(client, outputPath) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  fs.writeFileSync(outputPath, Buffer.from(result.data, "base64"));
}

async function hoverWithCdp(client, rect) {
  if (!rect || !rect.width || !rect.height) return false;
  const x = Math.round(rect.x + rect.width / 2);
  const y = Math.round(rect.y + rect.height / 2);
  await moveMouseAway(client);
  await sleep(80);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
  });
  return true;
}

async function clickWithCdp(client, rect) {
  if (!rect || !rect.width || !rect.height) return false;
  const x = Math.round(rect.x + rect.width / 2);
  const y = Math.round(rect.y + rect.height / 2);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  return true;
}

function diffSummary(before, after) {
  const beforeTarget = before.matched || {};
  const afterTarget = after.matched || {};
  return {
    menuLabel: after.targetMenu,
    anchor: {
      ariaExpandedBefore: beforeTarget.ariaExpanded || "",
      ariaExpandedAfter: afterTarget.ariaExpanded || "",
      classBefore: beforeTarget.classes || "",
      classAfter: afterTarget.classes || "",
      navItemClassBefore: beforeTarget.navItemClasses || "",
      navItemClassAfter: afterTarget.navItemClasses || "",
    },
    panel: {
      existsBefore: !!beforeTarget.panelExists,
      existsAfter: !!afterTarget.panelExists,
      styleBefore: beforeTarget.panelStyle || null,
      styleAfter: afterTarget.panelStyle || null,
      rectBefore: beforeTarget.panelRect || null,
      rectAfter: afterTarget.panelRect || null,
    },
    depth2: {
      countBefore: (beforeTarget.depth2 || []).length,
      countAfter: (afterTarget.depth2 || []).length,
    },
    depth3Panels: {
      countBefore: (beforeTarget.depth3Panels || []).length,
      countAfter: (afterTarget.depth3Panels || []).length,
      visibleAfter: (afterTarget.depth3Panels || [])
        .filter((item) => item.style?.display !== "none" && item.style?.visibility !== "hidden" && item.style?.opacity !== "0")
        .map((item) => ({
          id: item.id,
          classes: item.classes,
          rect: item.rect,
          columnCount: item.columnCount,
          itemCount: item.itemCount,
        })),
    },
  };
}

function isValidOpenState(summary) {
  const matched = summary?.matched || {};
  const ariaExpanded = String(matched.ariaExpanded || "") === "true";
  const topStripRect = matched.topStripRect || {};
  const visibleDepth3Panels = matched.visibleDepth3Panels || [];
  return (
    ariaExpanded &&
    (Number(topStripRect.width || 0) > 0 || Number(topStripRect.height || 0) > 0) &&
    visibleDepth3Panels.length > 0
  );
}

async function tryOpenState(client, menu, anchorRect) {
  const attempts = [];
  const strategies = [
    {
      name: "dom-hover",
      run: async () => {
        await evaluateValue(client, hoverExpression(menu));
      },
    },
    {
      name: "cdp-hover",
      run: async () => {
        await hoverWithCdp(client, anchorRect);
      },
    },
    {
      name: "dom-hover+cdp-hover",
      run: async () => {
        await evaluateValue(client, hoverExpression(menu));
        await hoverWithCdp(client, anchorRect);
      },
    },
    {
      name: "dom-hover+cdp-hover+dom-click",
      run: async () => {
        await evaluateValue(client, hoverExpression(menu));
        await hoverWithCdp(client, anchorRect);
        await evaluateValue(client, clickExpression(menu));
      },
    },
    {
      name: "dom-click",
      run: async () => {
        await evaluateValue(client, clickExpression(menu));
      },
    },
    {
      name: "cdp-hover+cdp-click",
      run: async () => {
        await hoverWithCdp(client, anchorRect);
        await clickWithCdp(client, anchorRect);
      },
    },
  ];

  for (const strategy of strategies) {
    await moveMouseAway(client);
    await sleep(120);
    await strategy.run();
    await sleep(700);
    const summary = await evaluateJson(client, collectSummaryExpression(menu));
    const valid = isValidOpenState(summary);
    attempts.push({
      name: strategy.name,
      valid,
      ariaExpanded: summary?.matched?.ariaExpanded || "",
      navItemClasses: summary?.matched?.navItemClasses || "",
      panelRect: summary?.matched?.panelRect || null,
      topStripRect: summary?.matched?.topStripRect || null,
      visibleDepth3Count: (summary?.matched?.visibleDepth3Panels || []).length,
    });
    if (valid) return { summary, attempts, strategy: strategy.name };
  }

  const finalSummary = await evaluateJson(client, collectSummaryExpression(menu));
  return { summary: finalSummary, attempts, strategy: null };
}

async function main() {
  const { url, menu } = parseArgs();
  ensureDir(OUT_DIR);
  ensureDir(path.join(ROOT, "tmp"));
  const outBase = path.join(OUT_DIR, `${slug(url)}__${slug(menu)}`);
  const userDataDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cdp-gnb-"));

  const chrome = spawn(
    CHROME,
    [
      "--headless",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--window-size=1460,1400",
      url,
    ],
    { stdio: "ignore" }
  );

  try {
    const version = await waitForJson(`http://127.0.0.1:${PORT}/json/version`, 30, 500);
    await sleep(2500);
    const targets = await waitForJson(`http://127.0.0.1:${PORT}/json/list`, 10, 300);
    const pageTarget = targets.find((target) => target.type === "page") || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error("page target not found");

    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("DOM.enable");
    await client.send("CSS.enable");
    await sleep(1500);

    const beforeSummary = await evaluateJson(client, collectSummaryExpression(menu));
    const beforeSnapshot = await client.send("DOMSnapshot.captureSnapshot", {
      computedStyles: ["display", "visibility", "opacity", "position", "z-index"],
      includeDOMRects: true,
      includeBlendedBackgroundColors: false,
      includeTextColorOpacities: false,
    });
    await captureScreenshot(client, `${outBase}.default.png`);

    const openAttempt = await tryOpenState(client, menu, beforeSummary?.matched?.rect || null);
    const afterSummary = openAttempt.summary;
    const afterSnapshot = await client.send("DOMSnapshot.captureSnapshot", {
      computedStyles: ["display", "visibility", "opacity", "position", "z-index"],
      includeDOMRects: true,
      includeBlendedBackgroundColors: false,
      includeTextColorOpacities: false,
    });
    await captureScreenshot(client, `${outBase}.open.png`);

    const payload = {
      url,
      menu,
      hoverResult: openAttempt.strategy || "failed",
      attempts: openAttempt.attempts,
      cdpBrowserVersion: version.Browser || "",
      beforeSummary,
      afterSummary,
      openStateValid: isValidOpenState(afterSummary),
      diff: diffSummary(beforeSummary, afterSummary),
      files: {
        defaultScreenshot: `${outBase}.default.png`,
        openScreenshot: `${outBase}.open.png`,
        defaultCdp: `${outBase}.default.cdp.json`,
        openCdp: `${outBase}.open.cdp.json`,
      },
    };

    fs.writeFileSync(`${outBase}.json`, JSON.stringify(payload, null, 2), "utf-8");
    fs.writeFileSync(`${outBase}.default.cdp.json`, JSON.stringify(beforeSnapshot, null, 2), "utf-8");
    fs.writeFileSync(`${outBase}.open.cdp.json`, JSON.stringify(afterSnapshot, null, 2), "utf-8");

    await client.close();
    console.log(`wrote ${outBase}.json`);
  } finally {
    chrome.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
