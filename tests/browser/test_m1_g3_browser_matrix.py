"""M1-G3 — Stable API Error Envelope → Client UI Browser Matrix.

Verifies that the stable error envelope is surfaced safely and consistently in the
web client:

  1. 401 INVALID_CREDENTIALS renders the server-provided safe message in an
     aria-live banner (never the code/requestId/internals).
  2. 400 VALIDATION_ERROR `fields` from the server are mapped to inline
     field-level messages with focus on the first invalid field.
  3. Client-side validation fails safely (focus + inline messages) before any request.
  4. Deep-link return after sign-in honors the protected-route `from` path.
  5. A corrupted session token redirects to /login without crashing or leaking
     envelope internals into the DOM.
  6. Successful sign-in renders the workspace shell; session can be signed out.
  7. Axe accessibility audit on the login page surfaces no critical/serious issues.
"""

import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from axe_playwright_python.sync_playwright import Axe

# Force UTF-8 on Windows stdout
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.environ.get("RECRUITFLOW_WEB_URL", "http://127.0.0.1:5173")
ADMIN_EMAIL = "ahmed.mahmoud@recruitflow.local"
ADMIN_PASSWORD = "Password123!"
VIEWPORTS = (
    (375, 667),
    (430, 932),
    (768, 1024),
    (1024, 768),
    (1280, 800),
    (1440, 900),
)
THEMES = ("light", "dark")

LEAK_MARKERS = (
    "INVALID_CREDENTIALS",
    "UNAUTHENTICATED",
    "statusCode",
    "node_modules",
    "PrismaClient",
    "req_",
    "x-correlation-id",
    "ERR_",
)

passed = 0
failed = 0


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {label}" + (f" — {detail}" if detail else ""))
    else:
        failed += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


def browser_executable():
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        return None
    candidates = sorted(
        (Path(local_app_data) / "ms-playwright").glob("chromium-*/chrome-win64/chrome.exe"),
        reverse=True,
    )
    return str(candidates[0]) if candidates else None


def body_text(page):
    try:
        return page.locator("body").inner_text()
    except Exception:
        return ""


def assert_no_leak(page, label):
    text = body_text(page)
    leaked = [m for m in LEAK_MARKERS if m in text]
    check(f"{label}: no envelope internals leak into DOM", not leaked, f"leaks={leaked}")


def login(page, email, password):
    page.locator("input#login-email").fill(email)
    page.locator("input#login-password").fill(password)
    page.locator("button[type='submit']").click()


