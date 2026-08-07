from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


WEB_BASE = os.getenv("AUDIT_WEB_BASE", "http://localhost:5173")
API_BASE = os.getenv("AUDIT_API_BASE", "http://localhost:3000/api/v1")
ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def safe_text(page, selector: str) -> str:
    try:
        return page.locator(selector).first.inner_text(timeout=1500).strip()
    except Exception:
        return ""


def visit(page, path: str, results: list[dict[str, Any]]) -> None:
    entry: dict[str, Any] = {"path": path}
    try:
        response = page.goto(f"{WEB_BASE}{path}", wait_until="networkidle", timeout=15000)
        entry["http_status"] = response.status if response else None
        entry["h1"] = safe_text(page, "h1")
        entry["body_has_error"] = any(
            marker in page.locator("body").inner_text().lower()
            for marker in ("cannot read", "application error", "uncaught", "failed to fetch")
        )
    except Exception as error:
        entry["error"] = str(error)
    results.append(entry)


def main() -> None:
    report: dict[str, Any] = {
        "web_base": WEB_BASE,
        "api_base": API_BASE,
        "api": {},
        "login": {},
        "routes": [],
        "responsive": [],
        "accessibility": {},
        "console_errors": [],
        "request_failures": [],
    }

    with sync_playwright() as playwright:
        request = playwright.request.new_context()
        for path in ("/health", "/auth/me"):
            try:
                response = request.get(f"{API_BASE}{path}")
                report["api"][path] = {"status": response.status, "body": response.text()[:500]}
            except Exception as error:
                report["api"][path] = {"error": str(error)}
        request.dispose()

        browser_options: dict[str, Any] = {"headless": True}
        executable = os.getenv(
            "AUDIT_BROWSER_EXECUTABLE",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        )
        if Path(executable).exists():
            browser_options["executable_path"] = executable
        browser = playwright.chromium.launch(**browser_options)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()

        page.on("console", lambda message: report["console_errors"].append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: report["console_errors"].append(str(error)))
        page.on("requestfailed", lambda failed: report["request_failures"].append({"url": failed.url, "error": failed.failure}))

        page.goto(f"{WEB_BASE}/login", wait_until="networkidle", timeout=15000)
        report["login"]["title"] = page.title()
        report["login"]["h1"] = safe_text(page, "h1")
        report["login"]["labels"] = page.locator("label").all_inner_texts()

        page.get_by_role("button", name="Sign In").click()
        report["login"]["missing_field_messages"] = page.locator(".field-error").all_inner_texts()
        report["login"]["focused_after_submit"] = page.evaluate("document.activeElement && document.activeElement.id")

        email = os.getenv("AUDIT_EMAIL")
        password = os.getenv("AUDIT_PASSWORD")
        if email and password:
            page.get_by_label("Email address").fill(email)
            page.get_by_label("Password").fill(password)
            page.get_by_role("button", name="Sign In").click()
            try:
                page.wait_for_url(f"{WEB_BASE}/", timeout=15000)
                report["login"]["authenticated"] = True
            except PlaywrightTimeoutError:
                report["login"]["authenticated"] = False
                report["login"]["error"] = safe_text(page, '[role="alert"]')
        else:
            report["login"]["authenticated"] = False
            report["login"]["skipped_reason"] = "AUDIT_EMAIL/AUDIT_PASSWORD were not supplied"

        if report["login"].get("authenticated"):
            for route in (
                "/",
                "/candidates",
                "/applications",
                "/interviews",
                "/offers",
                "/hires",
                "/talent-pool",
                "/import",
                "/reports",
                "/pipeline-settings",
                "/integrations",
                "/design-system",
                "/states-feedback",
                "/does-not-exist",
            ):
                visit(page, route, report["routes"])

            for width in (1440, 768, 375):
                page.set_viewport_size({"width": width, "height": 1000})
                page.goto(f"{WEB_BASE}/", wait_until="networkidle", timeout=15000)
                metrics = page.evaluate(
                    """() => ({
                        viewport: window.innerWidth,
                        scrollWidth: document.documentElement.scrollWidth,
                        clientWidth: document.documentElement.clientWidth,
                        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                        mobileToggle: Boolean(document.querySelector('.mobile-nav-toggle')),
                        sidebarVisible: getComputedStyle(document.querySelector('.sidebar')).transform === 'none'
                    })"""
                )
                screenshot = ARTIFACTS / f"dashboard-{width}.png"
                page.screenshot(path=str(screenshot), full_page=True)
                report["responsive"].append({**metrics, "screenshot": str(screenshot.relative_to(ROOT))})

            page.set_viewport_size({"width": 375, "height": 1000})
            page.goto(f"{WEB_BASE}/", wait_until="networkidle", timeout=15000)
            page.get_by_role("button", name="Open navigation").click()
            report["responsive"].append(
                {
                    "mobile_navigation_opened": page.locator(".sidebar.mobile-open").count() == 1,
                    "close_button_visible": page.get_by_role("button", name="Close navigation").count() == 1,
                }
            )

            report["accessibility"] = page.evaluate(
                """() => ({
                    unlabeledInputs: [...document.querySelectorAll('input,select,textarea')]
                        .filter(el => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.closest('label'))
                        .map(el => ({tag: el.tagName, type: el.getAttribute('type'), id: el.id})),
                    unnamedButtons: [...document.querySelectorAll('button')]
                        .filter(el => !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title'))
                        .length,
                    dialogs: document.querySelectorAll('[role="dialog"]').length
                })"""
            )

        context.close()
        browser.close()

    (ROOT / "browser-audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
