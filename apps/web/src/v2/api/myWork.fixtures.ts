/** Dev-only fixtures for E1 (Roadmap v2 worked example: Mariam Farag, HRIS Developer). No pay fields. */
import type { MyWorkResponse, WorkDay } from './myWork';

export const FIXTURE_JOB = {
  id: 'vac-hris', title: 'HRIS Developer', requisitionId: 'req-hris', department: 'IT',
  site: { id: 'br-cai', name: 'Offshore Cairo' }, ownerName: 'Mariam Farag',
  seats: { filled: 1, target: 3 }, dueDate: '2026-10-19',
} as const;

export function myWorkFixture(day: WorkDay, opts: { empty?: boolean; workerHealthy?: boolean } = {}): MyWorkResponse {
  const healthy = opts.workerHealthy ?? true;
  const job = { ...FIXTURE_JOB, site: { ...FIXTURE_JOB.site }, seats: { ...FIXTURE_JOB.seats } };
  if (day === 'tomorrow') {
    return {
      day, date: '2026-10-13', job,
      counts: { total: 1, overdue: 0, today: 0, waiting: 0 },
      sections: { overdue: [], today: [], waiting: [] },
      scheduled: opts.empty ? [] : [{
        id: 'int-1', kind: 'interview', applicationId: 'app-ahmed',
        candidate: { id: 'c-ahmed', name: 'Ahmed Embaby' }, job: { id: job.id, title: job.title },
        title: 'Follow-up interview', context: 'technical panel follow-up · Owner: Mariam Farag',
        startsAt: '2026-10-13T10:00:00+03:00', endsAt: '2026-10-13T11:00:00+03:00',
        room: { name: 'Room SG-4 — HQ Riyadh', url: 'https://rooms.example.test/sg-4' },
        interviewer: { id: 'u-karim', name: 'Karim Hassan' },
      }],
      reminderWorkerHealthy: healthy, generatedAt: '2026-10-12T06:00:00Z',
    };
  }
  if (opts.empty) {
    return {
      day, date: '2026-10-12', job, counts: { total: 0, overdue: 0, today: 0, waiting: 0 },
      sections: { overdue: [], today: [], waiting: [] }, scheduled: [], reminderWorkerHealthy: healthy, generatedAt: '2026-10-12T06:00:00Z',
    };
  }
  return {
    day, date: '2026-10-12', job,
    counts: { total: 3, overdue: 1, today: 1, waiting: 1 },
    sections: {
      overdue: [{
        id: 't-1', section: 'overdue', applicationId: 'app-ahmed', candidate: { id: 'c-ahmed', name: 'Ahmed Embaby' },
        job: { id: job.id, title: job.title }, stage: 'Interview', title: 'Scorecard missing',
        context: 'interview held 6 Oct with Karim Hassan · gate blocks Offer', followUpAt: '2026-10-07',
        sla: healthy ? 'overdue' : null, blocker: 'Scorecard missing', waitingOn: null,
        nextAction: { kind: 'open_file', label: 'Open file', enabled: true },
      }],
      today: [{
        id: 't-2', section: 'today', applicationId: 'app-nourhan', candidate: { id: 'c-nourhan', name: 'Nourhan Sami' },
        job: { id: job.id, title: job.title }, stage: 'Screening', title: 'Log screening',
        context: 'phone screening booked 11:30', followUpAt: '2026-10-12T11:30:00+03:00',
        sla: healthy ? 'due_today' : null, blocker: null, waitingOn: null,
        nextAction: { kind: 'log_screening', label: 'Log screening', enabled: true },
      }],
      waiting: [{
        id: 't-3', section: 'waiting', applicationId: 'app-lina', candidate: { id: 'c-lina', name: 'Lina Hassan' },
        job: { id: job.id, title: job.title }, stage: 'Offer', title: 'Offer waiting on Karim Hassan',
        context: 'submitted 8 Oct, 14:20 · read-only until decided', followUpAt: null,
        sla: null, blocker: null, waitingOn: { id: 'u-karim', name: 'Karim Hassan' },
        nextAction: { kind: 'view_file', label: 'View file', enabled: true },
      }],
    },
    scheduled: [], reminderWorkerHealthy: healthy, generatedAt: '2026-10-12T06:00:00Z',
  };
}