def test_m1_g3_browser_matrix():
    print("=== M1-G3 ERROR ENVELOPE → CLIENT UI BROWSER MATRIX ===\n")

    with sync_playwright() as p:
        launch_opts = {"headless": True}
        executable = browser_executable()
        if executable:
            launch_opts["executable_path"] = executable
        browser = p.chromium.launch(**launch_opts)

        # ─── Part 1: Envelope-driven login error rendering ──────────────────
        print("\n[1] ENVELOPE-BACKED LOGIN MESSAGES")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page_errors = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        try:
            page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
            page.wait_for_selector("input#login-email", timeout=15000)

            # Journey A: wrong password -> server envelope message in aria-live banner
            login(page, ADMIN_EMAIL, "DefinitelyWrong!999")
            page.wait_for_selector("text=Invalid email or password", timeout=15000)
            check("A1: 401 INVALID_CREDENTIALS message rendered", page.locator("text=Invalid email or password").count() > 0)
            banner = page.locator("[aria-live='polite'] [role='alert'], [aria-live='polite']")
            check("A2: message lives in aria-live region", banner.count() > 0 or page.locator("text=Unable to sign in").count() > 0)
            assert_no_leak(page, "A3")
            check("A4: no uncaught page errors during failed login", len(page_errors) == 0, str(page_errors))

            # Journey B: server 400 VALIDATION_ERROR fields mapped to inline email error
            # 'a..b@example.com' passes the client regex but fails server IsEmail.
            login(page, "a..b@example.com", "whatever123")
            msg = page.locator("#login-email-message")
            msg.wait_for(state="visible", timeout=15000)
            text = msg.inner_text()
            check("B1: server field error mapped to email field", "email" in text.lower() or "valid" in text.lower(), text)
            focused = page.evaluate("document.activeElement && document.activeElement.id")
            check("B2: focus moved to first invalid server field (email)", focused == "login-email", focused)
            check("B3: no generic banner supersedes server field error", page.locator("text=Unable to sign in").count() == 0)
            assert_no_leak(page, "B4")
            check("B5: no uncaught page errors on validation pass-through", len(page_errors) == 0, str(page_errors))

            # Journey C: client-side validation (no request) focuses + inlines errors
            page.reload(wait_until="domcontentloaded")
            page.wait_for_selector("input#login-email", timeout=15000)
            page.locator("button[type='submit']").click()
            page.wait_for_selector("#login-email-message", timeout=8000)
            email_msg = page.locator("#login-email-message").inner_text()
            pass_msg = page.locator("#login-password-message").inner_text()
            check("C1: empty submit shows email inline error", "email" in email_msg.lower(), email_msg)
            check("C2: empty submit shows password inline error", "password" in pass_msg.lower(), pass_msg)
            check("C3: focus on first invalid field (email)", page.evaluate("document.activeElement && document.activeElement.id") == "login-email")

            # Journey D: unauthenticated deep-link returns user after sign-in
            page.goto(f"{BASE_URL}/users", wait_until="domcontentloaded")
            page.wait_for_url("**/login**", timeout=15000)
            page.wait_for_selector("input#login-email", timeout=15000)
            login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
            try:
                page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
            except TimeoutError:
                pass
            back_to_users = "/users" in page.url
            check("D1: sign-in returns to requested deep link", back_to_users, page.url)
            page.wait_for_selector("button[aria-label='Sign out'], button:has-text('Sign out')", timeout=15000)
            check("D2: workspace shell rendered after sign-in", page.locator("button[aria-label='Sign out'], button:has-text('Sign out')").count() > 0)
            assert_no_leak(page, "D3")

            # Journey E: corrupted session cookie -> clean redirect, no leak, no crash
            page.context.add_cookies([
                {"name": "access_token", "value": "garbage-token-value",
                 "domain": "127.0.0.1", "path": "/api/v1", "httpOnly": True},
                {"name": "refresh_token", "value": "garbage-token-value",
                 "domain": "127.0.0.1", "path": "/api/v1/auth/refresh", "httpOnly": True},
            ])
            page.goto(f"{BASE_URL}/candidates", wait_until="domcontentloaded")
            page.wait_for_url("**/login**", timeout=20000)
            page.wait_for_selector("input#login-email", timeout=15000)
            check("E1: corrupted token redirects to /login", "/login" in page.url)
            assert_no_leak(page, "E2")
            check("E3: no uncaught page errors on session-expiry redirect", len(page_errors) == 0, str(page_errors))

            # Journey F: sign out resets owning session (context hygiene)
            login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
            try:
                page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
            except TimeoutError:
                pass
            signout = page.locator("button[aria-label='Sign out'], button:has-text('Sign out')")
            signout.wait_for(timeout=15000)
            signout.first.click()
            page.wait_for_url("**/login**", timeout=15000)
            check("F1: sign out returns to /login", "/login" in page.url)

        finally:
            context.close()

        # ─── Part 2: Responsive and theme smoke matrix on login error surface ─
        print("\n[2] RESPONSIVE & THEMING — LOGIN ERROR SURFACE")
        for width, height in VIEWPORTS:
            for theme in THEMES:
                matrix_ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    color_scheme=theme,
                )
                matrix_page = matrix_ctx.new_page()
                matrix_errors = []
                matrix_page.on("pageerror", lambda err: matrix_errors.append(str(err)))
                try:
                    matrix_page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
                    matrix_page.wait_for_selector("input#login-email", timeout=15000)
                    matrix_page.evaluate(
                        "theme => document.documentElement.setAttribute('data-theme', theme)",
                        theme,
                    )
                    matrix_page.locator("button[type='submit']").click()
                    matrix_page.wait_for_selector("#login-email-message", timeout=8000)
                    overflow = matrix_page.evaluate(
                        "() => document.documentElement.scrollWidth > window.innerWidth + 1"
                    )
                    visible_form = matrix_page.locator("input#login-email").is_visible()
                    leaked = [m for m in LEAK_MARKERS if m in body_text(matrix_page)]
                    check(
                        f"Responsive login error surface @ {width}x{height} ({theme})",
                        not overflow and visible_form and not matrix_errors and not leaked,
                        f"overflow={overflow}, errors={matrix_errors}, leaks={leaked}",
                    )
                except Exception as e:
                    check(f"Responsive login error surface @ {width}x{height} ({theme})", False, str(e))
                finally:
                    matrix_ctx.close()

        # ─── Part 3: Axe accessibility on login error surface ────────────────
        print("\n[3] AXE ACCESSIBILITY — LOGIN ERROR SURFACE")
        for theme in THEMES:
            axe_ctx = browser.new_context(
                viewport={"width": 1280, "height": 900},
                color_scheme=theme,
            )
            axe_page = axe_ctx.new_page()
            try:
                axe_page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
                axe_page.wait_for_selector("input#login-email", timeout=15000)
                axe_page.evaluate(
                    "theme => document.documentElement.setAttribute('data-theme', theme)",
                    theme,
                )
                login(axe_page, ADMIN_EMAIL, "DefinitelyWrong!999")
                axe_page.wait_for_selector("text=Invalid email or password", timeout=15000)

                results = Axe().run(axe_page)
                violations = results.response.get("violations", [])
                critical = [v for v in violations if v.get("impact") in ("critical", "serious")]
                if critical:
                    check(f"Axe login error surface clean ({theme})", False, "; ".join(v.get("id", "?") for v in critical))
                else:
                    check(f"Axe login error surface clean ({theme})", True, f"{len(violations)} total, 0 critical/serious")
            finally:
                axe_ctx.close()

        browser.close()

    print(f"\n=== M1-G3 BROWSER MATRIX: {passed} passed, {failed} failed ===")
    if failed > 0:
        sys.exit(1)
    print("ALL M1-G3 BROWSER CHECKS PASSED [OK]\n")


if __name__ == "__main__":
    test_m1_g3_browser_matrix()
