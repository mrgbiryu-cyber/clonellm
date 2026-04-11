import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const ROOT = "/mnt/c/Users/mrgbi/lge-site-analysis";
const QUEUE_PATH = path.join(ROOT, "data", "runtime", "job-queue.json");
const LOCK_PATH = path.join(ROOT, "tmp", "job-worker.lock");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function readQueue() {
  return readJson(QUEUE_PATH, { generatedAt: null, jobs: [] });
}

function writeQueue(queue) {
  writeJson(QUEUE_PATH, {
    ...queue,
    generatedAt: new Date().toISOString(),
  });
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    result[key] = value;
  }
  return result;
}

function acquireLock(lockPath) {
  ensureDir(path.dirname(lockPath));
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(fd, String(process.pid));
    return () => {
      try {
        fs.closeSync(fd);
      } catch {}
      try {
        fs.unlinkSync(lockPath);
      } catch {}
    };
  } catch {
    throw new Error(`worker_lock_exists:${lockPath}`);
  }
}

function createJob(type, params) {
  return {
    id: crypto.randomUUID(),
    type,
    params,
    status: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    error: null,
  };
}

function buildCommand(job) {
  const args = [];
  const pushFlag = (key, value) => {
    if (value == null || value === "") return;
    args.push(`--${key}`, String(value));
  };

  if (job.type === "capture-pdp") {
    pushFlag("pageId", job.params.pageId);
    pushFlag("viewportProfile", job.params.viewportProfile);
    pushFlag("source", job.params.source);
    pushFlag("limit", job.params.limit);
    pushFlag("baseUrl", job.params.baseUrl);
    return {
      cmd: "node",
      args: ["scripts/capture_pdp_representatives.mjs", ...args],
    };
  }

  if (job.type === "extract-pdp-groups") {
    pushFlag("pageId", job.params.pageId);
    pushFlag("viewportProfile", job.params.viewportProfile);
    pushFlag("source", job.params.source);
    pushFlag("limit", job.params.limit);
    pushFlag("baseUrl", job.params.baseUrl);
    return {
      cmd: "node",
      args: ["scripts/extract_pdp_groups.mjs", ...args],
    };
  }

  throw new Error(`unsupported_job_type:${job.type}`);
}

function formatJob(job) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    pageId: job.params?.pageId || null,
    viewportProfile: job.params?.viewportProfile || null,
    source: job.params?.source || null,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
  };
}

async function runChild(job) {
  const { cmd, args } = buildCommand(job);
  await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`job_exit_code:${code}`));
    });
    child.on("error", reject);
  });
}

async function runNext() {
  const releaseLock = acquireLock(LOCK_PATH);
  try {
    const queue = readQueue();
    const next = (queue.jobs || []).find((job) => job.status === "queued");
    if (!next) {
      console.log(JSON.stringify({ status: "idle", queueLength: queue.jobs.length }, null, 2));
      return;
    }

    next.status = "running";
    next.startedAt = new Date().toISOString();
    writeQueue(queue);

    try {
      await runChild(next);
      next.status = "done";
      next.finishedAt = new Date().toISOString();
      next.error = null;
    } catch (error) {
      next.status = "failed";
      next.finishedAt = new Date().toISOString();
      next.error = String(error);
    }

    writeQueue(queue);
    console.log(JSON.stringify({ status: next.status, job: formatJob(next) }, null, 2));
  } finally {
    releaseLock();
  }
}

async function runAll() {
  while (true) {
    const queue = readQueue();
    const pending = (queue.jobs || []).some((job) => job.status === "queued");
    if (!pending) {
      console.log(JSON.stringify({ status: "complete", summary: summarizeQueue(queue) }, null, 2));
      return;
    }
    await runNext();
  }
}

function summarizeQueue(queue) {
  const jobs = queue.jobs || [];
  return {
    total: jobs.length,
    queued: jobs.filter((job) => job.status === "queued").length,
    running: jobs.filter((job) => job.status === "running").length,
    done: jobs.filter((job) => job.status === "done").length,
    failed: jobs.filter((job) => job.status === "failed").length,
  };
}

function listJobs() {
  const queue = readQueue();
  console.log(JSON.stringify({ summary: summarizeQueue(queue), jobs: queue.jobs.map(formatJob) }, null, 2));
}

function enqueue(type, params) {
  const queue = readQueue();
  const job = createJob(type, params);
  queue.jobs.push(job);
  writeQueue(queue);
  console.log(JSON.stringify({ enqueued: formatJob(job), summary: summarizeQueue(queue) }, null, 2));
}

function seedPdpGroups(params) {
  const queue = readQueue();
  const pageIds = ["category-tvs", "category-refrigerators"];
  const viewportProfiles = ["pc", "mo"];
  const sources = ["reference", "working"];
  for (const pageId of pageIds) {
    for (const viewportProfile of viewportProfiles) {
      for (const source of sources) {
        queue.jobs.push(
          createJob("extract-pdp-groups", {
            pageId,
            viewportProfile,
            source,
            baseUrl: params.baseUrl || "http://localhost:3000",
          })
        );
      }
    }
  }
  writeQueue(queue);
  console.log(JSON.stringify({ status: "seeded", summary: summarizeQueue(queue) }, null, 2));
}

function resetQueue() {
  writeQueue({ jobs: [] });
  console.log(JSON.stringify({ status: "reset", summary: summarizeQueue(readQueue()) }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "list";

  if (command === "enqueue") {
    const type = args.type;
    if (!type) throw new Error("missing --type");
    enqueue(type, {
      pageId: args.pageId || null,
      viewportProfile: args.viewportProfile || null,
      source: args.source || null,
      limit: args.limit || null,
      baseUrl: args.baseUrl || "http://localhost:3000",
    });
    return;
  }

  if (command === "seed-pdp-groups") {
    seedPdpGroups({ baseUrl: args.baseUrl || "http://localhost:3000" });
    return;
  }

  if (command === "run-next") {
    await runNext();
    return;
  }

  if (command === "run-all") {
    await runAll();
    return;
  }

  if (command === "reset") {
    resetQueue();
    return;
  }

  if (command === "list") {
    listJobs();
    return;
  }

  throw new Error(`unknown_command:${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
