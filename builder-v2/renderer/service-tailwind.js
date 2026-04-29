"use strict";

function esc(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value || "");
}

function buildTailwindServiceStyleTag() {
  return `<style data-codex-v2-service-tailwind>
    .codex-v2-service-surface {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: linear-gradient(145deg, #f8fafc 0%, #edf3fb 50%, #dfe9f7 100%);
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.10);
      isolation: isolate;
    }
    .codex-v2-service-surface::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,0.24), transparent 30%);
      z-index: 0;
    }
    .svx-stage {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 18px;
      padding: 28px;
    }
    .svx-stage--compact {
      gap: 14px;
      padding: 22px;
    }
    .svx-head {
      display: grid;
      gap: 10px;
      max-width: 56rem;
    }
    .svx-badge {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.08);
      color: rgba(15, 23, 42, 0.76);
      font: 700 0.72rem/1 "Pretendard Variable", "Inter", sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .svx-title {
      margin: 0;
      color: #0f172a;
      font: 800 clamp(2rem, 4vw, 3.8rem)/0.98 "Pretendard Variable", "Inter", sans-serif;
      letter-spacing: -0.04em;
      text-wrap: balance;
    }
    .svx-title--compact {
      font-size: clamp(1.35rem, 2.4vw, 2rem);
      letter-spacing: -0.03em;
    }
    .svx-copy {
      margin: 0;
      color: rgba(15, 23, 42, 0.70);
      font: 500 clamp(0.96rem, 1.2vw, 1.08rem)/1.58 "Pretendard Variable", "Inter", sans-serif;
      max-width: 62ch;
    }
    .svx-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .svx-btn,
    .svx-btn-subtle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font: 700 0.92rem/1 "Pretendard Variable", "Inter", sans-serif;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .svx-btn {
      background: #111827;
      color: #fff;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
    }
    .svx-btn-subtle {
      background: rgba(255,255,255,0.42);
      color: #0f172a;
      border: 1px solid rgba(148, 163, 184, 0.22);
      backdrop-filter: blur(14px);
    }
    .svx-btn:hover,
    .svx-btn-subtle:hover {
      transform: translateY(-2px);
    }
    .svx-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
      gap: 18px;
      align-items: stretch;
    }
    .svx-hero-copy {
      display: grid;
      gap: 14px;
      align-content: center;
      padding: 8px 6px 8px 0;
    }
    .svx-hero-visual {
      position: relative;
      overflow: hidden;
      min-height: clamp(320px, 40vw, 500px);
      border-radius: 24px;
      background: rgba(15, 23, 42, 0.08);
      border: 1px solid rgba(255,255,255,0.32);
    }
    .svx-hero-visual img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .svx-hero-rail {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .svx-mini-card,
    .svx-card,
    .svx-story-card,
    .svx-grid-lead {
      display: grid;
      gap: 10px;
      padding: 16px;
      border-radius: 20px;
      background: rgba(255,255,255,0.46);
      border: 1px solid rgba(148, 163, 184, 0.18);
      color: inherit;
      text-decoration: none;
      backdrop-filter: blur(14px);
    }
    .svx-mini-card strong,
    .svx-card strong,
    .svx-story-card strong,
    .svx-grid-lead strong {
      color: #0f172a;
      font: 760 1rem/1.2 "Pretendard Variable", "Inter", sans-serif;
      letter-spacing: -0.02em;
    }
    .svx-mini-card span,
    .svx-card span,
    .svx-story-card span,
    .svx-grid-lead span {
      color: rgba(15, 23, 42, 0.68);
      font: 500 0.9rem/1.5 "Pretendard Variable", "Inter", sans-serif;
    }
    .svx-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .svx-grid--three {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .svx-grid--lead {
      grid-template-columns: minmax(240px, 1.1fr) repeat(3, minmax(0, 1fr));
    }
    .svx-icon {
      display: inline-flex;
      width: 44px;
      height: 44px;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }
    .svx-icon img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }
    .svx-banner {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 0.72fr);
      gap: 16px;
      align-items: center;
    }
    .svx-banner-visual,
    .svx-card-visual,
    .svx-story-visual {
      position: relative;
      overflow: hidden;
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.08);
      min-height: 180px;
    }
    .svx-banner-visual img,
    .svx-card-visual img,
    .svx-story-visual img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .svx-ranking {
      display: grid;
      gap: 12px;
    }
    .svx-ranking-card {
      display: grid;
      grid-template-columns: 40px 96px minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255,255,255,0.46);
      border: 1px solid rgba(148, 163, 184, 0.18);
      text-decoration: none;
      color: inherit;
    }
    .svx-ranking-rank {
      color: rgba(15, 23, 42, 0.44);
      font: 800 1.2rem/1 "Pretendard Variable", "Inter", sans-serif;
      letter-spacing: -0.04em;
    }
    .svx-ranking-thumb {
      position: relative;
      overflow: hidden;
      min-height: 84px;
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.08);
    }
    .svx-ranking-thumb img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .svx-story-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .svx-story-visual {
      min-height: 220px;
    }
    @media (max-width: 980px) {
      .svx-hero,
      .svx-banner,
      .svx-grid--lead {
        grid-template-columns: 1fr;
      }
      .svx-grid,
      .svx-grid--three,
      .svx-story-grid,
      .svx-hero-rail {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 720px) {
      .svx-stage,
      .svx-stage--compact {
        padding: 18px;
      }
      .svx-grid,
      .svx-grid--three,
      .svx-story-grid,
      .svx-hero-rail {
        grid-template-columns: 1fr;
      }
      .svx-ranking-card {
        grid-template-columns: 32px 80px minmax(0, 1fr);
      }
    }
  </style>`;
}

