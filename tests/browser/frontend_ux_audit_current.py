"""Current RecruitFlow UI/UX audit: typography, shell geometry, recruiter path, and browser health."""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = "http://127.0.0.1:5173"
PASSWORD = "Password123!"
RECRUITER_EMAIL = "sarah.ahmed@recruitflow.local"
WIDTHS = [1440, 1280, 1024, 768, 430, 375]
THEMES = ["light", "dark"]
ROUTES = ["/", "/vacancies", "/applications", "/candidates", "/interviews", "/offers", "/reports", "/settings"]
ARTIFACT_DIR = Path("tests/artifacts/browser/frontend-ux-audit")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def record_error(errors: list[dict[str, str]], kind: str, value: str) -> None:
    if not value:
        return
    errors.append({"kind": kind, "value": value})


def login(page: Page) -> None:
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30_000)
    page.locator("#login-email").fill(RECRUITER_EMAIL)
    page.locator("#login-password").fill(PASSWORD)
    page.locator("button[type='submit']").click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=30_000)
    page.wait_for_selector(".app", timeout=30_000)
    page.wait_for_timeout(500)


def set_theme(page: Page, theme: str) -> None:
    current_theme = page.evaluate("() => document.documentElement.dataset.theme")
    if current_theme != theme:
        toggle = page.locator("header .theme-toggle").first
        toggle.click()
        page.wait_for_timeout(200)
    settled_theme = page.evaluate("() => document.documentElement.dataset.theme")
    if settled_theme != theme:
        raise AssertionError(f"Theme did not settle in {theme} mode; found {settled_theme}")


def first_visible_text(page: Page, selectors: list[str]) -> str:
    for selector in selectors:
        locator = page.locator(selector).filter(has_text=re.compile(r"\S")).first
        if locator.count() and locator.is_visible():
            return locator.inner_text().strip()[:160]
    return ""


