"""Read-only dual-mode route matrix for the RecruitFlow enhancement gate."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


BASE_URL = os.environ.get("RECRUITFLOW_WEB_URL", "http://localhost:5173")
API_URL = os.environ.get("RECRUITFLOW_API_URL", "http://localhost:3000/api/v1")
ARTIFACT_DIR = Path(os.environ.get("RECRUITFLOW_BROWSER_ARTIFACTS", "tests/artifacts/dual-mode"))
AXE_PATH = Path("apps/web/node_modules/axe-core/axe.min.js").resolve()
VIEWPORTS = ((375, 812), (430, 900), (768, 900), (1024, 900), (1280, 900), (1440, 900))
THEMES = ("light", "dark")
STATIC_ROUTES = (
    "/", "/tasks", "/notifications", "/vacancy-requests", "/vacancy-requests/create",
    "/approval-inbox", "/vacancies", "/candidates", "/talent-pool", "/cv-intake",
    "/applications", "/interviews", "/interviews/calendar", "/offers", "/offers/create",
    "/offers/approvals/inbox", "/hires", "/hires/approvals/inbox", "/licenses", "/joinings",
    "/reports", "/users", "/master-data", "/audit-log", "/pipeline-settings", "/integrations",
    "/route-that-does-not-exist",
)
AXE_ROUTES = {"/login", "/", "/candidates", "/applications", "/reports"}
SCREENSHOT_ROUTES = {"/", "/candidates", "/applications", "/reports"}


def selected_routes(default: tuple[str, ...]) -> tuple[str, ...]:
    configured = os.environ.get("RECRUITFLOW_MATRIX_ROUTES")
    return tuple(item.strip() for item in configured.split(",") if item.strip()) if configured else default


def selected_viewports(default: tuple[tuple[int, int], ...]) -> tuple[tuple[int, int], ...]:
    configured = os.environ.get("RECRUITFLOW_MATRIX_WIDTHS")
    if not configured:
        return default
    heights = {width: height for width, height in default}
    return tuple((width, heights.get(width, 900)) for width in (int(item.strip()) for item in configured.split(",") if item.strip()))


def selected_themes(default: tuple[str, ...]) -> tuple[str, ...]:
    configured = os.environ.get("RECRUITFLOW_MATRIX_THEMES")
    return tuple(item.strip() for item in configured.split(",") if item.strip()) if configured else default


def browser_executable() -> str | None:
    configured = os.environ.get("RECRUITFLOW_BROWSER_EXECUTABLE")
    if configured and Path(configured).exists():
        return configured
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        return None
    candidates = sorted(
        (Path(local_app_data) / "ms-playwright").glob("chromium-*/chrome-win64/chrome.exe"),
        reverse=True,
    )
    return str(candidates[0]) if candidates else None


def no_overflow(page: Page) -> tuple[bool, dict]:
    details = page.evaluate(
        """() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          offenders: Array.from(document.querySelectorAll('body *'))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.right > innerWidth + 1 && getComputedStyle(element).position !== 'fixed';
            })
            .slice(0, 4)
            .map((element) => ({ tag: element.tagName, className: String(element.className).slice(0, 120) }))
        })"""
    )
    return details["scrollWidth"] <= details["width"] + 1, details


def first_record_path(page: Page, endpoint: str, route_prefix: str) -> str | None:
    record_id = page.evaluate(
        """async ({ apiUrl, endpoint }) => {
          const response = await fetch(`${apiUrl}${endpoint}`, { credentials: 'include' });
          if (!response.ok) return null;
          const payload = await response.json();
          const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
          return rows[0]?.id ?? null;
        }""",
        {"apiUrl": API_URL, "endpoint": endpoint},
    )
    return f"{route_prefix}/{record_id}" if record_id else None


def axe_violations(page: Page) -> list[dict]:
    page.add_script_tag(path=str(AXE_PATH))
    return page.evaluate(
        """async () => {
          const result = await axe.run(document, { resultTypes: ['violations'] });
          return result.violations
            .filter((violation) => ['critical', 'serious'].includes(violation.impact))
            .map((violation) => ({
              id: violation.id,
              impact: violation.impact,
              description: violation.description,
              nodes: violation.nodes.length,
              targets: violation.nodes.slice(0, 12).map((node) => ({
                target: node.target,
                html: node.html,
                failureSummary: node.failureSummary
              }))
            }));
        }"""
    )


def login(page: Page) -> None:
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    page.get_by_label("Email address").fill(os.environ.get("RECRUITFLOW_TEST_EMAIL", "admin@me.com"))
    page.locator("#login-password").fill(os.environ.get("RECRUITFLOW_TEST_PASSWORD", "Admin@123456"))
    page.get_by_role("button", name="Sign in").click()
    try:
        page.wait_for_function("window.location.pathname === '/'", timeout=15_000)
    except Exception:  # noqa: BLE001 - preserve the visible authentication evidence
        page.screenshot(path=str(ARTIFACT_DIR / "login-failure.png"), full_page=True)
        visible_text = re.sub(r"\s+", " ", page.locator("body").inner_text()).strip()
        raise AssertionError(f"Login did not complete at {page.url}: {visible_text[:800]}")
    page.locator("h1").first.wait_for(state="visible", timeout=15_000)


def run() -> int:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    runtime_errors: dict[str, list[str]] = {}
    failed_responses: dict[str, list[str]] = {}
    current_key = "bootstrap"

    with sync_playwright() as playwright:
        launch_options: dict = {"headless": True, "args": ["--host-resolver-rules=MAP localhost 127.0.0.1"]}
        executable = browser_executable()
        if executable:
            launch_options["executable_path"] = executable
        browser = playwright.chromium.launch(**launch_options)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.on("console", lambda message: runtime_errors.setdefault(current_key, []).append(message.text) if message.type == "error" else None)
        page.on(
            "response",
            lambda response: failed_responses.setdefault(current_key, []).append(f"{response.status} {response.url}")
            if response.status >= 400 and response.status != 401 else None,
        )

        current_key = "login"
        login(page)
        dynamic_routes = tuple(filter(None, (
            first_record_path(page, "/vacancy-requests?page=1&pageSize=1", "/vacancy-requests"),
            first_record_path(page, "/vacancies?page=1&pageSize=1", "/vacancies"),
            first_record_path(page, "/candidates?page=1&pageSize=1", "/candidates"),
            first_record_path(page, "/applications?page=1&pageSize=1", "/applications"),
            first_record_path(page, "/interviews?page=1&pageSize=1", "/interviews"),
            first_record_path(page, "/offers?page=1&pageSize=1", "/offers"),
            first_record_path(page, "/hiring?page=1&pageSize=1", "/hires"),
        )))
        routes = selected_routes(STATIC_ROUTES + dynamic_routes)

        for theme in selected_themes(THEMES):
            page.evaluate("theme => localStorage.setItem('recruitflow.theme', theme)", theme)
            for width, height in selected_viewports(VIEWPORTS):
                page.set_viewport_size({"width": width, "height": height})
                for route in routes:
                    current_key = f"{theme}:{width}:{route}"
                    runtime_errors[current_key] = []
                    failed_responses[current_key] = []
                    entry = {"theme": theme, "width": width, "route": route, "result": "PASS", "issues": []}
                    try:
                        page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded", timeout=15_000)
                        page.locator("h1").first.wait_for(state="visible", timeout=12_000)
                        page.wait_for_timeout(180)
                        active_theme = page.locator("html").get_attribute("data-theme")
                        if active_theme != theme:
                            entry["issues"].append(f"theme={active_theme}")
                        fits, overflow = no_overflow(page)
                        if not fits:
                            entry["issues"].append({"overflow": overflow})
                        if runtime_errors[current_key]:
                            entry["issues"].append({"console": runtime_errors[current_key]})
                        if failed_responses[current_key]:
                            entry["issues"].append({"responses": failed_responses[current_key]})
                        if route in AXE_ROUTES:
                            violations = axe_violations(page)
                            if violations:
                                entry["issues"].append({"axe": violations})
                        if route in SCREENSHOT_ROUTES and width in (375, 1440):
                            slug = "dashboard" if route == "/" else route.strip("/").replace("/", "-")
                            page.screenshot(path=str(ARTIFACT_DIR / f"{slug}-{theme}-{width}.png"), full_page=True)
                        if entry["issues"]:
                            entry["result"] = "FAIL"
                    except Exception as error:  # noqa: BLE001 - matrix records every route before exit
                        entry["result"] = "FAIL"
                        entry["issues"].append(str(error))
                    results.append(entry)
                    print(f"[{entry['result']}] {theme} {width} {route}", flush=True)

        browser.close()

    summary = {
        "checks": len(results),
        "passed": sum(1 for result in results if result["result"] == "PASS"),
        "failed": sum(1 for result in results if result["result"] == "FAIL"),
        "results": results,
    }
    (ARTIFACT_DIR / "matrix-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({key: summary[key] for key in ("checks", "passed", "failed")}), flush=True)
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
