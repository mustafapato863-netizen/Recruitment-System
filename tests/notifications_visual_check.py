import os
import re

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('RECRUITFLOW_WEB_URL', 'http://127.0.0.1:5198')
ARTIFACT_DIR = os.environ.get('RECRUITFLOW_BROWSER_ARTIFACTS', 'tests/artifacts/notifications-visual-check')


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
            page.goto(f'{BASE_URL}/notifications', wait_until='networkidle')
            page.get_by_role('heading', name='Notification Center').wait_for()
            assert page.locator('.rf-notification-panel').is_visible()
            assert page.locator('.rf-notification-panel__tabs .rf-source-tab').count() == 2
            assert page.locator('.rf-notification-item').count() > 0
            assert not page.get_by_text('Notifications could not be updated').is_visible()
            page.screenshot(path=f'{ARTIFACT_DIR}/notifications-{width}.png', full_page=False)

        page.get_by_role('tab', name=re.compile('Unread only')).click()
        page.wait_for_load_state('networkidle')
        assert page.locator('.rf-notification-panel__meta').get_by_text(re.compile('Showing unread updates')).is_visible()

        browser.close()

    print('Notification Center visual checks passed at 1440, 768, and 430px.')


if __name__ == '__main__':
    main()
