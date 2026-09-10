import React, { useState, useEffect } from 'react';
import type { Application, InterviewType, GenerateSelfScheduleResult } from '@recruitflow/contracts';
import { postApi, getApi, ApiError } from '../../api/client';
import { Modal } from '../Modal';
import { Icon } from '../Icon';
import { useInterviewTypeOptions } from '../../hooks/useInterviewTypeOptions';

interface SelfScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  applications: Application[];
  initialApplicationId?: string;
}

interface OrganizationUser {
  id: string;
  displayName: string;
  email: string;
  status: string;
}

export function SelfScheduleModal({
  isOpen,
  onClose,
  applications,
  initialApplicationId,
}: SelfScheduleModalProps) {
  const [selectedAppId, setSelectedAppId] = useState(initialApplicationId || '');
  const [title, setTitle] = useState('Technical & Clinical Peer Assessment');
  const [interviewType, setInterviewType] = useState<InterviewType>('Technical');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [expiresInHours, setExpiresInHours] = useState<number>(72);
  const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([]);
  const [meetingLink, setMeetingLink] = useState('');
  const [availableUsers, setAvailableUsers] = useState<OrganizationUser[]>([]);
  const { options: interviewTypeOptions, isLoading: isLoadingInterviewTypes } = useInterviewTypeOptions();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<GenerateSelfScheduleResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialApplicationId) {
        setSelectedAppId(initialApplicationId);
      } else if (applications.length > 0 && !selectedAppId) {
        setSelectedAppId(applications[0].id);
      }
      setGeneratedLink(null);
      setError(null);
      setIsCopied(false);
      setMeetingLink('');

      // Load active users for interviewer selection
      getApi<OrganizationUser[] | { data?: OrganizationUser[] }>('/users')
        .then((res) => {
          const userList = Array.isArray(res) ? res : res?.data || [];
          setAvailableUsers(userList.filter((u) => u.status === 'Active'));
          if (userList.length > 0 && selectedInterviewerIds.length === 0) {
            setSelectedInterviewerIds([userList[0].id]);
          }
        })
        .catch(() => {
          // Ignore error, fallback
        });
    }
  }, [isOpen, initialApplicationId, applications]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId) {
      setError('Please select a target application.');
      return;
    }
    if (selectedInterviewerIds.length === 0) {
      setError('Please select at least one interviewer.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await postApi<GenerateSelfScheduleResult>('/interviews/self-schedule-link', {
        applicationId: selectedAppId,
        title: title.trim(),
        interviewType,
        durationMinutes,
        attendeeUserIds: selectedInterviewerIds,
        locationUrl: meetingLink.trim() || undefined,
        expiresInHours,
      });
      setGeneratedLink(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to generate self-schedule link.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fullUrl = generatedLink
    ? `${window.location.origin}${generatedLink.scheduleUrl}`
    : '';

  const handleCopy = () => {
    if (!fullUrl) return;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Candidate Self-Schedule Link"
      maxWidthClass="max-w-md"
    >
      {generatedLink ? (
        <div className="space-y-4 text-xs animate-fade-in">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Icon name="check" size={20} />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
              Self-Schedule Invitation Created
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              This tamper-proof signed link allows the candidate to view live recruiter availability and self-book
              their slot.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Candidate Booking Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fullUrl}
                className="flex-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-mono select-all text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Icon name="copy" size={13} />
                <span>{isCopied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <span className="text-[10.5px] text-slate-400 block mt-1">
              Expires on:{' '}
              <strong className="text-slate-600 dark:text-slate-300">
                {new Date(generatedLink.expiresAt).toLocaleString()}
              </strong>
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
              Target Candidate &amp; Application
            </label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              {applications.length > 0 ? (
                applications.map((app) => {
                  const name = app.candidate
                    ? `${app.candidate.firstName} ${app.candidate.lastName}`
                    : app.applicationCode || 'Application';
                  return (
                    <option key={app.id} value={app.id}>
                      {name} — {app.positionTitle || app.vacancyCode || 'Role'}
                    </option>
                  );
                })
              ) : (
                <option value="">No applications found</option>
              )}
            </select>
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
              Interview Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Clinical Assessment Panel"
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                Round Type
              </label>
              <select
                value={interviewType}
                onChange={(e) => {
                  const next = e.target.value as InterviewType;
                  setInterviewType(next);
                  const option = interviewTypeOptions.find((item) => item.code === next);
                  if (option) setDurationMinutes(option.defaultDuration);
                }}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                {interviewTypeOptions.map((option) => (
                  <option key={option.code} value={option.code}>{option.name}</option>
                ))}
              </select>
              {isLoadingInterviewTypes && <p className="mt-1 text-[10px] text-slate-500">Loading interview types from Master Data…</p>}
            </div>

            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes (Standard)</option>
                <option value={60}>60 Minutes</option>
                <option value={90}>90 Minutes</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300" htmlFor="self-schedule-meeting-link">Meeting link <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              id="self-schedule-meeting-link"
              type="url"
              inputMode="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
            <p className="mt-1 text-[10px] text-slate-500">This link is attached when the candidate books a slot.</p>
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
              Link Validity / Expiration
            </label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value={24}>24 Hours</option>
              <option value={48}>48 Hours</option>
              <option value={72}>72 Hours (3 Days • Recommended)</option>
              <option value={168}>7 Days</option>
            </select>
          </div>

          {availableUsers.length > 0 && (
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                Assigned Interviewer Panel
              </label>
              <div className="max-h-28 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {availableUsers.map((u) => {
                  const isChecked = selectedInterviewerIds.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInterviewerIds([...selectedInterviewerIds, u.id]);
                          } else {
                            setSelectedInterviewerIds(selectedInterviewerIds.filter((id) => id !== u.id));
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {u.displayName}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedAppId}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition disabled:opacity-50 flex items-center gap-1"
            >
              {isSubmitting ? 'Generating...' : 'Create Invitation Link'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
