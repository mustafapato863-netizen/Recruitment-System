import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Bot, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import type {
  AssistantActionLink,
  AssistantAnswerMode,
  AssistantAskResponse,
  AssistantCitation,
  AssistantHistoryTurn,
  AssistantSeat,
} from '@recruitflow/contracts';
import { SkeletonV2 } from '../../components/v2';
import { useQuickGuide } from '../../quickguide';
import { askAssistant, fetchAssistantSuggestions } from '../api/assistant';
import './assistant.css';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode?: AssistantAnswerMode;
  provider?: string;
  citations?: AssistantCitation[];
  suggestedActions?: AssistantActionLink[];
  followUpQuestions?: string[];
  warnings?: string[];
}

export interface AssistantDrawerProps {
  open: boolean;
  seat: AssistantSeat;
  initialQuestion?: string | null;
  onInitialQuestionConsumed?: () => void;
  onClose: () => void;
}

const SEAT_DISPLAY: Record<AssistantSeat, string> = {
  employee: 'Employee Workspace',
  manager: 'Manager Workspace',
  admin: 'Admin Workspace',
};

function renderInlineMarkdown(line: string): ReactNode[] {
  const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return <strong key={i}>{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
      return <code key={i}>{tok.slice(1, -1)}</code>;
    }
    return <Fragment key={i}>{tok}</Fragment>;
  });
}

