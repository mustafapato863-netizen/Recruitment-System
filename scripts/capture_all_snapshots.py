import os
import time
import glob
from playwright.sync_api import sync_playwright

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'client_snapshots')
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_URL = 'http://127.0.0.1:5173'

def run():
    # Clean old screenshots
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

        print("1. Capturing Login Page...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_selector('#login-email', timeout=15000)
        time.sleep(1)
        page.screenshot(path=os.path.join(OUTPUT_DIR, '01_login_page.png'), full_page=True)

        print("2. Logging into RecruitFlow as Admin...")
        page.fill('#login-email', 'ahmed.mahmoud@recruitflow.local')
        page.fill('#login-password', 'Password123!')
        page.locator('form').evaluate('form => form.requestSubmit()')
        
        # Wait for navigation to dashboard
        page.wait_for_url(f"{BASE_URL}/", timeout=15000)
        time.sleep(2.5)
        print(f"   Logged in successfully. Current URL: {page.url}")

        # Helper to safely navigate, wait, and capture
        snapshots = [{
            'file': '01_login_page.png',
            'title': 'Sign In / Authentication',
            'path': '/login',
            'description': 'Clean authentication screen with persona selector, secure password toggle, and enterprise validation.'
        }]

        def capture(filename, path, title, description, wait_sec=2.0):
            print(f"Capturing: {title} ({path})...")
            try:
                page.goto(f"{BASE_URL}{path}")
                time.sleep(wait_sec)
                
                # Check if inadvertently redirected to login
                if page.url.endswith('/login'):
                    print(f"   WARNING: Unexpected redirect to login on {path}")
                    return

                filepath = os.path.join(OUTPUT_DIR, filename)
                page.screenshot(path=filepath, full_page=True)
                snapshots.append({
                    'file': filename,
                    'title': title,
                    'path': path,
                    'description': description
                })
                print(f"   Saved -> {filename} (URL: {page.url})")
            except Exception as e:
                print(f"   Error capturing {title}: {e}")

        # Core Dashboard & Workflows
        capture('02_dashboard.png', '/', 'Executive Dashboard', 'Executive recruitment metrics, KPI summary, and active pipeline funnel.')
        capture('03_tasks.png', '/tasks', 'Assigned Tasks', 'Active task assignments, SLAs, priority tags, and work items.')
        capture('04_notifications.png', '/notifications', 'Notifications Center', 'System notifications, workflow updates, and alert ledger.')
        
        # Vacancy Requests & Approval
        capture('05_vacancy_requests.png', '/vacancy-requests', 'Vacancy Requests', 'Requisitions list with status badges and headcount targets.')
        capture('06_create_vacancy_request.png', '/vacancy-requests/create', 'Create Vacancy Request', 'Requisition creation wizard with dynamic branch/position dropdowns.')
        capture('07_approval_inbox.png', '/approval-inbox', 'Unified Approval Inbox', 'Centralized inbox for vacancy request and offer approvals.')
        
        # Vacancies & Positions
        capture('08_vacancies_list.png', '/vacancies', 'Vacancies Directory', 'Active open positions and headcount tracking.')
        
        # Candidates & Talent Pool
        capture('09_candidates_directory.png', '/candidates', 'Candidate Directory', 'Searchable candidate database with contact details and tags.')
        capture('10_talent_pool.png', '/talent-pool', 'Talent Pools', 'Curated candidate talent pools and benchmark groups.')
        capture('11_cv_intake_upload.png', '/cv-intake', 'CV & Resume Intake', 'Bulk and single PDF/Word resume upload with client-side text extraction.')
        
        # Applications Pipeline
        capture('12_applications_kanban.png', '/applications', 'Application Pipeline Kanban', 'Multi-stage recruitment workflow Kanban board from Applied to Joined.')
        
        # Interviews & Scheduling
        capture('13_interviews_list.png', '/interviews', 'Interviews Overview', 'Scheduled, completed, and pending interview sessions.')
        capture('14_interview_calendar.png', '/interviews/calendar', 'Interview Calendar', 'Weekly interview calendar view with schedule slots.')
        
        # Offers & Compensation
        capture('15_offers_management.png', '/offers', 'Offers Management', 'Offer packages, draft packages, sent offers, and acceptance tracking.')
        capture('16_create_offer_package.png', '/offers/create', 'Create Offer Package', 'Offer package compensation builder with breakdown components.')
        capture('17_offer_approval_inbox.png', '/offers/approvals/inbox', 'Offer Approvals Inbox', 'Compensation review and offer package approval inbox.')
        
        # Pre-Hire & Onboarding
        capture('18_hire_management.png', '/hires', 'Pre-Hire Management', 'Pre-hire cases transitioning from accepted offers to compliance.')
        capture('19_final_approval_inbox.png', '/hires/approvals/inbox', 'Final Hiring Approval Inbox', 'Executive signoff inbox for verified compliance cases.')
        capture('20_license_compliance.png', '/licenses', 'License Compliance', 'Professional license tracking and verification matrix.')
        capture('21_joining_management.png', '/joinings', 'Joining & Onboarding', 'Confirmed arrival dates and headcount increment management.')
        
        # Reports & Analytics
        capture('22_reports_analytics.png', '/reports', 'Analytics & Reports', 'Time-to-fill, offer acceptance rates, department distributions, and recruiter workload.')
        
        # Administration & Governance
        capture('23_users_roles.png', '/users', 'Users & Access Control', 'Authorized user management, RBAC role assignment, and access policies.')
        capture('24_master_data.png', '/master-data', 'Domain Master Data', 'Legal entities, branches, and positions reference catalogues.')
        capture('25_audit_log.png', '/audit-log', 'Audit Log Trail', 'Immutable audit log ledger recording all organizational lifecycle mutations.')
        capture('26_pipeline_settings.png', '/pipeline-settings', 'Pipeline Stage Settings', 'Recruitment stages configuration and SLA gate definitions.')
        capture('27_integrations.png', '/integrations', 'System Integrations', 'External HRIS, ATS, and background check service connectors.')
        capture('28_not_found_404.png', '/unknown-route-test', '404 Error State', 'Clean error state and navigation fallback for unknown routes.')

        # Fetch detail IDs to capture detail pages using page.evaluate() inside browser session
        print("\n--- Fetching live entity IDs for detail pages ---")
        try:
            # Query candidate list
            cands_data = page.evaluate('() => fetch("/api/v1/candidates").then(r => r.json()).catch(() => null)')
            if cands_data and cands_data.get('data') and len(cands_data['data']) > 0:
                cand_id = cands_data['data'][0]['id']
                capture('29_candidate_profile_detail.png', f"/candidates/{cand_id}", 'Candidate Profile Detail', 'Candidate profile view with timeline, application history, and document metadata.')
                capture('30_candidate_documents_vault.png', f"/candidates/{cand_id}/documents", 'Candidate Document Vault', 'Metadata-only document repository and upload interface.')

            # Query vacancies
            vac_data = page.evaluate('() => fetch("/api/v1/vacancies").then(r => r.json()).catch(() => null)')
            if vac_data and isinstance(vac_data, list) and len(vac_data) > 0:
                vac_id = vac_data[0]['id']
                capture('31_vacancy_overview_detail.png', f"/vacancies/{vac_id}", 'Vacancy Overview Detail', 'Detailed vacancy view with stage funnel distribution and team assignments.')

            # Query applications
            app_data = page.evaluate('() => fetch("/api/v1/applications").then(r => r.json()).catch(() => null)')
            if app_data and app_data.get('data') and len(app_data['data']) > 0:
                app_id = app_data['data'][0]['id']
                capture('32_application_stage_detail.png', f"/applications/{app_id}", 'Application Stage Detail', 'Detailed application lifecycle view with stage advancement and screening notes.')

            # Query interviews
            int_data = page.evaluate('() => fetch("/api/v1/interviews").then(r => r.json()).catch(() => null)')
            if int_data and isinstance(int_data, list) and len(int_data) > 0:
                int_id = int_data[0]['id']
                capture('33_interview_scorecard_detail.png', f"/interviews/{int_id}", 'Interview Scorecard Detail', 'Structured evaluation scorecard and rating submission interface.')

            # Query offers
            off_data = page.evaluate('() => fetch("/api/v1/offers").then(r => r.json()).catch(() => null)')
            if off_data and isinstance(off_data, list) and len(off_data) > 0:
                off_id = off_data[0]['id']
                capture('34_offer_version_detail.png', f"/offers/{off_id}", 'Offer Package Detail', 'Offer package breakdown, version history, and signoff status.')

            # Query hiring cases
            hire_data = page.evaluate('() => fetch("/api/v1/hiring/cases").then(r => r.json()).catch(() => null)')
            if hire_data and isinstance(hire_data, list) and len(hire_data) > 0:
                hire_id = hire_data[0]['id']
                capture('35_hiring_case_detail.png', f"/hires/{hire_id}", 'Hiring Case & Compliance Detail', 'Compliance verification checklist and final executive approval status.')

            # Query vacancy requests
            req_data = page.evaluate('() => fetch("/api/v1/vacancy-requests").then(r => r.json()).catch(() => null)')
            if req_data and isinstance(req_data, list) and len(req_data) > 0:
                req_id = req_data[0]['id']
                capture('36_vacancy_request_detail.png', f"/vacancy-requests/{req_id}", 'Vacancy Request Detail', 'Requisition details, approval steps, and timeline progression.')

        except Exception as e:
            print(f"Error while fetching detail records: {e}")

        # Build an HTML Catalog for easy client presentation
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RecruitFlow - System UI/UX Page Snapshots</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; }}
        .container {{ max-width: 1300px; margin: 0 auto; }}
        header {{ margin-bottom: 40px; border-bottom: 1px solid #334155; padding-bottom: 24px; }}
        h1 {{ font-size: 28px; font-weight: 800; color: #38bdf8; margin-bottom: 8px; }}
        p.subtitle {{ font-size: 15px; color: #94a3b8; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 28px; }}
        .card {{ background: #1e293b; border-radius: 14px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.2s; }}
        .card:hover {{ transform: translateY(-4px); border-color: #38bdf8; }}
        .card-img {{ width: 100%; height: 240px; object-fit: cover; object-position: top; border-bottom: 1px solid #334155; background: #0f172a; cursor: pointer; }}
        .card-body {{ padding: 18px; }}
        .card-num {{ font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
        .card-title {{ font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 6px; }}
        .card-path {{ font-family: monospace; font-size: 12px; color: #94a3b8; background: #0f172a; padding: 3px 8px; border-radius: 6px; display: inline-block; margin-bottom: 10px; }}
        .card-desc {{ font-size: 13px; color: #cbd5e1; line-height: 1.4; }}
        .badge {{ background: #0284c7; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; display: inline-block; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>RecruitFlow System Snapshots</h1>
            <p class="subtitle">Complete visual presentation of all {len(snapshots)} RecruitFlow screens and operational workflows captured in high-definition 2x scaling.</p>
        </header>
        <div class="grid">
"""
        for i, s in enumerate(snapshots):
            html_content += f"""
            <div class="card">
                <a href="{s['file']}" target="_blank">
                    <img class="card-img" src="{s['file']}" alt="{s['title']}">
                </a>
                <div class="card-body">
                    <div class="card-num">Screen #{i+1:02d}</div>
                    <div class="card-title">{s['title']}</div>
                    <div class="card-path">{s['path']}</div>
                    <div class="card-desc">{s['description']}</div>
                </div>
            </div>
"""
        html_content += """
        </div>
    </div>
</body>
</html>
"""
        with open(os.path.join(OUTPUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html_content)

        # Also create a Markdown index
        md_content = f"# RecruitFlow Client UI/UX Page Snapshots\n\n"
        md_content += f"Captured {len(snapshots)} high-resolution screens representing the complete RecruitFlow recruitment lifecycle.\n\n"
        md_content += "| # | Page / Feature | Route Path | Snapshot Image | Description |\n"
        md_content += "|---|---|---|---|---|\n"
        for i, s in enumerate(snapshots):
            md_content += f"| {i+1:02d} | **{s['title']}** | `{s['path']}` | [{s['file']}](./{s['file']}) | {s['description']} |\n"

        with open(os.path.join(OUTPUT_DIR, 'README.md'), 'w', encoding='utf-8') as f:
            f.write(md_content)

        print(f"\n===========================================================")
        print(f"SUCCESS: Captured {len(snapshots)} snapshots into:")
        print(f"  {OUTPUT_DIR}")
        print(f"HTML Catalog: {os.path.join(OUTPUT_DIR, 'index.html')}")
        print(f"Markdown Catalog: {os.path.join(OUTPUT_DIR, 'README.md')}")
        print(f"===========================================================")

        browser.close()

if __name__ == '__main__':
    run()
