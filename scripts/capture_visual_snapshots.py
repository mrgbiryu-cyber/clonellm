#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path("/mnt/c/Users/mrgbi/lge-site-analysis")
OUTPUT_ROOT = ROOT / "data" / "visual"
DEFAULT_PAGE_ID = "home"
DEFAULT_WIDTH = 1460
DEFAULT_HEIGHT = 2600
DEFAULT_BASE_URL = "http://localhost:3000"
DEFAULT_CHROME = Path.home() / ".cache" / "ms-playwright" / "chromium-1217" / "chrome-linux64" / "chrome"
ARCHIVE_INDEX_PATH = ROOT / "data" / "raw" / "archive-index.json"


def fetch_json(url: str):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def slug_from_url(raw_url: str):
    from urllib.parse import urlparse
    import hashlib
    import re

    parsed = urlparse(raw_url)
    pathname = parsed.path.strip("/") or "root"
    base = re.sub(r"[^a-zA-Z0-9_-]+", "-", pathname)[:100]
    if not parsed.query:
        return base
    digest = hashlib.sha1(parsed.query.encode()).hexdigest()[:8]
    return f"{base}-{digest}"


def resolve_live_url(page_id: str):
    normalized = (page_id or "home").strip() or "home"
    if normalized == "home":
        return "https://www.lge.co.kr/m/home"
    if normalized.startswith("category-"):
        slug = normalized[len("category-"):].strip()
        if slug:
            return f"https://www.lge.co.kr/m/category/{slug}"
    try:
        rows = json.loads(ARCHIVE_INDEX_PATH.read_text(encoding="utf-8"))
    except Exception:
        rows = []
    for row in rows:
        url = row.get("url")
        if not url:
            continue
        if slug_from_url(url) == page_id:
            return url
    return f"https://www.lge.co.kr/{normalized}"


def wait_for_measurements(base_url: str, page_id: str, timeout_seconds: float = 8.0):
    started = time.time()
    while time.time() - started < timeout_seconds:
      try:
          payload = fetch_json(f"{base_url}/api/measurements?pageId={page_id}")
          measurements = payload.get("measurements", {})
          if measurements.get("reference-content") and measurements.get("clone-shell") and measurements.get("clone-content"):
              return payload
      except Exception:
          pass
      time.sleep(0.5)
    return fetch_json(f"{base_url}/api/measurements?pageId={page_id}")


def run_capture(chrome_bin: str, url: str, output_path: Path, width: int, height: int):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        chrome_bin,
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=8000",
        f"--window-size={width},{height}",
        f"--screenshot={str(output_path)}",
        url,
    ]
    completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
    return {
        "cmd": cmd,
        "returncode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def run_dump_dom(chrome_bin: str, url: str, width: int, height: int):
    cmd = [
        chrome_bin,
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=8000",
        f"--window-size={width},{height}",
        "--dump-dom",
        url,
    ]
    completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
    return {
        "cmd": cmd,
        "returncode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def main():
    page_id = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PAGE_ID
    width = int(os.environ.get("VISUAL_CANVAS_WIDTH", DEFAULT_WIDTH))
    height = int(os.environ.get("VISUAL_CANVAS_HEIGHT", DEFAULT_HEIGHT))
    base_url = os.environ.get("VISUAL_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    chrome_bin = os.environ.get("CHROME_BIN", str(DEFAULT_CHROME))

    output_dir = OUTPUT_ROOT / page_id
    output_dir.mkdir(parents=True, exist_ok=True)
    live_url = resolve_live_url(page_id)

    targets = {
        "live-reference": live_url,
        "reference-replay": f"{base_url}/reference-content/{page_id}",
        "working": f"{base_url}/clone/{page_id}",
        "compare": f"{base_url}/compare/{page_id}",
    }

    screenshots = {}
    for name, url in targets.items():
        output_path = output_dir / f"{name}.png"
        result = run_capture(chrome_bin, url, output_path, width, height)
        screenshots[name] = {
            "url": url,
            "path": str(output_path),
            "returncode": result["returncode"],
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }

    metadata = {
        "pageId": page_id,
        "liveUrl": live_url,
        "canvas": {
            "width": width,
            "height": height,
        },
        "screenshots": screenshots,
        "slotDiff": fetch_json(f"{base_url}/api/slot-diff?pageId={page_id}"),
        "referenceSlots": fetch_json(f"{base_url}/api/slot-snapshots?pageId={page_id}&source=reference"),
        "workingSlots": fetch_json(f"{base_url}/api/slot-snapshots?pageId={page_id}&source=working"),
        "liveMeasurements": wait_for_measurements(base_url, page_id),
    }

    compare_dom = run_dump_dom(chrome_bin, targets["compare"], width, height)
    compare_dom_path = output_dir / "compare.dom.html"
    compare_dom_path.write_text(compare_dom["stdout"], encoding="utf-8")
    metadata["compareDom"] = {
        "path": str(compare_dom_path),
        "returncode": compare_dom["returncode"],
        "stderr": compare_dom["stderr"],
    }

    metadata_path = output_dir / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(metadata_path))


if __name__ == "__main__":
    main()
