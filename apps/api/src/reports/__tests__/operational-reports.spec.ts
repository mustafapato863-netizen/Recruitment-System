import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import { ReportsService } from '../reports.service';

const adminUser: AuthUser = {
  userId: 'adm-1',
  organizationId: 'org-1',
  email: 'admin@sgh.org',
  displayName: 'Admin',
  roleCodes: ['ADMINISTRATOR'],
  permissions: ['APPLICATION_VIEW'],
};

describe('Ticket 07 — Vacancy Tracker & Candidate Activity Reports + Excel Parity', () => {
  it('separates open requests from remaining seats, omits replaced employee column, and matches Excel export', async () => {
    const prisma = {
      vacancyRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'vr-1',
            requestCode: 'VR-001',
            openingType: 'Replacement',
            status: 'Approved',
            requestedHeadcount: 3,
            branchId: 'br-1',
            departmentId: 'dep-1',
            activatedAt: new Date('2026-10-10T00:00:00.000Z'),
            approvals: [{ decidedAt: new Date('2026-10-01T00:00:00.000Z') }],
            branch: { id: 'br-1', name: 'Cairo' },
            department: { id: 'dep-1', name: 'ICU' },
            position: { id: 'pos-1', title: 'ICU Nurse' },
            requester: { id: 'u-1', displayName: 'Mgr' },
            assignedEmployee: { id: 'rec-1', displayName: 'Mariam' },
            vacancy: {
              id: 'vac-1',
              vacancyCode: 'VAC-001',
              status: 'Partially Filled',
              approvedHeadcount: 3,
              joinedHeadcount: 1,
              openedAt: new Date('2026-10-10T00:00:00.000Z'),
              updatedAt: new Date('2026-10-15T00:00:00.000Z'),
              primaryRecruiter: { id: 'rec-1', displayName: 'Mariam' },
            },
          },
          {
            id: 'vr-2',
            requestCode: 'VR-002',
            openingType: 'New position',
            status: 'Pending Approval',
            requestedHeadcount: 2,
            branchId: 'br-1',
            departmentId: 'dep-1',
            activatedAt: null,
            approvals: [],
            branch: { id: 'br-1', name: 'Cairo' },
            department: { id: 'dep-1', name: 'ICU' },
            position: { id: 'pos-2', title: 'Pharmacist' },
            requester: { id: 'u-1', displayName: 'Mgr' },
            assignedEmployee: null,
            vacancy: null,
          },
        ]),
      },
    };

    const svc = new ReportsService(prisma as never);
    const report = await svc.getVacancyTracker('org-1', { from: '2026-10-01', to: '2026-11-30' }, adminUser);

    expect(report.summary.openRequestsCount).toBe(2);
    expect(report.summary.totalRequestedSeats).toBe(5);
    expect(report.summary.totalFilledSeats).toBe(1);
    expect(report.summary.totalRemainingSeats).toBe(4);
    expect(report.rows[0].vacantDays).toBeGreaterThanOrEqual(0);
    expect(report.rows[1].vacantDays).toBeNull();
    expect(JSON.stringify(report.rows)).not.toMatch(/replacedEmployee/i);

    const buf = await svc.exportVacancyTrackerExcel('org-1', { from: '2026-10-01', to: '2026-11-30' }, adminUser);
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames).toContain('Vacancy Tracker');
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Vacancy Tracker']);
    expect(sheetRows).toHaveLength(2);
    expect(Object.keys(sheetRows[0])).not.toContain('Replaced Employee');
    expect(sheetRows[0]['Remaining Seats']).toBe(2);
  });

  it('counts each application once per stage even with rescheduled interviews and resent offers, and matches Excel', async () => {
    const prisma = {
      application: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'app-1',
            applicationCode: 'APP-001',
            source: 'LinkedIn',
            stage: 'Offer',
            rejectionReason: 'Compensation below expectation',
            appliedAt: new Date('2026-10-05T10:00:00.000Z'),
            createdAt: new Date('2026-10-05T10:00:00.000Z'),
            candidate: { firstName: 'Ahmed', lastName: 'Ali' },
            primaryRecruiter: { displayName: 'Mariam' },
            vacancy: {
              position: { title: 'HRIS Dev' },
              branch: { id: 'br-1', name: 'Cairo' },
              department: 'IT',
              vacancyRequest: { department: { name: 'IT' } },
            },
            statusHistory: [
              { toStage: 'Screening', createdAt: new Date('2026-10-06T10:00:00.000Z') },
              { toStage: 'Interview', createdAt: new Date('2026-10-08T10:00:00.000Z') },
              { toStage: 'Offer', createdAt: new Date('2026-10-12T10:00:00.000Z') },
            ],
            screeningLogs: [{ screenedAt: new Date('2026-10-06T10:00:00.000Z') }],
            interviews: [
              // Two technical interviews (rescheduled/second slot) -> must count ONCE for technicalInterview
              { interviewType: 'Technical', stageContext: 'Interview', scheduledStart: new Date('2026-10-08T10:00:00.000Z'), createdAt: new Date('2026-10-07T10:00:00.000Z') },
              { interviewType: 'Technical', stageContext: 'Interview', scheduledStart: new Date('2026-10-09T10:00:00.000Z'), createdAt: new Date('2026-10-08T12:00:00.000Z') },
              // Pre-hire assessment interview -> counted separately
              { interviewType: 'Assessment', stageContext: 'Pre-Hire', scheduledStart: new Date('2026-10-14T10:00:00.000Z'), createdAt: new Date('2026-10-13T10:00:00.000Z') },
            ],
            offers: [
              // Resent twice -> must count ONCE for offerSent
              {
                status: 'Declined',
                updatedAt: new Date('2026-10-15T10:00:00.000Z'),
                declineReason: 'Compensation below expectation',
                versions: [
                  { sentAt: new Date('2026-10-12T10:00:00.000Z'), status: 'Sent' },
                  { sentAt: new Date('2026-11-02T10:00:00.000Z'), sendDates: [new Date('2026-10-13T10:00:00.000Z'), new Date('2026-11-02T10:00:00.000Z')], status: 'Sent' },
                ],
              },
            ],
            hiringCase: null,
          },
        ]),
      },
    };

    const svc = new ReportsService(prisma as never);
    const activity = await svc.getCandidateActivity('org-1', { from: '2026-10-01', to: '2026-10-31' }, adminUser);

    expect(activity.totals).toEqual({
      applications: 1,
      applied: 1,
      screening: 1,
      hrInterview: 0,
      technicalInterview: 1,
      assessmentInterview: 1,
      offerSent: 1,
      offerDeclined: 1,
      joined: 0,
    });
    expect(activity.declineReasons).toEqual([{ reason: 'Compensation below expectation', count: 1 }]);

    const buf = await svc.exportCandidateActivityExcel('org-1', { from: '2026-10-01', to: '2026-10-31' }, adminUser);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const detail = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Candidate Activity']);
    expect(detail).toHaveLength(1);
    expect(detail[0]['Technical Interview']).toBe('Yes');
    expect(detail[0]['Assessment Interview']).toBe('Yes');
    expect(detail[0]['Offer Sent']).toBe('Yes');
    const november = await svc.getCandidateActivity('org-1', { from: '2026-11-01', to: '2026-11-30' }, adminUser);
    expect(november.totals.offerSent).toBe(1);
    const original = await prisma.application.findMany();
    prisma.application.findMany.mockResolvedValue(original.map((app) => ({ ...app, offers: [] })));
    const unsent = await svc.getCandidateActivity('org-1', { from: '2026-10-01', to: '2026-10-31' }, adminUser);
    expect(unsent.totals.offerSent).toBe(0);
    expect(unsent.rows[0]?.offerSent).toBe(false);
    expect(detail[0]['Decline Reason']).toBe('Compensation below expectation');
  });
});
