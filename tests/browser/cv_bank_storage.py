import re

from playwright.sync_api import sync_playwright


def settle(page) -> None:
    page.wait_for_load_state("domcontentloaded")
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass


def verify_cv_bank(page, width: int, color_scheme: str) -> None:
    page.set_viewport_size({"width": width, "height": 900})
    page.emulate_media(color_scheme=color_scheme)
    page.goto("http://127.0.0.1:5187/cv-bank", wait_until="domcontentloaded")
    settle(page)
    assert page.get_by_role("heading", name="CV Bank").is_visible()
    assert page.get_by_role("button", name=re.compile("Export Excel backup manifest")).is_visible()
    assert page.get_by_text("CV backup is metadata-only").is_visible()
    assert page.get_by_role("textbox", name="Search CV Bank").is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


def main() -> None:
    console_errors = []
    server_errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light")
        page = context.new_page()
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: console_errors.append(str(error)))
        page.on("response", lambda response: server_errors.append(f"{response.status} {response.url}") if response.status >= 500 else None)
        page.goto("http://127.0.0.1:5187/login", wait_until="domcontentloaded")
        settle(page)
        page.get_by_label("Email address").fill("ahmed.mahmoud@recruitflow.local")
        page.locator("#login-password").fill("Password123!")
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url("**/")
        # The unauthenticated bootstrap may probe /auth/me before login; only
        # post-login console/API failures are relevant to this journey.
        console_errors.clear()
        server_errors.clear()
        verify_cv_bank(page, 1440, "light")
        verify_cv_bank(page, 430, "dark")
        assert not console_errors, f"Browser console errors: {console_errors}"
        assert not server_errors, f"Server errors: {server_errors}"
        print("[PASS] CV Bank light/dark, desktop/mobile, Excel backup status, and error-free load")
        browser.close()


if __name__ == "__main__":
    main()
