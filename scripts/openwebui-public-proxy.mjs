import http from "node:http";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const HOST = process.env.PUBLIC_PROXY_HOST || "0.0.0.0";
const PORT = Number(process.env.PUBLIC_PROXY_PORT || 3000);
const OPENWEBUI_TARGET = new URL(process.env.OPENWEBUI_TARGET || "http://127.0.0.1:8080");
const CLONELLM_TARGET = new URL(process.env.CLONELLM_TARGET || "http://127.0.0.1:3100");
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const BRAND_DIR = path.join(ROOT, "web", "brand");
const BRAND_NAME = process.env.PUBLIC_BRAND_NAME || "CNS Atlas";
const BRAND_ASSETS = new Map([
  ["/static/favicon.svg", { file: "lg-symbol.svg", type: "image/svg+xml; charset=utf-8" }],
  ["/static/favicon.png", { file: "lg-symbol-32.png", type: "image/png" }],
  ["/static/favicon-96x96.png", { file: "lg-symbol-96.png", type: "image/png" }],
  ["/static/apple-touch-icon.png", { file: "lg-symbol-180.png", type: "image/png" }],
  ["/static/logo.png", { file: "lg-symbol.png", type: "image/png" }],
  ["/static/splash.png", { file: "lg-symbol.png", type: "image/png" }],
  ["/static/splash-dark.png", { file: "lg-symbol.png", type: "image/png" }],
  ["/static/web-app-manifest-192x192.png", { file: "lg-symbol-192.png", type: "image/png" }],
  ["/static/web-app-manifest-512x512.png", { file: "lg-symbol-512.png", type: "image/png" }],
]);

const BUILDER_PATHS = new Map([
  ["/builder-admin", "/admin"],
  ["/builder-admin-legacy", "/admin-legacy"],
  ["/builder-admin-research", "/admin-research"],
  ["/builder-login", "/login"],
]);

function mapBuilderPath(reqUrl = "") {
  const url = new URL(reqUrl, "http://proxy.local");
  const exact = BUILDER_PATHS.get(url.pathname);
  if (exact) {
    url.pathname = exact;
    return `${url.pathname}${url.search}`;
  }

  const prefixPairs = [
    ["/builder-api/auth/", "/api/auth/"],
    ["/builder-api/workspace/", "/api/workspace/"],
    ["/builder-assets/", "/assets/"],
    ["/builder-raw-assets/", "/raw-assets/"],
  ];
  for (const [from, to] of prefixPairs) {
    if (url.pathname.startsWith(from)) {
      url.pathname = `${to}${url.pathname.slice(from.length)}`;
      return `${url.pathname}${url.search}`;
    }
  }

  if (url.pathname === "/builder-api/auth") {
    url.pathname = "/api/auth";
    return `${url.pathname}${url.search}`;
  }
  if (url.pathname === "/builder-api/workspace") {
    url.pathname = "/api/workspace";
    return `${url.pathname}${url.search}`;
  }

  return null;
}

function isBuilderPath(reqUrl = "") {
  return mapBuilderPath(reqUrl) !== null;
}

function rewriteBuilderBody(body) {
  return body
    .replaceAll('"/api/auth/', '"/builder-api/auth/')
    .replaceAll("'/api/auth/", "'/builder-api/auth/")
    .replaceAll("`/api/auth/", "`/builder-api/auth/")
    .replaceAll('"/api/workspace/', '"/builder-api/workspace/')
    .replaceAll("'/api/workspace/", "'/builder-api/workspace/")
    .replaceAll("`/api/workspace/", "`/builder-api/workspace/")
    .replaceAll('"/assets/', '"/builder-assets/')
    .replaceAll("'/assets/", "'/builder-assets/")
    .replaceAll("`/assets/", "`/builder-assets/")
    .replaceAll('"/raw-assets/', '"/builder-raw-assets/')
    .replaceAll("'/raw-assets/", "'/builder-raw-assets/")
    .replaceAll("`/raw-assets/", "`/builder-raw-assets/")
    .replaceAll('href="/admin"', 'href="/builder-admin"')
    .replaceAll("href='/admin'", "href='/builder-admin'")
    .replaceAll('href="/admin-research"', 'href="/builder-admin-research"')
    .replaceAll("href='/admin-research'", "href='/builder-admin-research'")
    .replaceAll('href="/admin-legacy"', 'href="/builder-admin-legacy"')
    .replaceAll("href='/admin-legacy'", "href='/builder-admin-legacy'")
    .replaceAll('href="/login"', 'href="/builder-login"')
    .replaceAll("href='/login'", "href='/builder-login'")
    .replaceAll('location.href = "/admin"', 'location.href = "/builder-admin"')
    .replaceAll("location.href = '/admin'", "location.href = '/builder-admin'")
    .replaceAll('location.href = "/login"', 'location.href = "/builder-login"')
    .replaceAll("location.href = '/login'", "location.href = '/builder-login'");
}

function shouldRouteToClonellm(reqUrl = "", headers = {}) {
  const pathname = new URL(reqUrl, "http://proxy.local").pathname;
  if (
    isBuilderPath(reqUrl) ||
    pathname.startsWith("/api/builder/lge/") ||
    pathname.startsWith("/runtime-draft/") ||
    pathname.startsWith("/runtime-compare/") ||
    pathname.startsWith("/asset-proxy") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/clone/") ||
    pathname.startsWith("/clone-content/")
  ) {
    return true;
  }

  if (pathname.startsWith("/assets/")) {
    if (/\.(?:js|mjs|css|map)$/i.test(pathname)) return false;
    const referer = String(headers.referer || "");
    return /\/(?:runtime-draft|runtime-compare|share|clone|clone-content)\//.test(referer);
  }

  return false;
}

