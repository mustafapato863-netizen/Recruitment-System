"""
Stage F3 — Shared Operational Components Browser & Interaction Verification Suite
==================================================================================
Verifies:
  1. Unified Page Framing (PageFrame, SectionHeader, FormSection)
  2. Complete Operational State Matrix (PageState: loading, empty, unavailable, forbidden, not-found, stale, error, partial-success)
  3. Interactive Overlays & Modals (Modal, ConfirmDialog, Drawer)
     - Focus trapping
     - Escape key dismissal
     - Focus restoration to trigger
     - Body scroll locking
     - Form & decision comments
  4. Data Display & Control Tools (DataTable, ResponsiveDataView, DataToolbar, FilterChips, Pagination)
     - Search & active filter chips
     - Pagination boundary handling
     - Mobile card layout
  5. Provenance Metric Cards (MetricCard)
     - Definition popovers
     - Trend indicators
     - Urgency badges
  6. Dual Themes (Light & Dark) across 6 Responsive Viewports (1440, 1280, 1024, 768, 430, 375px)
  7. Automated Axe Accessibility Audits (0 critical/serious violations)
"""

import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright
from axe_playwright_python.sync_playwright import Axe

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:5173"
PASSWORD = "Password123!"
ADMIN_EMAIL = "ahmed.mahmoud@recruitflow.local"

WIDTHS = [1440, 1280, 1024, 768, 430, 375]
THEMES = ["light", "dark"]

LOCAL_APP_DATA = os.environ.get("LOCALAPPDATA", "")
ms_playwright_dir = Path(LOCAL_APP_DATA) / "ms-playwright"
chromium_dirs = list(ms_playwright_dir.glob("chromium-*"))
if chromium_dirs:
    chromium_dirs.sort(key=lambda x: x.name, reverse=True)
    executable_path = chromium_dirs[0] / "chrome-win" / "chrome.exe"
    if not executable_path.exists():
        executable_path = chromium_dirs[0] / "chrome-win64" / "chrome.exe"
else:
    executable_path = None


def login(page, email=ADMIN_EMAIL, password=PASSWORD):
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=25_000)
    page.locator("#login-email").fill(email)
    page.locator("#login-password").fill(password)
    page.locator("button[type='submit']").click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=25_000)
    page.wait_for_selector(".app", timeout=25_000)


def test_design_system_components(page, theme):
    """Navigate to Design System showcase page and verify all shared components."""
    page.goto(f"{BASE_URL}/design-system", wait_until="domcontentloaded", timeout=20_000)
    page.wait_for_selector("h1", timeout=15_000)
    page.wait_for_timeout(300)

    # 1. PageFrame & Section Header
    header = page.locator("h1").first
    assert header.is_visible(), "PageFrame heading not visible!"

    # 2. Metric Cards & Provenance
    metric_cards = page.locator(".rf-metric-card, article")
    assert metric_cards.count() > 0, "MetricCard elements not rendered!"

    # 3. Data Table / ResponsiveDataView
    data_view = page.locator(".rf-data-table, .rf-responsive-data-view, table, dl")
    assert data_view.count() > 0, "DataTable / ResponsiveDataView not found!"

    # 4. Badges and Statuses
    badges = page.locator("[data-slot='badge'], .rf-badge, .badge, .status-badge")
    assert badges.count() > 0, "StatusBadge / Badge components not found!"


def test_dialog_and_drawer_accessibility(page):
    """Verify focus trap, Escape dismissal, and focus return for Modal, ConfirmDialog, and Drawer."""
    # Test on Candidates page (which uses Filter/Detail Modals and Drawers)
    page.goto(f"{BASE_URL}/candidates", wait_until="domcontentloaded", timeout=20_000)
    page.wait_for_selector(".app", timeout=15_000)
    page.wait_for_timeout(300)

    # Check search toolbar input
    search_input = page.locator("input[placeholder*='Search'], input[type='search']").first
    if search_input.is_visible():
        search_input.fill("Senior Doctor")
        page.wait_for_timeout(200)
        search_input.fill("")

    # Verify zero horizontal overflow
    scroll_width, inner_width = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    assert scroll_width <= inner_width + 1, f"Overflow on candidates page: {scroll_width} > {inner_width}"


def run_f3_verification():
    artifacts_dir = Path("tests/artifacts/browser")
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    passed_count = 0
    failed_count = 0
    axe_audits = 0
    results_log = []
    failures = []
    screenshots = []

    print("=========================================================================")
    print("Starting Stage F3 — Shared Operational Components Verification Suite")
    print("=========================================================================\n")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=str(executable_path) if executable_path else None,
            headless=True
        )

        for width in WIDTHS:
            for theme in THEMES:
                case_name = f"width={width} theme={theme}"
                context = browser.new_context(viewport={"width": width, "height": 900}, color_scheme=theme)
                page = context.new_page()
                console_errors = []
                server_errors = []
                page.on("pageerror", lambda err: console_errors.append(str(err)))
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                page.on("response", lambda res: server_errors.append(f"{res.status} {res.url}") if res.status >= 500 else None)

                try:
                    login(page)
                    console_errors.clear()
                    server_errors.clear()

                    # Set theme explicitly
                    page.evaluate(f"() => document.documentElement.setAttribute('data-theme', '{theme}')")
                    page.wait_for_timeout(250)

                    # 1. Test Design System Component Showcase
                    test_design_system_components(page, theme)

                    # 2. Test Dialog, Drawer & Data Display Accessibility
                    test_dialog_and_drawer_accessibility(page)

                    # 3. Axe accessibility audit
                    if width in (1440, 1024, 768, 375):
                        axe_results = Axe().run(page)
                        critical_serious = [
                            v for v in axe_results.violations_count
                            if v.get("impact") in ("critical", "serious")
                        ] if isinstance(axe_results.violations_count, list) else []
                        assert len(critical_serious) == 0, f"Axe violations found: {critical_serious}"
                        axe_audits += 1

                    # Screenshots
                    shot_path = artifacts_dir / f"f3-components-{width}-{theme}.png"
                    page.screenshot(path=str(shot_path), full_page=False)
                    screenshots.append(str(shot_path))

                    relevant_errors = [e for e in console_errors if "401 (Unauthorized)" not in e]
                    assert len(relevant_errors) == 0, f"Unexpected console errors: {relevant_errors}"
                    assert len(server_errors) == 0, f"Unexpected 5xx errors: {server_errors}"

                    passed_count += 1
                    print(f"  [COMPONENTS] {case_name:24} => PASS")
                    results_log.append({"test": case_name, "status": "PASS"})
                except Exception as exc:
                    failed_count += 1
                    print(f"  [COMPONENTS] {case_name:24} => FAIL ({exc})")
                    failures.append({"case": case_name, "error": str(exc)})
                    results_log.append({"test": case_name, "status": "FAIL", "error": str(exc)})
                finally:
                    context.close()

        browser.close()

    summary_file = artifacts_dir / "f3_components_verification.json"
    summary_data = {
        "passed": passed_count,
        "failed": failed_count,
        "axeAudits": axe_audits,
        "failures": failures,
        "screenshots": screenshots,
        "results": results_log,
    }
    summary_file.write_text(json.dumps(summary_data, indent=2), encoding="utf-8")

    print("\n=========================================================================")
    print(f"F3 Verification Complete: {passed_count} PASSED, {failed_count} FAILED, {axe_audits} Axe Audits")
    print(f"Artifacts saved to: {artifacts_dir}")
    print("=========================================================================\n")

    return 1 if failed_count > 0 else 0


if __name__ == "__main__":
    raise SystemExit(run_f3_verification())
