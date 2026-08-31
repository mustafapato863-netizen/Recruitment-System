import re

from playwright.sync_api import sync_playwright

from hardening_slice import BASE_URL, PASSWORD, RESTRICTED_EMAIL, ADMIN_EMAIL, WIDTHS, assert_no_horizontal_overflow, settle


def login(page, email: str) -> None:
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    settle(page)
    page.get_by_label("Email address").fill(email)
    page.locator("#login-password").fill(PASSWORD)
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_url(f"{BASE_URL}/", timeout=15000)
    settle(page)


def main() -> None:
    server_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
        page = context.new_page()
        page.on("response", lambda response: server_errors.append(f"{response.status} {response.url}") if response.status >= 500 else None)
        login(page, ADMIN_EMAIL)
        print("[PASS] Dark-mode admin login and redirect")

        routes = [
            ("/reports", "Reports & Analytics"),
            ("/cv-bank", "CV Bank"),
            ("/pipeline-settings", "Workflow & Pipeline Settings"),
        ]
        for width in WIDTHS:
            page.set_viewport_size({"width": width, "height": 900})
            for route, heading in routes:
                page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                settle(page)
                assert page.get_by_role("heading", name=heading).is_visible(), f"{heading} renders in dark mode at {width}px"
                assert_no_horizontal_overflow(page, f"dark {route} at {width}px")
            print(f"[PASS] Dark Reports, CV Bank, and pipeline settings render at {width}px")

        page.goto(f"{BASE_URL}/reports", wait_until="domcontentloaded")
        settle(page)
        with page.expect_download() as download_info:
            page.get_by_role("button", name=re.compile("Export Excel", re.I)).click()
        assert download_info.value.suggested_filename.endswith(".xlsx")
        print("[PASS] Dark Reports exports an Excel workbook")

        page.goto(f"{BASE_URL}/cv-bank", wait_until="domcontentloaded")
        settle(page)
        with page.expect_download() as download_info:
            page.get_by_role("button", name=re.compile("Export Excel", re.I)).click()
        assert download_info.value.suggested_filename.endswith(".xlsx")
        print("[PASS] Dark CV Bank exports an Excel manifest")

        context.close()
        restricted_context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
        restricted_page = restricted_context.new_page()
        login(restricted_page, RESTRICTED_EMAIL)
        body = restricted_page.locator("body").inner_text()
        assert "Workspace data is unavailable" not in body
        assert "Unavailable dashboard sections" not in body
        print("[PASS] Dark restricted dashboard does not show unauthorized workspace errors")
        restricted_context.close()
        browser.close()

    assert not server_errors, f"Browser saw server errors: {server_errors}"
    print("[PASS] Dark-mode browser server-error checks are clean")


if __name__ == "__main__":
    main()
