"""Read-only F0 frontend baseline across routes, widths, themes, and personas."""

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:5173"
ADMIN_EMAIL = "ahmed.mahmoud@recruitflow.local"
PASSWORD = "Password123!"
WIDTHS = [1440, 1280, 1024, 768, 430, 375]
THEMES = ["light", "dark"]
ROUTES = [
    ("login", "/login", False),
    ("dashboard", "/", True),
    ("candidates", "/candidates", True),
    ("vacancies", "/vacancies", True),
    ("applications", "/applications", True),
    ("cv-bank", "/cv-bank", True),
    ("reports", "/reports", True),
    ("master-data", "/master-data", True),
    ("pipeline-settings", "/pipeline-settings", True),
]


def browser_executable():
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    candidates = sorted((Path(local_app_data) / "ms-playwright").glob("chromium-*"), reverse=True)
    for directory in candidates:
        for relative in ("chrome-win/chrome.exe", "chrome-win64/chrome.exe"):
            executable = directory / relative
            if executable.exists():
                return str(executable)
    return None


def login(page):
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=20_000)
    page.locator("#login-email").fill(ADMIN_EMAIL)
    page.locator("#login-password").fill(PASSWORD)
    page.locator("button[type='submit']").click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=20_000)
    page.wait_for_selector(".app", timeout=20_000)


def inspect_page(page):
    return page.evaluate(
        """() => {
          const first = (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return {
              selector,
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              padding: style.padding,
              gap: style.gap,
              borderRadius: style.borderRadius,
              boxShadow: style.boxShadow,
            };
          };
          const focusables = [...document.querySelectorAll(
            'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
          )].filter(el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
          });
          return {
            title: document.title,
            bodyFontSize: getComputedStyle(document.documentElement).fontSize,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            selectors: [
              'h1', 'h2', 'input', 'button', '.sidebar', '.header', '.main',
              '.main-shell', '.rf-page', '.rf-card', '[role="dialog"]'
            ].map(first).filter(Boolean),
            focusableCount: focusables.length,
            firstFocusable: focusables.slice(0, 8).map(el => ({
              tag: el.tagName,
              id: el.id,
              text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 80),
            })),
          };
        }"""
    )


def run():
    results = []
    failures = []
    screenshots = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=browser_executable(), headless=True)
        for width in WIDTHS:
            for theme in THEMES:
                context = browser.new_context(
                    viewport={"width": width, "height": 900}, color_scheme=theme
                )
                page = context.new_page()
                console_errors = []
                server_errors = []
                page.on("pageerror", lambda error: console_errors.append(str(error)))
                page.on(
                    "console",
                    lambda message: console_errors.append(message.text)
                    if message.type == "error"
                    else None,
                )
                page.on(
                    "response",
                    lambda response: server_errors.append(f"{response.status} {response.url}")
                    if response.status >= 500
                    else None,
                )
                try:
                    for name, route, protected in ROUTES:
                        if protected and "/login" in page.url:
                            login(page)
                            # The unauthenticated bootstrap probes /auth/me and
                            # /auth/refresh before login. Only post-login errors
                            # are relevant to the protected route evidence.
                            console_errors.clear()
                            server_errors.clear()
                        page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded", timeout=20_000)
                        if protected:
                            page.wait_for_selector(".app", timeout=20_000)
                        page.wait_for_timeout(750)
                        inspection = inspect_page(page)
                        record = {
                            "width": width,
                            "theme": theme,
                            "name": name,
                            "route": route,
                            "url": page.url,
                            "inspection": inspection,
                            "consoleErrors": list(console_errors),
                            "serverErrors": list(server_errors),
                        }
                        results.append(record)
                        if name == "login" and width in (1440, 375):
                            path = Path("tests/artifacts/browser") / f"f0-{name}-{width}-{theme}.png"
                            page.screenshot(path=str(path), full_page=True)
                            screenshots.append(str(path))
                    relevant_console_errors = [
                        error for error in console_errors
                        if "401 (Unauthorized)" not in error
                    ]
                    if relevant_console_errors or server_errors:
                        failures.append({"width": width, "theme": theme, "console": relevant_console_errors, "server": server_errors})
                except Exception as error:
                    failures.append({"width": width, "theme": theme, "error": str(error)})
                finally:
                    context.close()
        browser.close()

    artifact = Path("tests/artifacts/browser/f0_frontend_baseline.json")
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_text(json.dumps({"results": results, "failures": failures, "screenshots": screenshots}, indent=2), encoding="utf-8")
    print(f"F0 baseline records: {len(results)}")
    print(f"F0 matrix cases: {len(WIDTHS) * len(THEMES)}")
    print(f"F0 failures: {len(failures)}")
    print(f"F0 artifact: {artifact}")
    for failure in failures:
        print(f"FAIL {failure}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(run())
