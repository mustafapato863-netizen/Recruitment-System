import os
import time
import glob
import shutil
from playwright.sync_api import sync_playwright

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'client_snapshots')
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_URL = 'http://127.0.0.1:5173'

def run():
    # Clean previous screenshots
    for f in glob.glob(os.path.join(OUTPUT_DIR, '*.png')):
        try:
            os.remove(f)
        except Exception:
            pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Desktop viewport: 1440x900, deviceScaleFactor 2 for crisp, high-res presentation
        context = browser.new_context(
            viewport={'width': 1440, 'height': 900},
            device_scale_factor=2,
        )
        page = context.new_page()

        print("1. Capturing Sign In Page...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_selector('#login-email', timeout=15000)
        time.sleep(1)
        page.screenshot(path=os.path.join(OUTPUT_DIR, '01_login_page.png'), full_page=True)

        print("2. Authenticating as Administrator...")
        page.fill('#login-email', 'ahmed.mahmoud@recruitflow.local')
        page.fill('#login-password', 'Password123!')
        page.locator('form').evaluate('form => form.requestSubmit()')
        
        page.wait_for_url(f"{BASE_URL}/", timeout=15000)
        time.sleep(2)
        print(f"   Authenticated. Current URL: {page.url}")

        snapshots = [{
            'file': '01_login_page.png',
            'title': 'Sign In / Authentication',
            'category': 'Authentication',
            'path': '/login',
            'description': 'Clean authentication screen with persona selector, secure password toggle, and enterprise validation.'
        }]

        def capture(filename, path, title, category, description, action=None, wait_sec=1.5):
            print(f"Capturing: [{category}] {title} ({path})...")
            try:
                if path:
                    page.goto(f"{BASE_URL}{path}")
                    time.sleep(wait_sec)
                
                if page.url.endswith('/login'):
                    print(f"   WARNING: Redirected to login on {path}")
                    return

                if action:
                    try:
                        action(page)
                        time.sleep(1.0)
                    except Exception as act_err:
                        print(f"   Action execution note: {act_err}")

                filepath = os.path.join(OUTPUT_DIR, filename)
                page.screenshot(path=filepath, full_page=True)
                snapshots.append({
                    'file': filename,
                    'title': title,
                    'category': category,
                    'path': path or page.url.replace(BASE_URL, ''),
                    'description': description
                })
                print(f"   Saved -> {filename}")
            except Exception as e:
                print(f"   Error capturing {title}: {e}")

        # ─── 1. CORE DASHBOARD & NAVIGATION ──────────────────────────
        capture('02_dashboard.png', '/', 'Executive Dashboard', 'Executive Overview', 'Executive recruitment metrics, KPI summary, and active pipeline funnel.')
        capture('03_tasks.png', '/tasks', 'Assigned Tasks & SLAs', 'Workflow', 'Active task assignments, SLAs, priority tags, and work items.')
        capture('04_notifications.png', '/notifications', 'Notifications Center', 'Workflow', 'System notifications, workflow updates, and alert ledger.')
        
        # Header Shell Overlays
        capture('05_header_quick_create_menu.png', '/', 'Quick Create Action Menu', 'Shell & Navigation', 'Instant quick-action menu for creating requisitions, adding candidates, scheduling interviews, and making offers.',
                action=lambda p: p.click('button:has-text("New"), button[aria-label*="Create"], button:has-text("Quick Create")'))
        
        # ─── 2. VACANCY REQUESTS & APPROVALS ─────────────────────────
        capture('06_vacancy_requests.png', '/vacancy-requests', 'Vacancy Requests Directory', 'Requisitions', 'Requisitions list with status badges, budget criticality, and target headcount.')
        capture('07_create_vacancy_request.png', '/vacancy-requests/create', 'Create Vacancy Request Wizard', 'Requisitions', '5-step requisition wizard with dynamic branch and position dropdown selection.')
        capture('08_approval_inbox_requests.png', '/approval-inbox', 'Approval Inbox (Vacancy Requests Tab)', 'Approvals', 'Requisition approval inbox with pending approvals, justification notes, and decisions.')
        
        # ─── 3. VACANCIES & PIPELINE DETAILS ─────────────────────────
        capture('09_vacancies_list.png', '/vacancies', 'Vacancies Directory', 'Vacancies', 'Active open positions and approved vs joined headcount tracking.')
        
        # Query live IDs for detail pages
        print("\n--- Fetching live entity IDs for detail sub-views ---")
        vac_data = page.evaluate('() => fetch("/api/v1/vacancies").then(r => r.json()).catch(() => null)')
        cand_data = page.evaluate('() => fetch("/api/v1/candidates").then(r => r.json()).catch(() => null)')
        app_data = page.evaluate('() => fetch("/api/v1/applications").then(r => r.json()).catch(() => null)')
        int_data = page.evaluate('() => fetch("/api/v1/interviews").then(r => r.json()).catch(() => null)')
        off_data = page.evaluate('() => fetch("/api/v1/offers").then(r => r.json()).catch(() => null)')
        req_data = page.evaluate('() => fetch("/api/v1/vacancy-requests").then(r => r.json()).catch(() => null)')

        # Vacancy Detail Sub-Tabs
        if vac_data and len(vac_data) > 0:
            v_id = vac_data[0]['id']
            capture('10_vacancy_detail_overview.png', f"/vacancies/{v_id}", 'Vacancy Overview (Overview Tab)', 'Vacancies', 'Detailed position view with visual stage distribution funnel and headcount progress.',
                    action=lambda p: p.click('button:has-text("Overview")'))
            capture('11_vacancy_detail_candidates_tab.png', f"/vacancies/{v_id}", 'Vacancy Overview (Candidates Tab)', 'Vacancies', 'Direct listing of all active applicants currently evaluated for this vacancy.',
                    action=lambda p: p.click('button:has-text("Candidates")'))
            capture('12_vacancy_detail_pipeline_tab.png', f"/vacancies/{v_id}", 'Vacancy Overview (Pipeline Tab)', 'Vacancies', 'Stage breakdown showing applicant counts across all active recruitment gates.',
                    action=lambda p: p.click('button:has-text("Pipeline")'))
            capture('13_vacancy_detail_interviews_tab.png', f"/vacancies/{v_id}", 'Vacancy Overview (Interviews Tab)', 'Vacancies', 'All scheduled and completed interview evaluations for this requisition.',
                    action=lambda p: p.click('button:has-text("Interviews")'))
            capture('14_vacancy_detail_offers_tab.png', f"/vacancies/{v_id}", 'Vacancy Overview (Offers Tab)', 'Vacancies', 'Offer packages created and pending acceptance for this requisition.',
                    action=lambda p: p.click('button:has-text("Offers")'))

        # ─── 4. CANDIDATE DIRECTORY & PROFILE TABS ───────────────────
        capture('15_candidates_directory.png', '/candidates', 'Candidates Directory', 'Candidates', 'Searchable candidate directory with contact details, current role, and source tags.')
        capture('16_candidates_add_modal.png', '/candidates', 'Add Candidate Modal', 'Candidates', 'Direct candidate intake dialog with contact info, current role, and sourcing channel.',
                action=lambda p: p.click('button:has-text("Add Candidate"), button:has-text("New Candidate")'))

        if cand_data and cand_data.get('data') and len(cand_data['data']) > 0:
            c_id = cand_data['data'][0]['id']
            capture('17_candidate_profile_overview.png', f"/candidates/{c_id}", 'Candidate Profile (Overview Tab)', 'Candidates', 'Comprehensive candidate overview with contact details, resume highlights, and active status.',
                    action=lambda p: p.click('button:has-text("Overview")'))
            capture('18_candidate_profile_applications_tab.png', f"/candidates/{c_id}", 'Candidate Profile (Applications Tab)', 'Candidates', 'Application history and current active vacancy applications.',
                    action=lambda p: p.click('button:has-text("Applications")'))
            capture('19_candidate_profile_documents_tab.png', f"/candidates/{c_id}", 'Candidate Profile (Documents Tab)', 'Candidates', 'Vault metadata showing resumes, certificates, and compliance attachments.',
                    action=lambda p: p.click('button:has-text("Documents")'))
            capture('20_candidate_profile_activity_tab.png', f"/candidates/{c_id}", 'Candidate Profile (Activity Timeline Tab)', 'Candidates', 'Chronological audit trail of all recruiter actions and stage transitions.',
                    action=lambda p: p.click('button:has-text("Activity")'))
            capture('21_candidate_apply_modal.png', f"/candidates/{c_id}", 'Candidate Apply to Vacancy Modal', 'Candidates', 'Dialog to attach candidate to an open requisition.',
                    action=lambda p: (p.click('button:has-text("Applications")'), time.sleep(0.5), p.click('button:has-text("Apply to vacancy")')))
            capture('22_candidate_document_vault.png', f"/candidates/{c_id}/documents", 'Candidate Document Vault', 'Candidates', 'Candidate documents management and metadata vault interface.')

        # ─── 5. TALENT POOLS & CV INTAKE ─────────────────────────────
        capture('23_talent_pool.png', '/talent-pool', 'Talent Pools & Benchmarks', 'Talent Pool', 'Curated candidate talent pools and benchmark groups for future hiring.')
        capture('24_cv_intake_upload.png', '/cv-intake', 'CV & Resume Intake Engine', 'CV Intake', 'AI resume parser dropzone supporting PDF, Word, and text parsing.')

        # ─── 6. APPLICATIONS PIPELINE & STAGE DETAILS ────────────────
        capture('25_applications_kanban.png', '/applications', 'Application Pipeline (Kanban View)', 'Pipeline', 'Visual recruitment workflow board from Applied, Screening, Interview, Offer, Pre-Hire to Joined.')

        if app_data and app_data.get('data') and len(app_data['data']) > 0:
            a_id = app_data['data'][0]['id']
            capture('26_application_detail.png', f"/applications/{a_id}", 'Application Lifecycle & Stepper', 'Pipeline', 'Detailed application lifecycle view with visual stepper and phone screening evaluation.')

        # ─── 7. INTERVIEWS & SCORECARDS ──────────────────────────────
        capture('27_interviews_list.png', '/interviews', 'Interviews Overview', 'Interviews', 'Scheduled, completed, and pending interview sessions.')
        capture('28_interview_schedule_modal.png', '/interviews', 'Schedule Interview Modal', 'Interviews', 'Dialog for scheduling interview with interviewers multi-select, date/time, and meeting link.',
                action=lambda p: p.click('button:has-text("Schedule Interview")'))
        capture('29_interview_calendar.png', '/interviews/calendar', 'Interview Calendar', 'Interviews', 'Weekly interview calendar view with schedule slots and attendee details.')

        if int_data and len(int_data) > 0:
            i_id = int_data[0]['id']
            capture('30_interview_scorecard_detail.png', f"/interviews/{i_id}", 'Interview Scorecard & Evaluation', 'Interviews', 'Structured scorecard evaluation interface with competency ratings and recommendation.')

        # ─── 8. OFFERS & COMPENSATION ────────────────────────────────
        capture('31_offers_management.png', '/offers', 'Offers Management', 'Offers', 'Offer packages list, approval states, sent offers, and acceptance tracking.')
        capture('32_create_offer_package.png', '/offers/create', 'Create Offer Package Builder', 'Offers', 'Compensation package builder with basic salary, housing, transport, and gross calculations.')
        capture('33_offer_approval_inbox.png', '/offers/approvals/inbox', 'Offer Approvals Inbox', 'Offers', 'Compensation review and offer package approval inbox.')

        if off_data and len(off_data) > 0:
            o_id = off_data[0]['id']
            capture('34_offer_version_detail.png', f"/offers/{o_id}", 'Offer Package Breakdown & Details', 'Offers', 'Detailed offer package breakdown, compensation summary, and signoff status.')

        # ─── 9. PRE-HIRE, COMPLIANCE & JOINING ───────────────────────
        capture('35_hire_management.png', '/hires', 'Pre-Hire Management', 'Pre-Hire & Onboarding', 'Pre-hire cases transitioning from accepted offers to compliance and arrival.')
        capture('36_final_approval_inbox.png', '/hires/approvals/inbox', 'Final Hiring Approval Inbox', 'Pre-Hire & Onboarding', 'Executive signoff inbox for verified compliance cases.')
        capture('37_license_compliance.png', '/licenses', 'License Compliance Matrix', 'Pre-Hire & Onboarding', 'Professional license tracking and compliance verification matrix.')
        capture('38_joining_management.png', '/joinings', 'Joining & Onboarding', 'Pre-Hire & Onboarding', 'Confirmed arrival dates and headcount increment management.')

        # ─── 10. ANALYTICS & MASTER DATA ─────────────────────────────
        capture('39_reports_analytics.png', '/reports', 'Analytics & KPI Reports', 'Analytics', 'Time-to-fill, offer acceptance rates, department distributions, and recruiter workload.')
        capture('40_users_roles_directory.png', '/users', 'Users & Roles Directory', 'Administration', 'Authorized user management, RBAC role assignment, and access policies.')
        capture('41_users_create_user_modal.png', '/users', 'Create User Modal', 'Administration', 'Dialog to create an authorized user account and assign organization roles.',
                action=lambda p: p.click('button:has-text("Create user")'))
        capture('42_users_create_role_modal.png', '/users', 'Create Custom Role Modal', 'Administration', 'Dialog to define a new custom RBAC role and code definition.',
                action=lambda p: p.click('button:has-text("Create role")'))
        
        # Master Data Sub-Tabs
        capture('43_master_data_legal_entities.png', '/master-data', 'Master Data (Legal Entities Tab)', 'Administration', 'Legal entities catalogue with codes, registration status, and headcount limits.',
                action=lambda p: p.click('button:has-text("Legal Entities")'))
        capture('44_master_data_branches.png', '/master-data', 'Master Data (Branches Tab)', 'Administration', 'Branch locations, cities, and operational status.',
                action=lambda p: p.click('button:has-text("Branches")'))
        capture('45_master_data_positions.png', '/master-data', 'Master Data (Positions Tab)', 'Administration', 'Position master catalog with job titles, departments, and descriptions.',
                action=lambda p: p.click('button:has-text("Positions")'))
        capture('46_master_data_create_modal.png', '/master-data', 'Create Master Data Record Modal', 'Administration', 'Dialog to create a new branch or position master record.',
                action=lambda p: p.click('button:has-text("New Entity"), button:has-text("Add Branch"), button:has-text("Add Position"), button:has-text("Add")'))

        # Governance & Settings
        capture('47_audit_log.png', '/audit-log', 'Security & Audit Log Trail', 'Governance', 'Immutable audit log ledger recording all organizational lifecycle mutations.')
        capture('48_pipeline_settings.png', '/pipeline-settings', 'Pipeline Stage Settings', 'Settings', 'Recruitment stages configuration and SLA gate definitions.')
        capture('49_integrations.png', '/integrations', 'System Integrations', 'Settings', 'External HRIS, ATS, and background check service connectors.')
        capture('50_not_found_404.png', '/unknown-route-test', '404 Error State', 'Fallback', 'Clean error state and navigation fallback for unknown routes.')

        if req_data and len(req_data) > 0:
            r_id = req_data[0]['id']
            capture('51_vacancy_request_detail.png', f"/vacancy-requests/{r_id}", 'Vacancy Request Detail & Stepper', 'Requisitions', 'Requisition details, approval steps, and timeline progression.')

        # Build an HTML Catalog for easy client presentation with Categories
        categories = {}
        for s in snapshots:
            cat = s.get('category', 'General')
            categories.setdefault(cat, []).append(s)

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RecruitFlow - Complete System UI/UX Showcase ({len(snapshots)} Screens & Sub-Views)</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f8fafc; padding: 40px 20px; }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        header {{ margin-bottom: 36px; border-bottom: 1px solid #1e293b; padding-bottom: 24px; }}
        h1 {{ font-size: 32px; font-weight: 800; color: #38bdf8; margin-bottom: 8px; letter-spacing: -0.02em; }}
        p.subtitle {{ font-size: 15px; color: #94a3b8; line-height: 1.5; }}
        .badge-total {{ background: #0284c7; color: #ffffff; font-size: 13px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; display: inline-block; margin-top: 10px; }}
        
        .category-section {{ margin-bottom: 48px; }}
        .category-title {{ font-size: 20px; font-weight: 800; color: #f1f5f9; margin-bottom: 18px; display: flex; items-center; gap: 10px; border-left: 4px solid #38bdf8; padding-left: 12px; }}
        
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 24px; }}
        .card {{ background: #131d31; border-radius: 14px; border: 1px solid #22324f; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.4); transition: transform 0.2s, border-color 0.2s; }}
        .card:hover {{ transform: translateY(-4px); border-color: #38bdf8; }}
        .card-img-wrap {{ width: 100%; height: 250px; overflow: hidden; background: #0a0e17; border-bottom: 1px solid #22324f; position: relative; }}
        .card-img {{ width: 100%; height: 100%; object-fit: cover; object-position: top; transition: transform 0.3s; cursor: pointer; }}
        .card:hover .card-img {{ transform: scale(1.03); }}
        .card-body {{ padding: 18px; }}
        .card-num {{ font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
        .card-title {{ font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 6px; }}
        .card-path {{ font-family: monospace; font-size: 11.5px; color: #94a3b8; background: #0b0f19; padding: 3px 8px; border-radius: 6px; display: inline-block; margin-bottom: 10px; border: 1px solid #1e293b; }}
        .card-desc {{ font-size: 13px; color: #cbd5e1; line-height: 1.45; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>RecruitFlow Full System Showcase</h1>
            <p class="subtitle">Complete visual presentation of all {len(snapshots)} primary screens, sub-tabs, interactive dialogs, and recruitment workflow views captured in crisp 2x High-Definition.</p>
            <span class="badge-total">{len(snapshots)} High-Resolution Screens & Sub-Pages Captured</span>
        </header>
"""
        screen_counter = 1
        for cat, items in categories.items():
            html_content += f"""
        <div class="category-section">
            <h2 class="category-title">{cat}</h2>
            <div class="grid">
"""
            for s in items:
                html_content += f"""
                <div class="card">
                    <a href="{s['file']}" target="_blank" title="Click to view full image">
                        <div class="card-img-wrap">
                            <img class="card-img" src="{s['file']}" alt="{s['title']}">
                        </div>
                    </a>
                    <div class="card-body">
                        <div class="card-num">Screen #{screen_counter:02d} · {cat}</div>
                        <div class="card-title">{s['title']}</div>
                        <div class="card-path">{s['path']}</div>
                        <div class="card-desc">{s['description']}</div>
                    </div>
                </div>
"""
                screen_counter += 1

            html_content += """
            </div>
        </div>
"""

        html_content += """
    </div>
</body>
</html>
"""
        with open(os.path.join(OUTPUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html_content)

        # Also create a Markdown index
        md_content = f"# RecruitFlow Complete System UI/UX Showcase\n\n"
        md_content += f"Captured **{len(snapshots)} high-resolution screens, sub-tabs, and dialog modals** across all RecruitFlow workflows.\n\n"
        md_content += "| # | Category | Screen / Sub-View | Route Path | Snapshot Image | Description |\n"
        md_content += "|---|---|---|---|---|---|\n"
        for i, s in enumerate(snapshots):
            md_content += f"| {i+1:02d} | **{s['category']}** | {s['title']} | `{s['path']}` | [{s['file']}](./{s['file']}) | {s['description']} |\n"

        with open(os.path.join(OUTPUT_DIR, 'README.md'), 'w', encoding='utf-8') as f:
            f.write(md_content)

        print(f"\n===========================================================")
        print(f"SUCCESS: Captured {len(snapshots)} primary & sub-view snapshots into:")
        print(f"  {OUTPUT_DIR}")
        print(f"HTML Catalog: {os.path.join(OUTPUT_DIR, 'index.html')}")
        print(f"Markdown Catalog: {os.path.join(OUTPUT_DIR, 'README.md')}")
        print(f"===========================================================")

        # Update ZIP file
        zip_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'RecruitFlow_Client_Snapshots')
        shutil.make_archive(zip_path, 'zip', OUTPUT_DIR)
        print(f"Updated ZIP archive at: {zip_path}.zip")

        browser.close()

if __name__ == '__main__':
    run()
