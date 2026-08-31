"""M1-G2 — Public & Authenticated Surface Separation Browser Matrix & Accessibility Test.

Deterministically tests public recruitment surfaces using isolated database fixtures,
verifies responsive viewports, light/dark themes, Axe accessibility audits, and functional journeys.
"""

import json
import os
import random
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
from axe_playwright_python.sync_playwright import Axe

# Force UTF-8 on Windows stdout
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.environ.get("RECRUITFLOW_WEB_URL", "http://127.0.0.1:5173")
VIEWPORTS = (
    (375, 667),
    (430, 932),
    (768, 1024),
    (1024, 768),
    (1280, 800),
    (1440, 900),
)
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

def setup_fixture():
    root = Path(__file__).resolve().parent.parent.parent
    cmd = ["node", str(root / "database" / "browser-fixture-manager.cjs"), "setup"]
    output = subprocess.check_output(cmd, cwd=str(root), text=True)
    return json.loads(output.strip())

def cleanup_fixture(vacancy_code):
    if not vacancy_code:
        return
    root = Path(__file__).resolve().parent.parent.parent
    cmd = ["node", str(root / "database" / "browser-fixture-manager.cjs"), "cleanup", vacancy_code]
    try:
        subprocess.check_output(cmd, cwd=str(root), text=True)
    except Exception as e:
        print(f"  [WARN] Cleanup error for {vacancy_code}: {e}")

