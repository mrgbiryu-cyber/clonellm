import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = '/mnt/c/Users/mrgbi/lge-site-analysis';
const OUT_PATH = path.join(ROOT, 'data', 'visual', 'batch-summary.json');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function run(label, command, args = []) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });
  return {
    label,
    command: [command, ...args].join(' '),
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function summarizeHomeLower() {
  const names = [
    'brand-showroom',
    'latest-product-news',
    'space-renewal',
    'subscription',
    'smart-life',
    'missed-benefits',
    'lg-best-care',
    'bestshop-guide',
    'summary-banner-2',
  ];
  const sections = names.map((name) => {
    const dir = path.join(ROOT, 'data', 'visual', 'home-lower', name);
    const metadata = readJson(path.join(dir, 'metadata.json'), {});
    return {
      slotId: name,
      liveReference: exists(path.join(dir, 'live-reference.png')),
      working: exists(path.join(dir, 'working.png')),
      metadata: exists(path.join(dir, 'metadata.json')),
      generatedAt: metadata.generatedAt || metadata.capturedAt || null,
    };
  });
  return {
    sectionCount: sections.length,
    sections,
  };
}

function summarizeIndex(filePath) {
  const index = readJson(filePath, { captures: [], errors: [] });
  return {
    generatedAt: index.generatedAt || null,
    captureCount: Array.isArray(index.captures) ? index.captures.length : 0,
    errorCount: Array.isArray(index.errors) ? index.errors.length : 0,
    samples: (index.captures || []).slice(0, 10).map((item) => ({
      pageId: item.pageId,
      viewportProfile: item.viewportProfile,
      sourceType: item.sourceType,
    })),
  };
}

function main() {
  const steps = [
    run('home-page-visual', 'python3', ['scripts/capture_visual_snapshots.py', 'home']),
    run('home-lower-sections', 'node', ['scripts/capture_home_lower_sections.mjs']),
    run('service-pages-reference', 'node', ['scripts/capture_service_pages.mjs', '--source', 'reference']),
    run('service-pages-working', 'node', ['scripts/capture_service_pages.mjs', '--source', 'working']),
    run('plp-reference', 'node', ['scripts/capture_plp_representatives.mjs', '--source', 'reference']),
    run('plp-working', 'node', ['scripts/capture_plp_representatives.mjs', '--source', 'working']),
  ];

  const summary = {
    generatedAt: new Date().toISOString(),
    overallStatus: steps.some((step) => step.status === 'fail') ? 'fail' : 'pass',
    steps,
    artifacts: {
      homeLower: summarizeHomeLower(),
      servicePages: summarizeIndex(path.join(ROOT, 'data', 'visual', 'service-pages', 'index.json')),
      plp: summarizeIndex(path.join(ROOT, 'data', 'visual', 'plp', 'index.json')),
      homePage: {
        liveReference: exists(path.join(ROOT, 'data', 'visual', 'home', 'live-reference.png')),
        working: exists(path.join(ROOT, 'data', 'visual', 'home', 'working.png')),
        compareDom: exists(path.join(ROOT, 'data', 'visual', 'home', 'compare.dom.html')),
      },
    },
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ out: OUT_PATH, overallStatus: summary.overallStatus }, null, 2));
}

main();
