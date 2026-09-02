import { useState } from 'react';
import type { Application, ApplicationStage } from '@recruitflow/contracts';
import { Icon } from '../Icon';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Modal } from '../Modal';
import { useAuth } from '../../auth/AuthContext';

interface CandidateSplitDrawerProps {
  application: Application | null;
  isOpen: boolean;
  onClose: () => void;
  onMoveStage?: (applicationId: string, nextStage: ApplicationStage) => Promise<void> | void;
  onScorecardSubmitted?: (applicationId: string, rating: number, notes: string) => void;
  onCallLogged?: (applicationId: string) => void;
}

const REJECTION_REASONS = [
  'Technical Competency Gap',
  'Salary Expectation Above Budget',
  'Cultural & Team Alignment',
  'Candidate Withdrew / Accepted Counter-Offer',
  'Notice Period Too Long',
  'Failed Background / License Verification',
  'Overqualified for Role',
  'Other Reason',
];

const PIPELINE_STAGES: ApplicationStage[] = [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Pre-Hire',
  'Joined',
];

const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  interview_invite: {
    subject: 'Invitation to Technical Interview — Saudi German Health',
    body: 'Dear Candidate,\n\nWe were impressed by your background and would like to invite you for a technical interview round for the position. Please let us know your availability for tomorrow between 10:00 AM and 2:00 PM.\n\nBest regards,\nRecruitment Team',
  },
  job_offer: {
    subject: 'Official Job Offer — Saudi German Health',
    body: 'Dear Candidate,\n\nWe are pleased to extend this official job offer. Please review the attached contract proposal and compensation breakdown.\n\nBest regards,\nTalent Acquisition Team',
  },
  rejection: {
    subject: 'Application Update — Saudi German Health',
    body: 'Dear Candidate,\n\nThank you for taking the time to speak with our hiring team. After careful review, we have decided to proceed with other candidates whose experience aligns more closely with our current departmental needs.\n\nWe wish you all the best in your career search.',
  },
};

interface ChatterNote {
  id: string;
  author: string;
  timestamp: string;
  text: string;
  type: 'note' | 'call' | 'stage' | 'email';
}

