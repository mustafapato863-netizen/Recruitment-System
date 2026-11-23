import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { errorCodes, type AssistantActionLink, type AssistantSeat } from '@recruitflow/contracts';

export interface IndexedKnowledgeChunk {
  id: string;
  topic: string;
  title: string;
  sourceDoc: string;
  audience: string[];
  seats: string[];
  routes: string[];
  api: string[];
  models: string[];
  errorCodes: string[];
  summary: string;
  isJsonlPrimary: boolean;
  searchTokens: Set<string>;
  normalizedHaystack: string;
}

export interface RetrievalQuery {
  question: string;
  seat: AssistantSeat;
  currentRoute?: string | undefined;
  errorCode?: string | undefined;
  isAdministrator: boolean;
  limit?: number | undefined;
}

const CHAPTER_DOCS = [
  { file: '01-workspaces-roles-and-rbac.md', topic: 'rbac', seats: ['employee', 'manager', 'admin'], audience: ['recruiter', 'manager', 'admin', 'approver', 'license_specialist', 'interviewer'] },
  { file: '02-end-to-end-hiring-workflows-and-gates.md', topic: 'workflow', seats: ['employee', 'manager', 'admin'], audience: ['recruiter', 'manager', 'approver', 'license_specialist', 'interviewer'] },
  { file: '03-frontend-routes-pages-and-drawers.md', topic: 'frontend', seats: ['employee', 'manager', 'admin'], audience: ['recruiter', 'manager', 'admin', 'developer', 'qa'] },
  { file: '04-backend-api-modules-and-contracts.md', topic: 'api', seats: ['admin'], audience: ['developer', 'ops', 'admin'] },
  { file: '05-database-schema-and-workers.md', topic: 'database', seats: ['admin'], audience: ['developer', 'ops', 'admin'] },
  { file: '06-operations-ci-and-release.md', topic: 'ops', seats: ['admin'], audience: ['developer', 'ops', 'admin'] },
  { file: 'ai-assistant/ROLE_PLAYBOOKS_AND_FAQ.md', topic: 'workflow', seats: ['employee', 'manager', 'admin', 'public'], audience: ['recruiter', 'manager', 'admin', 'approver', 'license_specialist', 'interviewer', 'candidate'] },
] as const;

const ROUTE_LABELS: Readonly<Record<string, string>> = {
  '/my-work': 'Open My Work',
  '/vacancies': 'Open Jobs',
  '/vacancies/:id': 'Open Job Detail',
  '/candidates': 'Open Candidates',
  '/candidates/compare': 'Open Candidate Compare',
  '/cv-bank': 'Open CV Bank',
  '/sourcing-match': 'Open Smart Sourcing & Match',
  '/interviews': 'Open Interviews',
  '/interviews/calendar': 'Open Interview Calendar',
  '/my-interviews': 'Open My Interviews',
  '/offers': 'Open Offers',
  '/hires': 'Open Hires & Joining',
  '/hires/approvals/inbox': 'Open Final Approval Inbox',
  '/licenses': 'Open Medical Licenses',
  '/my-result': 'Open My Result',
  '/team-work': 'Open Team Work',
  '/team-interviews': 'Open Team Interviews',
  '/vacancy-requests': 'Open Requisitions',
  '/approvals': 'Open Approvals Inbox',
  '/reports': 'Open Reports',
  '/results/team': 'Open Team Results',
  '/users': 'Open Users & Access',
  '/users?view=tree': 'Open Visual Org Chart',
  '/roles': 'Open Roles & Permissions',
  '/master-data': 'Open Master Data',
  '/pipeline-settings': 'Open Pipeline Settings',
  '/whatsapp-templates': 'Open Templates',
  '/integrations': 'Open Integrations',
  '/audit-log': 'Open Audit Log',
  '/admin/overrides': 'Open Admin Overrides',
  '/profile': 'Open Profile',
  '/notifications': 'Open Notifications',
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'when', 'where',
  'why', 'how', 'can', 'does', 'not', 'are', 'you', 'your', 'into', 'about',
  'have', 'has', 'was', 'were', 'will', 'only', 'after', 'before', 'without',
]);

