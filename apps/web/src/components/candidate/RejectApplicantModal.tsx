import React from 'react';
import { Modal } from '../Modal';
import { Select } from '../ui/Select';

interface RejectApplicantModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRejectReason: string;
  setSelectedRejectReason: (v: string) => void;
  rejectNote: string;
  setRejectNote: (v: string) => void;
  isSubmitting: boolean;
  onConfirm: () => void;
}

export const RejectApplicantModal: React.FC<RejectApplicantModalProps> = ({
  isOpen,
  onClose,
  selectedRejectReason,
  setSelectedRejectReason,
  rejectNote,
  setRejectNote,
  isSubmitting,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Reject Applicant"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-3 text-xs">
        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
          Are you sure you want to reject this applicant? This will transition their status to{' '}
          <span className="font-bold text-rose-600">Rejected</span>, record the structured reason, and update
          the activity timeline.
        </p>
        <div>
          <label className="font-bold block mb-1">Structured Rejection Reason</label>
          <Select
            value={selectedRejectReason}
            onChange={(e) => setSelectedRejectReason(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="Skills mismatch">Skills mismatch / Lacks technical requirements</option>
            <option value="Salary expectations">Salary expectations exceed budget</option>
            <option value="Cultural fit">Cultural / Team fit alignment</option>
            <option value="Failed interview">Did not pass interview scorecard</option>
            <option value="Candidate withdrew">Candidate withdrew application</option>
            <option value="Not responsive">Candidate not responsive / No show</option>
            <option value="Position filled">Position filled by another candidate</option>
            <option value="Overqualified">Overqualified for current seniority</option>
          </Select>
        </div>
        <div>
          <label className="font-bold block mb-1">Internal Rejection Notes (Optional)</label>
          <textarea
            rows={2}
            placeholder="Specific feedback or context..."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            disabled={isSubmitting}
            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
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
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
