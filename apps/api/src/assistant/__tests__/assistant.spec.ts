import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { type HttpException, HttpStatus } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AssistantController } from '../assistant.controller';
import { AssistantLlmProvider } from '../assistant-llm.provider';
import { AssistantService, sanitizeAssistantOutput } from '../assistant.service';
import { KnowledgeIndexService, normalizeRoutePattern, resolveSystemGuideDir } from '../knowledge-index.service';
import { TenantScopedGuard } from '../../common/guards/tenant-scoped.guard';

const RECRUITER_USER: AuthUser = {
  userId: 'usr-recruiter-1',
  organizationId: 'org-sgh-1',
  tokenVersion: 1,
  roleCodes: ['RECRUITER'],
};

const MANAGER_USER: AuthUser = {
  userId: 'usr-manager-1',
  organizationId: 'org-sgh-1',
  tokenVersion: 1,
  roleCodes: ['HIRING_MANAGER'],
};

const ADMIN_USER: AuthUser = {
  userId: 'usr-admin-1',
  organizationId: 'org-sgh-1',
  tokenVersion: 1,
  roleCodes: ['ADMINISTRATOR'],
};

function createService(opts: {
  geminiKey?: string;
  permissions?: string[];
  directReportsCount?: number;
} = {}) {
  const index = new KnowledgeIndexService();
  index.ensureLoaded(resolveSystemGuideDir(__dirname));

  const envMap: Record<string, string | undefined> = {
    AI_ASSISTANT_ENABLED: 'true',
    GEMINI_API_KEY: opts.geminiKey,
    AI_ASSISTANT_MODEL: undefined,
  };
  const mockConfig = {
    get: <T = string>(key: string): T | undefined => envMap[key] as T | undefined,
  };
  const provider = new AssistantLlmProvider(mockConfig as never);

  const mockPerms = {
    getPermissionSet: vi.fn().mockResolvedValue(new Set(opts.permissions ?? ['APPLICATION_VIEW', 'CANDIDATE_VIEW'])),
  };
  const mockPrisma = {
    user: {
      count: vi.fn().mockResolvedValue(opts.directReportsCount ?? 0),
    },
  };

  const service = new AssistantService(index, provider, mockPrisma as never, mockPerms as never);
  return { service, index, provider };
}

describe('KnowledgeIndexService', () => {
  it('loads canonical prompt, JSONL chunks, and markdown guide sections', () => {
    const dir = resolveSystemGuideDir(__dirname);
    expect(dir).not.toBeNull();
    expect(existsSync(join(dir!, 'ai-assistant', 'KNOWLEDGE_CHUNKS.jsonl'))).toBe(true);

    const index = new KnowledgeIndexService();
    index.ensureLoaded(dir);

    expect(index.getSystemPrompt()).toContain('RecruitFlow Assistant');
    expect(index.getAllChunks().length).toBeGreaterThanOrEqual(20);
  });

  it('normalizes routes with UUIDs, numbers, and public tokens cleanly', () => {
    expect(normalizeRoutePattern('/applications/123e4567-e89b-12d3-a456-426614174000')).toBe('/applications/:id');
    expect(normalizeRoutePattern('/schedule/secret-signed-token-999')).toBe('/schedule/:token');
    expect(normalizeRoutePattern('/portal/applications/tok_abc123')).toBe('/portal/applications/:token');
    expect(normalizeRoutePattern('/users?view=tree&focus=u2')).toBe('/users?view=tree');
    expect(normalizeRoutePattern('not-a-route')).toBeUndefined();
  });
});

