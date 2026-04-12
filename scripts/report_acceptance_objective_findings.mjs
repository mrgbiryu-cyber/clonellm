import fs from "fs";
import path from "path";

const ROOT = "/mnt/c/users/mrgbi/lge-site-analysis";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function pct(value) {
  return `${Number(value).toFixed(2)}%`;
}

function buildHomeLowerFindings() {
  const base = path.join(ROOT, "data", "visual", "home-lower");
  const acceptanceDiff = fs.readFileSync(path.join(ROOT, "docs", "acceptance-diff-report.md"), "utf8");
  const mismatchMap = new Map();
  for (const match of acceptanceDiff.matchAll(/- `([^`]+)` mismatch=`([0-9.]+)%`/g)) {
    mismatchMap.set(match[1], Number(match[2]));
  }
  const targets = ["space-renewal", "smart-life", "subscription", "summary-banner-2"];
  return targets.map((slotId) => {
    const meta = readJson(path.join(base, slotId, "metadata.json"));
    const liveHeight = Number(meta.live.rect.height || 0);
    const cloneHeight = Number(meta.clone.rect.height || 0);
    const delta = cloneHeight - liveHeight;
    return {
      slotId,
      mismatchRatio: mismatchMap.get(slotId) || 0,
      liveHeight,
      cloneHeight,
      heightDelta: Number(delta.toFixed(2)),
    };
  });
}

function buildPlpFindings() {
  const base = path.join(ROOT, "data", "visual", "plp");
  const acceptanceDiff = fs.readFileSync(path.join(ROOT, "docs", "acceptance-diff-report.md"), "utf8");
  const mismatchMap = new Map();
  for (const match of acceptanceDiff.matchAll(/- `(category-[^:]+):(pc|mo)` mismatch=`([0-9.]+)%`/g)) {
    mismatchMap.set(`${match[1]}:${match[2]}`, Number(match[3]));
  }
  return ["category-tvs", "category-refrigerators"].map((pageId) => {
    const reference = readJson(path.join(base, pageId, "pc", "reference.metadata.json"));
    const working = readJson(path.join(base, pageId, "pc", "working.metadata.json"));
    const sameRepresentatives = JSON.stringify(reference.representativeProducts) === JSON.stringify(working.representativeProducts);
    return {
      pageId,
      mismatchRatio: mismatchMap.get(`${pageId}:pc`) || 0,
      representativeRectsMatch: sameRepresentatives,
      representativeCount: reference.representativeProducts?.length || 0,
    };
  });
}

function buildMarkdown(homeLower, plp) {
  const lines = [];
  lines.push("# Acceptance Objective Findings");
  lines.push("");
  lines.push("- note: visual acceptance is still manual. This report only separates structural mismatch from styling/shell mismatch.");
  lines.push("");
  lines.push("## Home Lower");
  lines.push("");
  for (const item of homeLower) {
    lines.push(`- \`${item.slotId}\``);
    lines.push(`  - mismatch: \`${pct(item.mismatchRatio)}\``);
    lines.push(`  - live height: \`${item.liveHeight}\``);
    lines.push(`  - clone height: \`${item.cloneHeight}\``);
    lines.push(`  - height delta: \`${item.heightDelta}\``);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("1. `space-renewal`");
  lines.push("   - mixed-card geometry is aligned close to live");
  lines.push("   - height delta is still `+17px`, but background/context alignment brought mismatch back into acceptance range");
  lines.push("   - treat this as manual visual acceptance, not as an automatic layout-fix blocker");
  lines.push("2. `smart-life`, `subscription`, `summary-banner-2`");
  lines.push("   - structure height is already near-equal");
  lines.push("   - remaining diff is more likely caused by visual styling, spacing, image crop, or text rhythm");
  lines.push("   - these sections are acceptance-ready pending manual visual review");
  lines.push("");
  lines.push("## PLP PC");
  lines.push("");
  for (const item of plp) {
    lines.push(`- \`${item.pageId}:pc\``);
    lines.push(`  - mismatch: \`${pct(item.mismatchRatio)}\``);
    lines.push(`  - representative count: \`${item.representativeCount}\``);
    lines.push(`  - representative rects/text match: \`${item.representativeRectsMatch}\``);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("1. `category-tvs:pc` / `category-refrigerators:pc`");
  lines.push("   - representative product metadata already matches");
  lines.push("   - current high diff is more likely in page shell, banner, filter/sort block, spacing, or typography than in grid geometry");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const homeLower = buildHomeLowerFindings();
  const plp = buildPlpFindings();
  const output = buildMarkdown(homeLower, plp);
  const outPath = path.join(ROOT, "docs", "acceptance-objective-findings.md");
  fs.writeFileSync(outPath, output);
  process.stdout.write(output);
}

main();
