import { describe, expect, it, vi } from 'vitest';
import type { Application, AuthUser } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import { ApplicationsService } from '../applications.service';

const application = {
  id: 'app-1',
  organizationId: 'org-1',
  applicationCode: 'APP-2026-001',
  vacancyId: 'vacancy-1',
  candidateId: 'candidate-1',
  stage: 'Applied',
  allowedTransitions: ['Screening'],
  version: 4,
  source: 'CV Intake',
  primaryRecruiterId: null,
  taskOwnerId: null,
  candidate: { firstName: 'Mona', lastName: 'AlHarbi', email: 'mona@example.com', phone: null },
} as unknown as Application;

const user = {
  userId: 'user-1',
  organizationId: 'org-1',
  roleCodes: ['RECRUITER'],
} as unknown as AuthUser;

function createService() {
  const prisma = {
    pipelineTemplate: { findFirst: vi.fn() },
    screeningLog: { findFirst: vi.fn() },
    interview: { findMany: vi.fn() },
    offer: { findFirst: vi.fn() },
    hiringCase: { findFirst: vi.fn(), findUnique: vi.fn() },
    candidateDocument: { count: vi.fn() },
    $transaction: vi.fn(),
  } as unknown as PrismaService;
  const service = new ApplicationsService(prisma, {} as never, {} as never, {} as never);
  vi.spyOn(service, 'getApplication').mockResolvedValue(application);
  return { service, prisma };
}

