"""Read-only HTTP probes and isolated browser response simulations; no business writes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
import recruitflow_dual_mode_matrix as matrix

out = Path('tests/artifacts/full-audit-2026-09-08')
out.mkdir(parents=True, exist_ok=True)
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=matrix.browser_executable())
    page = browser.new_page()
    matrix.login(page)
    for endpoint in ['/tasks', '/tasks?page=-1', '/tasks?pageSize=abc', '/vacancy-requests']:
        response = page.request.get(matrix.API_URL + endpoint)
        payload = response.json()
        results[endpoint] = {'status': response.status, 'shape': list(payload.keys()) if isinstance(payload, dict) else 'array'}
    # Simulate a task-only employee profile in this browser, without modifying a user.
    profile = page.request.get(matrix.API_URL + '/auth/me').json()
    profile['roles'] = [{'id': 'audit-role', 'code': 'EMPLOYEE', 'name': 'Employee'}]
    profile['permissions'] = ['TASK_VIEW']
    page.route('**/auth/me', lambda route: route.fulfill(json=profile))
    page.goto(matrix.BASE_URL + '/', wait_until='networkidle')
    results['employee_tasks_contract'] = {
        'service_notice': page.get_by_text('Service Notice').count() > 0,
        'task_error_message': page.get_by_text('Unable to load your tasks. Please refresh.').count() > 0,
    }
    page.screenshot(path=str(out / 'employee-tasks-contract.png'), full_page=True)
    page.unroute('**/auth/me')
    page.goto(matrix.BASE_URL + '/offers/create', wait_until='networkidle')
    results['offer_create_route'] = {'url': page.url, 'headings': page.locator('h1').all_text_contents()}
    browser.close()
(out / 'targeted-probes.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results))
