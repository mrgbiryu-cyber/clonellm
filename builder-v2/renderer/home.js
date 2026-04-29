"use strict";

const recipeLibrary = require("../../data/normalized/home-recipe-library.json");

function esc(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value || "");
}

function normalizeTone(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveRecipe(kind, { recipeId = "", primitiveId = "", variant = "", tone = "" } = {}) {
  const collection = kind === "quickmenu"
    ? Array.isArray(recipeLibrary?.quickmenuRecipes) ? recipeLibrary.quickmenuRecipes : []
    : kind === "banner"
      ? Array.isArray(recipeLibrary?.bannerRecipes) ? recipeLibrary.bannerRecipes : []
      : kind === "ranking"
        ? Array.isArray(recipeLibrary?.rankingRecipes) ? recipeLibrary.rankingRecipes : []
        : Array.isArray(recipeLibrary?.heroRecipes) ? recipeLibrary.heroRecipes : [];
  const normalizedRecipeId = String(recipeId || "").trim();
  if (normalizedRecipeId) {
    const exact = collection.find((item) => String(item?.recipeId || "").trim() === normalizedRecipeId);
    if (exact) return exact;
  }
  const normalizedPrimitiveId = String(primitiveId || "").trim();
  const normalizedVariant = String(variant || "").trim();
  const normalizedTone = normalizeTone(tone);
  const toneMatched = collection.find((item) =>
    String(item?.primitiveId || "").trim() === normalizedPrimitiveId &&
    String(item?.variant || "").trim() === normalizedVariant &&
    normalizeTone(item?.tone) === normalizedTone
  );
  if (toneMatched) return toneMatched;
  const variantMatched = collection.find((item) =>
    String(item?.primitiveId || "").trim() === normalizedPrimitiveId &&
    String(item?.variant || "").trim() === normalizedVariant
  );
  if (variantMatched) {
    console.warn(
      `[home-renderer] recipe-tone-fallback kind=${kind} primitiveId=${normalizedPrimitiveId || "none"} variant=${normalizedVariant || "none"} tone=${normalizedTone || "none"} fallback=${String(variantMatched?.recipeId || "").trim() || "unknown"}`
    );
    return variantMatched;
  }
  const fallback = collection[0] || null;
  if (fallback) {
    console.warn(
      `[home-renderer] recipe-default-fallback kind=${kind} primitiveId=${normalizedPrimitiveId || "none"} variant=${normalizedVariant || "none"} tone=${normalizedTone || "none"} fallback=${String(fallback?.recipeId || "").trim() || "unknown"}`
    );
  }
  return fallback;
}

function buildHeroFallbackMarkup(recipe, label, escapeHtml) {
  const fallbackWord = String(recipe?.fallbackWord || "Stage").trim();
  const safeLabel = esc(label || fallbackWord, escapeHtml);
  return `
    <span class="codex-v2-home-hero__fallback" data-fallback="${esc(fallbackWord, escapeHtml)}">
      <strong>${safeLabel}</strong>
      <span>${esc(fallbackWord, escapeHtml)}</span>
    </span>
  `;
}

function buildQuickmenuFallbackMarkup(recipe, index, escapeHtml) {
  const fallbackWord = String(recipe?.fallbackWord || "Link").trim();
  return `
    <span class="codex-v2-home-quickmenu__fallback" data-fallback="${esc(fallbackWord, escapeHtml)}">
      <strong>${String(Number(index || 0) + 1).padStart(2, "0")}</strong>
      <span>${esc(fallbackWord, escapeHtml)}</span>
    </span>
  `;
}

function buildHomeV2PrimitiveStyleTag() {
  return `<style data-codex-v2-home-primitive>
    .codex-v2-home-surface {
      --v2-surface: color-mix(in srgb, var(--codex-surface-tone, #f7f8fc) 18%, white);
      --v2-card: rgba(255,255,255,0.82);
      --v2-card-border: rgba(148,163,184,0.16);
      --v2-copy: #0f172a;
      --v2-copy-muted: #475569;
      --v2-accent: #1d4ed8;
      --v2-accent-strong: #0f172a;
      --v2-shadow: 0 36px 100px rgba(15,23,42,0.18);
      --v2-radius-xl: var(--codex-card-radius, 32px);
      --v2-radius-lg: calc(var(--v2-radius-xl) - 8px);
      --v2-radius-md: calc(var(--v2-radius-xl) - 14px);
      --v2-gap-lg: 28px;
      --v2-gap-md: 18px;
      --v2-gap-sm: 12px;
      --v2-title-size: var(--codex-title-size, clamp(2.8rem, 5vw, 4.8rem));
      --v2-title-line: var(--codex-title-line-height, 0.98);
      --v2-title-space: var(--codex-title-letter-spacing, -0.045em);
      --v2-title-font: var(--codex-title-font-family, "Pretendard Variable", "Inter", sans-serif);
      --v2-body-size: var(--codex-description-size, clamp(1rem, 1.4vw, 1.18rem));
      --v2-body-line: var(--codex-description-line-height, 1.55);
      --v2-body-space: var(--codex-description-letter-spacing, -0.012em);
      --v2-body-font: var(--codex-description-font-family, "Pretendard Variable", "Inter", sans-serif);
      position: relative;
      overflow: hidden;
      border-radius: clamp(26px, 2.2vw, 36px);
      border: 1px solid rgba(148,163,184,0.28);
      box-shadow: var(--v2-shadow);
      isolation: isolate;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.92), transparent 26%),
        linear-gradient(138deg, #eaf0f8 0%, #dfe8f4 42%, #d2deee 100%);
    }
    .codex-v2-home-surface::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(122deg, rgba(15,23,42,0.055), transparent 32%),
        radial-gradient(circle at 82% 18%, rgba(59,130,246,0.22), transparent 34%);
      pointer-events: none;
      z-index: 0;
    }
    .codex-v2-home-surface[data-tone="premium"],
    .codex-v2-home-surface[data-tone="cinematic"] {
      --v2-copy: #f8fafc;
      --v2-copy-muted: rgba(226,232,240,0.84);
      --v2-card: rgba(15,23,42,0.48);
      --v2-card-border: rgba(255,255,255,0.12);
      --v2-accent: #f8fafc;
      --v2-accent-strong: #ffffff;
      background:
        radial-gradient(circle at 12% 12%, rgba(59,130,246,0.28), transparent 30%),
        linear-gradient(145deg, #020617 0%, #0f172a 32%, #172554 100%);
    }
    .codex-v2-home-surface[data-tone="editorial"] {
      background:
        radial-gradient(circle at 18% 14%, rgba(248,250,252,0.9), transparent 28%),
        linear-gradient(140deg, #f6efe6 0%, #f8f4ec 30%, #efe4d2 100%);
    }
    .codex-v2-home-hero,
    .codex-v2-home-quickmenu {
      position: relative;
      z-index: 1;
    }
    .codex-v2-home-hero {
      display: grid;
      gap: clamp(18px, 2vw, 26px);
      padding: clamp(24px, 2vw, 32px);
    }
    .codex-v2-home-hero__content {
      display: grid;
      align-content: start;
      gap: 18px;
      max-width: min(720px, 100%);
    }
    .codex-v2-home-hero__eyebrow {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 8px;
      padding: 9px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.22);
      font: 700 0.78rem/1 var(--v2-body-font);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--v2-copy);
      backdrop-filter: blur(18px);
    }
    .codex-v2-home-hero__title {
      margin: 0;
      font-family: var(--v2-title-font);
      font-size: var(--v2-title-size);
      line-height: var(--v2-title-line);
      letter-spacing: var(--v2-title-space);
      font-weight: 830;
      color: var(--v2-copy);
      text-wrap: balance;
    }
    .codex-v2-home-hero__description {
      margin: 0;
      max-width: 60ch;
      font-family: var(--v2-body-font);
      font-size: var(--v2-body-size);
      line-height: var(--v2-body-line);
      letter-spacing: var(--v2-body-space);
      color: var(--v2-copy-muted);
    }
    .codex-v2-home-hero__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .codex-v2-home-hero__cta,
    .codex-v2-home-hero__secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 18px;
      border-radius: 999px;
      font: 700 0.95rem/1 var(--v2-body-font);
      text-decoration: none;
      transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
    }
    .codex-v2-home-hero__cta {
      background: var(--v2-accent-strong);
      color: #fff;
      box-shadow: 0 18px 34px rgba(15,23,42,0.16);
    }
    .codex-v2-home-surface[data-tone="premium"] .codex-v2-home-hero__cta,
    .codex-v2-home-surface[data-tone="cinematic"] .codex-v2-home-hero__cta {
      background: #f8fafc;
      color: #0f172a;
    }
    .codex-v2-home-hero__secondary {
      color: var(--v2-copy);
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.24);
      backdrop-filter: blur(14px);
    }
    .codex-v2-home-hero__cta:hover,
    .codex-v2-home-hero__secondary:hover {
      transform: translateY(-2px);
    }
    .codex-v2-home-hero__grid {
      display: grid;
      gap: 16px;
    }
    .codex-v2-home-hero[data-variant="premium-stage"] .codex-v2-home-hero__grid,
    .codex-v2-home-hero[data-variant="editorial"] .codex-v2-home-hero__grid,
    .codex-v2-home-hero[data-variant="carousel"] .codex-v2-home-hero__grid {
      grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.92fr);
      align-items: stretch;
    }
    .codex-v2-home-hero[data-variant="centered"] .codex-v2-home-hero__content {
      justify-items: center;
      max-width: 920px;
      margin-inline: auto;
      text-align: center;
    }
    .codex-v2-home-hero[data-variant="centered"] .codex-v2-home-hero__description {
      margin-inline: auto;
    }
    .codex-v2-home-hero[data-variant="centered"] .codex-v2-home-hero__grid {
      grid-template-columns: 1fr;
    }
    .codex-v2-home-hero[data-variant="stacked"] .codex-v2-home-hero__grid {
      grid-template-columns: 1fr;
    }
    .codex-v2-home-hero__lead {
      position: relative;
      overflow: hidden;
      border-radius: var(--v2-radius-xl);
      min-height: clamp(360px, 44vw, 560px);
      background: rgba(15,23,42,0.16);
      border: 1px solid var(--v2-card-border);
    }
    .codex-v2-home-hero__lead::after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      height: 55%;
      background: linear-gradient(180deg, transparent, rgba(2,6,23,0.78));
      pointer-events: none;
      z-index: 1;
    }
    .codex-v2-home-hero__lead img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .codex-v2-home-hero__lead-copy {
      position: absolute;
      left: 24px;
      right: 24px;
      bottom: 24px;
      z-index: 2;
      display: grid;
      gap: 10px;
      color: #fff;
    }
    .codex-v2-home-hero__lead-copy strong {
      font: 800 clamp(1.4rem, 2vw, 2rem)/1.02 var(--v2-title-font);
      letter-spacing: -0.03em;
    }
    .codex-v2-home-hero__lead-copy p,
    .codex-v2-home-hero__support-copy span {
      margin: 0;
      color: rgba(255,255,255,0.82);
      font: 500 0.97rem/1.45 var(--v2-body-font);
    }
    .codex-v2-home-hero__support-rail {
      display: grid;
      gap: 14px;
      align-content: stretch;
    }
    .codex-v2-home-hero__support-card {
      display: grid;
      grid-template-columns: 118px minmax(0, 1fr);
      gap: 14px;
      min-height: 120px;
      padding: 14px;
      border-radius: var(--v2-radius-lg);
      background: var(--v2-card);
      border: 1px solid var(--v2-card-border);
      backdrop-filter: blur(14px);
      text-decoration: none;
      color: inherit;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .codex-v2-home-hero__support-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 34px rgba(15,23,42,0.1);
    }
    .codex-v2-home-hero__support-card img {
      width: 100%;
      height: 100%;
      border-radius: var(--v2-radius-md);
      object-fit: cover;
      background: rgba(255,255,255,0.3);
    }
    .codex-v2-home-hero__support-copy {
      display: grid;
      align-content: center;
      gap: 8px;
    }
    .codex-v2-home-hero__support-copy em,
    .codex-v2-home-hero__lead-copy em {
      font: 700 0.72rem/1 var(--v2-body-font);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.72);
      font-style: normal;
    }
    .codex-v2-home-hero__support-copy strong {
      font: 760 1.05rem/1.08 var(--v2-title-font);
      color: var(--v2-copy);
      letter-spacing: -0.03em;
    }
    .codex-v2-home-hero__support-copy span {
      color: var(--v2-copy-muted);
    }
    .codex-v2-home-surface[data-tone="premium"] .codex-v2-home-hero__support-copy strong,
    .codex-v2-home-surface[data-tone="cinematic"] .codex-v2-home-hero__support-copy strong {
      color: #f8fafc;
    }
    .codex-v2-home-surface[data-tone="premium"] .codex-v2-home-hero__support-copy span,
    .codex-v2-home-surface[data-tone="cinematic"] .codex-v2-home-hero__support-copy span {
      color: rgba(226,232,240,0.78);
    }
    .codex-v2-home-hero__fallback,
    .codex-v2-home-quickmenu__fallback {
      display: inline-grid;
      place-items: center;
      gap: 6px;
      width: 100%;
      height: 100%;
      min-height: 100px;
      padding: 18px;
      border-radius: inherit;
      background:
        radial-gradient(circle at 20% 18%, rgba(255,255,255,0.48), transparent 28%),
        linear-gradient(135deg, rgba(255,255,255,0.34), rgba(255,255,255,0.06)),
        repeating-linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.18) 12px, rgba(255,255,255,0.02) 12px, rgba(255,255,255,0.02) 24px);
      color: rgba(15,23,42,0.42);
      text-transform: uppercase;
      text-align: center;
    }
    .codex-v2-home-hero__fallback strong,
    .codex-v2-home-quickmenu__fallback strong {
      font: 850 clamp(1.1rem, 1.6vw, 1.55rem)/1 var(--v2-title-font);
      letter-spacing: -0.03em;
    }
    .codex-v2-home-hero__fallback span,
    .codex-v2-home-quickmenu__fallback span {
      font: 700 0.74rem/1 var(--v2-body-font);
      letter-spacing: 0.14em;
      opacity: 0.82;
    }
    .codex-v2-home-hero__fallback::before,
    .codex-v2-home-quickmenu__fallback::before {
      content: attr(data-fallback);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 88px;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.52);
      border: 1px solid rgba(148,163,184,0.16);
      font: 700 0.68rem/1 var(--v2-body-font);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(15,23,42,0.56);
    }
    .codex-v2-home-surface[data-tone="premium"] .codex-v2-home-hero__fallback,
    .codex-v2-home-surface[data-tone="premium"] .codex-v2-home-quickmenu__fallback,
    .codex-v2-home-surface[data-tone="cinematic"] .codex-v2-home-hero__fallback,
    .codex-v2-home-surface[data-tone="cinematic"] .codex-v2-home-quickmenu__fallback {
      color: rgba(248,250,252,0.84);
      background:
        radial-gradient(circle at 20% 18%, rgba(59,130,246,0.28), transparent 28%),
        linear-gradient(135deg, rgba(255,255,255,0.16), rgba(15,23,42,0.38)),
        repeating-linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.12) 12px, rgba(255,255,255,0.02) 12px, rgba(255,255,255,0.02) 24px);
    }
    .codex-v2-home-surface[data-tone="premium"] .codex-v2-home-hero__fallback::before,
    .codex-v2-home-surface[data-tone="premium"] .codex-v2-home-quickmenu__fallback::before,
    .codex-v2-home-surface[data-tone="cinematic"] .codex-v2-home-hero__fallback::before,
    .codex-v2-home-surface[data-tone="cinematic"] .codex-v2-home-quickmenu__fallback::before {
      color: rgba(248,250,252,0.88);
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.16);
    }
    .codex-v2-home-hero[data-recipe="hero-premium-spotlight-v1"] .codex-v2-home-hero__lead {
      min-height: clamp(420px, 48vw, 610px);
    }
    .codex-v2-home-hero[data-recipe="hero-editorial-briefing-v1"] .codex-v2-home-hero__content {
      max-width: 640px;
    }
    .codex-v2-home-hero[data-recipe="hero-centered-campaign-v1"] .codex-v2-home-hero__title {
      font-size: clamp(3.3rem, 5.8vw, 5.8rem);
    }
    .codex-v2-home-hero[data-recipe="hero-story-stack-v1"] .codex-v2-home-hero__support-rail {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-lead-panel-v1"] .codex-v2-home-quickmenu__card[data-lead="true"] {
      min-height: 344px;
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-premium-chip-grid-v1"] .codex-v2-home-quickmenu__icon {
      background: linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0.38));
      border-color: rgba(59,130,246,0.18);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-editorial-strip-v1"] .codex-v2-home-quickmenu__card[data-editorial="true"] {
      background:
        radial-gradient(circle at 16% 10%, rgba(255,255,255,0.52), transparent 34%),
        linear-gradient(145deg, #f9f1e7, #efe0ca);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-service-tab-cluster-v1"] .codex-v2-home-quickmenu__card {
      min-height: 136px;
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-service-tab-cluster-v1"] .codex-v2-home-quickmenu__card[data-lead="true"] {
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.2), transparent 34%),
        linear-gradient(160deg, #0f172a, #1e3a8a);
    }
    .codex-v2-home-hero[data-recipe="hero-cinematic-stage-v1"] .codex-v2-home-hero__grid {
      grid-template-columns: minmax(0, 1.72fr) minmax(268px, 0.74fr);
    }
    .codex-v2-home-hero[data-recipe="hero-cinematic-stage-v1"] .codex-v2-home-hero__lead {
      min-height: clamp(450px, 52vw, 660px);
    }
    .codex-v2-home-hero[data-recipe="hero-cinematic-stage-v1"] .codex-v2-home-hero__title {
      font-size: clamp(3.1rem, 5.2vw, 5.5rem);
      letter-spacing: -0.052em;
    }
    .codex-v2-home-hero[data-recipe="hero-launch-manifesto-v1"] .codex-v2-home-hero__title {
      font-size: clamp(3.8rem, 7.2vw, 7.6rem);
      letter-spacing: -0.058em;
      line-height: 0.91;
    }
    .codex-v2-home-hero[data-recipe="hero-launch-manifesto-v1"] .codex-v2-home-hero__content {
      gap: 30px;
    }
    .codex-v2-home-hero[data-recipe="hero-launch-manifesto-v1"] .codex-v2-home-hero__lead {
      min-height: clamp(340px, 40vw, 520px);
    }
    .codex-v2-home-hero[data-recipe="hero-service-assurance-centered-v1"] .codex-v2-home-hero__title {
      font-size: clamp(2.6rem, 4.4vw, 4.8rem);
      font-weight: 760;
    }
    .codex-v2-home-hero[data-recipe="hero-service-assurance-centered-v1"] .codex-v2-home-hero__eyebrow {
      background: rgba(59,130,246,0.1);
      border-color: rgba(59,130,246,0.22);
      color: #1e40af;
    }
    .codex-v2-home-hero[data-recipe="hero-service-assurance-centered-v1"] .codex-v2-home-hero__cta {
      background: #1d4ed8;
    }
    .codex-v2-home-hero[data-recipe="hero-service-assurance-centered-v1"] .codex-v2-home-hero__lead {
      min-height: clamp(300px, 36vw, 460px);
    }
    .codex-v2-home-hero[data-recipe="hero-editorial-rail-v1"] .codex-v2-home-hero__support-rail {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 11px;
    }
    .codex-v2-home-hero[data-recipe="hero-editorial-rail-v1"] .codex-v2-home-hero__support-card {
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 10px;
      min-height: 96px;
    }
    .codex-v2-home-hero[data-recipe="hero-editorial-rail-v1"] .codex-v2-home-hero__lead {
      min-height: clamp(370px, 43vw, 550px);
    }
    .codex-v2-home-hero[data-recipe="hero-guided-discovery-v1"] .codex-v2-home-hero__eyebrow {
      background: rgba(59,130,246,0.1);
      border-color: rgba(59,130,246,0.2);
      color: #1e40af;
    }
    .codex-v2-home-hero[data-recipe="hero-guided-discovery-v1"] .codex-v2-home-hero__cta {
      background: #1d4ed8;
    }
    .codex-v2-home-hero[data-recipe="hero-guided-discovery-v1"] .codex-v2-home-hero__lead {
      min-height: clamp(310px, 38vw, 480px);
    }
    .codex-v2-home-hero[data-recipe="hero-featured-chapters-v1"] .codex-v2-home-hero__lead {
      min-height: clamp(400px, 46vw, 580px);
    }
    .codex-v2-home-hero[data-recipe="hero-featured-chapters-v1"] .codex-v2-home-hero__title {
      font-size: clamp(3rem, 5.4vw, 5.7rem);
      letter-spacing: -0.05em;
    }
    .codex-v2-home-hero[data-recipe="hero-featured-chapters-v1"] .codex-v2-home-hero__support-rail {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .codex-v2-home-hero[data-recipe="hero-category-story-stack-v1"] .codex-v2-home-hero__support-rail {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .codex-v2-home-hero[data-recipe="hero-category-story-stack-v1"] .codex-v2-home-hero__support-card {
      grid-template-columns: 1fr;
      min-height: 164px;
    }
    .codex-v2-home-hero[data-recipe="hero-category-story-stack-v1"] .codex-v2-home-hero__support-card img {
      height: 94px;
      border-radius: var(--v2-radius-md);
    }
    .codex-v2-home-hero[data-recipe="hero-category-story-stack-v1"] .codex-v2-home-hero__lead {
      min-height: clamp(360px, 42vw, 540px);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-guided-start-grid-v1"] .codex-v2-home-quickmenu__card {
      background: rgba(255,255,255,0.94);
      border-color: rgba(59,130,246,0.13);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-guided-start-grid-v1"] .codex-v2-home-quickmenu__icon {
      background: rgba(59,130,246,0.09);
      border-color: rgba(59,130,246,0.16);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-guided-start-grid-v1"] .codex-v2-home-quickmenu__card:hover {
      border-color: rgba(59,130,246,0.26);
      box-shadow: 0 12px 28px rgba(29,78,216,0.1);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-campaign-shortcut-panel-v1"] .codex-v2-home-quickmenu__card[data-lead="true"] {
      min-height: 384px;
      background:
        radial-gradient(circle at 20% 16%, rgba(99,102,241,0.38), transparent 44%),
        linear-gradient(165deg, #020617 0%, #0f172a 45%, #1e1b4b 100%);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-campaign-shortcut-panel-v1"] .codex-v2-home-quickmenu__card[data-lead="true"] .codex-v2-home-quickmenu__icon {
      background: rgba(99,102,241,0.24);
      border-color: rgba(165,180,252,0.22);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-campaign-shortcut-panel-v1"] .codex-v2-home-quickmenu__card[data-lead="true"] .codex-v2-home-quickmenu__body strong {
      font-size: clamp(1.7rem, 2.4vw, 2.4rem);
      letter-spacing: -0.04em;
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-editor-choice-ribbon-v1"] .codex-v2-home-quickmenu__card[data-editorial="true"] {
      background:
        radial-gradient(circle at 14% 12%, rgba(99,102,241,0.3), transparent 40%),
        linear-gradient(155deg, #0f172a, #1e1b4b);
      color: #f8fafc;
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-editor-choice-ribbon-v1"] .codex-v2-home-quickmenu__card[data-editorial="true"] .codex-v2-home-quickmenu__body em {
      color: rgba(165,180,252,0.76);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-editor-choice-ribbon-v1"] .codex-v2-home-quickmenu__card[data-editorial="true"] .codex-v2-home-quickmenu__body strong {
      color: #f8fafc;
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-editor-choice-ribbon-v1"] .codex-v2-home-quickmenu__chip {
      background: rgba(255,255,255,0.13);
      border-color: rgba(255,255,255,0.15);
      color: #f8fafc;
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-membership-priority-panel-v1"] .codex-v2-home-quickmenu__card[data-lead="true"] {
      min-height: 364px;
      background:
        radial-gradient(circle at top right, rgba(251,191,36,0.18), transparent 44%),
        linear-gradient(160deg, #020617 0%, #0f172a 60%, #172554 100%);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-membership-priority-panel-v1"] .codex-v2-home-quickmenu__card[data-lead="true"] .codex-v2-home-quickmenu__icon {
      background: rgba(251,191,36,0.2);
      border-color: rgba(251,191,36,0.26);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-membership-priority-panel-v1"] .codex-v2-home-quickmenu__icon {
      background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(251,191,36,0.1));
      border-color: rgba(251,191,36,0.15);
    }
    .codex-v2-home-quickmenu[data-recipe="quickmenu-membership-priority-panel-v1"] .codex-v2-home-quickmenu__card {
      border-color: rgba(251,191,36,0.1);
    }
    .codex-v2-home-quickmenu {
      display: grid;
      gap: 18px;
      padding: clamp(22px, 1.8vw, 28px);
    }
    .codex-v2-home-quickmenu__head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 16px;
    }
    .codex-v2-home-quickmenu__copy {
      display: grid;
      gap: 8px;
      max-width: 740px;
    }
    .codex-v2-home-quickmenu__title {
      margin: 0;
      font: 820 clamp(1.7rem, 2.4vw, 2.4rem)/1 var(--v2-title-font);
      letter-spacing: -0.035em;
      color: var(--v2-copy);
    }
    .codex-v2-home-quickmenu__subtitle {
      margin: 0;
      font: 500 0.98rem/1.5 var(--v2-body-font);
      color: var(--v2-copy-muted);
    }
    .codex-v2-home-quickmenu__cta {
      color: var(--v2-copy);
      text-decoration: none;
      font: 700 0.92rem/1 var(--v2-body-font);
    }
    .codex-v2-home-quickmenu__grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .codex-v2-home-quickmenu[data-variant="panel"] .codex-v2-home-quickmenu__grid {
      grid-template-columns: minmax(280px, 1.18fr) repeat(3, minmax(0, 1fr));
    }
    .codex-v2-home-quickmenu[data-variant="editorial-strip"] .codex-v2-home-quickmenu__grid {
      grid-template-columns: minmax(320px, 1.4fr) repeat(3, minmax(0, 1fr));
    }
    .codex-v2-home-quickmenu__card {
      min-height: 152px;
      display: grid;
      gap: 16px;
      align-content: space-between;
      padding: 18px;
      border-radius: var(--v2-radius-lg);
      background: var(--v2-card);
      border: 1px solid var(--v2-card-border);
      text-decoration: none;
      color: inherit;
      backdrop-filter: blur(14px);
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
    }
    .codex-v2-home-quickmenu__card:hover {
      transform: var(--codex-quickmenu-hover-lift, translateY(-3px));
      box-shadow: 0 18px 34px rgba(15,23,42,0.12);
      border-color: rgba(59,130,246,0.18);
    }
    .codex-v2-home-quickmenu__card[data-lead="true"] {
      min-height: 318px;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.24), transparent 34%),
        linear-gradient(160deg, rgba(15,23,42,0.92), rgba(30,41,59,0.92));
      color: #fff;
      grid-row: span 2;
    }
    .codex-v2-home-quickmenu__card[data-editorial="true"] {
      min-height: 208px;
      grid-column: span 2;
      background:
        radial-gradient(circle at 18% 10%, rgba(255,255,255,0.5), transparent 34%),
        linear-gradient(145deg, #f8f0e6, #efe2cf);
    }
    .codex-v2-home-quickmenu__icon {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: 18px;
      background: rgba(255,255,255,0.66);
      border: 1px solid rgba(148,163,184,0.16);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.32);
    }
    .codex-v2-home-quickmenu__card[data-lead="true"] .codex-v2-home-quickmenu__icon {
      width: 74px;
      height: 74px;
      border-radius: 24px;
      background: rgba(255,255,255,0.16);
      border-color: rgba(255,255,255,0.16);
    }
    .codex-v2-home-quickmenu__icon img {
      width: 72%;
      height: 72%;
      object-fit: contain;
    }
    .codex-v2-home-quickmenu__body {
      display: grid;
      gap: 6px;
    }
    .codex-v2-home-quickmenu__body em {
      font: 700 0.72rem/1 var(--v2-body-font);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--v2-copy-muted);
      font-style: normal;
    }
    .codex-v2-home-quickmenu__card[data-lead="true"] .codex-v2-home-quickmenu__body em {
      color: rgba(255,255,255,0.68);
    }
    .codex-v2-home-quickmenu__body strong {
      font: 780 1.08rem/1.08 var(--v2-title-font);
      letter-spacing: -0.03em;
      color: var(--v2-copy);
    }
    .codex-v2-home-quickmenu__card[data-lead="true"] .codex-v2-home-quickmenu__body strong {
      font-size: clamp(1.5rem, 2.1vw, 2rem);
      color: #fff;
    }
    .codex-v2-home-quickmenu__body span {
      font: 500 0.92rem/1.48 var(--v2-body-font);
      color: var(--v2-copy-muted);
    }
    .codex-v2-home-quickmenu__card[data-lead="true"] .codex-v2-home-quickmenu__body span {
      color: rgba(255,255,255,0.78);
      max-width: 34ch;
    }
    .codex-v2-home-quickmenu__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .codex-v2-home-quickmenu__chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.6);
      border: 1px solid rgba(148,163,184,0.14);
      color: var(--v2-copy);
      font: 700 0.84rem/1 var(--v2-body-font);
      letter-spacing: -0.015em;
    }
    .codex-v2-home-quickmenu__chip img {
      width: 18px;
      height: 18px;
      object-fit: contain;
    }
    @media (max-width: 1120px) {
      .codex-v2-home-hero[data-variant="premium-stage"] .codex-v2-home-hero__grid,
      .codex-v2-home-hero[data-variant="editorial"] .codex-v2-home-hero__grid,
      .codex-v2-home-hero[data-variant="carousel"] .codex-v2-home-hero__grid,
      .codex-v2-home-quickmenu__grid,
      .codex-v2-home-quickmenu[data-variant="panel"] .codex-v2-home-quickmenu__grid,
      .codex-v2-home-quickmenu[data-variant="editorial-strip"] .codex-v2-home-quickmenu__grid {
        grid-template-columns: 1fr 1fr;
      }
      .codex-v2-home-hero__support-card {
        grid-template-columns: 96px minmax(0, 1fr);
      }
    }
    @media (max-width: 760px) {
      .codex-v2-home-hero,
      .codex-v2-home-quickmenu {
        padding: 18px;
      }
      .codex-v2-home-hero__grid,
      .codex-v2-home-quickmenu__grid,
      .codex-v2-home-quickmenu[data-variant="panel"] .codex-v2-home-quickmenu__grid,
      .codex-v2-home-quickmenu[data-variant="editorial-strip"] .codex-v2-home-quickmenu__grid {
        grid-template-columns: 1fr;
      }
      .codex-v2-home-quickmenu__card[data-editorial="true"] {
        grid-column: auto;
      }
      .codex-v2-home-hero__support-card {
        grid-template-columns: 1fr;
      }
      .codex-v2-home-hero__lead-copy {
        left: 18px;
        right: 18px;
        bottom: 18px;
      }
      .codex-v2-home-quickmenu__head {
        flex-direction: column;
        align-items: start;
      }
    }
  </style>`;
}

function renderHomePrimitiveHeroSection({
  attrs = "",
  sectionStyle = "",
  titleStyle = "",
  subtitleStyle = "",
  badge = "",
  headline = "",
  description = "",
  ctaLabel = "",
  ctaHref = "/clone/home",
  firstSlide = {},
  supportSlides = [],
  visibleSlides = [],
  heroVariant = "carousel",
  escapeHtml,
  resolveHeroImageSrc,
  primitiveTone = "",
  primitiveId = "",
  recipeId = "",
}) {
  const safeResolveImage = typeof resolveHeroImageSrc === "function" ? resolveHeroImageSrc : () => "";
  const rawTone = String(primitiveTone || "").trim().toLowerCase();
  const recipe = resolveRecipe("hero", { recipeId, primitiveId, variant: heroVariant, tone: rawTone });
  const tone = (rawTone && rawTone !== "neutral")
    ? rawTone
    : String(recipe?.tone || "").trim().toLowerCase() || (heroVariant === "premium-stage" ? "premium" : heroVariant === "editorial" ? "editorial" : "neutral");
  const eyebrow = String(badge || recipe?.defaultEyebrow || "").trim();
  const secondaryLabel = String(recipe?.secondaryCtaLabel || "큐레이션 보기").trim();
  return `
    <section ${attrs}${sectionStyle ? ` style="${esc(sectionStyle, escapeHtml)}"` : ""}>
      ${buildHomeV2PrimitiveStyleTag()}
      <div class="codex-v2-home-surface codex-v2-home-hero" data-tone="${esc(tone, escapeHtml)}" data-variant="${esc(heroVariant, escapeHtml)}" data-recipe="${esc(recipe?.recipeId || "", escapeHtml)}">
        <div class="codex-v2-home-hero__content">
          ${eyebrow ? `<span class="codex-v2-home-hero__eyebrow">${esc(eyebrow, escapeHtml)}</span>` : ""}
          ${headline ? `<h2 class="codex-v2-home-hero__title"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(headline, escapeHtml)}</h2>` : ""}
          ${description ? `<p class="codex-v2-home-hero__description"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(description, escapeHtml)}</p>` : ""}
          <div class="codex-v2-home-hero__actions">
            <a class="codex-v2-home-hero__cta" href="${esc(ctaHref, escapeHtml)}">${esc(ctaLabel, escapeHtml)}</a>
            <a class="codex-v2-home-hero__secondary" href="${esc(String(firstSlide?.href || ctaHref).trim() || ctaHref, escapeHtml)}">${esc(secondaryLabel, escapeHtml)}</a>
          </div>
        </div>
        <div class="codex-v2-home-hero__grid">
          <article class="codex-v2-home-hero__lead">
            ${safeResolveImage(firstSlide, 0) ? `<img src="${esc(safeResolveImage(firstSlide, 0), escapeHtml)}" alt="${esc(String(firstSlide?.headline || headline).trim(), escapeHtml)}" />` : buildHeroFallbackMarkup(recipe, String(firstSlide?.headline || headline || recipe?.fallbackWord || "Visual").trim(), escapeHtml)}
            <div class="codex-v2-home-hero__lead-copy">
              ${(firstSlide?.badge || recipe?.leadEyebrow) ? `<em>${esc(String(firstSlide?.badge || recipe?.leadEyebrow || "").trim(), escapeHtml)}</em>` : ""}
              <strong>${esc(String(firstSlide?.headline || headline).trim(), escapeHtml)}</strong>
              ${firstSlide?.description ? `<p>${esc(String(firstSlide.description).trim(), escapeHtml)}</p>` : ""}
            </div>
          </article>
          <div class="codex-v2-home-hero__support-rail">
            ${(supportSlides.length ? supportSlides : visibleSlides.slice(1, 4)).map((slide, index) => `
              <a class="codex-v2-home-hero__support-card" href="${esc(String(slide?.href || ctaHref).trim() || ctaHref, escapeHtml)}">
                ${safeResolveImage(slide, index + 1) ? `<img src="${esc(safeResolveImage(slide, index + 1), escapeHtml)}" alt="${esc(String(slide?.headline || `슬라이드 ${index + 2}`).trim(), escapeHtml)}" />` : buildHeroFallbackMarkup(recipe, String(slide?.headline || `Slide ${index + 2}`).trim(), escapeHtml)}
                <span class="codex-v2-home-hero__support-copy">
                  ${(slide?.badge || recipe?.supportEyebrow) ? `<em>${esc(String(slide?.badge || recipe?.supportEyebrow || "").trim(), escapeHtml)}</em>` : ""}
                  <strong>${esc(String(slide?.headline || `슬라이드 ${index + 2}`).trim(), escapeHtml)}</strong>
                  ${slide?.description ? `<span>${esc(String(slide.description).trim(), escapeHtml)}</span>` : ""}
                </span>
              </a>
            `).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderHomePrimitiveQuickmenuSection({
  attrs = "",
  sectionStyle = "",
  titleStyle = "",
  subtitleStyle = "",
  title = "",
  subtitle = "",
  ctaLabel = "",
  ctaHref = "/clone/home",
  items = [],
  quickmenuVariant = "grid",
  escapeHtml,
  resolveQuickmenuIconSrc,
  primitiveTone = "",
  primitiveId = "",
  recipeId = "",
}) {
  const safeResolveIcon = typeof resolveQuickmenuIconSrc === "function" ? resolveQuickmenuIconSrc : () => "";
  const leadItem = items[0] || null;
  const rawTone = String(primitiveTone || "").trim().toLowerCase();
  const recipe = resolveRecipe("quickmenu", { recipeId, primitiveId, variant: quickmenuVariant, tone: rawTone });
  const tone = (rawTone && rawTone !== "neutral")
    ? rawTone
    : String(recipe?.tone || "").trim().toLowerCase() || (quickmenuVariant === "editorial-strip" ? "editorial" : "neutral");
  return `
    <section ${attrs}${sectionStyle ? ` style="${esc(sectionStyle, escapeHtml)}"` : ""}>
      ${buildHomeV2PrimitiveStyleTag()}
      <div class="codex-v2-home-surface codex-v2-home-quickmenu" data-tone="${esc(tone, escapeHtml)}" data-variant="${esc(quickmenuVariant, escapeHtml)}" data-recipe="${esc(recipe?.recipeId || "", escapeHtml)}">
        <div class="codex-v2-home-quickmenu__head">
          <div class="codex-v2-home-quickmenu__copy">
            ${title ? `<h2 class="codex-v2-home-quickmenu__title"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</h2>` : ""}
            ${subtitle ? `<p class="codex-v2-home-quickmenu__subtitle"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</p>` : ""}
          </div>
          <a class="codex-v2-home-quickmenu__cta" href="${esc(ctaHref, escapeHtml)}">${esc(ctaLabel, escapeHtml)}</a>
        </div>
        <div class="codex-v2-home-quickmenu__grid">
          ${quickmenuVariant === "panel" && leadItem ? `
            <a class="codex-v2-home-quickmenu__card" data-lead="true" href="${esc(leadItem.href, escapeHtml)}">
              <span class="codex-v2-home-quickmenu__icon">
                ${safeResolveIcon(leadItem, 0) ? `<img src="${esc(safeResolveIcon(leadItem, 0), escapeHtml)}" alt="${esc(leadItem.alt || leadItem.title, escapeHtml)}" />` : buildQuickmenuFallbackMarkup(recipe, 0, escapeHtml)}
              </span>
              <span class="codex-v2-home-quickmenu__body">
                <em>${esc(String(recipe?.leadEyebrow || "Primary Entry").trim(), escapeHtml)}</em>
                <strong>${esc(leadItem.title, escapeHtml)}</strong>
                <span>${esc(subtitle || "핵심 진입을 크게 강조한 전면개편 메뉴 카드입니다.", escapeHtml)}</span>
              </span>
            </a>
          ` : ""}
          ${quickmenuVariant === "editorial-strip" && leadItem ? `
            <a class="codex-v2-home-quickmenu__card" data-editorial="true" href="${esc(String(leadItem?.href || ctaHref).trim() || ctaHref, escapeHtml)}">
              <span class="codex-v2-home-quickmenu__body">
                <em>${esc(String(recipe?.editorialEyebrow || "Curated Entry").trim(), escapeHtml)}</em>
                <strong>${esc(String(leadItem?.title || "대표 메뉴").trim(), escapeHtml)}</strong>
                <span>${esc(subtitle || "핵심 탐색 진입과 보조 카테고리를 에디토리얼 리듬으로 재정렬했습니다.", escapeHtml)}</span>
              </span>
              <span class="codex-v2-home-quickmenu__chips">
                ${items.slice(1, 4).map((item) => `
                  <span class="codex-v2-home-quickmenu__chip">
                    ${safeResolveIcon(item, items.indexOf(item)) ? `<img src="${esc(safeResolveIcon(item, items.indexOf(item)), escapeHtml)}" alt="${esc(item.alt || item.title, escapeHtml)}" />` : ""}
                    ${esc(item.title, escapeHtml)}
                  </span>
                `).join("")}
              </span>
            </a>
          ` : ""}
          ${(quickmenuVariant === "editorial-strip" ? items.slice(3, 8) : (quickmenuVariant === "panel" ? items.slice(1, 8) : items))
            .map((item, index) => `
              <a class="codex-v2-home-quickmenu__card" href="${esc(item.href, escapeHtml)}">
                <span class="codex-v2-home-quickmenu__icon">
                  ${safeResolveIcon(item, quickmenuVariant === "panel" ? index + 1 : quickmenuVariant === "editorial-strip" ? index + 3 : index) ? `<img src="${esc(safeResolveIcon(item, quickmenuVariant === "panel" ? index + 1 : quickmenuVariant === "editorial-strip" ? index + 3 : index), escapeHtml)}" alt="${esc(item.alt || item.title, escapeHtml)}" />` : buildQuickmenuFallbackMarkup(recipe, quickmenuVariant === "panel" ? index + 1 : quickmenuVariant === "editorial-strip" ? index + 3 : index, escapeHtml)}
                </span>
                <span class="codex-v2-home-quickmenu__body">
                  ${quickmenuVariant === "grid" ? `<em>${esc(String(recipe?.cardEyebrow || "Quick Link").trim(), escapeHtml)}</em>` : ""}
                  <strong>${esc(item.title, escapeHtml)}</strong>
                  ${quickmenuVariant !== "grid" ? `<span>${esc("가장 많이 쓰는 동선에 맞춰 빠르게 진입하도록 재배열했습니다.", escapeHtml)}</span>` : ""}
                </span>
              </a>
            `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderHomePrimitiveRankingSection({
  attrs = "",
  sectionStyle = "",
  selfContainedStyleTag = "",
  titleStyle = "",
  subtitleStyle = "",
  title = "",
  subtitle = "",
  items = [],
  tabs = [],
  rankingVariant = "compact",
  recipeId = "",
  primitiveTone = "",
  primitiveId = "",
  escapeHtml,
  resolveThumbSrc,
}) {
  const safeEscape = (value) => esc(value, escapeHtml);
  const safeResolveThumb = typeof resolveThumbSrc === "function" ? resolveThumbSrc : () => "";
  const recipe = resolveRecipe("ranking", { recipeId, primitiveId, tone: primitiveTone });
  const tone = normalizeTone(recipe?.tone || primitiveTone || "");
  const resolvedVariant = rankingVariant || recipe?.variant || "compact";
  const toneAttr = tone ? ` data-tone="${safeEscape(tone)}"` : "";
  const recipeAttr = recipe?.recipeId ? ` data-recipe="${safeEscape(recipe.recipeId)}"` : "";
  const rankingToneStyle = `
    <style data-codex-v2-ranking-tone>
      .codex-v2-home-ranking[data-tone="premium"] .codex-home-composition-ranking-card {
        background: linear-gradient(145deg, #ffffff 0%, #f1f5fb 100%);
        border: 1px solid rgba(148, 163, 184, 0.16);
      }
      .codex-v2-home-ranking[data-tone="editorial"] .codex-home-composition-ranking-card {
        background: linear-gradient(145deg, #fdf9f4 0%, #f5ede0 100%);
        border: 1px solid rgba(180, 130, 80, 0.12);
      }
      .codex-v2-home-ranking[data-tone="premium"] .codex-home-composition-ranking-rank,
      .codex-v2-home-ranking[data-tone="editorial"] .codex-home-composition-ranking-rank {
        font-weight: 820;
      }
    </style>
  `;
  return `
    <section class="codex-v2-home-ranking"${toneAttr}${recipeAttr} ${attrs}${sectionStyle ? ` style="${safeEscape(sectionStyle)}"` : ""}>
      ${selfContainedStyleTag}
      ${tone ? rankingToneStyle : ""}
      <div class="codex-home-composition-shell codex-home-composition-shell--narrow">
        <div class="codex-home-composition-ranking-head">
          <h2 class="codex-home-composition-title codex-home-composition-title--compact"${titleStyle ? ` style="${safeEscape(titleStyle)}"` : ""}>${safeEscape(title)}</h2>
          ${subtitle ? `<p class="codex-home-composition-description codex-home-composition-description--compact"${subtitleStyle ? ` style="${safeEscape(subtitleStyle)}"` : ""}>${safeEscape(subtitle)}</p>` : ""}
        </div>
        <div class="codex-home-composition-ranking-tabs">
          ${tabs.map((item, index) => `<span class="codex-home-composition-ranking-tab${index === 0 ? " is-active" : ""}">${safeEscape(String(item.label || "").trim())}</span>`).join("")}
        </div>
        <div class="codex-home-composition-ranking-list">
          ${items.map((item, index) => `
            <a class="codex-home-composition-ranking-card${resolvedVariant === "poster" ? " codex-home-composition-ranking-card--poster" : ""}" href="${safeEscape(item.href)}">
              <span class="codex-home-composition-ranking-rank">${String(index + 1).padStart(2, "0")}</span>
              <span class="codex-home-composition-ranking-thumb">
                ${safeResolveThumb(item, index) ? `<img src="${safeEscape(safeResolveThumb(item, index))}" alt="${safeEscape(item.title)}" />` : `<span class="codex-home-composition-hero-fallback"></span>`}
              </span>
              <span class="codex-home-composition-ranking-body">
                ${item.badge ? `<span class="codex-home-composition-badge codex-home-composition-badge--inline">${safeEscape(item.badge)}</span>` : ""}
                <strong>${safeEscape(item.title)}</strong>
                ${item.description ? `<span>${safeEscape(item.description)}</span>` : ""}
                ${item.price ? `<em>${safeEscape(item.price)}원</em>` : ""}
              </span>
            </a>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderHomePrimitiveBannerSection({
  attrs = "",
  sectionStyle = "",
  selfContainedStyleTag = "",
  titleStyle = "",
  subtitleStyle = "",
  title = "",
  subtitle = "",
  ctaLabel = "",
  eyebrow = "",
  href = "/clone/home",
  imageSrc = "",
  imageAlt = "",
  recipeId = "",
  primitiveTone = "",
  primitiveId = "",
  escapeHtml,
}) {
  const safeEscape = (value) => esc(value, escapeHtml);
  const recipe = resolveRecipe("banner", { recipeId, primitiveId, tone: primitiveTone });
  const tone = normalizeTone(recipe?.tone || primitiveTone || "");
  const resolvedEyebrow = eyebrow || (recipe?.eyebrowLabel ? "" : "");
  const toneAttr = tone ? ` data-tone="${safeEscape(tone)}"` : "";
  const recipeAttr = recipe?.recipeId ? ` data-recipe="${safeEscape(recipe.recipeId)}"` : "";
  const bannerToneStyle = `
    <style data-codex-v2-banner-tone>
      .codex-v2-home-banner[data-tone="cinematic"] {
        background: linear-gradient(135deg, #020617 0%, #0f172a 100%);
        --v2-banner-title: #f8fafc;
        --v2-banner-body: rgba(248,250,252,0.72);
        --v2-banner-cta: rgba(248,250,252,0.54);
      }
      .codex-v2-home-banner[data-tone="editorial"] {
        background: linear-gradient(140deg, #fdf6ec 0%, #f5e6d0 100%);
        --v2-banner-title: #1c1008;
        --v2-banner-body: rgba(28,16,8,0.62);
        --v2-banner-cta: rgba(28,16,8,0.48);
      }
      .codex-v2-home-banner[data-tone="service-trust"] {
        background: linear-gradient(140deg, #f0f7ff 0%, #e0ecfa 100%);
        --v2-banner-title: #0f172a;
        --v2-banner-body: rgba(15,23,42,0.65);
        --v2-banner-cta: rgba(15,23,42,0.48);
      }
      .codex-v2-home-banner .codex-home-composition-banner-card strong {
        color: var(--v2-banner-title, #0f172a);
      }
      .codex-v2-home-banner .codex-home-composition-banner-card span:not(.codex-home-composition-eyebrow) {
        color: var(--v2-banner-body, rgba(15,23,42,0.65));
      }
      .codex-v2-home-banner .codex-home-composition-banner-card em {
        color: var(--v2-banner-cta, rgba(15,23,42,0.5));
      }
    </style>
  `;
  return `
    <section class="codex-v2-home-banner"${toneAttr}${recipeAttr} ${attrs}${sectionStyle ? ` style="${safeEscape(sectionStyle)}"` : ""}>
      ${selfContainedStyleTag}
      ${tone ? bannerToneStyle : ""}
      <div class="codex-home-composition-shell codex-home-composition-shell--narrow">
        <a class="codex-home-composition-banner-card" href="${safeEscape(href)}">
          <span class="codex-home-composition-banner-copy">
            ${resolvedEyebrow ? `<span class="codex-home-composition-eyebrow">${safeEscape(resolvedEyebrow)}</span>` : ""}
            <strong${titleStyle ? ` style="${safeEscape(titleStyle)}"` : ""}>${safeEscape(title)}</strong>
            ${subtitle ? `<span${subtitleStyle ? ` style="${safeEscape(subtitleStyle)}"` : ""}>${safeEscape(subtitle)}</span>` : ""}
            <em>${safeEscape(ctaLabel)}</em>
          </span>
          <span class="codex-home-composition-banner-visual">
            ${imageSrc ? `<img src="${safeEscape(imageSrc)}" alt="${safeEscape(imageAlt || title)}" />` : `<span class="codex-home-composition-hero-fallback"></span>`}
          </span>
        </a>
      </div>
    </section>
  `;
}

module.exports = {
  renderHomePrimitiveHeroSection,
  renderHomePrimitiveQuickmenuSection,
  renderHomePrimitiveRankingSection,
  renderHomePrimitiveBannerSection,
};
