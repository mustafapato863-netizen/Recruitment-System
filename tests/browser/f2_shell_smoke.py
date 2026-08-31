"""Focused shell interaction smoke for F2 baseline."""
from playwright.sync_api import sync_playwright


def login(page):
    page.goto("http://127.0.0.1:5173/login", wait_until="domcontentloaded")
    page.locator("#login-email").fill("ahmed.mahmoud@recruitflow.local")
    page.locator("#login-password").fill("Password123!")
    page.locator("button[type='submit']").click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=20_000)
    page.wait_for_selector(".app", timeout=20_000)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    desktop = browser.new_context(viewport={"width": 1440, "height": 900})
    desktop_page = desktop.new_page()
    login(desktop_page)
    print("PASS desktop shell loaded")
    print("desktop sidebar width", desktop_page.locator(".sidebar").evaluate("e => getComputedStyle(e).width"))
    print("desktop header height", desktop_page.locator(".header").evaluate("e => getComputedStyle(e).height"))
    collapse = desktop_page.get_by_label("Collapse sidebar")
    collapse.click()
    desktop_page.wait_for_timeout(150)
    assert "is-sidebar-collapsed" in desktop_page.locator(".app").get_attribute("class")
    assert desktop_page.get_by_label("Expand sidebar").is_visible()
    print("PASS desktop sidebar collapse/expand state")
    desktop.close()

    mobile = browser.new_context(viewport={"width": 430, "height": 900})
    mobile_page = mobile.new_page()
    login(mobile_page)
    open_menu = mobile_page.get_by_label("Open navigation menu")
    open_menu.click()
    mobile_page.wait_for_timeout(200)
    state = mobile_page.locator(".sidebar").evaluate(
        "e => { const s=getComputedStyle(e); return {visibility:s.visibility, transform:s.transform, pointerEvents:s.pointerEvents}; }"
    )
    assert state["visibility"] == "visible", state
    assert state["pointerEvents"] != "none", state
    print("PASS mobile drawer open", state)
    mobile_page.keyboard.press("Escape")
    mobile_page.wait_for_timeout(150)
    print("mobile after Escape", mobile_page.locator(".app").get_attribute("class"), mobile_page.locator(".sidebar").evaluate("e => { const s=getComputedStyle(e); return {visibility:s.visibility, transform:s.transform, pointerEvents:s.pointerEvents}; }"))
    closed_state = mobile_page.locator(".sidebar").evaluate(
        "e => { const s=getComputedStyle(e); return {visibility:s.visibility, transform:s.transform, pointerEvents:s.pointerEvents}; }"
    )
    assert closed_state["pointerEvents"] == "none", closed_state
    assert closed_state["transform"] != "matrix(1, 0, 0, 1, 0, 0)", closed_state
    assert open_menu.evaluate("e => document.activeElement === e")
    print("PASS mobile Escape closes drawer and restores focus")
    mobile.close()
    browser.close()