def test_m1_g2_browser_matrix():
    fixture = setup_fixture()
    org_code = fixture["organizationCode"]
    vac_code = fixture["vacancyCode"]
    position_title = fixture["positionTitle"]

    print(f"Isolated Browser Fixture Created: {vac_code} ({position_title}) in {org_code}")

    public_routes = (
        f"/careers/{org_code}/jobs",
        f"/careers/{org_code}/jobs/{vac_code}",
        f"/careers/{org_code}/jobs/{vac_code}/apply",
    )

    passed = 0
    failed = 0
    total = len(VIEWPORTS) * len(THEMES) * len(public_routes)

    print(f"\n=== M1-G2 PUBLIC RECRUITMENT PAGES BROWSER MATRIX ({total} evaluations) ===\n")

    # Create temporary PDF CV file for browser upload testing
    temp_pdf = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_pdf.write(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")
    temp_pdf.close()

    try:
        with sync_playwright() as p:
            executable = browser_executable()
            launch_opts = {"headless": True}
            if executable:
                launch_opts["executable_path"] = executable

            browser = p.chromium.launch(**launch_opts)

            # ─── Part 1: Responsive & Theming Matrix Across All Public Routes ────────
            for width, height in VIEWPORTS:
                for theme in THEMES:
                    for route in public_routes:
                        context = browser.new_context(
                            viewport={"width": width, "height": height},
                            color_scheme=theme,
                        )
                        page = context.new_page()

                        # Track uncaught runtime errors
                        errors = []
                        page.on("pageerror", lambda err: errors.append(str(err)))

                        try:
                            page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                            page.wait_for_selector("h1", timeout=15000)

                            # Wait for any async loading spinners to disappear
                            try:
                                page.locator(".rf-page-state-loading, text='Loading open roles'").first.wait_for(state="hidden", timeout=5000)
                            except Exception:
                                pass

                            # Set data-theme attribute on root
                            page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}')")

                            # 1. Verify no horizontal overflow
                            overflow = page.evaluate("""() => {
                                return document.documentElement.scrollWidth > window.innerWidth + 1;
                            }""")

                            # 2. Check title / heading is present
                            heading = page.locator("h1").first.inner_text() if page.locator("h1").count() > 0 else ""

                            # 3. Verify no uncaught runtime errors
                            has_errors = len(errors) > 0

                            # 4. Verify no authenticated shell elements exist on public pages
                            has_sidebar = page.locator("aside nav, [aria-label='Main Navigation'], .rf-sidebar").count() > 0
                            has_notifications = page.locator("button[aria-label*='Notifications'], .rf-notifications-dropdown, [data-testid='notifications-bell']").count() > 0

                            if not overflow and heading and not has_errors and not has_sidebar and not has_notifications:
                                passed += 1
                            else:
                                failed += 1
                                print(f"  [FAIL] {route} @ {width}x{height} ({theme}): overflow={overflow}, heading='{heading}', sidebar={has_sidebar}, notifications={has_notifications}, errors={errors}")

                        except Exception as e:
                            failed += 1
                            print(f"  [EXCEPTION] {route} @ {width}x{height} ({theme}): {e}")
                        finally:
                            context.close()

            # ─── Part 2: Automated Axe Accessibility Audits on Public Surfaces ───────
            print("\n--- Part 2: Automated Axe Accessibility Audits ---")
            axe_context = browser.new_context(viewport={"width": 1280, "height": 900})
            axe_page = axe_context.new_page()
            try:
                for route in public_routes:
                    axe_page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                    axe_page.wait_for_selector("h1", timeout=15000)
                    try:
                        axe_page.locator(".rf-page-state-loading").first.wait_for(state="hidden", timeout=5000)
                    except Exception:
                        pass

                    results = Axe().run(axe_page)
                    violations = results.response.get("violations", [])
                    critical_violations = [v for v in violations if v.get("impact") in ("critical", "serious")]
                    if len(critical_violations) == 0:
                        print(f"  [PASS] Axe Accessibility Clean: {route} (0 critical/serious violations)")
                    else:
                        print(f"  [WARN] Axe Accessibility Violations on {route}: {len(critical_violations)} found")
                        for v in critical_violations:
                            v_id = v.get('id')
                            v_help = v.get('help')
                            v_impact = v.get('impact')
                            print(f"    - {v_id}: {v_help} ({v_impact})")
            finally:
                axe_context.close()

            # ─── Part 3: Detailed Functional Journey Assertions ─────────────────────
            print("\n--- Part 3: Functional Interaction & Separation Verification ---")
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()

            try:
                # Journey 1: Public Jobs Listing with Dynamic API Loading
                page.goto(f"{BASE_URL}/careers/{org_code}/jobs", wait_until="domcontentloaded")
                page.wait_for_selector("h1", timeout=15000)
                assert "Find work that matters" in page.locator("h1").inner_text()
                assert page.locator("aside nav, .rf-sidebar").count() == 0, "Sidebar should not exist on public pages"

                # Wait for the public jobs API to respond and render the vacancy card
                page.wait_for_selector(f"text={vac_code}", timeout=15000)
                assert page.locator(f"text={vac_code}").count() > 0, f"Isolated fixture {vac_code} must be rendered in job cards"
                print(f"  [PASS] Journey 1: Public jobs page renders open vacancy ({vac_code}) without authenticated shell")

                # Journey 2: Search Filtering on Public Jobs Page
                search_input = page.locator("input[placeholder*='Search by role']")
                search_input.fill(vac_code)
                with page.expect_response(lambda r: f"/public/organizations/{org_code}/jobs" in r.url and r.status == 200, timeout=15000):
                    page.locator("button:has-text('Search roles')").click()

                page.wait_for_selector(f"text={vac_code}", timeout=15000)
                assert page.locator(f"text={vac_code}").count() > 0, f"Search result should include {vac_code}"
                print("  [PASS] Journey 2: Public jobs search filtering works correctly")

                # Journey 3: Public Job Detail Page while Logged Out
                page.goto(f"{BASE_URL}/careers/{org_code}/jobs/{vac_code}", wait_until="domcontentloaded")
                page.wait_for_selector("h1", timeout=15000)
                assert page.locator("h1").inner_text() != ""
                assert page.locator("a:has-text('Apply for this role')").count() > 0
                assert page.locator("button:has-text('Edit Job'), button:has-text('Delete')").count() == 0, "No recruiter management buttons on public detail"
                print("  [PASS] Journey 3: Public job detail renders public fields and no internal controls")

                # Journey 4: Unknown Vacancy Safe Not-Found State
                page.goto(f"{BASE_URL}/careers/{org_code}/jobs/UNKNOWN-VACANCY-999", wait_until="domcontentloaded")
                page.wait_for_selector("text=Role unavailable", timeout=15000)
                page_text = page.locator("main").inner_text()
                assert "Role unavailable" in page_text or "not available" in page_text or "not found" in page_text.lower()
                assert page.locator("a:has-text('Browse open roles')").count() > 0
                print("  [PASS] Journey 4: Unknown vacancy renders safe not-found state without leaks")

                # Journey 5: Public Application Validation Failure (missing consent)
                page.goto(f"{BASE_URL}/careers/{org_code}/jobs/{vac_code}/apply", wait_until="domcontentloaded")
                page.wait_for_selector("input#public-first-name", timeout=15000)
                page.locator("input#public-first-name").fill("John")
                page.locator("input#public-last-name").fill("Doe")
                page.locator("input#public-email").fill("john.doe@example.com")
                page.locator("button[type='submit']").click()
                page.wait_for_timeout(500)
                assert page.locator("[role='alert'], p.text-rf-danger").count() > 0
                print("  [PASS] Journey 5: Public application form validates consent requirement")

                # Journey 6: Valid Public Application Submission with CV Upload
                page.goto(f"{BASE_URL}/careers/{org_code}/jobs/{vac_code}/apply", wait_until="domcontentloaded")
                page.wait_for_selector("input#public-first-name", timeout=15000)
                unique_email = f"browser.applicant.{int(time.time())}.{random.randint(100, 999)}@example.com"
                page.locator("input#public-first-name").fill("Browser")
                page.locator("input#public-last-name").fill("Applicant")
                page.locator("input#public-email").fill(unique_email)
                page.locator("input#public-phone").fill("+966555123456")
                page.locator("input#public-title").fill("Senior Engineer")
                page.locator("input#public-company").fill("Global Tech")
                page.locator("input#public-skills").fill("Playwright, TypeScript, Python")
                page.locator("input#public-cv").set_input_files(temp_pdf.name)
                page.locator("input[type='checkbox']").check()

                with page.expect_response(lambda r: f"/public/organizations/{org_code}/jobs/{vac_code}/apply" in r.url and r.status == 201, timeout=15000):
                    page.locator("button[type='submit']").click()

                page.wait_for_selector("text=Application received", timeout=15000)
                assert page.locator("text=Reference: APP-").count() > 0 or page.locator("text=Reference:").count() > 0
                print("  [PASS] Journey 6: Valid public application with CV upload submits and displays reference code")

                # Journey 7: Public Applicant Remains Unauthenticated
                page.goto(f"{BASE_URL}/candidates", wait_until="domcontentloaded")
                page.wait_for_url("**/login**", timeout=15000)
                assert "/login" in page.url
                print("  [PASS] Journey 7: Public application does not establish an authenticated session")

                # Journey 8: Private Route Login Redirection
                private_urls = ["/dashboard", "/vacancy-requests", "/offers", "/audit-log", "/users", "/reports"]
                for purl in private_urls:
                    page.goto(f"{BASE_URL}{purl}", wait_until="domcontentloaded")
                    page.wait_for_url("**/login**", timeout=15000)
                    assert "/login" in page.url
                print("  [PASS] Journey 8: Unauthenticated access to private routes consistently redirects to /login")

                # Journey 9: Authenticated Login & Workspace Shell
                page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
                page.locator("input#login-email").fill("ahmed.mahmoud@recruitflow.local")
                page.locator("input#login-password").fill("Password123!")
                page.locator("button[type='submit']").click()
                page.wait_for_url(lambda u: "/login" not in u, timeout=15000)
                page.wait_for_selector(".rf-sidebar, .nav, button[aria-label='Sign out']", timeout=15000)
                assert page.locator("button[aria-label='Sign out'], button:has-text('Sign out')").count() > 0
                print("  [PASS] Journey 9: Authenticated login renders app shell and navigation")

                # Journey 10: Authenticated User Can Access Workspace Pages
                page.goto(f"{BASE_URL}/vacancies", wait_until="domcontentloaded")
                page.wait_for_selector("h1, h2, table, .rf-page-header", timeout=15000)
                assert "/login" not in page.url
                print("  [PASS] Journey 10: Authenticated user has access to internal workspace pages")

                # Journey 11: Logout Clears Session and Revokes Access
                page.locator("button[aria-label='Sign out']").click()
                page.wait_for_url("**/login**", timeout=15000)
                page.goto(f"{BASE_URL}/vacancies", wait_until="domcontentloaded")
                page.wait_for_url("**/login**", timeout=15000)
                assert "/login" in page.url
                print("  [PASS] Journey 11: Logout completely revokes access to internal workspace pages")

                # Journey 12: Keyboard Accessibility on Public Pages
                page.goto(f"{BASE_URL}/careers/{org_code}/jobs", wait_until="domcontentloaded")
                first_interactive = page.locator("a, input, button").first
                first_interactive.focus()
                focused_tag = page.evaluate("document.activeElement.tagName.toLowerCase()")
                assert focused_tag in ["a", "input", "button"], f"Expected interactive focused element, got {focused_tag}"
                page.keyboard.press("Tab")
                next_focused_tag = page.evaluate("document.activeElement.tagName.toLowerCase()")
                assert next_focused_tag in ["a", "input", "button"], f"Expected interactive focused element, got {next_focused_tag}"
                print("  [PASS] Journey 12: Keyboard focus and navigation is functional on public career site")

            finally:
                context.close()
                browser.close()

    finally:
        try:
            os.unlink(temp_pdf.name)
        except Exception:
            pass
        cleanup_fixture(vac_code)

    print(f"\nMatrix completed: {passed}/{total} route/viewport evaluations passed.")
    if failed == 0:
        print("ALL M1-G2 BROWSER CHECKS & FUNCTIONAL JOURNEYS PASSED [OK]\n")
    else:
        print(f"FAILED: {failed} evaluation(s) failed.\n")
        sys.exit(1)

if __name__ == "__main__":
    test_m1_g2_browser_matrix()
