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
        # Vite's HMR connection keeps development pages active; DOM readiness is the stable signal here.
        pass


def main() -> None:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["First Name", "Last Name", "Email", "Current Title"])
        writer.writeheader()
        writer.writerow({
            "First Name": "Browser",
            "Last Name": f"Import {int(time.time())}",
            "Email": f"browser.bulk.{int(time.time())}@recruitflow.local",
            "Current Title": "Browser Test Candidate",
        })
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
            assert page.get_by_role("heading", name="Bulk Import Center").is_visible()
            assert page.get_by_role("button", name="Download template").is_visible()
            page.locator('input[type="file"]').set_input_files(str(fixture))
            page.get_by_text("Inspected").wait_for(state="visible", timeout=15000)
            page.get_by_role("button", name="Stage for review").click()
            page.wait_for_url("**/import/candidates/**", timeout=15000)
            settle(page)
            if not page.get_by_role("button", name="Confirm import").is_visible():
                print(f"[DEBUG] URL: {page.url}")
                print(f"[DEBUG] BODY: {page.locator('body').inner_text()[:1200].encode('ascii', 'replace').decode('ascii')}")
            assert page.get_by_role("button", name="Confirm import").is_visible()
            assert page.get_by_text("Browser Test Candidate").is_visible()
            print("[PASS] Browser bulk-import upload, staging, and review journey")
            browser.close()
    finally:
        fixture.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
