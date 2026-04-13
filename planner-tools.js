const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const VISUAL_DIR = path.join(ROOT, "data", "visual");
const PLANNER_REFERENCE_DIR = path.join(VISUAL_DIR, "planner-reference");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function slugLoose(input) {
  return String(input || "")
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeReferenceUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("reference_url_protocol_not_supported");
  }
  return parsed.toString();
}

function viewportFor(profile) {
  const normalized = String(profile || "pc").trim() || "pc";
  if (normalized === "mo") {
    return {
      profile: "mo",
      viewport: { width: 430, height: 2400 },
      isMobile: true,
      deviceScaleFactor: 3,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    };
  }
  return {
    profile: "pc",
    viewport: { width: 1460, height: 2400 },
    isMobile: false,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  };
}

function toVisualUrl(filePath) {
  if (!filePath) return null;
  const normalized = path.normalize(filePath);
  const visualRoot = path.normalize(VISUAL_DIR + path.sep);
  if (!normalized.toLowerCase().startsWith(visualRoot.toLowerCase())) return null;
  const relativePath = normalized.slice(visualRoot.length).replace(/\\/g, "/");
  return `/visual/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function safeArray(values, limit = 12) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean))).slice(0, limit);
}

function buildTextCorpus(referenceSummary) {
  return [
    referenceSummary?.title,
    referenceSummary?.description,
    ...(referenceSummary?.headings || []),
    ...(referenceSummary?.ctaLabels || []),
    ...(referenceSummary?.navLabels || []),
    ...((referenceSummary?.sectionCandidates || []).map((item) => item.textPreview).filter(Boolean)),
  ]
    .join(" ")
    .toLowerCase();
}

function deriveTakeaways(referenceSummary) {
  const takeaways = [];
  if (Number(referenceSummary?.heroSectionCount || 0) > 0) {
    takeaways.push("상단 비주얼 중심의 첫 인상이 강한 레이아웃");
  }
  if (Number(referenceSummary?.imageCount || 0) >= 8) {
    takeaways.push("이미지 비중이 높아 시각 중심 톤을 참고하기 좋음");
  }
  if ((referenceSummary?.ctaLabels || []).length > 0) {
    takeaways.push(`CTA 문구 샘플 ${Math.min((referenceSummary.ctaLabels || []).length, 3)}개 확보`);
  }
  if (Number(referenceSummary?.productCardCount || 0) >= 4) {
    takeaways.push("상품 카드/리스트 구성 참고 가능");
  }
  if (Number(referenceSummary?.formControlCount || 0) >= 3) {
    takeaways.push("선택/필터/옵션 형태의 조작 UI 패턴 존재");
  }
  if (Number(referenceSummary?.stickySignalCount || 0) > 0) {
    takeaways.push("고정형 구매/요약 영역 패턴이 감지됨");
  }
  return takeaways.slice(0, 6);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function extractFirstMatch(source, pattern) {
  const match = String(source || "").match(pattern);
  return match ? stripTags(match[1] || "") : "";
}

function extractAllMatches(source, pattern, limit = 12) {
  const results = [];
  const text = String(source || "");
  const matcher = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match;
  while ((match = matcher.exec(text)) && results.length < limit) {
    const next = stripTags(match[1] || "");
    if (!next) continue;
    results.push(next);
  }
  return safeArray(results, limit);
}

function extractAttribute(openTag, attributeName) {
  const match = String(openTag || "").match(new RegExp(`\\s${attributeName}=(["'])(.*?)\\1`, "i"));
  return match ? String(match[2] || "").trim() : "";
}

function collectReferenceSummaryFromHtml(html) {
  const source = String(html || "");
  const headings = extractAllMatches(source, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, 12);
  const ctaLabels = extractAllMatches(source, /<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi, 12);
  const navBlocks = source.match(/<nav[\s\S]*?<\/nav>/gi) || [];
  const navLabels = navBlocks
    .flatMap((block) => extractAllMatches(block, /<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi, 12))
    .slice(0, 12);
  const sectionBlocks = [];
  const sectionPattern = /<(section|article)[^>]*([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = sectionPattern.exec(source)) && sectionBlocks.length < 12) {
    const block = match[0] || "";
    const openTag = block.match(/^<[^>]+>/)?.[0] || "";
    const id = extractAttribute(openTag, "id");
    const className = extractAttribute(openTag, "class");
    const textPreview = stripTags(block).slice(0, 220);
    const imageCount = (block.match(/<(img|picture|video)\b/gi) || []).length;
    const buttonCount = (block.match(/<(button|a)\b/gi) || []).length;
    const controlCount = (block.match(/<(button|select|input|textarea)\b/gi) || []).length;
    sectionBlocks.push({
      index: sectionBlocks.length,
      tagName: String(match[1] || "").toLowerCase(),
      id,
      className,
      textPreview,
      imageCount,
      buttonCount,
      controlCount,
    });
  }
  const textPreview = stripTags(source).slice(0, 4000);
  const heroSectionCount = sectionBlocks.filter((item) =>
    /hero|visual|banner|kv|main/i.test(`${item.tagName} ${item.id} ${item.className}`) ||
    (item.index === 0 && item.imageCount > 0 && item.buttonCount > 0)
  ).length;
  const stickySignalCount = sectionBlocks.filter((item) =>
    /sticky|buy|purchase|summary|option/i.test(`${item.id} ${item.className}`) && item.controlCount > 0
  ).length;
  return {
    title: extractFirstMatch(source, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description:
      extractFirstMatch(source, /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
      extractFirstMatch(source, /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i),
    headings,
    ctaLabels,
    navLabels,
    sectionCandidates: sectionBlocks,
    imageCount: (source.match(/<(img|picture|video)\b/gi) || []).length,
    formControlCount: (source.match(/<(button|select|input|textarea)\b/gi) || []).length,
    productCardCount: (source.match(/data-product-id|product-card|prd-item|goods-id/gi) || []).length,
    heroSectionCount,
    stickySignalCount,
    textPreview,
  };
}

function scoreSlotMatch(slotId, referenceSummary) {
  const corpus = buildTextCorpus(referenceSummary);
  const firstSection = (referenceSummary?.sectionCandidates || [])[0] || null;
  let score = 0;
  const reasons = [];
  const add = (points, reason) => {
    if (!points) return;
    score += points;
    if (reason) reasons.push(reason);
  };

  if (slotId === "hero" || slotId === "banner") {
    add(Number(referenceSummary?.heroSectionCount || 0) > 0 ? 4 : 0, "hero/banner 시그널 감지");
    add(firstSection?.imageCount > 0 && firstSection?.buttonCount > 0 ? 2 : 0, "상단 섹션이 이미지+CTA 구조");
  }

  if (slotId === "gallery") {
    add(Number(referenceSummary?.imageCount || 0) >= 8 ? 4 : 0, "이미지 수가 많음");
    add(/gallery|carousel|thumbnail|slider|갤러리|썸네일/.test(corpus) ? 4 : 0, "gallery 관련 키워드");
  }

  if (slotId === "summary") {
    add((referenceSummary?.headings || []).length > 0 ? 3 : 0, "헤드라인/요약 카피 존재");
    add(/summary|overview|제품|특징|signature|oled|냉장고|tv|가전/.test(corpus) ? 3 : 0, "제품 요약성 텍스트");
  }

  if (slotId === "price") {
    add(/price|가격|혜택|할인|원\b|₩|krw|구매/.test(corpus) ? 5 : 0, "가격/혜택 키워드");
  }

  if (slotId === "option" || slotId === "filter" || slotId === "sort" || slotId === "tabs") {
    add(Number(referenceSummary?.formControlCount || 0) >= 3 ? 3 : 0, "조작 UI 요소 수");
    add(/option|옵션|선택|색상|용량|filter|필터|sort|정렬|tab|탭/.test(corpus) ? 4 : 0, "옵션/필터/탭 키워드");
  }

  if (slotId === "sticky") {
    add(Number(referenceSummary?.stickySignalCount || 0) > 0 ? 5 : 0, "sticky/buybox 시그널");
    add(/sticky|buy|구매|장바구니|상담/.test(corpus) ? 3 : 0, "구매 고정영역 키워드");
  }

  if (slotId === "review") {
    add(/review|리뷰|후기|별점/.test(corpus) ? 5 : 0, "리뷰 키워드");
  }

  if (slotId === "qna" || slotId === "notice") {
    add(/q&a|qna|문의|faq|자주 묻는 질문|공지/.test(corpus) ? 5 : 0, "문의/공지 키워드");
  }

  if (slotId === "productGrid" || slotId === "firstProduct" || slotId === "firstRow") {
    add(Number(referenceSummary?.productCardCount || 0) >= 4 ? 5 : 0, "상품 카드 감지");
    add(/product|상품|제품 목록|category|카테고리/.test(corpus) ? 3 : 0, "상품 리스트 키워드");
  }

  return {
    slotId,
    confidence: score >= 8 ? "high" : score >= 4 ? "medium" : score > 0 ? "low" : "none",
    score,
    reasons: reasons.slice(0, 3),
  };
}

function buildSlotMatches(referenceSummary, editableSlots) {
  return safeArray(editableSlots, 20)
    .map((slotId) => scoreSlotMatch(slotId, referenceSummary))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.slotId).localeCompare(String(b.slotId), "ko"))
    .slice(0, 8);
}

function buildGuardrailBundle({ pageId = "", pageGroup = "", editableSlots = [], referenceAnalyses = [] } = {}) {
  const rules = [
    "사실 기반 가격/스펙/상품 정보는 임의 변경 금지",
    "현재 페이지에서 지원되는 slot 범위 안에서만 시안 생성",
    "레퍼런스는 방향 참고용이며 레이아웃/카피를 그대로 복제하지 않음",
  ];
  if (String(pageGroup || "") === "product-detail") {
    rules.push("구매 흐름, 옵션 선택, sticky 구매영역은 끊기지 않게 유지");
  }
  if (String(pageId || "").startsWith("category-")) {
    rules.push("상품 리스트/필터/정렬 흐름은 유지하고 시각 톤만 과도하게 흔들지 않음");
  }
  const warnings = [];
  for (const analysis of referenceAnalyses || []) {
    if (analysis?.status !== "ok") {
      warnings.push(`레퍼런스 분석 실패: ${analysis?.requestedUrl || analysis?.finalUrl || "unknown"}`);
    }
  }
  if (!Array.isArray(editableSlots) || editableSlots.length === 0) {
    warnings.push("편집 가능한 slot 정보가 비어 있어 Planner 범위를 좁게 해석해야 함");
  }
  return { rules, warnings };
}

async function collectReferenceSummary(page) {
  return page.evaluate(() => {
    const textOf = (node) => String(node?.textContent || "").replace(/\s+/g, " ").trim();
    const main = document.querySelector("main") || document.body;
    const headingNodes = Array.from(document.querySelectorAll("h1, h2, h3")).slice(0, 12);
    const ctaNodes = Array.from(document.querySelectorAll("button, a, [role='button']")).slice(0, 20);
    const navNodes = Array.from(document.querySelectorAll("nav a, header a")).slice(0, 16);
    const sectionNodes = Array.from(
      main.querySelectorAll("section, article, [data-section], [class*='section'], [class*='hero'], [class*='banner']")
    ).slice(0, 12);
    const sectionCandidates = sectionNodes.map((node, index) => ({
      index,
      tagName: String(node.tagName || "").toLowerCase(),
      id: String(node.id || "").trim(),
      className:
        typeof node.className === "string"
          ? node.className.trim().replace(/\s+/g, " ").slice(0, 120)
          : String(node.getAttribute("class") || "").trim().replace(/\s+/g, " ").slice(0, 120),
      textPreview: textOf(node).slice(0, 220),
      imageCount: node.querySelectorAll("img, picture, video").length,
      buttonCount: node.querySelectorAll("button, a, [role='button']").length,
      controlCount: node.querySelectorAll("button, select, input, textarea, [role='tab'], [role='button']").length,
    }));
    const fullText = textOf(main).slice(0, 4000);
    const heroSectionCount = sectionCandidates.filter((item) =>
      /hero|visual|banner|kv|main/i.test(`${item.tagName} ${item.id} ${item.className}`) ||
      (item.index === 0 && item.imageCount > 0 && item.buttonCount > 0)
    ).length;
    const stickySignalCount = sectionCandidates.filter((item) =>
      /sticky|buy|purchase|summary|option/i.test(`${item.id} ${item.className}`) && item.controlCount > 0
    ).length;
    const productCardCount = main.querySelectorAll(
      "[data-product-id], [class*='product-card'], [class*='product_item'], [class*='prd-item'], li[data-goods-id], article[data-product-id]"
    ).length;
    return {
      title: document.title || "",
      description:
        document.querySelector('meta[name="description"]')?.getAttribute("content") ||
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
        "",
      headings: headingNodes.map(textOf).filter(Boolean),
      ctaLabels: ctaNodes.map(textOf).filter(Boolean).slice(0, 12),
      navLabels: navNodes.map(textOf).filter(Boolean).slice(0, 12),
      sectionCandidates,
      imageCount: main.querySelectorAll("img, picture, video").length,
      formControlCount: main.querySelectorAll("button, select, input, textarea, [role='tab'], [role='button']").length,
      productCardCount,
      heroSectionCount,
      stickySignalCount,
      textPreview: fullText,
    };
  });
}

async function analyzeReferenceUrl({
  url,
  pageId = "",
  pageGroup = "",
  viewportProfile = "pc",
  editableSlots = [],
  timeoutMs = 45000,
} = {}) {
  const normalizedUrl = normalizeReferenceUrl(url);
  const viewport = viewportFor(viewportProfile);
  const digest = crypto.createHash("sha1").update(`${pageId}:${viewport.profile}:${normalizedUrl}`).digest("hex").slice(0, 12);
  const referenceId = `ref_${digest}`;
  const outDir = path.join(PLANNER_REFERENCE_DIR, referenceId);
  const htmlPath = path.join(outDir, `${viewport.profile}.html`);
  const metadataPath = path.join(outDir, `${viewport.profile}.json`);
  try {
    ensureDir(outDir);
    const response = await fetch(normalizedUrl, {
      headers: {
        "user-agent": viewport.userAgent,
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    if (!response.ok) {
      throw new Error(`reference_fetch_failed:${response.status}`);
    }
    const html = await response.text();
    fs.writeFileSync(htmlPath, html, "utf-8");
    const summary = collectReferenceSummaryFromHtml(html);
    const finalUrl = response.url || normalizedUrl;
    const slotMatches = buildSlotMatches(summary, editableSlots);
    const payload = {
      referenceId,
      status: "ok",
      requestedUrl: normalizedUrl,
      finalUrl,
      pageId: String(pageId || "").trim(),
      pageGroup: String(pageGroup || "").trim(),
      viewportProfile: viewport.profile,
      capturedAt: nowIso(),
      artifact: {
        screenshotPath: null,
        screenshotUrl: null,
        htmlPath,
        metadataPath,
      },
      summary,
      takeaways: deriveTakeaways(summary),
      slotMatches,
    };
    fs.writeFileSync(metadataPath, JSON.stringify(payload, null, 2), "utf-8");
    return payload;
  } catch (error) {
    const failed = {
      referenceId,
      status: "error",
      requestedUrl: normalizedUrl,
      finalUrl: null,
      pageId: String(pageId || "").trim(),
      pageGroup: String(pageGroup || "").trim(),
      viewportProfile: viewport.profile,
      capturedAt: nowIso(),
      artifact: {
        screenshotPath: null,
        screenshotUrl: null,
        htmlPath: fs.existsSync(htmlPath) ? htmlPath : null,
        metadataPath,
      },
      summary: null,
      takeaways: [],
      slotMatches: [],
      error: String(error),
    };
    ensureDir(outDir);
    fs.writeFileSync(metadataPath, JSON.stringify(failed, null, 2), "utf-8");
    return failed;
  }
}

async function analyzeReferenceUrls(referenceUrls, options = {}) {
  const urls = safeArray(referenceUrls, 5);
  const results = [];
  for (const item of urls) {
    results.push(
      await analyzeReferenceUrl({
        ...options,
        url: item,
      })
    );
  }
  return results;
}

module.exports = {
  analyzeReferenceUrl,
  analyzeReferenceUrls,
  buildGuardrailBundle,
};
