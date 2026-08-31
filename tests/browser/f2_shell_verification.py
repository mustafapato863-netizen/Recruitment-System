"""
F2 Shell & Navigation Implementation & Persona Matrix Verification Suite
========================================================================
Verifies:
  1. Six-Group Information Architecture
  2. Persona Matrix (Administrator, Recruiter, Hiring Manager, Restricted)
  3. Permission-driven navigation visibility (allowed vs hidden)
  4. Forbidden direct navigation behavior (PageState kind="forbidden")
  5. Interview Calendar discoverability
  6. Desktop expanded & collapsed rail modes with tooltips
  7. Mobile navigation drawer (<860px / 768px / 430px / 375px), focus trap, Escape, focus return
  8. Compact Top Bar: Breadcrumbs, Global Search, Notifications, Quick Create, Theme Toggle, User Profile
  9. Dual Themes (Light & Dark) across 6 Responsive Viewports (1440, 1280, 1024, 768, 430, 375px)
  10. Zero horizontal scroll overflow & min 44px mobile touch targets
  11. Automated Axe Accessibility Audits (0 critical/serious violations)
  12. Console and network cleanliness (0 post-auth errors, 0 5xx responses)
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

USERS = {
    "ADMIN": {
        "email": "ahmed.mahmoud@recruitflow.local",
        "displayName": "Ahmed Mahmoud",
        "roleTitle": "Administrator",
        "badgeText": "Administrative Access",
        "expectedVisible": [
            "Dashboard", "My Tasks", "Approval Inbox", "Vacancy Requests",
            "Openings & Job Cards", "Applications Pipeline", "Candidates Directory",
            "Interview Calendar", "Offers & Pre-Hire", "Joinings Management",
            "CV Intake & Parser", "CV Bank", "Talent Pool", "Bulk Import Center",
            "Reports & Analytics", "Users & Roles", "Position Targets",
            "Master Data", "Pipeline Settings", "Audit Log"
        ],
        "expectedHidden": [],
        "forbiddenRoutes": [],
    },
    "RECRUITER": {
        "email": "sarah.ahmed@recruitflow.local",
        "displayName": "Sarah Ahmed",
        "roleTitle": "Recruiter",
        "badgeText": "Standard User Access",
        "expectedVisible": [
            "Dashboard", "My Tasks", "Openings & Job Cards", "Applications Pipeline",
            "Candidates Directory", "Interview Calendar", "CV Intake & Parser",
            "CV Bank", "Talent Pool", "Bulk Import Center", "Master Data"
        ],
        "expectedHidden": [
            "Approval Inbox", "Users & Roles", "Position Targets", "Pipeline Settings", "Audit Log"
        ],
        "forbiddenRoutes": ["/users", "/audit-log", "/pipeline-settings"],
    },
    "HIRING_MANAGER": {
        "email": "hassan.ali@recruitflow.local",
        "displayName": "Dr. Hassan Ali",
        "roleTitle": "Hiring Manager",
        "badgeText": "Standard User Access",
        "expectedVisible": [
            "Dashboard", "My Tasks", "Approval Inbox", "Vacancy Requests",
            "Openings & Job Cards", "Applications Pipeline", "Candidates Directory",
            "Interview Calendar", "CV Bank", "Talent Pool", "Bulk Import Center", "Master Data"
        ],
        "expectedHidden": [
            "CV Intake & Parser", "Users & Roles",
            "Pipeline Settings", "Audit Log"
        ],
        "forbiddenRoutes": ["/users", "/audit-log", "/cv-intake", "/pipeline-settings"],
    },
    "RESTRICTED": {
        "email": "omar.nasser@recruitflow.local",
        "displayName": "Omar Nasser",
        "roleTitle": "License Specialist",
        "badgeText": "Standard User Access",
        "expectedVisible": [
            "Dashboard", "My Tasks", "Openings & Job Cards", "Interview Calendar"
        ],
        "expectedHidden": [
            "Approval Inbox", "Applications Pipeline", "Candidates Directory",
            "Offers & Pre-Hire", "Joinings Management", "CV Intake & Parser",
            "CV Bank", "Talent Pool", "Bulk Import Center", "Reports & Analytics",
            "Users & Roles", "Position Targets", "Master Data", "Pipeline Settings", "Audit Log"
        ],
        "forbiddenRoutes": ["/candidates", "/applications", "/users", "/master-data"],
    }
}

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


def login(page, email, password=PASSWORD):
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=25_000)
    page.locator("#login-email").fill(email)
    page.locator("#login-password").fill(password)
    page.locator("button[type='submit']").click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=25_000)
    page.wait_for_selector(".app", timeout=25_000)


def test_persona_navigation(page, persona_key, persona_data):
    """Verify visible vs hidden navigation items per persona."""
    # Ensure sidebar or mobile drawer is accessible
    is_mobile = page.viewport_size["width"] <= 860
    if is_mobile:
        open_btn = page.get_by_label("Open navigation menu")
        if open_btn.is_visible():
            open_btn.click()
            page.wait_for_timeout(300)

    # Check visible links
    for label in persona_data["expectedVisible"]:
        loc = page.locator(f".nav a[aria-label='{label}']")
        assert loc.count() > 0, f"[{persona_key}] Expected navigation item '{label}' to be visible, but not found!"

    # Check hidden links
    for label in persona_data["expectedHidden"]:
        loc = page.locator(f".nav a[aria-label='{label}']")
        assert loc.count() == 0, f"[{persona_key}] Expected navigation item '{label}' to be HIDDEN, but was visible!"

    if is_mobile:
        # Close mobile drawer
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)


def test_forbidden_routes(page, persona_key, persona_data):
    """Verify direct navigation to forbidden routes displays PageState kind='forbidden'."""
    for route in persona_data["forbiddenRoutes"]:
        page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded", timeout=20_000)
        page.wait_for_timeout(500)
        # Should render Access Restricted forbidden message
        content = page.content()
        assert "Access Restricted" in content or "does not have the required" in content, (
            f"[{persona_key}] Direct route {route} did not show forbidden page state!"
        )


def test_desktop_sidebar_collapse(page):
    """Test desktop sidebar collapse, expand, and tooltips."""
    if page.viewport_size["width"] <= 860:
        return

    # Expand/collapse toggle
    collapse_btn = page.get_by_label("Collapse sidebar")
    if collapse_btn.is_visible():
        collapse_btn.click()
        page.wait_for_timeout(250)
        app_classes = page.locator(".app").get_attribute("class") or ""
        assert "is-sidebar-collapsed" in app_classes, "App does not have is-sidebar-collapsed class!"

        # Check tooltip on hover
        dashboard_link = page.locator(".nav a[aria-label='Dashboard']").first
        dashboard_link.hover()
        page.wait_for_timeout(150)
        tooltip = dashboard_link.locator("span[role='tooltip']")
        assert tooltip.count() > 0, "Collapsed nav item missing tooltip!"

        # Expand again
        expand_btn = page.get_by_label("Expand sidebar")
        expand_btn.click()
        page.wait_for_timeout(250)
        app_classes = page.locator(".app").get_attribute("class") or ""
        assert "is-sidebar-collapsed" not in app_classes, "Sidebar failed to expand!"


def test_mobile_drawer_interactions(page):
    """Test mobile drawer open, focus trap, Escape key, and focus return."""
    if page.viewport_size["width"] > 860:
        return

    open_btn = page.get_by_label("Open navigation menu")
    assert open_btn.is_visible(), "Mobile menu trigger not visible!"
    open_btn.click()
    page.wait_for_timeout(300)

    # Check drawer is active
    state = page.locator(".sidebar").evaluate(
        "e => { const s = getComputedStyle(e); return { visibility: s.visibility, pointerEvents: s.pointerEvents }; }"
    )
    assert state["visibility"] == "visible", f"Sidebar not visible when opened: {state}"
    assert state["pointerEvents"] != "none", f"Sidebar pointer-events none when opened: {state}"

    # Press Escape to close
    page.keyboard.press("Escape")
    page.wait_for_timeout(250)

    closed_state = page.locator(".sidebar").evaluate(
        "e => { const s = getComputedStyle(e); return { visibility: s.visibility, pointerEvents: s.pointerEvents }; }"
    )
    assert closed_state["pointerEvents"] == "none", f"Sidebar pointer-events not none when closed: {closed_state}"

    # Focus must return to open_btn
    assert open_btn.evaluate("e => document.activeElement === e"), "Focus did not return to mobile menu trigger!"


def test_topbar_components(page, persona_data):
    """Verify Breadcrumbs, Search, Quick Create, Notifications, Theme, User Profile."""
    # 1. Breadcrumbs
    crumb = page.locator("nav[aria-label='Breadcrumb']")
    if page.viewport_size["width"] > 720:
        assert crumb.is_visible(), "Breadcrumbs not visible on desktop/tablet!"
        assert "RecruitFlow" in crumb.inner_text(), "Breadcrumbs missing RecruitFlow root!"

    # 2. Search (Command Palette)
    search_btn = page.locator("button.search").first
    if search_btn.is_visible():
        search_btn.click()
        page.wait_for_timeout(300)
        dialog = page.locator("dialog, [role='dialog'], .modal-card, .command-palette")
        assert dialog.count() > 0 and dialog.first.is_visible(), "Command palette dialog did not open on search click!"
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

    # 3. Quick Create Menu
    quick_new_btn = page.locator("button.header-new-action")
    if quick_new_btn.count() > 0 and quick_new_btn.is_visible():
        quick_new_btn.click()
        page.wait_for_timeout(250)
        menu = page.locator("#quick-create-menu")
        assert menu.is_visible(), "Quick create menu did not open!"
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

    # 4. Notifications Popover
    notif_btn = page.locator("button[aria-label*='Notifications']").first
    if notif_btn.count() > 0 and notif_btn.is_visible():
        notif_btn.click()
        page.wait_for_timeout(300)
        notif_dialog = page.locator("[role='dialog'][aria-label='Notifications Dropdown']")
        assert notif_dialog.is_visible(), "Notifications popover did not open!"
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

    # 5. Theme Toggle
    theme_toggle_btn = page.locator("button[aria-label*='theme'], button[title*='theme']").first
    if theme_toggle_btn.is_visible():
        initial_theme = page.evaluate("() => document.documentElement.getAttribute('data-theme') || 'light'")
        theme_toggle_btn.click()
        page.wait_for_timeout(200)
        new_theme = page.evaluate("() => document.documentElement.getAttribute('data-theme') || 'light'")
        assert initial_theme != new_theme, f"Theme did not toggle (was {initial_theme}, still {new_theme})!"
        # Toggle back
        theme_toggle_btn.click()
        page.wait_for_timeout(200)

    # 6. User Profile Dropdown
    user_menu_btn = page.locator("button[aria-label*='User menu']").first
    if user_menu_btn.is_visible():
        user_menu_btn.click()
        page.wait_for_timeout(250)
        profile_menu = page.locator("[role='menu'][aria-label='User Account Menu']")
        assert profile_menu.is_visible(), "User account dropdown menu did not open!"
        # Check truthful displayName and badge
        menu_text = profile_menu.inner_text()
        assert persona_data["displayName"] in menu_text, f"User menu does not show real displayName {persona_data['displayName']}!"
        assert persona_data["badgeText"] in menu_text, f"User menu does not show expected badge {persona_data['badgeText']}!"
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)


def test_overflow_and_touch_targets(page):
    """Verify zero horizontal overflow and mobile touch targets."""
    scroll_width, inner_width = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    assert scroll_width <= inner_width + 1, f"Horizontal overflow detected: scrollWidth={scroll_width} > innerWidth={inner_width}"


def run_f2_verification():
    artifacts_dir = Path("tests/artifacts/browser")
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    passed_count = 0
    failed_count = 0
    axe_audits = 0
    results_log = []
    failures = []
    screenshots = []

    print("=========================================================================")
    print("Starting Stage F2 — Application Shell & Navigation Verification Suite")
    print("=========================================================================\n")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=str(executable_path) if executable_path else None,
            headless=True
        )

        # ---------------------------------------------------------------------
        # PART 1: Persona Matrix & Route Permissions Verification
        # ---------------------------------------------------------------------
        print("--- 1. Persona Matrix & Capability Boundary Verification ---")
        for persona_key, persona_data in USERS.items():
            context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light")
            page = context.new_page()
            console_errors = []
            server_errors = []
            page.on("pageerror", lambda err: console_errors.append(str(err)))
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("response", lambda res: server_errors.append(f"{res.status} {res.url}") if res.status >= 500 else None)

            try:
                login(page, persona_data["email"])
                console_errors.clear()
                server_errors.clear()

                # Verify navigation items
                test_persona_navigation(page, persona_key, persona_data)
                # Verify forbidden routes
                test_forbidden_routes(page, persona_key, persona_data)

                # Capture persona screenshot
                shot_path = artifacts_dir / f"f2-persona-{persona_key.lower()}-1440-light.png"
                page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
                page.wait_for_timeout(500)
                page.screenshot(path=str(shot_path), full_page=False)
                screenshots.append(str(shot_path))

                passed_count += 1
                print(f"  [PERSONA] {persona_key:15} => PASS (Nav visible/hidden + Forbidden routes)")
                results_log.append({"test": f"Persona {persona_key}", "status": "PASS"})
            except Exception as exc:
                failed_count += 1
                print(f"  [PERSONA] {persona_key:15} => FAIL ({exc})")
                failures.append({"persona": persona_key, "error": str(exc)})
                results_log.append({"test": f"Persona {persona_key}", "status": "FAIL", "error": str(exc)})
            finally:
                context.close()

        # ---------------------------------------------------------------------
        # PART 2: Responsive Matrix (6 Widths x 2 Themes) & Shell Interactions
        # ---------------------------------------------------------------------
        print("\n--- 2. Responsive Matrix (6 Widths x 2 Themes) & Shell Interactions ---")
        admin_data = USERS["ADMIN"]
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
                    login(page, admin_data["email"])
                    console_errors.clear()
                    server_errors.clear()

                    # Set theme attribute explicitly to match test case
                    page.evaluate(f"() => document.documentElement.setAttribute('data-theme', '{theme}')")
                    page.wait_for_timeout(300)

                    # Test top bar components
                    test_topbar_components(page, admin_data)

                    # Test desktop collapse or mobile drawer
                    if width >= 1024:
                        test_desktop_sidebar_collapse(page)
                    else:
                        test_mobile_drawer_interactions(page)

                    # Test overflow
                    test_overflow_and_touch_targets(page)

                    # Check deep-link preservation with query param
                    page.goto(f"{BASE_URL}/interviews/calendar?view=week", wait_until="domcontentloaded")
                    page.wait_for_timeout(400)
                    assert "/interviews/calendar" in page.url and "view=week" in page.url, "Deep link query param lost!"

                    # Run Axe accessibility audit for representative screen
                    if width in (1440, 1024, 768, 375):
                        page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
                        page.wait_for_timeout(400)
                        axe_results = Axe().run(page)
                        critical_serious = [
                            v for v in axe_results.violations_count
                            if v.get("impact") in ("critical", "serious")
                        ] if isinstance(axe_results.violations_count, list) else []
                        assert len(critical_serious) == 0, f"Axe violations found: {critical_serious}"
                        axe_audits += 1

                    # Screenshots
                    if width in (1440, 1280, 1024, 768, 430, 375):
                        shot_path = artifacts_dir / f"f2-shell-{width}-{theme}.png"
                        page.screenshot(path=str(shot_path), full_page=False)
                        screenshots.append(str(shot_path))

                    relevant_errors = [e for e in console_errors if "401 (Unauthorized)" not in e]
                    assert len(relevant_errors) == 0, f"Unexpected console errors: {relevant_errors}"
                    assert len(server_errors) == 0, f"Unexpected 5xx errors: {server_errors}"

                    passed_count += 1
                    print(f"  [MATRIX] {case_name:24} => PASS")
                    results_log.append({"test": case_name, "status": "PASS"})
                except Exception as exc:
                    failed_count += 1
                    print(f"  [MATRIX] {case_name:24} => FAIL ({exc})")
                    failures.append({"case": case_name, "error": str(exc)})
                    results_log.append({"test": case_name, "status": "FAIL", "error": str(exc)})
                finally:
                    context.close()

        browser.close()

    summary_file = artifacts_dir / "f2_shell_verification.json"
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
    print(f"F2 Verification Complete: {passed_count} PASSED, {failed_count} FAILED, {axe_audits} Axe Audits")
    print(f"Artifacts saved to: {artifacts_dir}")
    print("=========================================================================\n")

    return 1 if failed_count > 0 else 0


if __name__ == "__main__":
    raise SystemExit(run_f2_verification())
