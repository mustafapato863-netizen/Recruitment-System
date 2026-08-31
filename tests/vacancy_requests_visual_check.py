import os
import re

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('RECRUITFLOW_WEB_URL', 'http://127.0.0.1:5199')
ARTIFACT_DIR = os.environ.get('RECRUITFLOW_BROWSER_ARTIFACTS', 'tests/artifacts/vacancy-requests-visual-check')


def main() -> None:
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.goto(f'{BASE_URL}/login', wait_until='networkidle')
        page.locator('details').click()
        page.get_by_role('button', name=re.compile('Sarah Ahmed')).click()
        page.get_by_role('button', name='Sign in').click()
        page.wait_for_url(re.compile(r'.*/$'))

        for width in (1440, 768, 430):
            page.set_viewport_size({'width': width, 'height': 1000})
            page.goto(f'{BASE_URL}/vacancy-requests', wait_until='networkidle')
            page.get_by_role('heading', name='Vacancy Requests').wait_for()
            assert page.locator('.rf-request-overview').is_visible()
            assert page.locator('.rf-request-workspace').is_visible()
            assert page.locator('.rf-request-cell').count() > 0
            assert page.locator('th', has_text='Role & location').is_visible() or page.locator('dt', has_text='Role & location').count() > 0
            if width <= 760:
                assert page.locator('.rf-request-data .rf-responsive-data__cards').is_visible()
            page.screenshot(path=f'{ARTIFACT_DIR}/vacancy-requests-{width}.png', full_page=False)

        page.locator('[aria-label="Filter vacancy requests by status"]').select_option('Pending Approval')
        page.wait_for_timeout(250)
        assert page.locator('.rf-request-workspace__count').is_visible()

        browser.close()

    print('Vacancy Requests visual checks passed at 1440, 768, and 430px.')


if __name__ == '__main__':
    main()
