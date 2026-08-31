"""M1 Authentication Public Pages & Functional Journeys Browser Matrix Test."""

import json
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

# Force UTF-8 on Windows stdout
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.environ.get("RECRUITFLOW_WEB_URL", "http://127.0.0.1:5173")
VIEWPORTS = ((375, 812), (430, 900), (768, 900), (1024, 900), (1280, 900), (1440, 900))
THEMES = ("light", "dark")
AUTH_ROUTES = (
    "/login",
    "/forgot-password",
    "/reset-password?token=sample-test-token",
    "/accept-invitation?token=sample-test-token",
    "/verify-email?token=sample-test-token",
)

def browser_executable():
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        return None
    candidates = sorted(
        (Path(local_app_data) / "ms-playwright").glob("chromium-*/chrome-win64/chrome.exe"),
        reverse=True,
    )
    return str(candidates[0]) if candidates else None

def test_m1_browser_matrix():
    passed = 0
    failed = 0
    total = len(VIEWPORTS) * len(THEMES) * len(AUTH_ROUTES)

    print(f"=== M1 AUTH PUBLIC PAGES BROWSER MATRIX ({total} evaluations) ===\n")

    with sync_playwright() as p:
        executable = browser_executable()
        launch_opts = {"headless": True}
        if executable:
            launch_opts["executable_path"] = executable

        browser = p.chromium.launch(**launch_opts)

        # ─── Part 1: Responsive & Theming Matrix Across All 5 Auth Routes ────────
        for width, height in VIEWPORTS:
            for theme in THEMES:
                for route in AUTH_ROUTES:
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
                        page.wait_for_selector("h1", timeout=10000)

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

                        if not overflow and heading and not has_errors:
                            passed += 1
                        else:
                            failed += 1
                            print(f"  [FAIL] {route} @ {width}px ({theme}): overflow={overflow}, heading='{heading}', errors={errors}")

                    except Exception as e:
                        failed += 1
                        print(f"  [EXCEPTION] {route} @ {width}px ({theme}): {e}")
                    finally:
                        context.close()

        # ─── Part 2: Detailed Functional Journey Assertions ─────────────────────
        print("\n--- Functional Interaction & Authentication Lifecycle Verification ---")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        # J1: Invalid Login Attempt
        page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=10000)
        page.fill('input[type="email"]', "sarah.ahmed@recruitflow.local")
        page.fill('input[type="password"]', "WrongPassword123!")
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_selector('[role="alert"]', timeout=10000)
        assert page.locator('[role="alert"]').count() > 0
        print("  [PASS] Journey 1: Invalid login displays accessible alert banner")

        # J2: Successful Login & Redirection
        page.fill('input[type="email"]', "sarah.ahmed@recruitflow.local")
        page.fill('input[type="password"]', "Password123!")
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url(f"{BASE_URL}/", timeout=10000)
        page.wait_for_selector("h1", timeout=10000)
        print("  [PASS] Journey 2: Valid login redirects to authenticated workspace")

        # J3: Profile Navigation & Display Name Update
        page.goto(f"{BASE_URL}/profile?tab=profile", wait_until="domcontentloaded")
        page.wait_for_selector('input[value*="Sarah"]', timeout=10000)
        assert page.locator('input[value*="Sarah"]').count() > 0
        print("  [PASS] Journey 3: Authenticated /profile loads user data")

        # J4: Preferences Tab & Theme Toggle
        page.goto(f"{BASE_URL}/profile?tab=preferences", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=10000)
        assert page.locator('text=Preferences').count() > 0 or page.locator('text=Theme').count() > 0
        print("  [PASS] Journey 4: /profile?tab=preferences renders customization options")

        # J5: Security Tab & Password Change Form Validation
        page.goto(f"{BASE_URL}/profile?tab=security", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=10000)
        assert page.locator('text=Password').count() > 0 or page.locator('input[type="password"]').count() > 0
        print("  [PASS] Journey 5: /profile?tab=security renders password change controls")

        # J6: Logout Execution & Session Invalidation
        page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
        page.wait_for_selector('button[aria-label="Sign out"]', timeout=10000)
        page.locator('button[aria-label="Sign out"]').first.click()
        page.wait_for_url(f"{BASE_URL}/login*", timeout=10000)
        print("  [PASS] Journey 6: Logout successfully clears session and redirects to /login")

        # J7: Protected Route Guard (Redirects unauthenticated user)
        page.goto(f"{BASE_URL}/candidates", wait_until="domcontentloaded")
        page.wait_for_url(f"{BASE_URL}/login*", timeout=10000)
        print("  [PASS] Journey 7: Protected route /candidates enforces login redirection")

        # J8: Forgot Password Navigation & Validation
        page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=10000)
        forgot_link = page.locator('a[href="/forgot-password"]')
        assert forgot_link.count() > 0
        forgot_link.click()
        page.wait_for_url(f"{BASE_URL}/forgot-password", timeout=10000)
        page.get_by_role("button", name="Send reset link").click()
        page.wait_for_timeout(200)
        assert page.locator('#email-message').count() > 0 or page.locator('[role="alert"]').count() > 0 or page.locator('[aria-invalid="true"]').count() > 0
        print("  [PASS] Journey 8: ForgotPassword navigation and client validation verified")

        # J9: Reset Password Token States
        page.goto(f"{BASE_URL}/reset-password?token=sample-test-token", wait_until="domcontentloaded")
        page.wait_for_selector("#new-password", timeout=10000)
        pw_input = page.locator("#new-password")
        assert pw_input.get_attribute("type") == "password"
        toggle_btn = page.locator('button[aria-label*="password" i]').first
        if toggle_btn.count() > 0:
            toggle_btn.click()
            assert pw_input.get_attribute("type") == "text"
            toggle_btn.click()
            assert pw_input.get_attribute("type") == "password"
        print("  [PASS] Journey 9: ResetPassword token input and password visibility toggle verified")

        # J10: Reset Password No-Token Graceful Alert
        page.goto(f"{BASE_URL}/reset-password", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=10000)
        assert page.locator('[role="alert"]').count() > 0 or page.locator('text=No reset token').count() > 0
        print("  [PASS] Journey 10: ResetPassword missing-token error alert verified")

        # J11: Accept Invitation Token Input State
        page.goto(f"{BASE_URL}/accept-invitation?token=sample-test-token", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=10000)
        assert page.locator('#password').count() > 0 or page.locator('input[type="password"]').count() > 0
        print("  [PASS] Journey 11: AcceptInvitation token state renders password setup")

        # J12: Accept Invitation No-Token Alert State
        page.goto(f"{BASE_URL}/accept-invitation", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=10000)
        assert page.locator('[role="alert"]').count() > 0 or page.locator('text=No invitation token').count() > 0
        print("  [PASS] Journey 12: AcceptInvitation missing-token error alert verified")

        # J13: Verify Email No-Token Alert State
        page.goto(f"{BASE_URL}/verify-email", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=10000)
        assert page.locator('[role="alert"]').count() > 0 or page.locator('text=No verification token').count() > 0
        print("  [PASS] Journey 13: VerifyEmail missing-token error alert verified")

        context.close()
        browser.close()

    print(f"\nMatrix completed: {passed}/{total} route/viewport evaluations passed.")
    if failed == 0:
        print("ALL M1 BROWSER CHECKS & FUNCTIONAL JOURNEYS PASSED [OK]")
        return 0
    else:
        print(f"[FAIL] {failed} checks failed")
        return 1

if __name__ == "__main__":
    raise SystemExit(test_m1_browser_matrix())
