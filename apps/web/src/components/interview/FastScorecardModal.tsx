import React, { useState, useEffect } from 'react';
import type { Interview, SubmitScorecardInput } from '@recruitflow/contracts';
import { postApi, ApiError } from '../../api/client';
import { Modal } from '../Modal';
import { Icon } from '../Icon';

interface FastScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  interview: Interview | null;
  onSuccess: () => void;
}

const RECOMMENDATIONS: Array<{
  value: SubmitScorecardInput['recommendation'];
  label: string;
  tone: 'emerald' | 'blue' | 'slate' | 'amber' | 'rose';
}> = [
  { value: 'Strong Hire', label: 'Strong Hire', tone: 'emerald' },
  { value: 'Hire', label: 'Hire', tone: 'blue' },
  { value: 'Neutral', label: 'Neutral / Hold', tone: 'slate' },
  { value: 'No Hire', label: 'No Hire', tone: 'amber' },
  { value: 'Strong No Hire', label: 'Strong No Hire', tone: 'rose' },
];

interface InterviewApplicationCandidate {
  application?: {
    candidate?: { firstName?: string; lastName?: string };
  };
}

export function FastScorecardModal({
  isOpen,
  onClose,
  interview,
  onSuccess,
}: FastScorecardModalProps) {
  const [overallRating, setOverallRating] = useState<number>(4);
  const [recommendation, setRecommendation] = useState<SubmitScorecardInput['recommendation']>('Hire');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOverallRating(4);
      setRecommendation('Hire');
      setStrengths('');
      setConcerns('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  if (!interview) return null;

  const interviewApp = interview as unknown as InterviewApplicationCandidate;
  const candidateName =
    interview.candidateName ||
    (interviewApp.application?.candidate
      ? `${interviewApp.application.candidate.firstName ?? ''} ${interviewApp.application.candidate.lastName ?? ''}`.trim()
      : 'Candidate');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError('Please add interviewer results and notes before submitting.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      await postApi(`/interviews/${interview.id}/scorecard`, {
        overallRating,
        recommendation,
        strengths: strengths.trim() || undefined,
        concerns: concerns.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit evaluation.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Scorecard: ${interview.title}`}
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Candidate & Role banner */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
          <div>
            <span className="font-extrabold text-slate-900 dark:text-white block text-xs sm:text-sm">
              {candidateName}
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
              {interview.positionTitle || 'Position'} &bull; {interview.interviewType} Round
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-[11px]">
            {interview.interviewCode}
          </span>
        </div>

        {/* Rating Stars (1-5) */}
        <div>
          <label className="font-bold block mb-1.5 text-slate-700 dark:text-slate-300">
            Overall Rating (1 to 5)
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setOverallRating(star)}
                className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center transition cursor-pointer text-sm ${
                  overallRating >= star
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                ★ {star}
              </button>
            ))}
          </div>
        </div>

        {/* Recommendation Pills */}
        <div>
          <label className="font-bold block mb-1.5 text-slate-700 dark:text-slate-300">
            Final Recommendation
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {RECOMMENDATIONS.map((rec) => {
              const isSelected = recommendation === rec.value;
              return (
                <button
                  key={rec.value}
                  type="button"
                  onClick={() => setRecommendation(rec.value)}
                  className={`p-2 rounded-xl text-[11px] font-extrabold border transition cursor-pointer text-center ${
                    isSelected
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {rec.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Strengths */}
        <div>
          <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
            Key Clinical &amp; Technical Strengths
          </label>
          <textarea
            rows={2}
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="Highlight domains of excellence, leadership or clinical precision..."
            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Concerns */}
        <div>
          <label htmlFor="fast-scorecard-notes" className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
            Identified Concerns or Areas for Growth
          </label>
          <textarea
            rows={2}
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            placeholder="Any reservations, missing prerequisites or onboarding needs..."
            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Interviewer Results & Notes */}
        <div>
          <label htmlFor="fast-scorecard-notes" className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
            Interviewer Results &amp; Notes <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="fast-scorecard-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            required
            placeholder="Detailed assessment notes, interview questions asked..."
            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Compliance Warning */}
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
          <Icon name="shield-check" size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong>Immutable Record:</strong> Once submitted, this scorecard is permanently locked in compliance
            with hospital recruitment governance.
          </span>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer transition flex items-center gap-1.5"
          >
            {isSubmitting ? 'Submitting...' : 'Submit & Lock Scorecard'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
