import os
import re

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('RECRUITFLOW_WEB_URL', 'http://127.0.0.1:5199')
ARTIFACT_DIR = os.environ.get('RECRUITFLOW_BROWSER_ARTIFACTS', 'tests/artifacts/create-vacancy-request-visual-check')


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
            page.goto(f'{BASE_URL}/vacancy-requests/create', wait_until='networkidle')
            page.get_by_role('heading', name='Create Vacancy Request').wait_for()
            assert page.locator('.rf-create-vacancy-page').is_visible()
            assert page.locator('.rf-request-wizard').is_visible()
            assert page.locator('.rf-request-form-section').count() == 2
            assert page.locator('.rf-request-readiness').is_visible()
            assert page.get_by_role('button', name='Submit for Approval').is_visible()
            page.screenshot(path=f'{ARTIFACT_DIR}/create-vacancy-request-{width}.png', full_page=False)

        browser.close()

    print('Create Vacancy Request visual checks passed at 1440, 768, and 430px.')


if __name__ == '__main__':
    main()