function renderSectionShell({ attrs, sectionStyle = "", inner = "", escapeHtml }) {
  return `<section ${attrs}${sectionStyle ? ` style="${esc(sectionStyle, escapeHtml)}"` : ""}>${buildTailwindServiceStyleTag()}${inner}</section>`;
}

function buildServiceHeroToneStyle(tone) {
  if (!tone || tone === "service-trust") return "";
  if (tone === "editorial") {
    return `
      <style data-codex-v2-service-hero-tone>
        .codex-v2-service-surface[data-tone="editorial"] {
          background: linear-gradient(145deg, #fdf9f4 0%, #f0e8d8 100%);
        }
        .codex-v2-service-surface[data-tone="editorial"]::before {
          background:
            radial-gradient(circle at top right, rgba(180, 120, 40, 0.10), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.18), transparent 30%);
        }
        .codex-v2-service-surface[data-tone="editorial"] .svx-title {
          color: #1c1008;
        }
        .codex-v2-service-surface[data-tone="editorial"] .svx-copy {
          color: rgba(28, 16, 8, 0.65);
        }
        .codex-v2-service-surface[data-tone="editorial"] .svx-btn {
          background: #2d1a08;
        }
      </style>`;
  }
  if (tone === "premium") {
    return `
      <style data-codex-v2-service-hero-tone>
        .codex-v2-service-surface[data-tone="premium"] {
          background: linear-gradient(145deg, #f8fafc 0%, #dce8f8 100%);
        }
        .codex-v2-service-surface[data-tone="premium"]::before {
          background:
            radial-gradient(circle at top right, rgba(59, 100, 200, 0.16), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.28), transparent 30%);
        }
        .codex-v2-service-surface[data-tone="premium"] .svx-title {
          color: #0f172a;
        }
        .codex-v2-service-surface[data-tone="premium"] .svx-copy {
          color: rgba(15, 23, 42, 0.68);
        }
        .codex-v2-service-surface[data-tone="premium"] .svx-btn {
          background: #1e3a8a;
        }
      </style>`;
  }
  return "";
}