export function resolveSystemGuideDir(startDir = __dirname): string | null {
  const candidates = [
    join(process.cwd(), 'docs', 'system-guide'),
    resolve(process.cwd(), '..', '..', 'docs', 'system-guide'),
  ];

  let cursor = startDir;
  for (let i = 0; i < 8; i += 1) {
    candidates.push(join(cursor, 'docs', 'system-guide'));
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  for (const dir of candidates) {
    if (existsSync(join(dir, 'ai-assistant', 'KNOWLEDGE_CHUNKS.jsonl'))) {
      return dir;
    }
  }
  return null;
}

export function normalizeRoutePattern(raw?: string): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return undefined;

  const [rawPath = '', rawQuery = ''] = trimmed.split('?');
  const path = rawPath
    .replace(/\/+$/, '')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:id')
    .replace(/\/c[a-z0-9]{20,}(?=\/|$)/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/^(\/schedule)\/[^/]+$/i, '$1/:token')
    .replace(/^(\/portal\/applications)\/[^/]+$/i, '$1/:token') || '/';

  if (path === '/users' && /(?:^|&)view=tree(?:&|$)/i.test(rawQuery)) {
    return '/users?view=tree';
  }
  return path;
}

function stemToken(token: string): string {
  if (token.length >= 6 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length >= 5 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length >= 5 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length >= 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokenize(text: string): string[] {
  const camelSplit = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const rawTokens = `${text} ${camelSplit}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[-_]+|[-_]+$/g, ''))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const expanded = new Set<string>();
  for (const tok of rawTokens) {
    expanded.add(tok);
    expanded.add(stemToken(tok));
    if (tok.includes('_')) {
      for (const part of tok.split('_')) {
        if (part.length >= 2 && !STOP_WORDS.has(part)) {
          expanded.add(part);
          expanded.add(stemToken(part));
        }
      }
    }
  }
  return [...expanded];
}

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(errorCodes);

function extractCodes(text: string): string[] {
  const found = text.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? [];
  return [...new Set(found.filter((code) => KNOWN_ERROR_CODES.has(code)))];
}

function extractRoutes(text: string): string[] {
  const ui = new Set<string>();
  for (const m of text.matchAll(/`(\/[a-z0-9_/?:=.-]+)`/gi)) {
    const r = m[1];
    if (!r) continue;
    if (!r.startsWith('/api/') && r.startsWith('/') && !r.startsWith('//') && r.length < 80) {
      ui.add(r);
    }
  }
  return [...ui];
}

function extractApiRoutes(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/`(\/api\/v1\/[a-z0-9_/:.-]+)`/gi)) {
    if (m[1]) out.add(m[1]);
  }
  return [...out];
}

@Injectable()
export class KnowledgeIndexService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeIndexService.name);
  private loaded = false;
  private guideDir: string | null = null;
  private systemPrompt = '';
  private chunks: IndexedKnowledgeChunk[] = [];

  onModuleInit(): void {
    this.ensureLoaded();
  }

  ensureLoaded(customDir?: string | null): void {
    if (this.loaded && !customDir) return;
    this.guideDir = customDir ?? resolveSystemGuideDir();
    if (!this.guideDir) {
      this.logger.warn('docs/system-guide directory not found; assistant knowledge index is empty.');
      this.loaded = true;
      return;
    }

    this.chunks = [];
    this.systemPrompt = this.loadSystemPrompt(this.guideDir);
    this.loadJsonlChunks(this.guideDir);
    this.loadMarkdownSections(this.guideDir);
    this.loaded = true;
  }

  getSystemPrompt(): string {
    this.ensureLoaded();
    return this.systemPrompt;
  }

  getAllChunks(): readonly IndexedKnowledgeChunk[] {
    this.ensureLoaded();
    return this.chunks;
  }

  private loadSystemPrompt(guideDir: string): string {
    const path = join(guideDir, 'ai-assistant', 'SYSTEM_PROMPT.md');
    if (!existsSync(path)) return '';
    const raw = readFileSync(path, 'utf8');
    const match = raw.match(/```text\r?\n([\s\S]*?)\r?\n```/);
    return (match?.[1] ?? raw).trim();
  }

  private loadJsonlChunks(guideDir: string): void {
    const path = join(guideDir, 'ai-assistant', 'KNOWLEDGE_CHUNKS.jsonl');
    if (!existsSync(path)) return;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as {
          id: string;
          topic: string;
          title: string;
          audience?: string[];
          seats?: string[];
          routes?: string[];
          api?: string[];
          models?: string[];
          error_codes?: string[];
          summary: string;
        };
        const rawHaystack = [
          parsed.id,
          parsed.title,
          parsed.topic,
          (parsed.routes ?? []).join(' '),
          (parsed.api ?? []).join(' '),
          (parsed.error_codes ?? []).join(' '),
          (parsed.models ?? []).join(' '),
          parsed.summary,
        ].join(' ');
        const haystack = rawHaystack.toLowerCase();

        this.chunks.push({
          id: parsed.id,
          topic: parsed.topic,
          title: parsed.title,
          sourceDoc: 'ai-assistant/KNOWLEDGE_CHUNKS.jsonl',
          audience: parsed.audience ?? [],
          seats: parsed.seats ?? ['employee', 'manager', 'admin'],
          routes: parsed.routes ?? [],
          api: parsed.api ?? [],
          models: parsed.models ?? [],
          errorCodes: parsed.error_codes ?? [],
          summary: parsed.summary,
          isJsonlPrimary: true,
          searchTokens: new Set(tokenize(rawHaystack)),
          normalizedHaystack: haystack,
        });
      } catch (err) {
        this.logger.warn(`Skipping invalid JSONL line in KNOWLEDGE_CHUNKS.jsonl: ${err instanceof Error ? err.message : 'parse error'}`);
      }
    }
  }

  private loadMarkdownSections(guideDir: string): void {
    for (const meta of CHAPTER_DOCS) {
      const fullPath = join(guideDir, meta.file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf8');
      const sections = content.split(/(?=^#{2,3}\s+)/m);
      let sectionIndex = 0;

      for (const rawSection of sections) {
        const lines = rawSection.split(/\r?\n/);
        const headingLine = lines[0]?.trim() ?? '';
        const body = lines.slice(1).join('\n').trim();
        if (!headingLine.startsWith('#') || body.length < 40) continue;

        sectionIndex += 1;
        const title = headingLine.replace(/^#+\s*/, '').trim();
        const trimmedBody = body.length > 4500 ? `${body.slice(0, 4500)}\n…` : body;
        const routes = extractRoutes(trimmedBody);
        const api = extractApiRoutes(trimmedBody);
        const errorCodes = extractCodes(trimmedBody);
        const rawHaystack = `${title} ${meta.topic} ${routes.join(' ')} ${errorCodes.join(' ')} ${trimmedBody}`;

        this.chunks.push({
          id: `doc-${meta.file.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-${sectionIndex}`,
          topic: meta.topic,
          title,
          sourceDoc: meta.file,
          audience: [...meta.audience],
          seats: [...meta.seats],
          routes,
          api,
          models: [],
          errorCodes,
          summary: trimmedBody,
          isJsonlPrimary: false,
          searchTokens: new Set(tokenize(rawHaystack)),
          normalizedHaystack: rawHaystack.toLowerCase(),
        });
      }
    }
  }

  retrieve(query: RetrievalQuery): IndexedKnowledgeChunk[] {
    this.ensureLoaded();
    const limit = query.limit ?? 6;
    const normalizedCurrent = normalizeRoutePattern(query.currentRoute);
    const questionText = query.question.trim();
    const mentionedCodes = [
      ...extractCodes(questionText),
      ...(query.errorCode ? [query.errorCode.trim().toUpperCase()] : []),
    ];
    const mentionedRoutes = (questionText.match(/\/[a-z0-9_/?:=.-]+/gi) ?? [])
      .map((r) => normalizeRoutePattern(r))
      .filter((r): r is string => Boolean(r));
    const queryTokens = tokenize(`${questionText} ${mentionedCodes.join(' ')} ${normalizedCurrent ?? ''}`);

    const devOpsAsked = /\b(api|prisma|model|schema|worker|bullmq|cron|sweeper|docker|ci|pnpm|eslint|vitest|bundle|token|compression|brotli|gzip|csrf|cookie|logout|migration|database|health|readiness)\b/i.test(
      questionText,
    );

    const totalChunks = this.chunks.length || 1;
    const tokenDocFreq = new Map<string, number>();
    for (const token of queryTokens) {
      let count = 0;
      for (const c of this.chunks) {
        if (c.searchTokens.has(token)) count += 1;
      }
      tokenDocFreq.set(token, count);
    }

    const scored = this.chunks
      .filter((chunk) => {
        if (query.isAdministrator || query.seat === 'admin') return true;
        // Daily seats still see RBAC/workflow rules plus dev/ops ONLY if explicitly asked or referenced by error code
        const isDevOpsOnly = chunk.seats.length === 1 && chunk.seats[0] === 'admin' && (chunk.topic === 'api' || chunk.topic === 'database' || chunk.topic === 'worker' || chunk.topic === 'ops');
        if (!isDevOpsOnly) return true;
        if (devOpsAsked) return true;
        return mentionedCodes.some((c) => chunk.errorCodes.includes(c));
      })
      .map((chunk) => {
        let score = chunk.isJsonlPrimary ? 10 : 0;

        // Exact error code match
        for (const code of mentionedCodes) {
          if (chunk.errorCodes.includes(code)) score += 35;
          else if (chunk.normalizedHaystack.includes(code.toLowerCase())) score += 22;
        }

        // Exact or mentioned route match
        for (const route of mentionedRoutes) {
          if (chunk.routes.includes(route)) score += 24;
          else if (chunk.normalizedHaystack.includes(route.toLowerCase())) score += 14;
        }
        if (normalizedCurrent && chunk.routes.includes(normalizedCurrent)) {
          score += 12;
        }

        // Seat affinity
        if (chunk.seats.includes(query.seat)) score += 6;

        // IDF-weighted keyword & title overlap so specific terms (e.g. eicar, brotli, gradeband, reminder) outrank generic domain nouns
        const titleLower = chunk.title.toLowerCase();
        for (const token of queryTokens) {
          const df = tokenDocFreq.get(token) ?? 0;
          const idf = 1 + Math.log((totalChunks + 1) / (df + 1));
          if (chunk.searchTokens.has(token)) score += 3 * idf;
          if (titleLower.includes(token)) score += 4 * idf;
        }

        // Boost Error-Code Troubleshooting Matrix specifically when an explicit error code or HTTP status is cited
        if (
          (mentionedCodes.length > 0 || /\b(400|403|404|409)\b/.test(questionText)) &&
          chunk.title.includes('Error-Code Troubleshooting Matrix')
        ) {
          score += 10;
        }

        return { chunk, score };
      })
      .filter((entry) => entry.score > 6)
      .sort((a, b) => b.score - a.score);

    const picked = scored.slice(0, limit).map((s) => s.chunk);
    if (picked.length > 0) return picked;

    // Fallback: return seat-relevant primary architecture + RBAC/workflow overviews
    return this.chunks
      .filter((c) => c.isJsonlPrimary && (c.seats.includes(query.seat) || c.id === 'sys-glossary-terms'))
      .slice(0, limit);
  }

  buildSuggestedActions(
    chunks: readonly IndexedKnowledgeChunk[],
    options: {
      seat: AssistantSeat;
      isAdministrator: boolean;
      permissions: ReadonlySet<string>;
      isRecruiterOnly: boolean;
      canUseMyInterviews: boolean;
    },
  ): AssistantActionLink[] {
    const allowed = new Set<string>();
    const out: AssistantActionLink[] = [];

    for (const chunk of chunks) {
      for (const route of chunk.routes) {
        if (!ROUTE_LABELS[route] || allowed.has(route)) continue;
        if (!this.canSeatOpenRoute(route, options)) continue;
        allowed.add(route);
        out.push({ label: ROUTE_LABELS[route], route });
        if (out.length >= 4) return out;
      }
    }
    return out;
  }

  private canSeatOpenRoute(
    route: string,
    opts: {
      seat: AssistantSeat;
      isAdministrator: boolean;
      permissions: ReadonlySet<string>;
      isRecruiterOnly: boolean;
      canUseMyInterviews: boolean;
    },
  ): boolean {
    if (route === '/admin/overrides') return opts.isAdministrator && opts.seat === 'admin';
    if (['/users', '/users?view=tree', '/roles', '/master-data', '/pipeline-settings', '/whatsapp-templates', '/integrations', '/audit-log'].includes(route)) {
      return opts.seat === 'admin' || opts.isAdministrator;
    }
    if (['/team-work', '/team-interviews', '/results/team', '/approvals'].includes(route)) {
      return opts.seat === 'manager';
    }
    if (route === '/vacancy-requests') {
      if (opts.isRecruiterOnly) return false;
      return opts.seat === 'manager' || opts.permissions.has('VACANCY_REQUEST_CREATE') || opts.permissions.has('VACANCY_REQUEST_VIEW');
    }
    if (route === '/my-interviews') {
      return opts.canUseMyInterviews && opts.seat === 'employee';
    }
    if (route === '/reports') {
      return opts.seat === 'manager' || opts.seat === 'admin' || opts.isAdministrator;
    }
    if (['/my-work', '/vacancies', '/candidates', '/candidates/compare', '/cv-bank', '/sourcing-match', '/interviews', '/interviews/calendar', '/offers', '/hires', '/my-result'].includes(route)) {
      return opts.seat === 'employee' || opts.seat === 'manager';
    }
    if (route === '/licenses') {
      return opts.permissions.has('LICENSE_CHECK') || opts.permissions.has('APPLICATION_VIEW') || opts.isAdministrator;
    }
    if (route === '/hires/approvals/inbox') {
      return opts.permissions.has('FINAL_HIRING_APPROVAL');
    }
    return route === '/profile' || route === '/notifications';
  }
}