function AssistantProse({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="rf2-assistant-prose">
      {blocks.map((block, idx) => {
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={idx}>
              {lines.map((l, li) => (
                <li key={li}>{renderInlineMarkdown(l.replace(/^[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 ? <br /> : null}
                {renderInlineMarkdown(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function AssistantResponse({ turn }: { turn: ChatTurn }) {
  const detailsHeading = '\n\n**Related guide details:**\n\n';
  const detailsStart = turn.text.indexOf(detailsHeading);

  if (turn.mode !== 'grounded-fallback' || detailsStart < 0) {
    return <AssistantProse text={turn.text} />;
  }

  return (
    <>
      <AssistantProse text={turn.text.slice(0, detailsStart)} />
      <details className="rf2-assistant-citations">
        <summary>View related guide details</summary>
        <AssistantProse text={turn.text.slice(detailsStart + detailsHeading.length)} />
      </details>
    </>
  );
}

export function AssistantDrawer({
  open,
  seat,
  initialQuestion,
  onInitialQuestionConsumed,
  onClose,
}: AssistantDrawerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openGuide } = useQuickGuide();

  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [mode, setMode] = useState<AssistantAnswerMode>('grounded-fallback');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [askError, setAskError] = useState<{ message: string; lastQuestion: string } | null>(null);

  const currentRoute = `${location.pathname}${location.search}`;

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    try {
      const res = await fetchAssistantSuggestions(currentRoute, seat);
      setPrompts(res.prompts);
      setMode(res.mode);
    } catch {
      setSuggestionsError('Could not load starter guide prompts.');
    } finally {
      setLoadingSuggestions(false);
    }
  }, [currentRoute, seat]);

  useEffect(() => {
    if (!open) return undefined;
    void loadSuggestions();
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, loadSuggestions, onClose]);

  useEffect(() => {
    if (!open || !initialQuestion) return;
    setQuestion(initialQuestion);
    onInitialQuestionConsumed?.();
  }, [open, initialQuestion, onInitialQuestionConsumed]);

  useEffect(() => {
    if (turns.length > 0 && typeof threadEndRef.current?.scrollIntoView === 'function') {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [turns, sending]);

  const submitQuestion = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (trimmed.length < 2 || sending) return;

      const userTurn: ChatTurn = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      const history: AssistantHistoryTurn[] = turns
        .slice(-6)
        .map((t) => ({ role: t.role, content: t.text.slice(0, 1200) }));

      setTurns((prev) => [...prev, userTurn]);
      setQuestion('');
      setAskError(null);
      setSending(true);

      try {
        const res: AssistantAskResponse = await askAssistant({
          question: trimmed,
          currentRoute,
          seat,
          history,
        });
        setMode(res.mode);
        const botTurn: ChatTurn = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.answer,
          mode: res.mode,
          provider: res.provider,
          citations: res.citations,
          suggestedActions: res.suggestedActions,
          followUpQuestions: res.followUpQuestions,
          warnings: res.warnings,
        };
        setTurns((prev) => [...prev, botTurn]);
      } catch (err) {
        const apiErr = err as { statusCode?: number; retryAfterSeconds?: number | null; message?: string };
        const message =
          apiErr?.statusCode === 429
            ? `Rate limit reached. Please wait ${apiErr.retryAfterSeconds ?? 30}s before asking again.`
            : apiErr?.message || 'Unable to reach the RecruitFlow Guide Assistant right now.';
        setAskError({ message, lastQuestion: trimmed });
      } finally {
        setSending(false);
      }
    },
    [currentRoute, seat, sending, turns],
  );

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitQuestion(question);
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitQuestion(question);
    }
  };

  const openActionRoute = (route: string) => {
    onClose();
    navigate(route);
  };

  const handleOpenPageGuide = () => {
    onClose();
    openGuide();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="rf2-assistant-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rf2-assistant-drawer"
      >
        <header className="rf2-assistant-header">
          <div className="rf2-assistant-title-wrap">
            <span className="rf2-assistant-emblem" aria-hidden="true">
              <Bot size={18} />
            </span>
            <div>
              <h2 id={titleId} className="rf2-assistant-title">
                RecruitFlow Guide Assistant
              </h2>
              <div className="rf2-assistant-meta">
                <span className="rf2-assistant-badge">{SEAT_DISPLAY[seat]}</span>
                <span className={`rf2-assistant-badge${mode === 'llm' ? ' rf2-assistant-badge--live' : ''}`}>
                  <Sparkles size={12} aria-hidden="true" />
                  {mode === 'llm' ? 'AI Guide' : 'Verified Guide Search'}
                </span>
              </div>
            </div>
          </div>

          <div className="rf2-assistant-header-actions">
            <button
              type="button"
              className="rf2-btn rf2-btn--secondary rf2-btn--sm"
              onClick={handleOpenPageGuide}
            >
              <BookOpen size={14} aria-hidden="true" />
              Page Guide
            </button>
            <button
              type="button"
              className="rf2-icon-button"
              aria-label="Close RecruitFlow Guide Assistant"
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="rf2-assistant-body">
          <div className="rf2-assistant-intro">
            <strong>Grounded in the RecruitFlow v0.2.0 System Guide.</strong> Ask how to complete a{' '}
            <strong>Next action</strong>, resolve server gate errors (<code>GATE_*</code>,{' '}
            <code>OFFER_PAY_*</code>), or jump to the right workspace screen.
          </div>

          {turns.length === 0 ? (
            <div className="rf2-assistant-prompts" aria-label="Suggested questions">
              <p className="rf2-assistant-section-label">Suggested for your workspace</p>
              {loadingSuggestions ? (
                <SkeletonV2 lines={3} label="Loading guide prompts..." />
              ) : suggestionsError ? (
                <div className="rf2-assistant-error" role="alert">
                  <span>{suggestionsError}</span>
                  <button
                    type="button"
                    className="rf2-btn rf2-btn--secondary rf2-btn--sm"
                    onClick={() => void loadSuggestions()}
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    Retry
                  </button>
                </div>
              ) : (
                <div className="rf2-assistant-chip-list">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rf2-assistant-chip"
                      onClick={() => void submitQuestion(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="rf2-assistant-thread" aria-live="polite">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`rf2-assistant-msg rf2-assistant-msg--${turn.role === 'user' ? 'user' : 'bot'}`}
              >
                {turn.role === 'user' ? (
                  <span>{turn.text}</span>
                ) : (
                  <>
                    <AssistantResponse turn={turn} />

                    {turn.warnings?.length ? (
                      <div className="rf2-assistant-warning" role="status">
                        {turn.warnings.join(' ')}
                      </div>
                    ) : null}

                    {turn.suggestedActions?.length ? (
                      <div className="rf2-assistant-actions" aria-label="Suggested destinations">
                        {turn.suggestedActions.map((act) => (
                          <button
                            key={act.route}
                            type="button"
                            className="rf2-btn rf2-btn--secondary rf2-btn--sm"
                            onClick={() => openActionRoute(act.route)}
                          >
                            <span>{act.label}</span>
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {turn.followUpQuestions?.length ? (
                      <div className="rf2-assistant-chip-list" aria-label="Follow-up questions">
                        {turn.followUpQuestions.map((fq) => (
                          <button
                            key={fq}
                            type="button"
                            className="rf2-assistant-chip"
                            onClick={() => void submitQuestion(fq)}
                          >
                            {fq}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {turn.citations?.length ? (
                      <details className="rf2-assistant-citations">
                        <summary>Verified sources ({turn.citations.length})</summary>
                        <ul>
                          {turn.citations.map((c) => (
                            <li key={c.chunkId}>
                              <strong>{c.title}</strong> — <code>{c.sourceDoc}</code>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </>
                )}
              </div>
            ))}

            {sending ? (
              <div className="rf2-assistant-msg rf2-assistant-msg--bot">
                <SkeletonV2 lines={3} label="Searching RecruitFlow guide..." />
              </div>
            ) : null}

            {askError ? (
              <div className="rf2-assistant-error" role="alert">
                <span>{askError.message}</span>
                <div className="rf2-assistant-actions">
                  <button
                    type="button"
                    className="rf2-btn rf2-btn--secondary rf2-btn--sm"
                    onClick={() => void submitQuestion(askError.lastQuestion)}
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    Retry question
                  </button>
                </div>
              </div>
            ) : null}

            <div ref={threadEndRef} />
          </div>
        </div>

        <footer className="rf2-assistant-composer">
          <form className="rf2-assistant-form" onSubmit={onFormSubmit}>
            <textarea
              ref={inputRef}
              className="rf2-assistant-input"
              aria-label="Ask a question about RecruitFlow"
              placeholder="Ask how a workflow step, permission, or gate error works…"
              maxLength={4000}
              rows={2}
              value={question}
              disabled={sending}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onInputKeyDown}
            />
            <button
              type="submit"
              className="rf2-btn rf2-btn--primary rf2-btn--lg"
              aria-label="Send question"
              disabled={sending || question.trim().length < 2}
            >
              <Send size={16} aria-hidden="true" />
              <span>Ask</span>
            </button>
          </form>
          {turns.length > 0 ? (
            <div className="rf2-assistant-footer-meta">
              <button
                type="button"
                className="rf2-btn rf2-btn--tertiary rf2-btn--sm"
                onClick={() => {
                  setTurns([]);
                  setAskError(null);
                }}
              >
                New topic
              </button>
            </div>
          ) : null}
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export default AssistantDrawer;
