"""Exercise the real candidate activity form against a disposable candidate."""
import sys
import re
from pathlib import Path
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright, expect
from recruitflow_dual_mode_matrix import browser_executable, login, BASE_URL

with sync_playwright() as playwright:
    options = {"headless": True, "args": ["--host-resolver-rules=MAP localhost 127.0.0.1"]}
    executable = browser_executable()
    if executable:
        options["executable_path"] = executable
    browser = playwright.chromium.launch(**options)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    login(page)
    page.goto(f"{BASE_URL}/candidates/{sys.argv[1]}")
    panel = page.get_by_role("region", name="Candidate activity", exact=True)
    expect(panel.get_by_text("Confirmed availability", exact=True)).to_be_visible()
    page.get_by_role("button", name="Close Quick Guide", exact=True).click()
    panel.get_by_label("Call outcome / summary").fill("Browser call outcome")
    panel.get_by_role("button", name="Log completed activity", exact=True).click()
    expect(panel.get_by_text("Browser call outcome", exact=True)).to_be_visible()
    panel.get_by_role("combobox", name=re.compile("^When")).select_option("planned")
    panel.get_by_label("Call outcome / summary").fill("Browser follow-up")
    panel.get_by_label("Follow-up date and time (your local time)").fill((datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M"))
    panel.get_by_role("button", name="Save follow-up", exact=True).click()
    panel.get_by_role("button", name="Mark done", exact=True).click()
    expect(panel.get_by_role("button", name="Mark done", exact=True)).to_have_count(0)
    page.reload()
    expect(panel.get_by_text("Browser follow-up", exact=True)).to_be_visible()
    for width in [375, 1440]:
        page.set_viewport_size({"width": width, "height": 900})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"Overflow at {width}"
    Path("tests/artifacts/activity-review").mkdir(parents=True, exist_ok=True)
    panel.screenshot(path="tests/artifacts/activity-review/candidate-activity.png")
    assert not errors, errors
    browser.close()
    print("PASS: activity form, follow-up completion, refresh persistence, mobile/desktop overflow, no page errors")