function renderServiceTailwindHeroSection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  badge,
  ctaLabel,
  ctaHref,
  visualSrc,
  visualAlt,
  supportCards = [],
  primitiveTone = "",
  escapeHtml,
}) {
  const tone = String(primitiveTone || "").trim().toLowerCase() || "service-trust";
  const toneAttr = ` data-tone="${esc(tone, escapeHtml)}"`;
  const toneStyle = buildServiceHeroToneStyle(tone);
  return renderSectionShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      ${toneStyle}
      <div class="codex-v2-service-surface"${toneAttr}>
        <div class="svx-stage">
          <div class="svx-hero">
            <div class="svx-hero-copy">
              ${badge ? `<span class="svx-badge">${esc(badge, escapeHtml)}</span>` : ""}
              <h2 class="svx-title"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</h2>
              ${subtitle ? `<p class="svx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</p>` : ""}
              <div class="svx-actions">
                <a class="svx-btn" href="${esc(ctaHref || "#", escapeHtml)}">${esc(ctaLabel || "자세히 보기", escapeHtml)}</a>
              </div>
            </div>
            <div class="svx-hero-visual">
              ${visualSrc ? `<img src="${esc(visualSrc, escapeHtml)}" alt="${esc(visualAlt || title, escapeHtml)}" />` : ""}
            </div>
          </div>
          ${supportCards.length ? `
            <div class="svx-hero-rail">
              ${supportCards.map((item) => `
                <a class="svx-mini-card" href="${esc(item.href || "#", escapeHtml)}">
                  <strong>${esc(item.title || "", escapeHtml)}</strong>
                  ${item.description ? `<span>${esc(item.description, escapeHtml)}</span>` : ""}
                </a>
              `).join("")}
            </div>
          ` : ""}
        </div>
      </div>
    `,
  });
}

function renderServiceTailwindGridSection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  items = [],
  ctaLabel,
  ctaHref,
  lead = null,
  escapeHtml,
}) {
  const gridClass = lead ? "svx-grid svx-grid--lead" : items.length <= 3 ? "svx-grid svx-grid--three" : "svx-grid";
  const secondary = lead ? items.slice(0, 3) : items;
  return renderSectionShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      <div class="codex-v2-service-surface">
        <div class="svx-stage svx-stage--compact">
          <div class="svx-head">
            <h2 class="svx-title svx-title--compact"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</h2>
            ${subtitle ? `<p class="svx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</p>` : ""}
          </div>
          <div class="${gridClass}">
            ${lead ? `
              <a class="svx-grid-lead" href="${esc(lead.href || "#", escapeHtml)}">
                ${lead.icon ? `<span class="svx-icon"><img src="${esc(lead.icon, escapeHtml)}" alt="" /></span>` : ""}
                <strong>${esc(lead.title || "", escapeHtml)}</strong>
                ${lead.description ? `<span>${esc(lead.description, escapeHtml)}</span>` : ""}
              </a>
            ` : ""}
            ${secondary.map((item) => `
              <a class="svx-card" href="${esc(item.href || "#", escapeHtml)}">
                ${item.icon ? `<span class="svx-icon"><img src="${esc(item.icon, escapeHtml)}" alt="" /></span>` : ""}
                <strong>${esc(item.title || "", escapeHtml)}</strong>
                ${item.description ? `<span>${esc(item.description, escapeHtml)}</span>` : ""}
              </a>
            `).join("")}
          </div>
          ${ctaLabel ? `<div class="svx-actions"><a class="svx-btn-subtle" href="${esc(ctaHref || "#", escapeHtml)}">${esc(ctaLabel, escapeHtml)}</a></div>` : ""}
        </div>
      </div>
    `,
  });
}

function renderServiceTailwindRankingSection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  items = [],
  escapeHtml,
}) {
  return renderSectionShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      <div class="codex-v2-service-surface">
        <div class="svx-stage svx-stage--compact">
          <div class="svx-head">
            <h2 class="svx-title svx-title--compact"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</h2>
            ${subtitle ? `<p class="svx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</p>` : ""}
          </div>
          <div class="svx-ranking">
            ${items.map((item, index) => `
              <a class="svx-ranking-card" href="${esc(item.href || "#", escapeHtml)}">
                <span class="svx-ranking-rank">${String(index + 1).padStart(2, "0")}</span>
                <span class="svx-ranking-thumb">${item.image ? `<img src="${esc(item.image, escapeHtml)}" alt="${esc(item.title || "", escapeHtml)}" />` : ""}</span>
                <span class="svx-card-copy">
                  <strong>${esc(item.title || "", escapeHtml)}</strong>
                  ${item.description ? `<span>${esc(item.description, escapeHtml)}</span>` : ""}
                </span>
              </a>
            `).join("")}
          </div>
        </div>
      </div>
    `,
  });
}

function renderServiceTailwindBannerSection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  ctaLabel,
  href,
  imageSrc,
  imageAlt,
  escapeHtml,
}) {
  return renderSectionShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      <div class="codex-v2-service-surface">
        <div class="svx-stage svx-stage--compact">
          <a class="svx-banner" href="${esc(href || "#", escapeHtml)}">
            <span class="svx-head">
              <strong class="svx-title svx-title--compact"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</strong>
              ${subtitle ? `<span class="svx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</span>` : ""}
              ${ctaLabel ? `<span class="svx-btn-subtle">${esc(ctaLabel, escapeHtml)}</span>` : ""}
            </span>
            <span class="svx-banner-visual">
              ${imageSrc ? `<img src="${esc(imageSrc, escapeHtml)}" alt="${esc(imageAlt || title, escapeHtml)}" />` : ""}
            </span>
          </a>
        </div>
      </div>
    `,
  });
}

function renderServiceTailwindStorySection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  items = [],
  escapeHtml,
}) {
  return renderSectionShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      <div class="codex-v2-service-surface">
        <div class="svx-stage svx-stage--compact">
          <div class="svx-head">
            <h2 class="svx-title svx-title--compact"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</h2>
            ${subtitle ? `<p class="svx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</p>` : ""}
          </div>
          <div class="svx-story-grid">
            ${items.map((item) => `
              <a class="svx-story-card" href="${esc(item.href || "#", escapeHtml)}">
                <span class="svx-story-visual">${item.image ? `<img src="${esc(item.image, escapeHtml)}" alt="${esc(item.title || "", escapeHtml)}" />` : ""}</span>
                <strong>${esc(item.title || "", escapeHtml)}</strong>
                ${item.description ? `<span>${esc(item.description, escapeHtml)}</span>` : ""}
              </a>
            `).join("")}
          </div>
        </div>
      </div>
    `,
  });
}

function renderServiceTailwindCommerceSection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  items = [],
  escapeHtml,
}) {
  return renderSectionShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      <div class="codex-v2-service-surface">
        <div class="svx-stage svx-stage--compact">
          <div class="svx-head">
            <h2 class="svx-title svx-title--compact"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</h2>
            ${subtitle ? `<p class="svx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</p>` : ""}
          </div>
          <div class="${items.length <= 3 ? "svx-grid svx-grid--three" : "svx-grid"}">
            ${items.map((item) => `
              <a class="svx-card" href="${esc(item.href || "#", escapeHtml)}">
                <span class="svx-card-visual">${item.image ? `<img src="${esc(item.image, escapeHtml)}" alt="${esc(item.title || "", escapeHtml)}" />` : ""}</span>
                <strong>${esc(item.title || "", escapeHtml)}</strong>
                ${item.description ? `<span>${esc(item.description, escapeHtml)}</span>` : ""}
              </a>
            `).join("")}
          </div>
        </div>
      </div>
    `,
  });
}

module.exports = {
  renderServiceTailwindHeroSection,
  renderServiceTailwindGridSection,
  renderServiceTailwindRankingSection,
  renderServiceTailwindBannerSection,
  renderServiceTailwindStorySection,
  renderServiceTailwindCommerceSection,
};
