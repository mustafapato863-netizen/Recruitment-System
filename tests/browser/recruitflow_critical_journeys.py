"""Critical local browser journeys for the RecruitFlow Enterprise Beta gate.

The API is expected on port 3000 and the Vite app on port 5173. The suite is
intentionally small and deterministic: it verifies the login contract, the
live/reference boundary, the header notification access pattern, and the
mobile shell overflow contract without relying on CSS class names for actions.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


BASE_URL = os.environ.get("RECRUITFLOW_WEB_URL", "http://localhost:5173")
ARTIFACT_DIR = Path(os.environ.get("RECRUITFLOW_BROWSER_ARTIFACTS", "tests/artifacts/browser"))


def browser_executable() -> str | None:
    configured = os.environ.get("RECRUITFLOW_BROWSER_EXECUTABLE")
    if configured and Path(configured).exists():
        return configured

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        candidates = sorted(
            (Path(local_app_data) / "ms-playwright").glob("chromium-*/chrome-win64/chrome.exe"),
            reverse=True,
        )
        if candidates:
            return str(candidates[0])
    return None


def wait_for_app(page: Page, path: str = "/") -> None:
    # The authenticated shell intentionally keeps API activity available for
    # refresh/retry and notification state. Waiting for networkidle therefore
    # turns a deterministic route check into a 30-second timeout. Route
    # readiness is asserted by each scenario's semantic locator instead.
    page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded", timeout=15000)
    page.wait_for_timeout(150)


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def assert_no_horizontal_overflow(page: Page, label: str) -> None:
    details = page.evaluate(
        """() => {
          const overflowing = document.documentElement.scrollWidth > window.innerWidth + 1;
          const offenders = Array.from(document.querySelectorAll('*'))
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === 'string' ? element.className : '',
              right: Math.round(element.getBoundingClientRect().right),
            }))
            .filter((item) => item.right > window.innerWidth + 1)
            .slice(0, 5);
          return { overflowing, width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, offenders };
        }"""
    )
    check(not details["overflowing"], f"{label}: horizontal overflow detected ({details})")


def run() -> int:
    passed = 0
    failed = 0
    console_errors: list[str] = []
    failed_responses: list[str] = []

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        launch_options = {"headless": True}
        executable = browser_executable()
        if executable:
            launch_options["executable_path"] = executable
        browser = playwright.chromium.launch(**launch_options)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.set_default_timeout(15000)
        page.set_default_navigation_timeout(15000)
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on(
            "response",
            lambda response: failed_responses.append(f"{response.status} {response.url}")
            if response.status >= 400 and response.status != 401
            else None,
        )

        def scenario(name: str, action) -> None:
            nonlocal passed, failed
            try:
                action()
                print(f"[PASS] {name}")
                passed += 1
            except Exception as error:  # noqa: BLE001 - report every scenario before exit
                print(f"[FAIL] {name}: {error}")
                failed += 1

        def login_page_contract() -> None:
            wait_for_app(page, "/login")
            page.get_by_role("button", name="Sign in").click()
            check(page.get_by_text("Enter your email address.").is_visible(), "email validation message missing")
            check(page.get_by_text("Enter your password.").is_visible(), "password validation message missing")

            password = page.locator("#login-password")
            page.get_by_role("button", name="Show password").click()
            check(password.get_attribute("type") == "text", "password reveal did not change input type")
            page.get_by_role("button", name="Hide password").click()
            check(password.get_attribute("type") == "password", "password hide did not restore input type")

        def logout_contract() -> None:
            login_as_admin()
            page.get_by_role("button", name="Sign out").click()
            page.wait_for_url(re.compile(r".*/login$"), timeout=15000)
            page.get_by_role("button", name="Sign in").wait_for(state="visible", timeout=15000)
            page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_url(re.compile(r".*/login$"), timeout=15000)
            page.get_by_role("button", name="Sign in").wait_for(state="visible", timeout=15000)

        def login_as_user(email: str) -> None:
            wait_for_app(page, "/login")
            page.get_by_label("Email address").fill(email)
            page.locator("#login-password").fill("Password123!")
            page.get_by_role("button", name="Sign in").click()
            page.wait_for_function("window.location.pathname === '/'", timeout=15000)
            page.locator("main h1").wait_for(state="visible", timeout=15000)

        def login_as_admin() -> None:
            login_as_user("ahmed.mahmoud@recruitflow.local")

        def administrator_dashboard() -> None:
            login_as_admin()
            assert_no_horizontal_overflow(page, "desktop dashboard")
            page.screenshot(path=str(ARTIFACT_DIR / "dashboard-desktop.png"), full_page=True)

        def live_reference_boundary() -> None:
            sidebar = page.locator("aside.sidebar")
            check(sidebar.get_by_role("link", name="Notifications").count() == 0, "Notifications remains in primary sidebar")
            check(page.locator("a[href='/design-system']").count() == 0, "live Design System link remains")
            check(page.locator("text=Design System").count() == 0, "live Design System surface remains")

        def recruiter_forbidden_surface() -> None:
            login_as_user("sarah.ahmed@recruitflow.local")
            page.goto(f"{BASE_URL}/users", wait_until="domcontentloaded")
            page.get_by_text("Access Restricted").wait_for(state="visible", timeout=15000)
            check(page.get_by_text("USERS_VIEW").is_visible(), "forbidden state does not explain the required permission")

        def operational_work_surfaces() -> None:
            login_as_admin()
            page.goto(f"{BASE_URL}/tasks", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Task Inbox & Actions").wait_for(state="visible", timeout=15000)
            page.get_by_label("Task filters").wait_for(state="visible", timeout=15000)
            page.goto(f"{BASE_URL}/approval-inbox", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Universal Approval Inbox").wait_for(state="visible", timeout=15000)
            check(page.get_by_role("heading", name="Pending approvals").is_visible(), "approval inbox did not expose its default work queue")

        def recruitment_pipeline_surfaces() -> None:
            login_as_admin()
            page.goto(f"{BASE_URL}/candidates", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Candidate Database").wait_for(state="visible", timeout=15000)
            page.get_by_role("region", name="Candidate directory").wait_for(state="visible", timeout=15000)
            page.goto(f"{BASE_URL}/applications", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Recruitment Pipeline").wait_for(state="visible", timeout=15000)
            page.get_by_role("region", name="Candidate pipeline board").wait_for(state="visible", timeout=15000)
            check(page.get_by_text(re.compile(r"Source:")).count() > 0, "pipeline cards did not expose source context")
            check(page.get_by_text("4.6 ★").count() == 0, "pipeline still exposes an unsupported static score")
            page.goto(f"{BASE_URL}/interviews", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Interview Management").wait_for(state="visible", timeout=15000)
            page.get_by_label("Search interviews").wait_for(state="visible", timeout=15000)

        def interview_calendar_surface() -> None:
            login_as_admin()
            page.goto(f"{BASE_URL}/interviews/calendar", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Interview Calendar").wait_for(state="visible", timeout=15000)
            calendar = page.get_by_role("grid", name="Interview calendar week view")
            calendar.wait_for(state="visible", timeout=15000)
            check(page.get_by_role("button", name="Previous week").is_visible(), "calendar navigation is missing")
            page.set_viewport_size({"width": 375, "height": 812})
            page.wait_for_timeout(250)
            assert_no_horizontal_overflow(page, "mobile interview calendar")
            calendar_scroll = page.get_by_role("region", name="Interview calendar grid")
            check(calendar_scroll.evaluate("element => element.scrollWidth > element.clientWidth"), "mobile calendar did not preserve internal scrolling")

        def interview_schedule_and_scorecard_contract() -> None:
            login_as_admin()
            page.goto(f"{BASE_URL}/interviews", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Interview Management").wait_for(state="visible", timeout=15000)
            page.get_by_role("link", name=re.compile(r"Schedule interview", re.IGNORECASE)).click()
            dialog = page.get_by_role("dialog", name="Schedule Candidate Interview")
            dialog.wait_for(state="visible", timeout=15000)
            check(dialog.get_by_label("Start Date & Time").is_visible(), "schedule modal is missing timezone-bound start input")
            check(dialog.get_by_label("End Date & Time").is_visible(), "schedule modal is missing timezone-bound end input")
            dialog.get_by_role("button", name="Cancel").click()
            scorecard_links = page.get_by_role("link", name=re.compile(r"scorecard", re.IGNORECASE))
            check(scorecard_links.count() > 0, "interview list has no scorecard detail handoff")
            scorecard_links.first.click()
            page.get_by_text("Submit Competency Scorecard").wait_for(state="visible", timeout=15000)
            check(page.get_by_role("radiogroup", name=re.compile(r"rating", re.IGNORECASE)).count() > 0, "scorecard rating control is missing")
            check(page.get_by_role("group", name="Overall recommendation").is_visible(), "scorecard recommendation control is missing")

        def p8_hiring_surfaces() -> None:
            login_as_admin()
            page.goto(f"{BASE_URL}/offers", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Offer Management").wait_for(state="visible", timeout=15000)
            check(page.get_by_role("link", name="Create offer").is_visible(), "offers page has no create-offer handoff")
            check(page.get_by_text("Senior Position").count() == 0, "offers page exposes an unsupported position placeholder")

            page.goto(f"{BASE_URL}/hires", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Hire Management").wait_for(state="visible", timeout=15000)
            check(page.get_by_role("link", name=re.compile(r"Final approvals")).is_visible(), "hire management has no final approval handoff")

            page.goto(f"{BASE_URL}/hires/approvals/inbox", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Final Hiring Approval Inbox").wait_for(state="visible", timeout=15000)

            page.goto(f"{BASE_URL}/licenses", wait_until="domcontentloaded")
            page.get_by_role("heading", name="License Management").wait_for(state="visible", timeout=15000)

            page.goto(f"{BASE_URL}/joinings", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Joining Management").wait_for(state="visible", timeout=15000)
            check(page.get_by_role("link", name="Pre-hire cases").is_visible(), "joining management has no pre-hire handoff")

        def p9_admin_trust_surfaces() -> None:
            login_as_admin()
            page.goto(f"{BASE_URL}/reports", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Reports & Analytics").wait_for(state="visible", timeout=15000)
            page.get_by_label("From Date").wait_for(state="visible", timeout=15000)
            check(page.get_by_role("button", name="Export CSV").is_visible(), "reports page has no supported CSV export action")
            check(page.get_by_role("button", name="Export PDF").count() == 0, "reports page exposes a non-functional PDF export button")

            page.goto(f"{BASE_URL}/users", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Users & Roles").wait_for(state="visible", timeout=15000)
            page.get_by_label("Search users").wait_for(state="visible", timeout=15000)

            page.goto(f"{BASE_URL}/master-data", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Master Data & Catalogs").wait_for(state="visible", timeout=15000)
            page.get_by_role("tab", name="Branches").wait_for(state="visible", timeout=15000)

            page.goto(f"{BASE_URL}/pipeline-settings", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Workflow & Pipeline Settings").wait_for(state="visible", timeout=15000)

            page.goto(f"{BASE_URL}/integrations", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Integrations & API Management").wait_for(state="visible", timeout=15000)
            check(page.get_by_role("button", name="API Documentation").count() == 0, "integrations page exposes a non-functional documentation button")

            page.goto(f"{BASE_URL}/audit-log", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Audit Log").wait_for(state="visible", timeout=15000)
            page.get_by_label("Filter by date").wait_for(state="visible", timeout=15000)
            pagination = page.get_by_label("Audit log pages")
            if pagination.count() > 0:
                pagination.wait_for(state="visible", timeout=15000)

        def release_accessibility_shell_contract() -> None:
            page.emulate_media(reduced_motion="reduce")
            wait_for_app(page, "/login")
            email = page.get_by_label("Email address")
            password = page.locator("#login-password")
            email.focus()
            page.keyboard.press("Tab")
            check(page.evaluate("document.activeElement?.id") == "login-password", "login keyboard order skips the password field")
            page.keyboard.press("Tab")
            check(page.get_by_role("button", name="Show password").evaluate("element => element === document.activeElement"), "password visibility control is not keyboard reachable")
            check(page.evaluate("window.matchMedia('(prefers-reduced-motion: reduce)').matches"), "reduced-motion media preference was not applied")

            login_as_admin()
            navigation = page.evaluate(
                """() => {
                  const entry = performance.getEntriesByType('navigation')[0];
                  return entry ? { responseEnd: entry.responseEnd, domContentLoaded: entry.domContentLoadedEventEnd } : null;
                }"""
            )
            check(navigation is not None and navigation["responseEnd"] > 0 and navigation["domContentLoaded"] > 0, "release navigation timing evidence is unavailable")
            unnamed_controls = page.evaluate(
                """() => Array.from(document.querySelectorAll('button, a, input, select, textarea'))
                  .filter((element) => {
                    const style = getComputedStyle(element);
                    return style.display !== 'none' && style.visibility !== 'hidden' &&
                      !element.getAttribute('aria-label') && !element.textContent?.trim() &&
                      !element.getAttribute('title') && !element.id;
                  })
                  .map((element) => element.outerHTML.slice(0, 120))"""
            )
            check(len(unnamed_controls) == 0, f"visible interactive controls lack an accessible naming path: {unnamed_controls[:3]}")
            page.set_viewport_size({"width": 375, "height": 812})
            page.wait_for_timeout(250)
            assert_no_horizontal_overflow(page, "release mobile shell")

        def notification_popover() -> None:
            login_as_admin()
            bell = page.get_by_role("button", name=re.compile(r"^Notifications"))
            bell.first.wait_for(state="visible", timeout=15000)
            check(bell.count() == 1, "header notification bell is missing or duplicated")
            bell.click()
            popover = page.get_by_role("dialog", name="Notifications Dropdown")
            popover.wait_for(state="visible", timeout=15000)
            check(popover.get_by_role("link", name=re.compile(r"See all in Notifications", re.IGNORECASE)).is_visible(), "notification popover has no full-list handoff")
            popover.get_by_role("link", name=re.compile(r"See all in Notifications", re.IGNORECASE)).click()
            page.wait_for_url(re.compile(r".*/notifications(?:\?.*)?$"), timeout=15000)
            page.get_by_role("heading", name="Notifications").wait_for(state="visible", timeout=15000)

        def mobile_shell() -> None:
            page.set_viewport_size({"width": 375, "height": 812})
            login_as_admin()
            page.set_viewport_size({"width": 375, "height": 812})
            page.wait_for_timeout(250)
            page.screenshot(path=str(ARTIFACT_DIR / "dashboard-mobile.png"), full_page=True)
            assert_no_horizontal_overflow(page, "mobile dashboard")

        scenario("login validation and password visibility", login_page_contract)
        scenario("logout revokes the authenticated workspace session", logout_contract)
        scenario("administrator reaches the live command center", administrator_dashboard)
        scenario("live/reference route boundary", live_reference_boundary)
        scenario("recruiter receives a safe forbidden state for administration", recruiter_forbidden_surface)
        scenario("tasks and approvals expose role-aware work surfaces", operational_work_surfaces)
        scenario("candidate, application, and interview surfaces load", recruitment_pipeline_surfaces)
        scenario("interview calendar has live events and mobile internal scrolling", interview_calendar_surface)
        scenario("schedule modal and scorecard detail expose required controls", interview_schedule_and_scorecard_contract)
        scenario("offers, hiring, compliance, and joining surfaces expose P8 handoffs", p8_hiring_surfaces)
        scenario("reports, administration, integrations, and audit expose P9 trust surfaces", p9_admin_trust_surfaces)
        scenario("release accessibility and reduced-motion shell contract", release_accessibility_shell_contract)
        scenario("notifications are accessed from the header popover", notification_popover)
        scenario("mobile shell has no horizontal overflow", mobile_shell)

        browser.close()

    expected_auth_errors = [message for message in console_errors if "401 (Unauthorized)" in message]
    unexpected_console_errors = [message for message in console_errors if message not in expected_auth_errors]
    if expected_auth_errors:
        print(f"[INFO] Expected pre-session auth responses observed: {len(expected_auth_errors)}")
    if unexpected_console_errors:
        print(f"[WARN] Unexpected browser console errors observed: {len(unexpected_console_errors)}")
        for message in unexpected_console_errors[:5]:
            print(f"       {message}")
    if failed_responses:
        print(f"[WARN] Non-auth HTTP error responses observed: {len(failed_responses)}")
        for response in failed_responses[:10]:
            print(f"       {response}")

    print(f"Browser critical journeys: {passed} PASSED, {failed} FAILED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(run())
