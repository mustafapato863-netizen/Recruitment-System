import os
import re

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('RECRUITFLOW_WEB_URL', 'http://127.0.0.1:5187')
ARTIFACT_DIR = os.environ.get('RECRUITFLOW_BROWSER_ARTIFACTS', 'tests/artifacts/sidebar-visual-check')


def check_sidebar(page, width: int) -> None:
    page.set_viewport_size({'width': width, 'height': 900})
    page.goto(f'{BASE_URL}/', wait_until='networkidle')
    page.locator('.sidebar').wait_for(state='attached')

    if width <= 860:
        page.get_by_role('button', name='Open navigation menu').click()
        page.locator('.sidebar.mobile-active').wait_for(state='visible')
        page.wait_for_timeout(280)
        assert page.locator(".header .rf-icon-button[class~='lg:hidden']").is_visible()
        assert page.locator(".sidebar .sidebar-collapse[class~='lg:hidden']").is_visible()
        assert not page.locator(".sidebar .sidebar-collapse[class~='hidden'][class~='lg:flex']").is_visible()
    else:
        sidebar = page.locator('.sidebar')
        assert sidebar.bounding_box()['width'] >= 240
        assert not page.locator(".header .rf-icon-button[class~='lg:hidden']").is_visible()
        assert not page.locator(".sidebar .sidebar-collapse[class~='lg:hidden']").is_visible()
        assert page.locator(".sidebar .sidebar-collapse[class~='hidden'][class~='lg:flex']").is_visible()

    assert page.locator('.brand-home').get_by_text('RecruitFlow').is_visible()
    assert page.get_by_text('Command Center', exact=True).is_visible()
    assert page.get_by_role('link', name='Dashboard').get_attribute('class').find('active') >= 0
    assert page.locator('.nav a').count() >= 10

    page.screenshot(path=f'{ARTIFACT_DIR}/sidebar-{width}.png', full_page=False)


def check_collapsed_sidebar(page) -> None:
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{BASE_URL}/', wait_until='networkidle')
    page.get_by_role('button', name='Collapse sidebar').click()
    page.locator('.app.is-sidebar-collapsed').wait_for(state='attached')
    page.wait_for_timeout(220)

    assert page.locator('.sidebar .nav a').count() >= 10
    assert page.locator('.sidebar .nav a .ico').first.is_visible()
    assert page.get_by_role('link', name='Dashboard').get_attribute('class').find('active') >= 0
    toggle = page.get_by_role('button', name='Expand sidebar')
    assert toggle.is_visible()
    toggle_box = toggle.bounding_box()
    sidebar_box = page.locator('.sidebar').bounding_box()
    assert toggle_box['x'] + toggle_box['width'] <= sidebar_box['x'] + sidebar_box['width'] + 1
    page.screenshot(path=f'{ARTIFACT_DIR}/sidebar-collapsed.png', full_page=False)


def main() -> None:
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(f'{BASE_URL}/login', wait_until='networkidle')
        page.locator('details').click()
        page.get_by_role('button', name=re.compile('Sarah Ahmed')).click()
        page.get_by_role('button', name='Sign in').click()
        page.wait_for_url(re.compile(r'.*/$'))
        page.wait_for_load_state('networkidle')

        for width in (1440, 1024, 768, 592, 430):
            check_sidebar(page, width)

        check_collapsed_sidebar(page)

        browser.close()

    print('Sidebar visual checks passed at 1440, 1024, 768, 592, 430px, and collapsed desktop mode.')


if __name__ == '__main__':
    main()
