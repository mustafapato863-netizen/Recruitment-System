import csv
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


def settle(page) -> None:
    page.wait_for_load_state("domcontentloaded")
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        pass


def main() -> None:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["Name", "Status"])
        writer.writeheader()
        writer.writerow({"Name": f"Browser Master Data {int(time.time())}", "Status": "Active"})
        fixture = Path(handle.name)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light")
            page = context.new_page()
            page.goto("http://127.0.0.1:5187/login", wait_until="domcontentloaded")
            settle(page)
            page.get_by_label("Email address").fill("ahmed.mahmoud@recruitflow.local")
            page.locator("#login-password").fill("Password123!")
            page.get_by_role("button", name="Sign in").click()
            page.wait_for_url("**/")
            page.goto("http://127.0.0.1:5187/import", wait_until="domcontentloaded")
            settle(page)
            master_tab = page.locator("button").filter(has_text="Legal entities")
            assert master_tab.is_visible()
            assert page.locator("button").filter(has_text="Branches").is_visible()
            assert page.locator("button").filter(has_text="Positions").is_visible()
            master_tab.click()
            page.locator('input[type="file"]').set_input_files(str(fixture))
            page.get_by_text("Inspected").wait_for(state="visible", timeout=15000)
            assert page.get_by_text("Code").is_visible()
            page.set_viewport_size({"width": 430, "height": 900})
            page.emulate_media(color_scheme="dark")
            assert page.get_by_role("heading", name="Bulk Import Center").is_visible()
            assert page.get_by_role("button", name="Download template").is_visible()
            print("[PASS] Browser master-data tabs, inspection, mobile width, and dark theme")
            browser.close()
    finally:
        fixture.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