def collect_shell_metrics(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        () => {
          const rect = (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return {
              selector,
              x: Math.round(r.x * 10) / 10,
              y: Math.round(r.y * 10) / 10,
              width: Math.round(r.width * 10) / 10,
              height: Math.round(r.height * 10) / 10,
              fontSize: s.fontSize,
              lineHeight: s.lineHeight,
              display: s.display,
              visibility: s.visibility,
              overflowX: s.overflowX,
            };
          };
          const textMetrics = (selector) => [...document.querySelectorAll(selector)]
            .filter(el => (el.textContent || '').trim())
            .map(el => {
              const r = el.getBoundingClientRect();
              const s = getComputedStyle(el);
              return {
                selector,
                text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
                fontSize: s.fontSize,
                lineHeight: s.lineHeight,
                width: Math.round(r.width * 10) / 10,
                height: Math.round(r.height * 10) / 10,
                x: Math.round(r.x * 10) / 10,
                y: Math.round(r.y * 10) / 10,
                minHeight: s.minHeight,
              };
            });
          const nav = [...document.querySelectorAll('.nav a')].map(el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return {
              label: el.getAttribute('aria-label') || el.textContent?.trim(),
              x: Math.round(r.x * 10) / 10,
              y: Math.round(r.y * 10) / 10,
              width: Math.round(r.width * 10) / 10,
              height: Math.round(r.height * 10) / 10,
              fontSize: s.fontSize,
              padding: s.padding,
            };
          });
          return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
            body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
            theme: document.documentElement.dataset.theme || (document.body.classList.contains('dark') ? 'dark' : 'light'),
            shell: [
              rect('.sidebar'), rect('.header'), rect('.main'), rect('.page'), rect('.search'),
            ].filter(Boolean),
            nav,
            text: [
              ...textMetrics('.nav a'),
              ...textMetrics('.nav .group'),
              ...textMetrics('.header button'),
              ...textMetrics('.search'),
              ...textMetrics('.page h1'),
              ...textMetrics('.page h2, .page h3'),
              ...textMetrics('.page label'),
              ...textMetrics('.page button'),
              ...textMetrics('.page a'),
            ],
          };
        }
        """
    )


def run() -> int:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {
        "baseUrl": BASE_URL,
        "user": "recruiter",
        "widths": WIDTHS,
        "themes": THEMES,
        "shell": [],
        "routes": [],
        "recruiterJourney": {},
        "errors": [],
    }

    with sync_playwright() as playwright:
        executable_path = None
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        if local_app_data:
            chromium_dirs = sorted(Path(local_app_data, "ms-playwright").glob("chromium-*"), reverse=True)
            if chromium_dirs:
                for candidate in (chromium_dirs[0] / "chrome-win" / "chrome.exe", chromium_dirs[0] / "chrome-win64" / "chrome.exe"):
                    if candidate.exists():
                        executable_path = str(candidate)
                        break
        browser = playwright.chromium.launch(headless=True, executable_path=executable_path)
        try:
            # Shell matrix: all requested widths and both themes.
            for width in WIDTHS:
                for theme in THEMES:
                    context = browser.new_context(viewport={"width": width, "height": 900}, device_scale_factor=1)
                    context.add_init_script(
                        script=f"window.localStorage.setItem('recruitflow.theme', '{theme}');"
                    )
                    page = context.new_page()
                    page_errors: list[dict[str, str]] = []
                    page.on("console", lambda message, errors=page_errors: record_error(errors, f"console:{message.type}", message.text) if message.type in {"error", "warning"} else None)
                    page.on("pageerror", lambda error, errors=page_errors: record_error(errors, "pageerror", str(error)))
                    page.on("response", lambda response, errors=page_errors: record_error(errors, f"http:{response.status}", response.url) if response.status >= 400 and "/api/" in response.url else None)
                    try:
                        login(page)
                        set_theme(page, theme)
                        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30_000)
                        page.wait_for_selector(".app", timeout=15_000)
                        page.wait_for_timeout(600)
                        metrics = collect_shell_metrics(page)
                        metrics["requestedTheme"] = theme
                        metrics["errors"] = page_errors
                        metrics["title"] = first_visible_text(page, [".page h1", "main h1", "h1"])
                        screenshot = ARTIFACT_DIR / f"shell-{width}-{theme}.png"
                        page.screenshot(path=str(screenshot), full_page=True)
                        report["shell"].append(metrics)
                        report["errors"].extend({"viewport": f"{width}/{theme}", **error} for error in page_errors)
                    except Exception as error:
                        report["shell"].append({"requestedWidth": width, "requestedTheme": theme, "failure": str(error), "errors": page_errors})
                    finally:
                        context.close()

            # Route matrix at desktop, including visible route/runtime failures.
            context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
            page = context.new_page()
            route_errors: list[dict[str, str]] = []
            page.on("console", lambda message: record_error(route_errors, f"console:{message.type}", message.text) if message.type in {"error", "warning"} else None)
            page.on("pageerror", lambda error: record_error(route_errors, "pageerror", str(error)))
            page.on("response", lambda response: record_error(route_errors, f"http:{response.status}", response.url) if response.status >= 400 and "/api/" in response.url else None)
            login(page)
            for route in ROUTES:
                before = len(route_errors)
                try:
                    page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded", timeout=30_000)
                    page.wait_for_selector(".app", timeout=15_000)
                    page.wait_for_timeout(700)
                    body_text = page.locator("body").inner_text()[:5000]
                    report["routes"].append({
                        "route": route,
                        "url": page.url,
                        "title": first_visible_text(page, [".page h1", "main h1", "h1"]),
                        "hasNotFound": bool(re.search(r"Page Not Found|404", body_text, re.I)),
                        "hasErrorState": bool(re.search(r"Unable to load|Something went wrong|Unexpected error", body_text, re.I)),
                        "newErrors": route_errors[before:],
                    })
                except Exception as error:
                    report["routes"].append({"route": route, "url": page.url, "failure": str(error), "newErrors": route_errors[before:]})
                    if "/login" in page.url:
                        login(page)
            context.close()

            # Focused recruiter journey: Home -> Jobs -> Applicants -> Candidate/next action.
            context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
            page = context.new_page()
            journey_errors: list[dict[str, str]] = []
            page.on("console", lambda message: record_error(journey_errors, f"console:{message.type}", message.text) if message.type in {"error", "warning"} else None)
            page.on("pageerror", lambda error: record_error(journey_errors, "pageerror", str(error)))
            page.on("response", lambda response: record_error(journey_errors, f"http:{response.status}", response.url) if response.status >= 400 and "/api/" in response.url else None)
            login(page)
            journey: dict[str, Any] = {"steps": [], "errors": journey_errors}
            journey["steps"].append({"name": "Home", "url": page.url, "title": first_visible_text(page, [".page h1", "main h1", "h1"])})
            page.get_by_role("link", name="Jobs").click()
            page.wait_for_url(re.compile(r"/vacancies$"), timeout=15_000)
            page.wait_for_timeout(700)
            journey["steps"].append({"name": "Jobs", "url": page.url, "title": first_visible_text(page, [".page h1", "main h1", "h1"])})
            pipeline = page.get_by_role("button", name=re.compile(r"Review applicants", re.I)).first
            if pipeline.count() and pipeline.is_visible():
                pipeline.click()
            else:
                fallback = page.get_by_role("button", name=re.compile(r"Open job", re.I)).first
                if fallback.count() and fallback.is_visible():
                    fallback.click()
            page.wait_for_url(re.compile(r"/applications"), timeout=15_000)
            page.wait_for_timeout(800)
            journey["steps"].append({"name": "Applicants pipeline", "url": page.url, "title": first_visible_text(page, [".page h1", "main h1", "h1"])})
            candidate_action = page.get_by_role("button", name=re.compile(r"Candidate|View|Review|Open", re.I)).first
            journey["candidateActionVisible"] = bool(candidate_action.count() and candidate_action.is_visible())
            journey["applicantText"] = page.locator("body").inner_text()[:1500]
            journey["stepsCount"] = len(journey["steps"])
            journey["errors"] = journey_errors
            report["recruiterJourney"] = journey
            page.screenshot(path=str(ARTIFACT_DIR / "recruiter-journey-applicants.png"), full_page=True)
            context.close()
        finally:
            browser.close()

    output = ARTIFACT_DIR / "frontend-ux-audit.json"
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"UI/UX audit artifact written: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
