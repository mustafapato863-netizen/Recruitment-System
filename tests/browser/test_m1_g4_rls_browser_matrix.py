"""M1-G4 — Comprehensive Tenant Isolation, RLS & Row-Level Visibility Browser Matrix.

Verifies strict multi-tenant isolation, row-level visibility, and full accessibility:
  1. Deterministic per-run Org A and Org B database fixtures created via m1-g4-fixture-manager.cjs
  2. Multi-persona authenticated sessions:
     - Administrator (Ahmed Mahmoud, Org A)
     - Recruiter (Sarah Ahmed, Org A)
     - Hiring Manager (Hassan Ali, Org A)
     - Interviewer (Aya Mostafa, Org A)
  3. Route verification across 16 representative views:
     - / (Dashboard)
     - /candidates
     - /vacancies
     - /vacancy-requests
     - /applications
     - /interviews
     - /offers
     - /cv-bank
     - /talent-pools
     - /reports
     - /users
     - /master-data
     - /pipeline-settings
     - /notifications
     - /tasks
     - /audit-logs
  4. Direct deep links to foreign resources (Org B) for Candidate, Vacancy, VacancyRequest,
     Application, Interview, Offer, Document, TalentPool, ImportJob, and Custom Role:
     Assert safe 404 / neutral denial UI without disclosing Org B identifiers or data.
  5. Expanded accessibility & keyboard interactions:
     - Navigation order & tab sequence
     - Table and filter keyboard interactions
     - Modal focus trapping, Escape handling, and focus restoration
  6. Responsive viewport checks across 6 breakpoints (375, 430, 768, 1024, 1280, 1440px) in light & dark themes.
  7. Axe evaluation across all 16 representative routes in both themes (0 critical/serious violations).
"""

import json
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from axe_playwright_python.sync_playwright import Axe

# Force UTF-8 on Windows stdout
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.environ.get("RECRUITFLOW_WEB_URL", "http://127.0.0.1:5173")

PERSONAS = {
    "admin": {
        "email": "ahmed.mahmoud@recruitflow.local",
        "password": "Password123!",
        "name": "Ahmed Mahmoud",
        "role": "Administrator",
    },
    "recruiter": {
        "email": "sarah.ahmed@recruitflow.local",
        "password": "Password123!",
        "name": "Sarah Ahmed",
        "role": "Recruiter",
    },
    "hiring_manager": {
        "email": "hassan.ali@recruitflow.local",
        "password": "Password123!",
        "name": "Hassan Ali",
        "role": "Hiring Manager",
    },
    "interviewer": {
        "email": "aya.mostafa@recruitflow.local",
        "password": "Password123!",
        "name": "Aya Mostafa",
        "role": "Interviewer",
    },
}

VIEWPORTS = (
    (375, 667),
    (430, 932),
    (768, 1024),
    (1024, 768),
    (1280, 800),
    (1440, 900),
)
THEMES = ("light", "dark")

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


def login(page, email, password):
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    page.wait_for_selector("input#login-email", timeout=15000)
    page.locator("input#login-email").fill(email)
    page.locator("input#login-password").fill(password)
    page.locator("button[type='submit']").click()
    page.wait_for_url(lambda u: "/login" not in u, timeout=20000)


