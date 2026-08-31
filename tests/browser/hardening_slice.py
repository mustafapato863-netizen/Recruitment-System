import re
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5187"
ADMIN_EMAIL = "ahmed.mahmoud@recruitflow.local"
RESTRICTED_EMAIL = "omar.nasser@recruitflow.local"
PASSWORD = "Password123!"
WIDTHS = [1440, 1280, 1024, 768, 430, 375]


def settle(page) -> None:
    page.wait_for_load_state("domcontentloaded")
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        pass


def login(page, email: str) -> None:
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    settle(page)
    page.get_by_label("Email address").fill(email)
    page.locator("#login-password").fill(PASSWORD)
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_url(f"{BASE_URL}/", timeout=15000)
    settle(page)


def assert_no_horizontal_overflow(page, label: str) -> None:
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
    assert not overflow, f"{label} has no horizontal overflow"


def main() -> None:
    console_errors: list[str] = []
    failed_requests: list[str] = []
    unauthorized_requests: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light")
        page = context.new_page()
        page.on("console", lambda message: console_errors.append(f"{message.text} @ {message.page.url}") if message.type == "error" else None)
        page.on("response", lambda response: failed_requests.append(f"{response.status} {response.url}") if response.status >= 500 else None)
        page.on("response", lambda response: unauthorized_requests.append(f"{response.status} {response.url}") if response.status == 401 else None)

        login(page, ADMIN_EMAIL)
        print("[PASS] Admin login and redirect")

        for width in WIDTHS:
            page.set_viewport_size({"width": width, "height": 900})
            for route, heading in [
                ("/reports", "Reports & Analytics"),
                ("/cv-bank", "CV Bank"),
                ("/pipeline-settings", "Workflow & Pipeline Settings"),
            ]:
                page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                settle(page)
                assert page.get_by_role("heading", name=heading).is_visible(), f"{heading} renders at {width}px"
                assert_no_horizontal_overflow(page, f"{route} at {width}px")
            print(f"[PASS] Reports, CV Bank, and pipeline settings render at {width}px")

        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto(f"{BASE_URL}/reports", wait_until="domcontentloaded")
        settle(page)
        assert page.get_by_role("button", name=re.compile("Export Excel", re.I)).is_visible()
        with page.expect_download() as download_info:
            page.get_by_role("button", name=re.compile("Export Excel", re.I)).click()
        download = download_info.value
        assert download.suggested_filename.endswith(".xlsx")
        print("[PASS] Reports exports an Excel workbook from the browser")

        page.goto(f"{BASE_URL}/cv-bank", wait_until="domcontentloaded")
        settle(page)
        assert page.get_by_role("button", name=re.compile("Export Excel", re.I)).is_visible()
        with page.expect_download() as download_info:
            page.get_by_role("button", name=re.compile("Export Excel", re.I)).click()
        assert download_info.value.suggested_filename.endswith(".xlsx")
        print("[PASS] CV Bank exports an Excel manifest from the browser")

        page.goto(f"{BASE_URL}/pipeline-settings", wait_until="domcontentloaded")
        settle(page)
        assert page.get_by_role("heading", name="Workflow & Pipeline Settings").is_visible()
        assert page.get_by_role("button", name=re.compile("Edit", re.I)).count() >= 1
        assert page.get_by_role("button", name=re.compile("Archive", re.I)).count() >= 1
        print("[PASS] Pipeline settings exposes edit and archive controls")

        context.close()
        restricted_context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light")
        restricted_page = restricted_context.new_page()
        restricted_page.on("console", lambda message: console_errors.append(f"{message.text} @ {message.page.url}") if message.type == "error" else None)
        restricted_page.on("response", lambda response: unauthorized_requests.append(f"{response.status} {response.url}") if response.status == 401 else None)
        login(restricted_page, RESTRICTED_EMAIL)
        body = restricted_page.locator("body").inner_text()
        assert "Workspace data is unavailable" not in body
        assert "Unavailable dashboard sections" not in body
        print("[PASS] Restricted dashboard does not show unauthorized workspace errors")
        restricted_context.close()
        browser.close()

    assert not failed_requests, f"Browser saw server errors: {failed_requests}"
    print(f"[INFO] Browser 401 responses: {unauthorized_requests}")
    expected_bootstrap_401s = [error for error in console_errors if "401 (Unauthorized)" in error and "@ http://127.0.0.1:5187/login" in error]
    unexpected_console_errors = [error for error in console_errors if error not in expected_bootstrap_401s]
    assert not unexpected_console_errors, f"Browser saw unexpected console errors: {unexpected_console_errors}"
    print(f"[INFO] Expected unauthenticated bootstrap responses: {len(expected_bootstrap_401s)}")
    print("[PASS] Browser console and server-error checks are clean")


if __name__ == "__main__":
    main()
