import os
import re

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('RECRUITFLOW_WEB_URL', 'http://127.0.0.1:5199')
ARTIFACT_DIR = os.environ.get('RECRUITFLOW_BROWSER_ARTIFACTS', 'tests/artifacts/dashboard-visual-check')


def sign_in(page) -> None:
    page.goto(f'{BASE_URL}/login', wait_until='networkidle')
    page.locator('details').click()
    page.get_by_role('button', name=re.compile('Sarah Ahmed')).click()
    page.get_by_role('button', name='Sign in').click()
    page.wait_for_url(re.compile(r'.*/$'))


def assert_dashboard_visible(page) -> None:
    page.get_by_role('heading', name=re.compile('Good morning')).wait_for()
    assert page.locator('.page').is_visible()
    assert page.get_by_text('Recruitment Pipeline Funnel', exact=True).is_visible()
    assert page.get_by_text('Hiring trend', exact=True).is_visible()
    assert page.get_by_text('Needs Attention', exact=True).is_visible()
    assert page.get_by_text('Top Openings by Progress', exact=True).is_visible()


def main() -> None:
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        sign_in(page)

        for width in (1440, 768, 430):
            page.set_viewport_size({'width': width, 'height': 1000})
            page.goto(f'{BASE_URL}/', wait_until='networkidle')
            assert_dashboard_visible(page)
            page.screenshot(path=f'{ARTIFACT_DIR}/dashboard-light-{width}.png', full_page=False)

        page.get_by_role('button', name='Switch to dark mode').click()
        page.locator('html[data-theme="dark"]').wait_for()
        for width in (1440, 430):
            page.set_viewport_size({'width': width, 'height': 1000})
            page.goto(f'{BASE_URL}/', wait_until='networkidle')
            assert_dashboard_visible(page)
            page.screenshot(path=f'{ARTIFACT_DIR}/dashboard-dark-{width}.png', full_page=False)

        browser.close()

    print('Dashboard visual checks passed in light mode at 1440, 768, and 430px, plus dark mode at 1440 and 430px.')


if __name__ == '__main__':
    main()
