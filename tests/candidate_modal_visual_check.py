import os
import re

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('RECRUITFLOW_WEB_URL', 'http://127.0.0.1:5199')
ARTIFACT_DIR = os.environ.get('RECRUITFLOW_BROWSER_ARTIFACTS', 'tests/artifacts/candidate-modal-visual-check')


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
            page.goto(f'{BASE_URL}/candidates', wait_until='networkidle')
            page.get_by_role('heading', name='Candidate Database').wait_for()
            page.get_by_role('button', name='Add candidate', exact=True).click()

            dialog = page.get_by_role('dialog', name='Add New Candidate')
            dialog.wait_for()
            page.wait_for_timeout(250)
            dialog_box = dialog.bounding_box()
            assert dialog_box is not None
            assert dialog_box['y'] >= 0
            assert dialog_box['y'] + dialog_box['height'] <= 1000, dialog_box
            assert dialog.get_by_role('heading', name='Create a candidate record').is_visible()
            assert dialog.get_by_role('heading', name='Identity & contact').is_visible()
            assert dialog.get_by_role('heading', name='Professional context').is_visible()
            assert dialog.get_by_role('button', name='Create Candidate').is_visible()
            page.screenshot(path=f'{ARTIFACT_DIR}/candidate-modal-{width}.png', full_page=False)
            page.get_by_role('button', name='Close dialog').click()

        page.goto(f'{BASE_URL}/candidates', wait_until='networkidle')
        page.get_by_role('button', name='Switch to dark mode').click()
        page.locator('html[data-theme="dark"]').wait_for()
        page.get_by_role('button', name='Add candidate', exact=True).click()
        page.get_by_role('dialog', name='Add New Candidate').wait_for()
        page.wait_for_timeout(300)
        page.screenshot(path=f'{ARTIFACT_DIR}/candidate-modal-dark.png', full_page=False)

        browser.close()

    print('Add Candidate modal visual checks passed at 1440, 768, 430px, and dark mode.')


if __name__ == '__main__':
    main()