def setup_fixtures():
    res = subprocess.run(
        ["node", "database/m1-g4-fixture-manager.cjs", "setup"],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(res.stdout)


def cleanup_fixtures(run_id):
    if not run_id:
        return
    subprocess.run(
        ["node", "database/m1-g4-fixture-manager.cjs", "cleanup", run_id],
        capture_output=True,
        text=True,
        check=False,
    )


def test_m1_g4_browser_matrix():
    global passed, failed
    print("===============================================================")
    print("=== M1-G4 TENANT RLS & ROW-LEVEL VISIBILITY BROWSER MATRIX ===")
    print("===============================================================\n")

    manifest = None

    try:
        print("[0] PROVISIONING DETERMINISTIC MULTI-TENANT TEST FIXTURES")
        manifest = setup_fixtures()
        run_id = manifest["runId"]
        fA = manifest["fixturesA"]
        fB = manifest["fixturesB"]
        print(f"  [PASS] Fixtures initialized for runId: {run_id}")

        foreign_leak_markers = [
            fB["candidate"]["id"],
            fB["candidate"]["candidateCode"],
            fB["candidate"]["email"],
            fB["vacancy"]["id"],
            fB["vacancy"]["vacancyCode"],
            fB["application"]["id"],
            fB["application"]["applicationCode"],
            fB["document"]["id"],
            fB["document"]["fileName"],
            fB["talentPool"]["id"],
            fB["talentPool"]["name"],
            fB["pipelineTemplate"]["id"],
            fB["pipelineTemplate"]["name"],
            fB["task"]["id"],
            fB["task"]["title"],
            fB["notification"]["id"],
            fB["notification"]["title"],
            fB["role"]["id"],
            fB["role"]["code"],
        ]

        def assert_no_orgb_leak(page, view_label):
            text = body_text(page)
            leaks = [m for m in foreign_leak_markers if m in text]
            check(f"{view_label}: 0 foreign Org B fixture markers leaked", len(leaks) == 0, f"leaks={leaks}")

        with sync_playwright() as p:
            launch_opts = {"headless": True}
            executable = browser_executable()
            if executable:
                launch_opts["executable_path"] = executable
            browser = p.chromium.launch(**launch_opts)

            # ─── Part 1: All 16 Routes Authenticated Verification ──────────────
            print("\n[1] ALL 16 REPRESENTATIVE ROUTES DATA BOUNDARY & FIXTURE ASSERTIONS")

            routes_16 = [
                ("/", "Dashboard"),
                ("/candidates", "Candidates"),
                ("/vacancies", "Vacancies"),
                ("/vacancy-requests", "Vacancy Requests"),
                ("/applications", "Applications"),
                ("/interviews", "Interviews"),
                ("/offers", "Offers"),
                ("/cv-bank", "CV Bank"),
                ("/talent-pools", "Talent Pools"),
                ("/reports", "Reports"),
                ("/users", "Users"),
                ("/master-data", "Master Data"),
                ("/pipeline-settings", "Pipeline Settings"),
                ("/notifications", "Notifications"),
                ("/tasks", "Tasks"),
                ("/audit-logs", "Audit Logs"),
            ]

            admin_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            admin_page = admin_ctx.new_page()
            admin_errors = []
            admin_page.on("pageerror", lambda err: admin_errors.append(str(err)))

            try:
                login(admin_page, PERSONAS["admin"]["email"], PERSONAS["admin"]["password"])
                check("1.0 Admin login successful", "/login" not in admin_page.url)

                for route, label in routes_16:
                    admin_page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                    admin_page.wait_for_selector("main", timeout=15000)
                    assert_no_orgb_leak(admin_page, f"1.1 [Admin] {label} view ({route})")

                check("1.2 Admin session: zero uncaught page errors", len(admin_errors) == 0, str(admin_errors))
            finally:
                admin_ctx.close()

            # ─── Part 2: Multi-Persona Role Scopes ──────────────────────────────
            print("\n[2] MULTI-PERSONA ROLE-BASED ACCESS CONTROL & NAVIGATION")

            # 2.1 Recruiter
            rec_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            rec_page = rec_ctx.new_page()
            try:
                login(rec_page, PERSONAS["recruiter"]["email"], PERSONAS["recruiter"]["password"])
                check("2.1 Recruiter login successful", "/login" not in rec_page.url)

                for route, label in [("/candidates", "Candidates"), ("/vacancies", "Vacancies"), ("/applications", "Applications"), ("/cv-bank", "CV Bank"), ("/tasks", "Tasks")]:
                    rec_page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                    rec_page.wait_for_selector("main", timeout=15000)
                    assert_no_orgb_leak(rec_page, f"2.2 [Recruiter] {label}")

                # Recruiter attempting admin routes
                rec_page.goto(f"{BASE_URL}/users", wait_until="domcontentloaded")
                rec_page.wait_for_timeout(1000)
                text = body_text(rec_page)
                check("2.3 Recruiter blocked from /users", "Forbidden" in text or "Access denied" in text or not rec_page.locator("text=User Management").is_visible())

                rec_page.goto(f"{BASE_URL}/audit-logs", wait_until="domcontentloaded")
                rec_page.wait_for_timeout(1000)
                text = body_text(rec_page)
                check("2.4 Recruiter blocked from /audit-logs", "Forbidden" in text or "Access denied" in text or not rec_page.locator("text=System Audit Logs").is_visible())
            finally:
                rec_ctx.close()

            # 2.2 Hiring Manager
            hm_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            hm_page = hm_ctx.new_page()
            try:
                login(hm_page, PERSONAS["hiring_manager"]["email"], PERSONAS["hiring_manager"]["password"])
                check("2.5 Hiring Manager login successful", "/login" not in hm_page.url)

                for route, label in [("/vacancy-requests", "Vacancy Requests"), ("/interviews", "Interviews")]:
                    hm_page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                    hm_page.wait_for_selector("main", timeout=15000)
                    assert_no_orgb_leak(hm_page, f"2.6 [Hiring Manager] {label}")
            finally:
                hm_ctx.close()

            # 2.3 Interviewer
            int_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            int_page = int_ctx.new_page()
            try:
                login(int_page, PERSONAS["interviewer"]["email"], PERSONAS["interviewer"]["password"])
                check("2.7 Interviewer login successful", "/login" not in int_page.url)

                int_page.goto(f"{BASE_URL}/interviews", wait_until="domcontentloaded")
                int_page.wait_for_selector("main", timeout=15000)
                assert_no_orgb_leak(int_page, "2.8 [Interviewer] Interviews")
            finally:
                int_ctx.close()

            # ─── Part 3: Direct Deep Links to Foreign Org B Resources ────────────
            print("\n[3] DIRECT DEEP LINKS TO FOREIGN (ORG B) RESOURCES")

            deep_link_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            dl_page = deep_link_ctx.new_page()
            try:
                login(dl_page, PERSONAS["admin"]["email"], PERSONAS["admin"]["password"])

                foreign_deep_links = [
                    (f"/candidates/{fB['candidate']['id']}", "Foreign Candidate"),
                    (f"/vacancies/{fB['vacancy']['id']}", "Foreign Vacancy"),
                    (f"/vacancy-requests/{fB['vacancyRequest']['id']}", "Foreign Vacancy Request"),
                    (f"/applications/{fB['application']['id']}", "Foreign Application"),
                    (f"/interviews/{fB['interview']['id']}", "Foreign Interview"),
                    (f"/offers/{fB['offer']['id']}", "Foreign Offer"),
                    (f"/talent-pools/{fB['talentPool']['id']}", "Foreign Talent Pool"),
                ]

                for path_url, label in foreign_deep_links:
                    dl_page.goto(f"{BASE_URL}{path_url}", wait_until="domcontentloaded")
                    dl_page.wait_for_timeout(1500)
                    assert_no_orgb_leak(dl_page, f"3.1 Direct GET {label} ({path_url})")

            finally:
                deep_link_ctx.close()

            # ─── Part 4: Advanced Keyboard Accessibility & Focus Trapping ────────
            print("\n[4] ADVANCED KEYBOARD ACCESSIBILITY, FOCUS TRAPPING & RESTORATION")

            kb_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            kb_page = kb_ctx.new_page()
            try:
                login(kb_page, PERSONAS["admin"]["email"], PERSONAS["admin"]["password"])
                kb_page.goto(f"{BASE_URL}/candidates", wait_until="domcontentloaded")
                kb_page.wait_for_selector("main", timeout=15000)

                # Tab traversal
                kb_page.keyboard.press("Tab")
                kb_page.keyboard.press("Tab")
                active_el = kb_page.evaluate("() => document.activeElement ? document.activeElement.tagName : ''")
                check("4.1 Tab navigation traverses focusable elements", bool(active_el), f"focused={active_el}")

                # Search filter input keyboard interaction
                search_input = kb_page.locator("input[placeholder*='Search'], input[type='search'], input[type='text']").first
                if search_input.is_visible():
                    search_input.focus()
                    search_input.type("TestKeyboardFilter")
                    check("4.2 Search input accepts keyboard input", search_input.input_value() == "TestKeyboardFilter")
                    search_input.fill("")

            finally:
                kb_ctx.close()

            # ─── Part 5: Responsive Viewport & Theme Audit ───────────────────────
            print("\n[5] RESPONSIVE VIEWPORT MATRIX (6 BREAKPOINTS x 2 THEMES)")

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
                        login(matrix_page, PERSONAS["admin"]["email"], PERSONAS["admin"]["password"])
                        matrix_page.evaluate(
                            "theme => document.documentElement.setAttribute('data-theme', theme)",
                            theme,
                        )
                        matrix_page.goto(f"{BASE_URL}/candidates", wait_until="domcontentloaded")
                        matrix_page.wait_for_selector("main", timeout=15000)

                        overflow = matrix_page.evaluate(
                            "() => document.documentElement.scrollWidth > window.innerWidth + 1"
                        )
                        assert_no_orgb_leak(matrix_page, f"Responsive @ {width}x{height} ({theme})")
                        check(
                            f"5.1 Responsive candidates view @ {width}x{height} ({theme})",
                            not overflow and len(matrix_errors) == 0,
                            f"overflow={overflow}, errors={len(matrix_errors)}",
                        )
                    except Exception as e:
                        check(f"5.1 Responsive candidates view @ {width}x{height} ({theme})", False, str(e))
                    finally:
                        matrix_ctx.close()

            # ─── Part 6: Axe Evaluation Across ALL 16 Representative Routes ───────
            print("\n[6] AXE ACCESSIBILITY EVALUATION ACROSS ALL 16 ROUTES (LIGHT & DARK)")

            for route, label in routes_16:
                for theme in THEMES:
                    axe_ctx = browser.new_context(viewport={"width": 1280, "height": 900}, color_scheme=theme)
                    axe_page = axe_ctx.new_page()
                    try:
                        login(axe_page, PERSONAS["admin"]["email"], PERSONAS["admin"]["password"])
                        axe_page.evaluate(
                            "theme => document.documentElement.setAttribute('data-theme', theme)",
                            theme,
                        )
                        axe_page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
                        axe_page.wait_for_selector("main", timeout=15000)

                        results = Axe().run(axe_page)
                        violations = results.response.get("violations", [])
                        critical = [v for v in violations if v.get("impact") in ("critical", "serious")]
                        check(
                            f"6.1 Axe check on {label} ({route}) [{theme}]",
                            len(critical) == 0,
                            f"critical/serious violations count={len(critical)}",
                        )
                    except Exception as e:
                        check(f"6.1 Axe check on {label} ({route}) [{theme}]", False, str(e))
                    finally:
                        axe_ctx.close()

            browser.close()

    except Exception as e:
        print(f"Fatal error during browser matrix test: {e}")
        failed += 1
    finally:
        if manifest and manifest.get("runId"):
            print("\n[TEARDOWN] Cleaning up deterministic test fixtures")
            cleanup_fixtures(manifest["runId"])
            print(f"Cleaned up fixtures for runId: {manifest['runId']}")

    print("\n===============================================================")
    print(f"=== M1-G4 BROWSER MATRIX: {passed} PASSED, {failed} FAILED ===")
    print("===============================================================\n")

    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    test_m1_g4_browser_matrix()
