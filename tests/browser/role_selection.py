"""Local-only role checkbox layout regression with mocked API data."""
import re
from playwright.sync_api import sync_playwright, expect


def respond(route):
    path = route.request.url.split('/api/v1')[-1].split('?')[0]
    data = []
    if path == '/auth/me':
        data = dict(id='test-admin', email='admin@example.test', displayName='Test Admin',
                    permissions=['USERS_MANAGE', 'USERS_VIEW'],
                    roles=[dict(id='admin', code='ADMINISTRATOR', name='Administrator')])
    elif path == '/roles/permissions':
        data = [dict(id=f'p{i}', code=f'PERMISSION_{i}', name=f'Permission {i}') for i in range(30)]
    elif path == '/access-control/navigation':
        data = [dict(key=f'page{i}', label=f'Page {i}', route=f'/page{i}', group='Workspace', visible=False) for i in range(24)]
    route.fulfill(json=data)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in [1300, 390]:
        page = browser.new_page(viewport=dict(width=width, height=960))
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/api/v1/**', respond)
        page.goto('http://127.0.0.1:5193/users')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name=re.compile('Create role', re.I)).first.click()
        dialog = page.get_by_role('dialog', name='Create role and access')
        for title in ['Step 2 · Permissions', 'Step 3 · Sidebar pages']:
            section = dialog.locator('section').filter(has=page.get_by_role('heading', name=title))
            section.get_by_role('button', name='Select all', exact=True).click()
            labels = section.locator('.rf-checkbox-field')
            for index in [0, 8, 15]:
                label = labels.nth(index)
                label.scroll_into_view_if_needed()
                label.click()
                expect(label.locator('input')).not_to_be_checked()
                # Focusing the hidden input must not scroll the entire dialog shell.
                assert dialog.evaluate('(el) => el.scrollTop') == 0, 'Checkbox focus scrolled dialog shell'
                label.click()
                expect(label.locator('input')).to_be_checked()
        assert not errors, errors
        print(f'PASS: select all / individual deselection at {width}px')
        page.close()
    browser.close()