describe('ApplicationsService unified workspace', () => {
  it('builds stage requirements from the persisted default pipeline and current records', async () => {
    const { service, prisma } = createService();
    vi.mocked(prisma.pipelineTemplate.findFirst).mockResolvedValue({
      id: 'pipeline-1',
      name: 'Default hiring track',
      stages: [
        {
          id: 'stage-applied',
          name: 'Applied',
          stageType: 'Screening',
          sortOrder: 0,
          slaDays: null,
          defaultOwner: null,
          entryGate: null,
          exitGate: 'document',
          required: true,
          status: 'Active',
        },
        {
          id: 'stage-screening',
          name: 'Screening',
          stageType: 'Screening',
          sortOrder: 1,
          slaDays: null,
          defaultOwner: null,
          entryGate: 'screening',
          exitGate: null,
          required: true,
          status: 'Active',
        },
      ],
    } as never);
    vi.mocked(prisma.screeningLog.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.interview.findMany).mockResolvedValue([]);
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.hiringCase.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.hiringCase.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.candidateDocument.count).mockResolvedValue(0);

    const workspace = await service.getWorkspace('org-1', 'app-1', user);

    expect(workspace.templateId).toBe('pipeline-1');
    expect(workspace.nextStage).toBe('Screening');
    expect(workspace.canAdvance).toBe(false);
    expect(workspace.nextStageRequirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'document', blocking: true, complete: false }),
        expect.objectContaining({ code: 'screening', blocking: true, complete: false }),
      ]),
    );
  });

  it('rejects a stage transition when a required gate is incomplete', async () => {
    const { service } = createService();
    vi.spyOn(service, 'getWorkspace').mockResolvedValue({
      application,
      templateId: 'pipeline-1',
      templateName: 'Default hiring track',
      stages: [],
      nextStage: 'Screening',
      nextStageRequirements: [
        {
          id: 'stage-screening:entry:0',
          code: 'screening',
          label: 'screening',
          kind: 'entry',
          required: true,
          complete: false,
          blocking: true,
        },
      ],
      canAdvance: false,
    });

    await expect(
      service.updateStage('org-1', 'app-1', 'user-1', {
        stage: 'Screening',
        expectedStage: 'Applied',
        expectedVersion: 4,
      }, user),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'STAGE_GATE_BLOCKED' }) });
  });

  it('rejects a stage that is not a canonical or persisted immediate transition', async () => {
    const { service } = createService();
    vi.spyOn(service, 'getWorkspace').mockResolvedValue({
      application,
      templateId: 'pipeline-1',
      templateName: 'Default hiring track',
      stages: [],
      nextStage: 'Screening',
      nextStageRequirements: [],
      canAdvance: true,
    });

    await expect(
      service.updateStage('org-1', 'app-1', 'user-1', {
        stage: 'Joined',
        expectedStage: 'Applied',
        expectedVersion: 4,
      }, user),
    ).rejects.toThrow(/Cannot transition application from Applied to Joined/);
  });

  it('returns a conflict when the expected stage or version is stale', async () => {
    const { service } = createService();

    await expect(
      service.updateStage('org-1', 'app-1', 'user-1', {
        stage: 'Screening',
        expectedStage: 'Applied',
        expectedVersion: 3,
      }, user),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CONFLICT' }) });
  });

  it('keeps the legacy next-stage action available when no default pipeline exists', async () => {
    const { service, prisma } = createService();
    vi.mocked(prisma.pipelineTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.screeningLog.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.interview.findMany).mockResolvedValue([]);
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.hiringCase.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.candidateDocument.count).mockResolvedValue(0);

    const workspace = await service.getWorkspace('org-1', 'app-1', user);

    expect(workspace.templateId).toBeNull();
    expect(workspace.nextStage).toBe('Screening');
    expect(workspace.canAdvance).toBe(true);
    expect(workspace.nextStageRequirements).toEqual([]);
  });

  it('allows the immediate custom stage from the persisted pipeline ordering', async () => {
    const { service, prisma } = createService();
    const customApplication = {
      ...application,
      stage: 'Phone Screen',
      allowedTransitions: [],
      version: 7,
      appliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      candidate: {
        ...application.candidate,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as Application;
    vi.mocked(service.getApplication).mockResolvedValue(customApplication);
    vi.spyOn(service, 'getWorkspace').mockResolvedValue({
      application: customApplication,
      templateId: 'pipeline-1',
      templateName: 'Custom hiring track',
      stages: [
        { id: 'stage-phone', name: 'Phone Screen', stageType: 'Screening', sortOrder: 0, required: false, isCurrent: true, isCompleted: false, isNext: false, isAvailable: true, requirements: [] },
        { id: 'stage-panel', name: 'Panel Review', stageType: 'Interview', sortOrder: 1, required: false, isCurrent: false, isCompleted: false, isNext: true, isAvailable: true, requirements: [] },
      ],
      nextStage: 'Panel Review',
      nextStageRequirements: [],
      canAdvance: true,
    });
    const tx = {
      application: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          ...customApplication,
          stage: 'Panel Review',
          version: 8,
          candidate: customApplication.candidate,
          vacancy: undefined,
          primaryRecruiter: null,
          taskOwner: null,
        }),
      },
      applicationStatusHistory: { create: vi.fn().mockResolvedValue({}) },
      vacancy: { findUnique: vi.fn(), update: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    const updated = await service.updateStage('org-1', 'app-1', 'user-1', {
      stage: 'Panel Review',
      expectedStage: 'Phone Screen',
      expectedVersion: 7,
    }, user);

    expect(updated.stage).toBe('Panel Review');
    expect(tx.application.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stage: 'Phone Screen', version: 7 }),
      data: expect.objectContaining({ stage: 'Panel Review' }),
    }));
    expect(tx.applicationStatusHistory.create).toHaveBeenCalled();
  });

  it('does not bypass a configured pipeline with a canonical stage jump', async () => {
    const { service } = createService();
    vi.spyOn(service, 'getWorkspace').mockResolvedValue({
      application,
      templateId: 'pipeline-1',
      templateName: 'Custom hiring track',
      stages: [
        { id: 'stage-applied', name: 'Applied', stageType: 'Screening', sortOrder: 0, required: false, isCurrent: true, isCompleted: false, isNext: false, isAvailable: true, requirements: [] },
        { id: 'stage-phone', name: 'Phone Screen', stageType: 'Screening', sortOrder: 1, required: false, isCurrent: false, isCompleted: false, isNext: true, isAvailable: true, requirements: [] },
      ],
      nextStage: 'Phone Screen',
      nextStageRequirements: [],
      canAdvance: true,
    });

    await expect(
      service.updateStage('org-1', 'app-1', 'user-1', {
        stage: 'Screening',
        expectedStage: 'Applied',
        expectedVersion: 4,
      }, user),
    ).rejects.toThrow(/Cannot transition application from Applied to Screening/);
  });
});
