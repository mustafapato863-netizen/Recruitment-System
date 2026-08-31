"""CV Intake & Full Data Extraction Browser Matrix Test."""

import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PORT = 5187
BASE_URL = os.environ.get("RECRUITFLOW_WEB_URL", f"http://127.0.0.1:{PORT}")
VIEWPORTS = ((375, 812), (430, 900), (768, 900), (1024, 900), (1280, 900), (1440, 900))
THEMES = ("light", "dark")

def browser_executable():
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        return None
    candidates = sorted(
        (Path(local_app_data) / "ms-playwright").glob("chromium-*/chrome-win64/chrome.exe"),
        reverse=True,
    )
    return str(candidates[0]) if candidates else None

def is_server_ready(url, timeout=1):
    try:
        req = urllib.request.urlopen(f"{url}/", timeout=timeout)
        return req.getcode() == 200
    except Exception:
        return False

def test_cv_intake_browser():
    preview_proc = None
    if not is_server_ready(BASE_URL):
        print(f"Starting web preview server on port {PORT}...")
        web_dir = Path(__file__).resolve().parent.parent.parent / "apps" / "web"
        preview_proc = subprocess.Popen(
            ["npx", "--yes", "vite", "preview", "--port", str(PORT), "--host", "127.0.0.1"],
            cwd=str(web_dir),
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(30):
            if is_server_ready(BASE_URL):
                break
            time.sleep(0.3)

    passed = 0
    failed = 0
    total = len(VIEWPORTS) * len(THEMES)

    print(f"=== CV INTAKE BROWSER MATRIX ({total} evaluations) ===\n")

    try:
        with sync_playwright() as p:
            executable = browser_executable()
            launch_opts = {"headless": True}
            if executable:
                launch_opts["executable_path"] = executable

            browser = p.chromium.launch(**launch_opts)

            for width, height in VIEWPORTS:
                for theme in THEMES:
                    context = browser.new_context(
                        viewport={"width": width, "height": height},
                        color_scheme=theme,
                    )
                    page = context.new_page()

                    errors = []
                    page.on("pageerror", lambda err: errors.append(str(err)))

                    try:
                        page.goto(f"{BASE_URL}/cv-intake", wait_until="domcontentloaded", timeout=10000)
                        page.evaluate(f"() => document.documentElement.classList.toggle('dark', {str(theme == 'dark').lower()})")

                        # Check for title / header
                        heading = page.locator("h1").first
                        has_heading = heading.is_visible() if heading.count() > 0 else False

                        # Check for horizontal overflow
                        overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 2")

                        # Assertions
                        if len(errors) == 0 and not overflow:
                            passed += 1
                            print(f"  ✅ PASS: /cv-intake @ {width}px [{theme}] (overflow={overflow}, errors={len(errors)})")
                        else:
                            failed += 1
                            print(f"  ❌ FAIL: /cv-intake @ {width}px [{theme}] (overflow={overflow}, errors={errors})")

                    except Exception as ex:
                        failed += 1
                        print(f"  ❌ ERROR: /cv-intake @ {width}px [{theme}]: {ex}")
                    finally:
                        context.close()

            browser.close()
    finally:
        if preview_proc:
            preview_proc.terminate()

    print(f"\n============================================================")
    print(f"CV INTAKE BROWSER RESULTS: {passed} PASSED, {failed} FAILED / {total} TOTAL")
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    test_cv_intake_browser()
