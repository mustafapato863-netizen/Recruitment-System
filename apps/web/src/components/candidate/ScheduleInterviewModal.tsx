import React from 'react';
import { Modal } from '../Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  interviewTitle: string;
  setInterviewTitle: (v: string) => void;
  interviewType: 'Screening' | 'Technical' | 'Behavioral' | 'Managerial' | 'Executive';
  setInterviewType: (v: 'Screening' | 'Technical' | 'Behavioral' | 'Managerial' | 'Executive') => void;
  scheduledDateTime: string;
  setScheduledDateTime: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  interviewTitle,
  setInterviewTitle,
  interviewType,
  setInterviewType,
  scheduledDateTime,
  setScheduledDateTime,
  isSubmitting,
  onSubmit,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Schedule Interview"
      maxWidthClass="max-w-md"
    >
      <form onSubmit={onSubmit} className="space-y-3 text-xs">
        <div>
          <label className="font-bold block mb-1">Interview Title</label>
          <Input
            placeholder={`e.g. ${candidateName} - Technical Round`}
            value={interviewTitle}
            onChange={(e) => setInterviewTitle(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="font-bold block mb-1">Interview Type</label>
          <Select
            value={interviewType}
            onChange={(e) =>
              setInterviewType(
                e.target.value as 'Screening' | 'Technical' | 'Behavioral' | 'Managerial' | 'Executive'
              )
            }
            disabled={isSubmitting}
          >
            <option value="Screening">Screening Call</option>
            <option value="Technical">Technical Interview</option>
            <option value="Behavioral">Behavioral / HR Interview</option>
            <option value="Managerial">Hiring Manager Interview</option>
            <option value="Executive">Executive / Final Panel</option>
          </Select>
        </div>
        <div>
          <label className="font-bold block mb-1">Date &amp; Time (Arabia Standard Time • AST)</label>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <span className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10.5px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
              GMT+3
            </span>
          </div>
        </div>

        <div>
          <label className="font-bold block mb-1">Lead Interviewer / Clinical Panelist</label>
          <Select defaultValue="dr-hisham" disabled={isSubmitting}>
            <option value="dr-hisham">Dr. Hisham (Head of Cardiology) • Available</option>
            <option value="dr-fatima">Dr. Fatima (Medical Director) • Available</option>
            <option value="dr-mounir">Dr. Mounir (ICU Clinical Director) • Available</option>
            <option value="hr-lead">Talent Acquisition Specialist • SGH HR</option>
          </Select>
        </div>

        <div>
          <label className="font-bold block mb-1">Meeting Mode &amp; Location</label>
          <Select defaultValue="teams" disabled={isSubmitting}>
            <option value="teams">Microsoft Teams Video Meeting (Auto-generate link)</option>
            <option value="in-person">In-Person • SGH Executive Boardroom 302</option>
            <option value="clinic">In-Person • Clinical Department Office</option>
            <option value="phone">Telephone Screening Call</option>
          </Select>
        </div>

        <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300">
          <strong>Calendar Notice:</strong> Panelists will automatically receive calendar invites with direct scorecard evaluation links upon dispatch.
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
