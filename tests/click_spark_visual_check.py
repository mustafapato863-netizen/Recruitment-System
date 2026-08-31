import os
import re

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('RECRUITFLOW_WEB_URL', 'http://127.0.0.1:5199')
ARTIFACT_DIR = os.environ.get('RECRUITFLOW_BROWSER_ARTIFACTS', 'tests/artifacts/click-spark-visual-check')


def main() -> None:
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.goto(f'{BASE_URL}/login', wait_until='networkidle')
        canvas = page.locator('.rf-login-click-spark canvas')
        assert canvas.count() == 1
        assert (canvas.bounding_box() or {}).get('width', 0) > 0
        page.screenshot(path=f'{ARTIFACT_DIR}/login.png', full_page=False)

        page.locator('details').click()
        page.get_by_role('button', name=re.compile('Sarah Ahmed')).click()
        page.get_by_role('button', name='Sign in').click()
        page.wait_for_url(re.compile(r'.*/$'))
        page.wait_for_load_state('networkidle')
        page.goto(f'{BASE_URL}/notifications', wait_until='networkidle')
        page.get_by_role('heading', name='Notification Center').wait_for()
        assert page.locator('.app').is_visible()
        canvas = page.locator('.rf-notification-click-spark canvas')
        assert canvas.count() == 1
        assert (canvas.bounding_box() or {}).get('width', 0) > 0
        page.screenshot(path=f'{ARTIFACT_DIR}/notifications.png', full_page=False)

        browser.close()

    print('ClickSpark visual checks passed on login and Notification Center only.')


if __name__ == '__main__':
    main()