function pickTarget(req) {
  return shouldRouteToClonellm(req.url, req.headers) ? CLONELLM_TARGET : OPENWEBUI_TARGET;
}

function getUpstreamPath(req) {
  return mapBuilderPath(req.url) || req.url;
}

function sendBrandAsset(req, res) {
  const pathname = new URL(req.url, "http://proxy.local").pathname;
  const asset = BRAND_ASSETS.get(pathname);
  if (!asset) return false;

  const filePath = path.join(BRAND_DIR, asset.file);
  if (!fs.existsSync(filePath)) return false;
  res.writeHead(200, {
    "content-type": asset.type,
    "cache-control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function rewriteBody(reqUrl, headers, body) {
  const pathname = new URL(reqUrl, "http://proxy.local").pathname;
  const contentType = String(headers["content-type"] || "");

  if (isBuilderPath(reqUrl) && contentType.includes("text/html")) {
    return rewriteBuilderBody(body);
  }

  if (pathname === "/api/config" && contentType.includes("application/json")) {
    try {
      const payload = JSON.parse(body);
      payload.name = BRAND_NAME;
      return JSON.stringify(payload);
    } catch {
      return body;
    }
  }

  if ((pathname === "/" || pathname === "/index.html") && contentType.includes("text/html")) {
    return body.replaceAll("Open WebUI", BRAND_NAME);
  }

  if (pathname === "/manifest.json" && contentType.includes("application/json")) {
    return body
      .replaceAll("Open WebUI", BRAND_NAME)
      .replaceAll("/static/favicon.png", "/static/logo.png");
  }

  return body;
}

function shouldBufferResponse(reqUrl, headers) {
  const pathname = new URL(reqUrl, "http://proxy.local").pathname;
  if (isBuilderPath(reqUrl)) {
    const contentType = String(headers["content-type"] || "");
    return contentType.includes("text/html");
  }
  if (pathname === "/api/config" || pathname === "/" || pathname === "/index.html" || pathname === "/manifest.json") {
    const contentType = String(headers["content-type"] || "");
    return contentType.includes("application/json") || contentType.includes("text/html");
  }
  return false;
}

function rewriteLocation(reqUrl, location) {
  if (!location || !isBuilderPath(reqUrl)) return location;
  if (location === "/login") return "/builder-login";
  if (location === "/admin") return "/builder-admin";
  if (location === "/admin-research") return "/builder-admin-research";
  if (location === "/admin-legacy") return "/builder-admin-legacy";
  return location;
}

function proxyRequest(req, res) {
  if (sendBrandAsset(req, res)) return;

  const target = pickTarget(req);
  const upstreamPath = getUpstreamPath(req);
  const headers = {
    ...req.headers,
    "accept-encoding": "identity",
    "x-forwarded-host": req.headers.host || "",
    "x-forwarded-proto": "http",
    "x-forwarded-for": [req.socket.remoteAddress, req.headers["x-forwarded-for"]].filter(Boolean).join(", "),
  };

  const upstream = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: upstreamPath,
      headers,
    },
    (upstreamRes) => {
      const passthroughHeaders = { ...upstreamRes.headers };
      if (passthroughHeaders.location) {
        passthroughHeaders.location = rewriteLocation(req.url, String(passthroughHeaders.location));
      }
      if (!shouldBufferResponse(req.url, upstreamRes.headers)) {
        res.writeHead(upstreamRes.statusCode || 502, passthroughHeaders);
        upstreamRes.pipe(res);
        return;
      }

      const chunks = [];
      upstreamRes.on("data", (chunk) => chunks.push(chunk));
      upstreamRes.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const rewritten = rewriteBody(req.url, upstreamRes.headers, body);
        const responseHeaders = { ...passthroughHeaders };
        delete responseHeaders["content-length"];
        delete responseHeaders["content-encoding"];
        responseHeaders["cache-control"] = "no-store";
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
        res.end(rewritten);
      });
    },
  );

  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "bad_gateway", message: error.message }));
  });

  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head) {
  const target = pickTarget(req);
  const upstreamPath = getUpstreamPath(req);
  const upstream = net.connect(Number(target.port), target.hostname, () => {
    upstream.write(`${req.method} ${upstreamPath} HTTP/${req.httpVersion}\r\n`);
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) upstream.write(`${name}: ${item}\r\n`);
      } else if (value !== undefined) {
        upstream.write(`${name}: ${value}\r\n`);
      }
    }
    upstream.write(`x-forwarded-host: ${req.headers.host || ""}\r\n`);
    upstream.write("x-forwarded-proto: http\r\n");
    upstream.write("\r\n");
    if (head?.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });

  const destroyPair = () => {
    upstream.destroy();
    socket.destroy();
  };

  upstream.on("error", destroyPair);
  socket.on("error", destroyPair);
}

const server = http.createServer(proxyRequest);
server.on("upgrade", proxyUpgrade);
server.listen(PORT, HOST, () => {
  console.log(`public proxy listening on http://${HOST}:${PORT}`);
  console.log(`openwebui -> ${OPENWEBUI_TARGET.href}`);
  console.log(`clonellm  -> ${CLONELLM_TARGET.href}`);
});