describe('AssistantService RBAC, Privacy & Hybrid Synthesis', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prevents Recruiter from escalating seat to admin and omits restricted action links', async () => {
    const { service } = createService();
    const res = await service.ask(RECRUITER_USER, {
      question: 'Where do I create a new Vacancy Request or manage users?',
      seat: 'admin',
      currentRoute: '/vacancies/123e4567-e89b-12d3-a456-426614174000',
    });

    expect(res.seat).toBe('employee');
    expect(res.mode).toBe('grounded-fallback');
    expect(res.suggestedActions.some((a) => ['/vacancy-requests', '/users', '/roles', '/admin/overrides'].includes(a.route))).toBe(false);
    expect(res.answer).toContain('403');
  });

  it('enforces pay-privacy notes when caller lacks OFFER_PAY_VIEW', async () => {
    const { service } = createService({ permissions: ['USERS_MANAGE', 'VIEW_CURRENT_SALARY'] });
    const res = await service.ask(ADMIN_USER, {
      question: 'Can an Administrator see or approve salary numbers in Offers?',
    });

    expect(res.answer).toContain('OFFER_PAY_VIEW');
    expect(res.answer).toContain('OFFER_PAY_VIEW_REQUIRED');
    expect(res.answer).toContain('VIEW_CURRENT_SALARY');
  });

  it('calls Gemini API with PII-free prompt when GEMINI_API_KEY is configured and sanitizes output', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Where to go: `/applications/:id`. Recommended action: log Screening notes first (never share Password123!).',
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { service } = createService({ geminiKey: 'test-gemini-key' });
    const res = await service.ask(RECRUITER_USER, {
      question: 'Why did Move to Interview fail with GATE_SCREEN_NOTE_MISSING?',
      currentRoute: '/applications/123e4567-e89b-12d3-a456-426614174000',
      errorCode: 'GATE_SCREEN_NOTE_MISSING',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const bodyText = String(init?.body ?? '');
    expect(bodyText).not.toContain('usr-recruiter-1');
    expect(bodyText).not.toContain('org-sgh-1');
    expect(bodyText).not.toContain('123e4567-e89b-12d3-a456-426614174000');

    expect(res.mode).toBe('llm');
    expect(res.provider).toBe('gemini:gemini-3.5-flash-lite');
    expect(res.answer).not.toContain('Password123!');
    expect(res.answer).toContain('Next action');
    expect(res.answer).not.toMatch(/\brecommended action\b/i);
    expect(res.warnings?.[0]).toContain('redacted');
  });

  it('degrades gracefully to grounded-fallback if external LLM fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream error', { status: 503 }),
    );

    const { service } = createService({ geminiKey: 'test-gemini-key' });
    const res = await service.ask(MANAGER_USER, {
      question: 'Why did Submit Requisition fail with DUE_DATE_REQUIRED?',
    });

    expect(res.mode).toBe('grounded-fallback');
    expect(res.answer).toContain('DUE_DATE_REQUIRED');
    expect(res.warnings?.[0]).toContain('Live AI provider was unreachable');
  });

  it('rate limits repeated rapid requests with 429 RATE_LIMITED', async () => {
    const { service } = createService();
    for (let i = 0; i < 20; i += 1) {
      await service.ask(MANAGER_USER, { question: `Question number ${i + 1} about approvals` });
    }

    await expect(
      service.ask(MANAGER_USER, { question: 'Question number 21 should hit limit' }),
    ).rejects.toMatchObject<Partial<HttpException>>({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('returns route-aware suggestions for the active seat', async () => {
    const { service } = createService();
    const s = await service.getSuggestions(ADMIN_USER, { currentRoute: '/users?view=tree' });
    expect(s.seat).toBe('admin');
    expect(s.prompts.length).toBeGreaterThanOrEqual(2);
    expect(s.prompts.some((p) => p.includes('/reporting-tree'))).toBe(true);
  });

  it('passes all 26 grounded ASSISTANT_EVAL_CASES prompts in grounded mode without leaking forbidden patterns', async () => {
    const evalCases: Array<{ id: number; actor: AuthUser; prompt: string; mustMatch: RegExp }> = [
      { id: 1, actor: RECRUITER_USER, prompt: 'What does Recommended Action mean on an Application File?', mustMatch: /Next action/i },
      { id: 2, actor: RECRUITER_USER, prompt: 'I saved my screening draft — why won\'t the candidate move to Interview?', mustMatch: /GATE_SCREEN_NOTE_MISSING/ },
      { id: 3, actor: RECRUITER_USER, prompt: 'Interview is done, why is Move to Offer returning 409?', mustMatch: /GATE_SCORECARD_NOT_SUBMITTED/ },
      { id: 4, actor: RECRUITER_USER, prompt: 'Pre-Hire checks look good except SCFHS date is old — can HR mark Joined?', mustMatch: /GATE_JOINING_CHECKS_INCOMPLETE|LICENCE_EXPIRED/ },
      { id: 5, actor: ADMIN_USER, prompt: 'Can an Administrator see or approve salary numbers in Offers?', mustMatch: /OFFER_PAY_VIEW/ },
      { id: 6, actor: MANAGER_USER, prompt: 'Why did approving an offer fail with OFFER_PAY_OUTSIDE_BAND?', mustMatch: /GradeBand/ },
      { id: 7, actor: RECRUITER_USER, prompt: 'As a Recruiter, where do I create a new Vacancy Request?', mustMatch: /403|blocked/i },
      { id: 8, actor: ADMIN_USER, prompt: 'Can an Admin reassign a candidate file or put a job On Hold?', mustMatch: /ADMIN_CANNOT_REASSIGN|ADMIN_CANNOT_CHANGE_JOB_STATUS/ },
      { id: 9, actor: RECRUITER_USER, prompt: 'A file was rejected by mistake. Can any recruiter reopen it?', mustMatch: /REOPEN_NOT_OWNER|direct manager/i },
      { id: 10, actor: ADMIN_USER, prompt: 'Where is the Reporting Tree page now? /reporting-tree opened /users!', mustMatch: /\/users\?view=tree/ },
      { id: 11, actor: RECRUITER_USER, prompt: 'Why is my Zoom/custom meeting URL rejected when scheduling an interview?', mustMatch: /ROOM_URL_HOST_NOT_ALLOWED|INTERVIEW_ROOM_HOSTS/ },
      { id: 12, actor: RECRUITER_USER, prompt: 'I selected 5 candidates on Match Skills, why is Compare disabled?', mustMatch: /COMPARE_COUNT|2.?4/ },
      { id: 13, actor: ADMIN_USER, prompt: 'What happens if a candidate CV triggers a malware/EICAR check?', mustMatch: /FILE_UNSAFE/ },
      { id: 14, actor: ADMIN_USER, prompt: 'Why didn\'t due-date reminders send at midnight?', mustMatch: /DUE_REMINDER_HOUR_CAIRO|Africa\/Cairo/ },
      { id: 15, actor: ADMIN_USER, prompt: 'Does POST /api/v1/auth/logout clear both auth cookies?', mustMatch: /access_token.*refresh_token|refresh_token/ },
      { id: 16, actor: ADMIN_USER, prompt: 'Are the login page Staff quick-access demo accounts visible in production?', mustMatch: /import\.meta\.env\.DEV|LoginPage/ },
      { id: 17, actor: ADMIN_USER, prompt: 'What happens if API callers inject orgId or fetch another org\'s candidate UUID?', mustMatch: /404|ValidationPipe/ },
      { id: 18, actor: RECRUITER_USER, prompt: 'How does Import CVs avoid duplicate candidates?', mustMatch: /duplicate-check|966/ },
      { id: 19, actor: RECRUITER_USER, prompt: 'Why were lowercase ecg or icu skills displayed differently?', mustMatch: /skillFormat|ECG|ICU/ },
      { id: 20, actor: RECRUITER_USER, prompt: 'How does an external candidate upload missing onboarding documents?', mustMatch: /\/portal/ },
      { id: 21, actor: RECRUITER_USER, prompt: 'How do candidates choose an interview slot without accessing internal staff calendars?', mustMatch: /\/schedule\/:token/ },
      { id: 22, actor: ADMIN_USER, prompt: 'Can an Admin create multiple active pipeline templates or bypass a stage gate?', mustMatch: /SINGLE_PIPELINE_TEMPLATE|GATE_/ },
      { id: 23, actor: MANAGER_USER, prompt: 'Where do recruiters and managers track monthly hiring results vs targets?', mustMatch: /\/my-result|\/reports/ },
      { id: 24, actor: ADMIN_USER, prompt: 'Which master-data datasets support bulk import routes?', mustMatch: /branches|MASTER_IMPORT_DATASETS/ },
      { id: 25, actor: ADMIN_USER, prompt: 'Are PDFs or .xlsx downloads compressed by the API compression middleware?', mustMatch: /1024|1\s?KB|response-compression/i },
      { id: 26, actor: ADMIN_USER, prompt: 'Which commands must pass before merging a code change into main?', mustMatch: /pnpm check:bundle|pnpm typecheck/ },
    ];

    for (const tc of evalCases) {
      const { service } = createService();
      const res = await service.ask(tc.actor, { question: tc.prompt });
      expect(res.answer, `Eval case #${tc.id} failed to match`).toMatch(tc.mustMatch);
      expect(res.answer, `Eval case #${tc.id} leaked credential`).not.toContain('Password123!');
      expect(res.citations.length, `Eval case #${tc.id} missing citations`).toBeGreaterThan(0);
    }
  });
});

describe('AssistantController security metadata & sanitization', () => {
  it('applies TenantScopedGuard on AssistantController', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AssistantController) as unknown[] | undefined;
    expect(guards).toContain(TenantScopedGuard);
  });

  it('sanitizeAssistantOutput redacts local demo password and enforces Next action wording', () => {
    const out = sanitizeAssistantOutput('Use Password123! and follow Recommended action.');
    expect(out.redacted).toBe(true);
    expect(out.text).not.toContain('Password123!');
    expect(out.text).toContain('Next action');
  });
});