export function CandidateSplitDrawer({
  application,
  isOpen,
  onClose,
  onMoveStage,
  onScorecardSubmitted,
  onCallLogged,
}: CandidateSplitDrawerProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(4);
  const [scoreNotes, setScoreNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'cv' | 'chatter' | 'activities'>('cv');
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);

  // Activity Schedule Modal state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityType, setActivityType] = useState('Call');
  const [activityDueDate, setActivityDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [activitySummary, setActivitySummary] = useState('');

  // Email Template state
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');
  const [emailText, setEmailText] = useState('');

  // Employee creation success state
  const [employeeCreated, setEmployeeCreated] = useState(false);

  // Internal Chatter state
  const [newNote, setNewNote] = useState('');
  const [chatterNotes, setChatterNotes] = useState<ChatterNote[]>([
    {
      id: '1',
      author: 'Sarah Ahmed (Recruiter)',
      timestamp: 'Today at 10:15 AM',
      text: 'Candidate reached via phone. Confirmed notice period of 30 days and current package expectation within standard band.',
      type: 'call',
    },
    {
      id: '2',
      author: 'Dr. Hassan Ali (Hiring Lead)',
      timestamp: 'Yesterday at 4:30 PM',
      text: 'CV profile looks solid. Ready to proceed with technical interview screening.',
      type: 'note',
    },
  ]);

  if (!isOpen || !application) return null;

  const candidate = application.candidate;
  const canMove = user?.permissions.includes('APPLICATION_MOVE_STAGE');
  const viewPii = user?.permissions.includes('VIEW_CANDIDATE_PII');

  const handleScorecard = () => {
    setIsSubmittingScore(true);
    setTimeout(() => {
      onScorecardSubmitted?.(application.id, rating, scoreNotes);
      setIsSubmittingScore(false);
      setScoreSubmitted(true);

      setChatterNotes((prev) => [
        {
          id: Date.now().toString(),
          author: user?.displayName || 'Recruiter',
          timestamp: 'Just now',
          text: `Submitted Interview Scorecard: ${rating}/5 Stars. Notes: "${scoreNotes || 'Meets role requirements.'}"`,
          type: 'note',
        },
        ...prev,
      ]);

      setTimeout(() => setScoreSubmitted(false), 3000);
    }, 400);
  };

  const handleLogCall = () => {
    onCallLogged?.(application.id);
    setChatterNotes((prev) => [
      {
        id: Date.now().toString(),
        author: user?.displayName || 'Recruiter',
        timestamp: 'Just now',
        text: '📞 Phone Call Logged with candidate. Updated daily target tracker.',
        type: 'call',
      },
      ...prev,
    ]);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setChatterNotes((prev) => [
      {
        id: Date.now().toString(),
        author: user?.displayName || 'Recruiter',
        timestamp: 'Just now',
        text: newNote.trim(),
        type: 'note',
      },
      ...prev,
    ]);
    setNewNote('');
  };

  const handleApplyTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    if (key && EMAIL_TEMPLATES[key]) {
      setEmailText(EMAIL_TEMPLATES[key].body);
    } else {
      setEmailText('');
    }
  };

  const handleSendEmail = () => {
    if (!emailText.trim()) return;
    setChatterNotes((prev) => [
      {
        id: Date.now().toString(),
        author: user?.displayName || 'Recruiter',
        timestamp: 'Just now',
        text: `✉️ Sent Email: "${EMAIL_TEMPLATES[selectedTemplateKey]?.subject || 'Direct Communication'}"\n${emailText}`,
        type: 'email',
      },
      ...prev,
    ]);
    setEmailText('');
    setSelectedTemplateKey('');
  };

  const handleScheduleActivity = () => {
    if (!activitySummary.trim()) return;
    setChatterNotes((prev) => [
      {
        id: Date.now().toString(),
        author: user?.displayName || 'Recruiter',
        timestamp: 'Just now',
        text: `🕒 Scheduled ${activityType}: "${activitySummary}" for ${activityDueDate}.`,
        type: 'note',
      },
      ...prev,
    ]);
    setIsActivityModalOpen(false);
    setActivitySummary('');
  };

  const handleCreateEmployeeProfile = () => {
    setEmployeeCreated(true);
    setChatterNotes((prev) => [
      {
        id: Date.now().toString(),
        author: user?.displayName || 'Recruiter',
        timestamp: 'Just now',
        text: '🏆 Candidate converted into official Employee Profile in HR/Payroll database.',
        type: 'stage',
      },
      ...prev,
    ]);
    setTimeout(() => setEmployeeCreated(false), 4000);
  };

  const handlePassNext = () => {
    const nextAllowed = application.allowedTransitions.find((s) => s !== 'Rejected' && s !== 'Withdrawn');
    if (nextAllowed && onMoveStage) {
      void onMoveStage(application.id, nextAllowed as ApplicationStage);
      setChatterNotes((prev) => [
        {
          id: Date.now().toString(),
          author: user?.displayName || 'Recruiter',
          timestamp: 'Just now',
          text: `Advanced stage from "${application.stage}" to "${nextAllowed}".`,
          type: 'stage',
        },
        ...prev,
      ]);
    }
  };

  const handleReject = () => {
    if (onMoveStage) {
      void onMoveStage(application.id, 'Rejected' as ApplicationStage);
      setChatterNotes((prev) => [
        {
          id: Date.now().toString(),
          author: user?.displayName || 'Recruiter',
          timestamp: 'Just now',
          text: `Candidate marked as Rejected. Reason: "${rejectionReason}".`,
          type: 'stage',
        },
        ...prev,
      ]);
      setIsRejecting(false);
    }
  };

  const currentStageIndex = PIPELINE_STAGES.indexOf(application.stage as ApplicationStage);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-candidate-name"
    >
      <div className="flex h-full w-full max-w-5xl flex-col bg-white dark:bg-rf-surface shadow-2xl border-l border-rf-border">
        {/* Header with Odoo-style Status Stepper */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rf-border px-6 py-3.5 bg-rf-surface-subtle/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rf-primary text-white font-bold shadow-xs">
              {candidate ? `${candidate.firstName[0]}${candidate.lastName[0]}` : 'CP'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="drawer-candidate-name" className="text-lg font-bold text-rf-ink dark:text-white">
                  {candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Candidate Profile'}
                </h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-rf-primary/10 text-rf-primary font-semibold">
                  {application.vacancyCode || 'VAC'}
                </span>
              </div>
              <p className="text-xs text-rf-ink-muted">
                Applied for: <span className="font-semibold text-rf-ink dark:text-white">{application.positionTitle || 'Position'}</span>
              </p>
            </div>
          </div>

          {/* Odoo-Style Interactive Stage Stepper */}
          <div className="flex items-center gap-2">
            <nav aria-label="Pipeline Stage Progress" className="hidden sm:flex items-center rounded-lg border border-rf-border bg-white dark:bg-rf-surface p-1 shadow-2xs">
              {PIPELINE_STAGES.map((stg, idx) => {
                const isCurrent = application.stage === stg;
                const isPassed = currentStageIndex > idx;
                return (
                  <button
                    key={stg}
                    type="button"
                    disabled={!canMove || !application.allowedTransitions.includes(stg)}
                    onClick={() => onMoveStage?.(application.id, stg)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      isCurrent
                        ? 'bg-rf-primary text-white shadow-xs'
                        : isPassed
                        ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        : application.allowedTransitions.includes(stg)
                        ? 'text-rf-ink-muted hover:text-rf-ink hover:bg-rf-surface-subtle cursor-pointer'
                        : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {isPassed && <Icon name="check" size={12} className="text-emerald-600" />}
                    <span>{stg}</span>
                  </button>
                );
              })}
            </nav>

            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close review drawer">
              <Icon name="close" size={16} />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </header>

        {/* 4 Odoo Smart KPI Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rf-border px-6 py-2.5 bg-white dark:bg-rf-surface text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-semibold hover:brightness-95 cursor-pointer transition-all"
            >
              <Icon name="calendar-clock" size={13} />
              <span>📅 Meetings (1)</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold">
              <Icon name="file-text" size={13} />
              <span>📁 Documents (2)</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 font-semibold">
              <Icon name="offer" size={13} />
              <span>💼 Offers (1)</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800 text-rf-ink-muted font-semibold">
              <Icon name="history" size={13} />
              <span>🔁 Other Apps (0)</span>
            </div>
          </div>

          {/* Left Pane Navigation Tabs */}
          <div className="flex items-center rounded-lg border border-rf-border bg-rf-surface-subtle p-0.5">
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'cv' ? 'bg-white dark:bg-rf-surface text-rf-primary shadow-xs font-bold' : 'text-rf-ink-muted'
              }`}
              onClick={() => setActiveTab('cv')}
            >
              📄 CV Document
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'chatter' ? 'bg-white dark:bg-rf-surface text-rf-primary shadow-xs font-bold' : 'text-rf-ink-muted'
              }`}
              onClick={() => setActiveTab('chatter')}
            >
              💬 Activity Chatter ({chatterNotes.length})
            </button>
          </div>
        </div>

        {/* 2-Column Split Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: CV Document or Activity Chatter */}
          <section className="flex-1 overflow-y-auto border-r border-rf-border p-6 rf-scrollbar bg-slate-50/50 dark:bg-rf-surface-subtle/20">
            {activeTab === 'cv' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-rf-border pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1.5">
                    <Icon name="file-text" size={14} className="text-rf-primary" />
                    Interactive Resume Preview
                  </span>
                  <Badge variant="info">PDF / Document Extracted</Badge>
                </div>

                <div className="rounded-xl border border-rf-border bg-white dark:bg-rf-surface p-6 shadow-xs space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-rf-ink dark:text-white">
                      {candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Candidate Profile'}
                    </h3>
                    <p className="text-sm font-medium text-rf-primary">
                      {candidate?.currentTitle || 'Healthcare / Engineering Professional'}
                    </p>
                    <p className="text-xs text-rf-ink-muted mt-0.5">
                      Current: {candidate?.currentCompany || 'Saudi German Health'} · Sourced from: {candidate?.source || 'Career Portal'}
                    </p>
                  </div>

                  <div className="border-t border-rf-border/60 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted mb-2">Executive Summary</h4>
                    <p className="text-xs leading-relaxed text-rf-ink-muted">
                      6+ years of clinical and operational hospital experience. Certified in patient care protocols, healthcare compliance, and international healthcare quality accreditation (JCI).
                    </p>
                  </div>

                  <div className="border-t border-rf-border/60 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted mb-2">Key Skills & Certifications</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {['Clinical Protocols', 'Patient Care', 'Emergency Procedures', 'EMR Systems', 'JCI Quality', 'Team Leadership'].map((skill) => (
                        <span key={skill} className="rounded-md bg-rf-surface-subtle px-2 py-1 text-xs font-medium text-rf-ink dark:text-white border border-rf-border/60">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-rf-border/60 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted mb-2">Work Experience</h4>
                    <div className="space-y-3">
                      <div className="border-l-2 border-rf-primary pl-3">
                        <p className="text-xs font-bold text-rf-ink dark:text-white">Senior Specialist · Regional Hospital</p>
                        <p className="text-[11px] text-rf-ink-muted">2022 — Present · Full Time</p>
                        <p className="text-xs text-rf-ink-muted mt-0.5">Supervised clinical rounds and improved department efficiency rating by 18%.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Odoo-style Internal Chatter & Email Stream */
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-rf-border pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1.5">
                    <Icon name="chat" size={14} className="text-rf-primary" />
                    Internal Communication &amp; Activity Log
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setIsActivityModalOpen(true)}>
                    <Icon name="calendar-clock" size={13} />
                    Schedule Activity
                  </Button>
                </div>

                {/* Email Template Composer */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Icon name="mail" size={13} />
                      Send Template Email to Candidate
                    </label>
                    <Select
                      value={selectedTemplateKey}
                      onChange={(e) => handleApplyTemplate(e.target.value)}
                      className="text-xs w-56"
                    >
                      <option value="">-- Choose Email Template --</option>
                      <option value="interview_invite">✉️ Interview Invitation</option>
                      <option value="job_offer">💼 Official Job Offer</option>
                      <option value="rejection">📄 Rejection Notification</option>
                    </Select>
                  </div>
                  {selectedTemplateKey && (
                    <div className="space-y-2">
                      <Textarea
                        value={emailText}
                        onChange={(e) => setEmailText(e.target.value)}
                        rows={3}
                        className="text-xs"
                      />
                      <div className="flex justify-end">
                        <Button variant="primary" size="sm" onClick={handleSendEmail}>
                          <Icon name="send" size={13} />
                          Send to Candidate
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Quick Internal Note */}
                <div className="rounded-xl border border-rf-border bg-white dark:bg-rf-surface p-3.5 shadow-xs space-y-2">
                  <Textarea
                    placeholder="Log internal note, phone call summary, or tag @colleague..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-rf-ink-muted flex items-center gap-1">
                      <Icon name="phone" size={12} className="text-emerald-600" />
                      Updates daily activity counters
                    </span>
                    <Button variant="primary" size="sm" onClick={handleAddNote} disabled={!newNote.trim()}>
                      <Icon name="send" size={13} />
                      Post Note
                    </Button>
                  </div>
                </div>

                {/* Chatter History Stream */}
                <div className="space-y-3">
                  {chatterNotes.map((note) => (
                    <div key={note.id} className="rounded-xl border border-rf-border bg-white dark:bg-rf-surface p-3.5 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-rf-ink dark:text-white flex items-center gap-1.5">
                          {note.type === 'call' ? '📞' : note.type === 'email' ? '✉️' : note.type === 'stage' ? '🔄' : '💬'} {note.author}
                        </span>
                        <span className="text-[11px] text-rf-ink-muted">{note.timestamp}</span>
                      </div>
                      <p className="text-xs text-rf-ink-muted leading-relaxed whitespace-pre-line">{note.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right Column: Recruiter Action Center & Scorecard */}
          <aside className="w-96 overflow-y-auto p-6 rf-scrollbar flex flex-col justify-between bg-white dark:bg-rf-surface">
            <div className="space-y-5">
              {/* Contact Info */}
              <div className="rounded-xl border border-rf-border bg-rf-surface-subtle p-3.5 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted block">Contact Info</span>
                <div className="text-xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Icon name="mail" size={13} className="text-rf-ink-muted" />
                    <span className="font-mono text-rf-ink dark:text-white">
                      {viewPii ? (candidate?.email || 'email@example.com') : 'm***@***.com (PII Masked)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="phone" size={13} className="text-rf-ink-muted" />
                    <span className="font-mono text-rf-ink dark:text-white">
                      {viewPii ? (candidate?.phone || '+201001234567') : '+20 ••• ••• ••67 (PII Masked)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions (Call, Email, Activity) */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted block mb-2">Quick Actions</span>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="secondary" size="sm" onClick={handleLogCall} className="w-full flex-col py-2 h-auto text-xs">
                    <Icon name="phone" size={14} className="text-emerald-600 mb-1" />
                    Log Call
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActiveTab('chatter');
                      handleApplyTemplate('interview_invite');
                    }}
                    className="w-full flex-col py-2 h-auto text-xs"
                  >
                    <Icon name="mail" size={14} className="text-blue-600 mb-1" />
                    Send Email
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsActivityModalOpen(true)}
                    className="w-full flex-col py-2 h-auto text-xs"
                  >
                    <Icon name="calendar-clock" size={14} className="text-purple-600 mb-1" />
                    Activity
                  </Button>
                </div>
              </div>

              {/* 1-Click Scorecard */}
              <div className="rounded-xl border border-rf-border p-4 space-y-3 bg-white dark:bg-rf-surface">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted flex items-center gap-1">
                    <Icon name="check-circle" size={13} className="text-rf-primary" />
                    Interview Scorecard
                  </span>
                  <span className="text-xs font-bold text-amber-500">{rating} / 5 Stars</span>
                </div>

                {/* Star Rating */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`text-xl transition-transform hover:scale-110 ${
                        star <= rating ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'
                      }`}
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} star`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <Input
                  placeholder="Key strengths, salary remarks, or notes..."
                  value={scoreNotes}
                  onChange={(e) => setScoreNotes(e.target.value)}
                  className="text-xs"
                />

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleScorecard}
                  disabled={isSubmittingScore}
                  className="w-full"
                >
                  <Icon name="check" size={13} />
                  {scoreSubmitted ? 'Scorecard Recorded!' : 'Save Scorecard'}
                </Button>
              </div>

              {/* Joined State: 1-Click Create Employee Profile */}
              {application.stage === 'Joined' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 space-y-2">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                    Candidate Hired & Joined
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleCreateEmployeeProfile}
                  >
                    <Icon name="user-check" size={14} />
                    {employeeCreated ? 'Profile Generated!' : 'Create Employee Profile'}
                  </Button>
                </div>
              )}
            </div>

            {/* Stage Decision Actions */}
            <div className="border-t border-rf-border pt-4 mt-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted block mb-1">Recruitment Decision</span>

              {!isRejecting ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={!canMove}
                    onClick={handlePassNext}
                  >
                    <Icon name="chevron-right" size={14} />
                    Advance Stage
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="text-xs"
                    disabled={!canMove}
                    onClick={() => setIsRejecting(true)}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50/60 dark:bg-red-950/30 p-3 space-y-2.5 animate-in fade-in">
                  <label className="text-xs font-bold text-red-800 dark:text-red-300 block">
                    Mandatory Rejection Reason:
                  </label>
                  <Select
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    aria-label="Rejection Reason"
                  >
                    {REJECTION_REASONS.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </Select>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsRejecting(false)}>
                      Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleReject}>
                      Confirm Rejection
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Activity Scheduler Modal */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title="Schedule Candidate Activity"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-rf-ink dark:text-white block mb-1">Activity Type</label>
            <Select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
              <option value="Call">📞 Phone Call</option>
              <option value="Meeting">📅 Interview / Meeting</option>
              <option value="Document Verification">📄 Credential & License Verification</option>
              <option value="Offer Follow-up">💼 Contract & Offer Follow-up</option>
            </Select>
          </div>

          <div>
            <label className="text-xs font-bold text-rf-ink dark:text-white block mb-1">Due Date</label>
            <Input
              type="date"
              value={activityDueDate}
              onChange={(e) => setActivityDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-rf-ink dark:text-white block mb-1">Summary / Objective</label>
            <Input
              placeholder="e.g., Confirm availability for clinical round 2"
              value={activitySummary}
              onChange={(e) => setActivitySummary(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rf-border">
            <Button variant="ghost" size="sm" onClick={() => setIsActivityModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleScheduleActivity} disabled={!activitySummary.trim()}>
              Schedule Activity
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
