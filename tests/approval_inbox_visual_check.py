import os
import re

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('RECRUITFLOW_WEB_URL', 'http://127.0.0.1:5199')
ARTIFACT_DIR = os.environ.get('RECRUITFLOW_BROWSER_ARTIFACTS', 'tests/artifacts/approval-inbox-visual-check')


def main() -> None:
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.goto(f'{BASE_URL}/login', wait_until='networkidle')
        page.locator('details').click()
        page.get_by_role('button', name=re.compile('Ahmed Mahmoud')).click()
        page.get_by_role('button', name='Sign in').click()
        page.wait_for_url(re.compile(r'.*/$'))

        for width in (1440, 768, 430):
            page.set_viewport_size({'width': width, 'height': 1000})
            page.goto(f'{BASE_URL}/approval-inbox', wait_until='networkidle')
            page.get_by_role('heading', name='Universal Approval Inbox').wait_for()
            assert page.locator('.rf-approval-inbox-page').is_visible()
            assert page.locator('.rf-approval-overview').is_visible()
            assert page.locator('.rf-approval-workspace').is_visible()
            assert page.locator('.rf-approval-card').count() > 0
            assert page.get_by_role('button', name=re.compile('Approve')).count() > 0
            if width <= 760:
                assert page.locator('.rf-approval-workspace > .rf-source-tabs').is_visible()
            page.screenshot(path=f'{ARTIFACT_DIR}/approval-inbox-{width}.png', full_page=False)

        page.get_by_role('tab', name=re.compile('Offer Approvals')).click()
        page.wait_for_timeout(250)
        assert page.locator('.rf-approval-card--offer').count() > 0

        page.get_by_role('tab', name=re.compile('Final Hires')).click()
        page.wait_for_timeout(250)
        assert page.locator('.rf-approval-card--hire').count() > 0

        browser.close()

    print('Approval Inbox visual checks passed at 1440, 768, and 430px.')


if __name__ == '__main__':
    main()
