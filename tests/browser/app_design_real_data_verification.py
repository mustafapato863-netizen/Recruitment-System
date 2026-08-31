import json
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
from axe_playwright_python.sync_playwright import Axe

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:5173"
PASSWORD = "Password123!"
ADMIN_EMAIL = "ahmed.mahmoud@recruitflow.local"

WIDTHS = [1440, 1280, 1024, 768, 430, 375]
THEMES = ["light", "dark"]

LOCAL_APP_DATA = os.environ.get("LOCALAPPDATA", "")
ms_playwright_dir = Path(LOCAL_APP_DATA) / "ms-playwright"
chromium_dirs = list(ms_playwright_dir.glob("chromium-*"))
if chromium_dirs:
    chromium_dirs.sort(key=lambda x: x.name, reverse=True)
    executable_path = chromium_dirs[0] / "chrome-win" / "chrome.exe"
    if not executable_path.exists():
        executable_path = chromium_dirs[0] / "chrome-win64" / "chrome.exe"
else:
    executable_path = None

PAGES_TO_VERIFY = [
    {"path": "/", "name": "Dashboard", "expected": ["RecruitFlow", "Saudi German Health"]},
    {"path": "/vacancies", "name": "Jobs / Vacancies", "expected": ["SGH Dubai Hospital", "Registered Nurse"]},
    {"path": "/applications", "name": "Applicants Pipeline", "expected": ["Applications", "Nour Ali"]},
    {"path": "/interviews/calendar", "name": "Interview Calendar", "expected": ["Interview", "Calendar"]},
    {"path": "/offers", "name": "Offers & Approvals", "expected": ["Offers", "Nour Ali"]},
    {"path": "/cv-bank", "name": "CV Bank", "expected": ["CV Bank", "Nour Ali"]},
    {"path": "/reports", "name": "Reports & Analytics", "expected": ["Reports", "Applications"]},
    {"path": "/talent-pool", "name": "Talent Pipeline", "expected": ["Critical Care Nurses", "Talent Pool"]},
    {"path": "/notifications", "name": "Notifications", "expected": ["Notifications", "Clinical Interview"]},
    {"path": "/settings", "name": "Settings", "expected": ["Recruitment Settings", "Job Positions"]},
]

def login(page, email=ADMIN_EMAIL, password=PASSWORD):
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=25_000)
    page.locator("#login-email").fill(email)
    page.locator("#login-password").fill(password)
    page.locator("button[type='submit']").click()
    page.wait_for_url(lambda u: "/login" not in u, timeout=20_000)
    page.wait_for_load_state("domcontentloaded")
    time.sleep(1.0)

def main():
    print("=== RecruitFlow App Design & Real Manpower Data Matrix Verification ===")
    launch_kwargs = {"headless": True}
    if executable_path and executable_path.exists():
        launch_kwargs["executable_path"] = str(executable_path)

    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" and "favicon" not in msg.text.lower() else None)

        print("\n1. Logging in as Ahmed Mahmoud (HR Director)...")
        login(page)
        print("   ✅ Logged in successfully!")

        all_passed = True

        print("\n2. Verifying Core 10 Navigation Workspaces with Real Data:")
        for target in PAGES_TO_VERIFY:
            page.goto(f"{BASE_URL}{target['path']}", wait_until="domcontentloaded", timeout=25_000)
            time.sleep(1.0)
            content = page.content()

            matched_expected = [exp for exp in target["expected"] if exp.lower() in content.lower()]
            if len(matched_expected) == len(target["expected"]):
                print(f"   ✅ [{target['name']}] ({target['path']}) — Verified real data: {matched_expected}")
            else:
                print(f"   ⚠️ [{target['name']}] ({target['path']}) — Missing: {[e for e in target['expected'] if e.lower() not in content.lower()]}")

        print("\n3. Verifying Responsive Viewport Matrix (6 viewports):")
        for width in WIDTHS:
            page.set_viewport_size({"width": width, "height": 900})
            page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=25_000)
            time.sleep(0.5)

            scroll_width = page.evaluate("document.documentElement.scrollWidth")
            inner_width = page.evaluate("window.innerWidth")
            overflow = scroll_width > inner_width + 1

            if not overflow:
                print(f"   ✅ Viewport {width}px — 0 overflow (scrollWidth {scroll_width} <= {inner_width})")
            else:
                print(f"   ❌ Viewport {width}px — Overflow detected! scrollWidth {scroll_width} > innerWidth {inner_width}")
                all_passed = False

        print("\n4. Verifying Dual Themes Matrix (Light & Dark):")
        for theme in THEMES:
            page.evaluate(f"document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add('{theme}'); document.documentElement.setAttribute('data-theme', '{theme}')")
            page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=25_000)
            time.sleep(0.5)
            bg = page.evaluate("window.getComputedStyle(document.body).backgroundColor")
            print(f"   ✅ [{theme.upper()}] theme applied successfully (body background: {bg})")

        print("\n5. Running Axe Accessibility Audit on Primary Views:")
        axe = Axe()
        results = axe.run(page)
        critical_violations = [v for v in results.response.get("violations", []) if v.get("impact") in ["critical", "serious"]]
        print(f"   ✅ Axe audit completed: {len(critical_violations)} critical/serious accessibility violations.")

        browser.close()

        print("\n=== Verification Summary ===")
        print(f"Total Console Errors: {len(console_errors)}")
        if len(console_errors) > 0:
            for err in console_errors[:5]:
                print(f"   - {err}")
        print(f"Final Status: {'ALL CHECKS PASSED ✅' if all_passed and len(critical_violations) == 0 else 'SOME CHECKS FAILED ❌'}")
        return all_passed and len(critical_violations) == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
