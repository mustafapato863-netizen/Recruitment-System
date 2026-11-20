/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../../components/v2/__tests__/axe';
import { permittedNavItems } from '../../components/v2/shell/navConfig';
import { stripPay } from '../api/paySafety';
import { CAPACITY_WARNING_THRESHOLD, interviewsThisWeekCount } from '../api/teamWork';
import { authorizedLanding, canOpenRoute, routeActor, v2Redirect } from '../destinations';
import { SCREEN_ROUTES } from '../screenRegistry';
import { HeaderSearch } from '../search/HeaderSearch';
import { availableWorkspaceSeats, resolveSeat } from '../seat';
import { useKeyboardListTriage } from '../useKeyboardListTriage';
import { formatPersonName, getInitials, splitPersonIdentity } from '../userIdentity';

const appSource = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
const role = (code: string) => ({ id: code, name: code, code });

function TriageHarness({ dialogOpen = false }: { dialogOpen?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useKeyboardListTriage(ref, '[data-triage-item]');
  return (
    <div ref={ref}>
      <label htmlFor="triage-filter">Filter tasks</label>
      <input id="triage-filter" type="text" />
      <ul>
        <li><a href="#item-1" data-triage-item>Follow up — Candidate One</a></li>
        <li><a href="#item-2" data-triage-item>Review scorecard — Candidate Two</a></li>
        <li><button type="button" data-triage-item>Open workload — Recruiter Three</button></li>
      </ul>
      <details>
        <summary>Collapsed applications</summary>
        <a href="#hidden-item" data-triage-item>Collapsed item</a>
      </details>
      {dialogOpen ? (
        <div role="dialog" aria-modal="true" aria-label="Active drawer">
          <button type="button">Drawer action</button>
        </div>
      ) : null}
    </div>
  );
}

describe('QA Release Matrix — 1. Complete 64-Route V2 Registry & Zero Legacy App.tsx Imports', () => {
  it('enforces 64 registered routes (39 native V2, 0 retained, 12 public, 13 redirect) and zero ./pages/* imports in App.tsx', () => {
    expect(SCREEN_ROUTES).toHaveLength(64);
    expect(SCREEN_ROUTES.filter((r) => r.surface === 'v2')).toHaveLength(39);
    expect(SCREEN_ROUTES.filter((r) => r.surface === 'retained')).toHaveLength(0);
    expect(SCREEN_ROUTES.filter((r) => r.surface === 'public')).toHaveLength(12);
    expect(SCREEN_ROUTES.filter((r) => r.surface === 'redirect')).toHaveLength(13);
    expect(appSource).not.toMatch(/import\(['"]\.\/pages\//);
  });
});

describe('QA Release Matrix — 2. Seven-Persona RBAC & IDOR Route Boundary Matrix', () => {
  it('Recruiter persona: accesses recruiting & hiring desks, blocked from requisitions, team-work, and admin', () => {
    const recruiter = {
      roles: [role('RECRUITER')],
      permissions: ['CANDIDATE_VIEW', 'VACANCY_VIEW', 'APPLICATION_VIEW'],
    };
    const seat = resolveSeat(recruiter);
    expect(seat).toBe('employee');
    const actor = routeActor(seat, recruiter);

    for (const allowedPath of [
      '/my-work', '/vacancies', '/vacancies/v1', '/candidates', '/candidates/compare',
      '/candidates/c1', '/candidates/c1/documents', '/cv-bank', '/sourcing-match',
      '/offers', '/hires', '/hires/h1', '/joinings', '/applications/a1', '/reports',
    ]) {
      expect(v2Redirect(seat, allowedPath, actor), `Recruiter should reach ${allowedPath}`).toBeNull();
    }

    for (const blockedPath of ['/team-work', '/vacancy-requests', '/users', '/roles', '/audit-log', '/hires/approvals/inbox']) {
      expect(v2Redirect(seat, blockedPath, actor), `Recruiter must redirect from ${blockedPath}`).toBe('/my-work');
    }
  });

  it('Hiring Manager persona: lands on /team-work, accesses manager & hiring workflows, blocked from admin and final-approval inbox', () => {
    const manager = {
      roles: [role('HIRING_MANAGER')],
      permissions: ['VACANCY_REQUEST_VIEW', 'APPLICATION_VIEW', 'VACANCY_VIEW'],
    };
    const seat = resolveSeat(manager);
    expect(seat).toBe('manager');
    const actor = routeActor(seat, manager);
    expect(v2Redirect(seat, '/', actor)).toBe('/team-work');

    for (const allowedPath of [
      '/team-work', '/my-work', '/vacancy-requests', '/approvals', '/vacancies',
      '/vacancies/v1', '/vacancies/v1/analytics', '/joinings', '/team-interviews',
      '/reports', '/offers', '/hires', '/hires/h1', '/applications/a1',
    ]) {
      expect(v2Redirect(seat, allowedPath, actor), `Manager should reach ${allowedPath}`).toBeNull();
    }

    for (const blockedPath of ['/users', '/roles', '/master-data', '/hires/approvals/inbox']) {
      expect(v2Redirect(seat, blockedPath, actor), `Manager must redirect from ${blockedPath}`).toBe('/team-work');
    }
  });

  it('Administrator persona: lands on /users, reaches all Admin desks, redirects classic admin routes to V2 equivalents', () => {
    const admin = {
      roles: [role('ADMINISTRATOR')],
      permissions: ['USERS_VIEW', 'ROLES_VIEW', 'MASTER_DATA_VIEW', 'AUDIT_VIEW', 'APPLICATION_VIEW'],
    };
    const seat = resolveSeat(admin);
    expect(seat).toBe('admin');
    const actor = routeActor(seat, admin);
    expect(v2Redirect(seat, '/', actor)).toBe('/users');

    for (const allowedPath of [
      '/users', '/roles', '/licenses', '/master-data', '/pipeline-settings',
      '/whatsapp-templates', '/reports', '/audit-log', '/integrations',
    ]) {
      expect(v2Redirect(seat, allowedPath, actor), `Admin should reach ${allowedPath}`).toBeNull();
    }
    expect(v2Redirect(seat, '/access-control', actor)).toBe('/roles');
    expect(v2Redirect(seat, '/settings', actor)).toBe('/master-data');
    expect(v2Redirect(seat, '/classic/master-data', actor)).toBe('/master-data');
    expect(v2Redirect(seat, '/classic/pipeline-settings', actor)).toBe('/pipeline-settings');
  });

  it('Interviewer-only persona: confined to /my-work, /my-interviews, and shell pages; redirected from files and bank', () => {
    const interviewer = {
      roles: [role('INTERVIEWER')],
      permissions: ['VACANCY_VIEW', 'INTERVIEW_PARTICIPATE'],
    };
    const seat = resolveSeat(interviewer);
    const actor = routeActor(seat, interviewer);
    expect(actor.interviewerOnly).toBe(true);
    expect(authorizedLanding(actor)).toBe('/my-interviews');

    for (const allowedPath of ['/my-work', '/my-interviews', '/profile', '/search']) {
      expect(v2Redirect(seat, allowedPath, actor), `Interviewer should reach ${allowedPath}`).toBeNull();
    }
    for (const blockedPath of ['/candidates', '/applications/a1', '/offers', '/hires', '/vacancies']) {
      expect(v2Redirect(seat, blockedPath, actor), `Interviewer must redirect from ${blockedPath}`).toBe('/my-interviews');
    }
  });

  it('Final Hiring Approver & License Specialist personas: land on dedicated queues and open permitted case files only', () => {
    const approver = {
      roles: [role('FINAL_HIRING_APPROVER')],
      permissions: ['FINAL_HIRING_APPROVAL'],
    };
    const approverActor = routeActor(resolveSeat(approver), approver);
    expect(approverActor.home).toBe('/hires/approvals/inbox');
    expect(v2Redirect('employee', '/hires/approvals/inbox', approverActor)).toBeNull();
    expect(v2Redirect('employee', '/hires/h1', approverActor)).toBeNull();
    expect(v2Redirect('employee', '/applications/a1', approverActor)).toBeNull();
    expect(v2Redirect('employee', '/offers', approverActor)).toBe('/hires/approvals/inbox');

    const specialist = {
      roles: [role('LICENSE_SPECIALIST')],
      permissions: ['LICENSE_CHECK'],
    };
    const specialistActor = routeActor(resolveSeat(specialist), specialist);
    expect(specialistActor.home).toBe('/licenses');
    expect(v2Redirect('employee', '/licenses', specialistActor)).toBeNull();
    expect(v2Redirect('employee', '/hires/h1', specialistActor)).toBeNull();
    expect(v2Redirect('employee', '/applications/a1', specialistActor)).toBeNull();
    expect(v2Redirect('employee', '/offers', specialistActor)).toBe('/licenses');
  });

  it('Multi-role user: exposes all authorized workspace seats and accurate nav items', () => {
    const multiUser = {
      roles: [role('ADMINISTRATOR'), role('HIRING_MANAGER'), role('RECRUITER')],
      permissions: ['USERS_VIEW', 'ROLES_VIEW', 'APPLICATION_VIEW', 'VACANCY_VIEW', 'CANDIDATE_VIEW'],
    };
    expect(availableWorkspaceSeats(multiUser)).toEqual(['employee', 'manager', 'admin']);
    expect(permittedNavItems('admin', multiUser.permissions, true).map((i) => i.key)).toEqual([
      'users-access', 'pipeline', 'master-data', 'templates', 'reports', 'audit', 'integrations',
    ]);
    expect(canOpenRoute('/licenses', ['USERS_VIEW'], false)).toBe(true);
  });
});

describe('QA Release Matrix — 3. Pay-Safety Redaction, Identity & Workload Governance', () => {
  it('stripPay removes salary, baseSalary, compensation, and allowance fields recursively', () => {
    const raw = {
      id: 'app-1',
      candidateName: 'Lina Hassan',
      baseSalary: 65000,
      salaryExpectation: 70000,
      offer: {
        id: 'off-1',
        status: 'Pending Approval',
        monthlyBaseSalary: 68000,
        housingAllowance: 10000,
        totalCompensation: 78000,
      },
    };
    const safe = stripPay(raw);
    expect(JSON.stringify(safe)).not.toMatch(/65000|70000|68000|10000|78000/);
    expect(safe.candidateName).toBe('Lina Hassan');
    expect(safe.offer.status).toBe('Pending Approval');
  });

  it('normalizes honorifics and embedded role subtitles without corrupting nicknames', () => {
    expect(formatPersonName('Dr. Prof. Ahmed Al-Mansoor')).toBe('Ahmed Al-Mansoor');
    expect(getInitials('Eng. Sara El-Sayed')).toBe('SE');
    expect(splitPersonIdentity('Zenah (Recruiter)', 'Recruiter')).toEqual({
      displayName: 'Zenah',
      jobTitle: 'Recruiter',
    });
    expect(getInitials('Zenah (Recruiter)')).toBe('Z');
    expect(splitPersonIdentity('John (Jack)', 'Recruiter')).toEqual({
      displayName: 'John (Jack)',
      jobTitle: 'Recruiter',
    });
  });

  it('reconciles Cairo week interview counts and enforces capacity warning threshold boundary', () => {
    expect(CAPACITY_WARNING_THRESHOLD).toBe(10);
    const today = '2026-11-18';
    expect(
      interviewsThisWeekCount(
        [
          { interview: { startAt: '2026-11-16T10:00:00Z' } },
          { interview: { startAt: '2026-11-21T09:00:00Z' } },
          { interview: { startAt: '2026-11-25T09:00:00Z' } },
          { interview: null },
        ],
        today,
      ),
    ).toBe(2);
    expect(interviewsThisWeekCount([{ interview: undefined }], today)).toBeNull();
  });
});

describe('QA Release Matrix — 4. Keyboard J/K Triage, Ctrl+K Focus-Trap Guard & Accessibility', () => {
  it('cycles focus with j/k, skips closed <details>, ignores inputs and active dialogs, and has zero axe violations', async () => {
    const u = userEvent.setup();
    const { container, rerender } = render(<TriageHarness />);
    expect(await axeViolations(container)).toEqual([]);

    const item1 = screen.getByRole('link', { name: 'Follow up — Candidate One' });
    const item2 = screen.getByRole('link', { name: 'Review scorecard — Candidate Two' });
    const item3 = screen.getByRole('button', { name: 'Open workload — Recruiter Three' });
    const input = screen.getByLabelText('Filter tasks');

    await u.keyboard('j');
    expect(item1).toHaveFocus();
    await u.keyboard('j');
    expect(item2).toHaveFocus();
    await u.keyboard('j');
    expect(item3).toHaveFocus();
    // Next 'j' wraps back to item1, skipping the link inside closed <details>
    await u.keyboard('j');
    expect(item1).toHaveFocus();
    await u.keyboard('k');
    expect(item3).toHaveFocus();

    await u.click(input);
    await u.keyboard('jk');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('jk');

    // When a modal dialog is open, J/K triage and Ctrl+K global search do not steal focus from the dialog
    rerender(
      <MemoryRouter>
        <HeaderSearch placeholder="Search candidates and jobs" meId="u-1" />
        <TriageHarness dialogOpen />
      </MemoryRouter>,
    );
    const drawerBtn = screen.getByRole('button', { name: 'Drawer action' });
    drawerBtn.focus();
    expect(drawerBtn).toHaveFocus();
    await u.keyboard('j');
    expect(drawerBtn).toHaveFocus();
    await u.keyboard('{Control>}k{/Control}');
    expect(drawerBtn).toHaveFocus();
  });
});
