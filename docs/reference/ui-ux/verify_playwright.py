"""Validate the static enterprise reference catalog and representative viewports."""

from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"


def browser_executable() -> str | None:
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    candidates = sorted(local_app_data.glob("ms-playwright/chromium-*/chrome-win64/chrome.exe"), reverse=True)
    return str(candidates[0]) if candidates else None


def main() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=browser_executable())
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto((APP / "index.html").resolve().as_uri(), wait_until="load")
        cards = page.locator(".gallery-card")
        assert cards.count() == len(manifest) == 56, f"gallery cards={cards.count()} manifest={len(manifest)}"
        for href in page.locator("a").evaluate_all("els => els.map(el => el.getAttribute('href')).filter(Boolean)"):
            assert (APP / href).resolve().exists(), f"missing link target: {href}"
        for src in page.locator("img").evaluate_all("els => els.map(el => el.getAttribute('src')).filter(Boolean)"):
            assert (APP / src).resolve().exists(), f"missing image: {src}"
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "desktop catalog overflow"

        samples = [("01_dashboard.html", 1440), ("06_vacancy_request_details.html", 1440), ("15_candidate_profile.html", 1440), ("31_hiring_case.html", 1440), ("44_design_system.html", 1440), ("44_design_system.html", 1024), ("44_design_system.html", 768), ("44_design_system.html", 375), ("45_states_feedback.html", 1440), ("46_mobile_dashboard.html", 375), ("50_dark_dashboard.html", 1440), ("51_annotated_dashboard.html", 1440), ("55_security_access.html", 1440), ("55_security_access.html", 375), ("56_guidelines.html", 1440), ("56_guidelines.html", 375)]
        for filename, width in samples:
            page.set_viewport_size({"width": width, "height": 900 if width > 375 else 812})
            page.goto((APP / "pages" / filename).resolve().as_uri(), wait_until="load")
            assert page.title(), f"missing title: {filename}"
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f"overflow in {filename} at {width}px"
        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto((APP / "pages" / "44_design_system.html").resolve().as_uri(), wait_until="load")
        primary = page.locator(".button-matrix .btn.primary").first
        assert "gradient" in primary.evaluate("el => getComputedStyle(el).backgroundImage"), "primary button gradient missing"
        primary.hover()
        assert primary.evaluate("el => getComputedStyle(el).transform !== 'none'"), "primary hover motion missing"
        assert primary.evaluate("el => getComputedStyle(el, '::after').animationName === 'buttonShine'"), "button sheen animation missing"
        assert primary.evaluate("el => getComputedStyle(el, '::after').transform !== 'none'"), "button sheen transform missing"
        loading_button = page.locator(".button-matrix .btn.primary.loading")
        assert loading_button.is_disabled(), "loading button must be disabled"
        assert loading_button.get_attribute("aria-busy") == "true", "loading button aria-busy missing"
        assert loading_button.locator(".btn-spinner").count() == 1, "loading spinner missing"
        assert loading_button.locator(".sr-only").count() == 1, "loading accessible status missing"
        assert loading_button.evaluate("el => getComputedStyle(el).minHeight") == "36px", "desktop button height contract missing"
        selected_button = page.locator(".button-matrix .btn.selected")
        assert selected_button.get_attribute("aria-pressed") == "true", "selected state aria-pressed missing"
        assert selected_button.evaluate("el => getComputedStyle(el).color") == "rgb(11, 87, 208)", "selected label contrast token missing"
        approve_button = page.locator(".button-matrix .btn.success")
        reject_button = page.locator(".button-matrix .btn.danger")
        assert approve_button.evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(21, 128, 61)", "approve fill missing"
        assert reject_button.evaluate("el => getComputedStyle(el).borderColor") == "rgb(180, 35, 24)", "reject outline missing"
        primary.focus()
        assert primary.evaluate("el => getComputedStyle(el).boxShadow !== 'none'"), "shared focus ring missing"
        assert page.locator(".button-matrix .icon-btn").evaluate("el => getComputedStyle(el).width") == "36px", "desktop icon button size contract missing"
        assert page.locator(".header .icon-btn[aria-label='Notifications'] .notification-icon").count() == 1, "notification bell icon missing"
        assert page.locator(".header .icon-btn[aria-label='Notifications'] .notification-count").count() == 1, "notification badge missing"
        assert page.locator(".field-input, .field-select, .field-textarea").count() >= 6, "field recipes missing"
        assert page.locator("label[for='demo-candidate-email']").count() == 1, "field label association missing"
        assert page.locator(".field-input[aria-invalid='true']").count() == 1, "field error semantics missing"
        assert page.locator("#demo-salary-error .field-error-icon").count() == 1, "field error icon missing"
        assert page.locator(".field-error-message .field-error-icon").count() >= 3, "critical recipe error icons missing"
        assert page.locator(".field-toggle[role='switch'][aria-checked='true']").count() == 1, "toggle semantics missing"
        assert page.locator("table.table-demo th[scope='col']").count() == 6, "table header semantics missing"
        assert page.locator("table.table-demo .table-select").count() == 4, "table selection controls missing"
        assert page.locator("table.table-demo tr[aria-selected='true']").count() == 1, "selected row semantics missing"
        assert page.locator("table.table-demo .table-action").count() == 3, "table row actions missing"
        assert page.locator("table.table-demo th[aria-sort='descending']").count() == 1, "table sort semantics missing"
        assert page.locator(".tabs-demo[role='tablist'] [role='tab']").count() == 4, "tab semantics missing"
        assert page.locator(".modal-demo[role='dialog']").count() == 1, "dialog anatomy missing"
        assert page.locator(".modal-demo .btn.danger-solid").count() == 1, "filled destructive action missing"
        assert page.locator(".toast[role='status'], .toast[role='alert']").count() == 3, "toast roles missing"
        assert page.locator("input[type='file'][aria-label='Upload CV files']").count() == 1, "upload input missing"
        assert page.locator(".timeline-demo .timeline-item").count() == 3, "timeline recipe missing"
        assert page.locator(".stepper-demo[aria-label]").count() == 1, "stepper semantics missing"
        assert page.locator(".stepper-demo .step").count() == 4, "stepper stages missing"
        assert page.locator(".stepper-demo .step.current[aria-current='step']").count() == 1, "current step semantics missing"
        assert page.locator(".stepper-mobile-demo[aria-label]").count() == 1, "mobile stepper variant missing"
        assert page.locator(".stepper-mobile-demo .stepper-mobile-item[aria-current='step']").count() == 1, "mobile current step semantics missing"
        assert page.locator(".drawer-demo[role='dialog']").count() == 1, "drawer recipe missing"
        assert page.locator(".drawer-demo .drawer-footer").count() == 1, "drawer sticky footer missing"
        assert page.locator(".picker-demo .calendar-grid[role='grid']").count() == 1, "date picker grid missing"
        assert page.locator(".picker-demo .calendar-day[aria-selected='true']").count() == 1, "date picker selection missing"
        assert page.locator(".picker-demo .timezone-badge").count() == 1, "timezone indicator missing"
        assert page.locator(".bulk-toolbar[role='region']").count() == 1, "bulk actions toolbar missing"
        assert page.locator(".dropdown-menu[role='menu'] [role='menuitem']").count() == 3, "dropdown menu semantics missing"
        assert page.locator(".pipeline-board[role='region'] .pipeline-column").count() == 5, "pipeline board five-column layout missing"
        assert page.locator(".pipeline-card[draggable='true']").count() == 6, "pipeline draggable cards missing"
        assert page.locator(".pipeline-card.neon-focus").count() == 1, "pipeline neon focus card missing"
        assert page.locator(".scorecard-demo[aria-labelledby]").count() == 1, "scorecard recipe missing"
        assert page.locator(".scorecard-demo [role='radiogroup']").count() == 2, "scorecard rating groups missing"
        assert page.locator(".recommendation-group [aria-pressed='true']").count() == 1, "scorecard recommendation missing"
        assert page.locator(".comments-thread [role='textbox'][aria-multiline='true']").count() == 1, "comment composer semantics missing"
        assert page.locator(".comment-replies .comment-item").count() == 1, "nested comment reply missing"
        assert page.locator(".comment-attachment input[type='file']").count() == 1, "comment attachment input missing"
        assert page.locator(".interview-calendar-demo[role='region']").count() == 1, "interview calendar region missing"
        assert page.locator(".interview-calendar-grid[role='grid']").count() == 1, "interview calendar grid missing"
        assert page.locator(".interview-calendar-day-header[role='columnheader']").count() == 5, "interview calendar day headers missing"
        assert page.locator(".interview-event").count() == 7, "interview calendar events missing"
        assert page.locator(".interview-event.is-conflict[aria-describedby='interview-calendar-conflict']").count() == 1, "interview calendar conflict state missing"
        assert page.locator(".interview-calendar-view-switch [aria-pressed='true']").count() == 1, "interview calendar selected view missing"
        page.goto((APP / "pages" / "55_security_access.html").resolve().as_uri(), wait_until="load")
        assert page.locator(".security-hero[role='region']").count() == 1, "security hero missing"
        assert page.locator(".security-storyline .security-story-step").count() == 5, "security story steps missing"
        assert page.locator(".security-journey-grid .security-journey-card").count() == 3, "role journey stories missing"
        assert page.locator(".security-journey-card--recruiter .security-journey-steps > li").count() == 4, "recruiter journey missing"
        assert page.locator(".security-journey-card--manager .security-journey-steps > li").count() == 4, "HR manager journey missing"
        assert page.locator(".security-journey-card--approval .security-approval-flow > li").count() == 4, "approval cycle missing"
        assert page.locator(".security-role-table tbody tr").count() == 10, "security role matrix missing"
        assert page.locator(".security-role-table th[scope='row']").count() == 10, "security role labels missing"
        assert page.locator(".security-role-table .state-masked").count() >= 3, "masked field policy missing"
        assert page.locator(".security-contract code").count() == 5, "security enforcement contract missing"
        assert page.locator(".security-check-grid > div").count() == 6, "security page handoff checklist missing"
        assert page.locator(".nav a[href='55_security_access.html']").count() == 1, "security page navigation link missing"
        page.goto((APP / "pages" / "56_guidelines.html").resolve().as_uri(), wait_until="load")
        assert page.locator(".guideline-banner[role='region']").count() == 1, "guidelines banner missing"
        assert page.locator(".guideline-pipeline[aria-label]").count() == 1, "guidelines pipeline missing"
        assert page.locator(".guideline-pipeline .guideline-stage").count() == 5, "guidelines pipeline stages missing"
        assert page.locator(".guideline-stage--recruiter .guideline-rule").count() == 2, "recruiter guide stage missing"
        assert page.locator(".guideline-stage--manager .guideline-rule").count() == 2, "HR manager guide stage missing"
        assert page.locator(".guideline-stage--approval .guideline-gates li").count() == 3, "approval cycle gates missing"
        assert page.locator(".guideline-support-grid .guideline-checklist").count() == 3, "guidelines checklists missing"
        assert page.locator(".nav a[href='56_guidelines.html']").count() == 1, "guidelines navigation link missing"
        page.goto((APP / "pages" / "44_design_system.html").resolve().as_uri(), wait_until="load")
        selected = page.locator(".demo-sidebar-item.selected")
        assert "gradient" in selected.evaluate("el => getComputedStyle(el).backgroundImage"), "sidebar selection gradient missing"
        restricted = page.locator(".demo-sidebar-item.restricted")
        assert restricted.count() == 1, "restricted sidebar item missing"
        assert restricted.locator(".demo-lock-icon svg").count() == 1, "restricted lock affordance missing"
        assert restricted.evaluate("el => getComputedStyle(el).opacity") == "1", "restricted item must not look disabled"
        neon = page.locator(".stat-sample.neon-card")
        assert "gradient" in neon.evaluate("el => getComputedStyle(el).backgroundImage"), "neon card gradient missing"
        assert neon.evaluate("el => getComputedStyle(el).boxShadow !== 'none'"), "neon card glow missing"
        loader = page.locator(".loading-state .loader")
        assert loader.count() == 1, "design-system loader missing"
        assert loader.locator(".sr-only").count() == 1, "loader accessible label missing"
        assert loader.evaluate("el => getComputedStyle(el).borderTopColor === 'rgb(29, 78, 216)'"), "loader outer token missing"
        assert loader.evaluate("el => getComputedStyle(el, '::after').borderTopColor === 'rgb(34, 211, 238)'"), "loader inner token missing"
        assert loader.evaluate("el => getComputedStyle(el).animationName === 'loaderRotation'"), "loader outer animation missing"
        assert loader.evaluate("el => getComputedStyle(el, '::after').animationName === 'loaderRotationBack'"), "loader inner animation missing"
        page.emulate_media(reduced_motion="reduce")
        assert page.locator(".motion-demo").first.evaluate("el => getComputedStyle(el).animationDuration === '0.001s'"), "reduced motion fallback missing"
        page.emulate_media(reduced_motion="no-preference")
        page.set_viewport_size({"width": 375, "height": 812})
        page.goto((APP / "pages" / "44_design_system.html").resolve().as_uri(), wait_until="load")
        assert page.locator(".button-matrix .btn.primary").first.evaluate("el => getComputedStyle(el).minHeight") == "44px", "touch button target must be 44px"
        assert page.locator(".header .icon-btn[aria-label='Notifications']").evaluate("el => getComputedStyle(el).width") == "44px", "touch notification target must be 44px"
        browser.close()
    print("reference_validation=passed")
    print("gallery_cards=56")
    print("sample_pages=16")
    print("desktop_mobile_overflow=passed")


if __name__ == "__main__":
    main()
