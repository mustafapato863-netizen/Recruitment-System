import React from 'react';
import { Icon } from '../Icon';

interface InterviewFiltersBarProps {
  dateRange: string;
  setDateRange: React.Dispatch<React.SetStateAction<string>>;
  selectedType: string;
  setSelectedType: React.Dispatch<React.SetStateAction<string>>;
  selectedInterviewer: string;
  setSelectedInterviewer: React.Dispatch<React.SetStateAction<string>>;
  selectedStatus: string;
  setSelectedStatus: React.Dispatch<React.SetStateAction<string>>;
  interviewerOptions: string[];
  isMoreFiltersOpen: boolean;
  setIsMoreFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const InterviewFiltersBar: React.FC<InterviewFiltersBarProps> = ({
  dateRange,
  setDateRange,
  selectedType,
  setSelectedType,
  selectedInterviewer,
  setSelectedInterviewer,
  selectedStatus,
  setSelectedStatus,
  interviewerOptions,
  isMoreFiltersOpen,
  setIsMoreFiltersOpen,
}) => {
  return (
    <div className="space-y-3">
      {/* Filter controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setDateRange((prev) =>
                prev === 'All Dates' ? 'Today' : prev === 'Today' ? 'Upcoming' : 'All Dates'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Icon name="calendar" size={13} className="text-slate-400" />
            <span>{dateRange}</span>
            <Icon name="chevron-down" size={12} className="text-slate-400" />
          </button>
        </div>

        {/* All interview types */}
        <div className="relative">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Interview Types</option>
            <option value="Screening">Screening Round</option>
            <option value="Technical">Technical Interview</option>
            <option value="Behavioral">Behavioral / Leadership</option>
            <option value="Managerial">Managerial Round</option>
            <option value="Executive">Executive Board</option>
          </select>
          <Icon
            name="chevron-down"
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>

        {/* All interviewers */}
        <div className="relative">
          <select
            value={selectedInterviewer}
            onChange={(e) => setSelectedInterviewer(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Interviewers</option>
            {interviewerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>

        {/* All statuses */}
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Feedback Done">Feedback Done</option>
            <option value="Feedback Pending">Feedback Pending</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <Icon
            name="chevron-down"
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>

        {/* More filters */}
        <button
          type="button"
          onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer ${
            isMoreFiltersOpen
              ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <Icon name="filter" size={13} className="text-slate-400" />
          <span>{isMoreFiltersOpen ? 'Hide filters' : 'More filters'}</span>
        </button>
      </div>

      {/* Expandable filters */}
      {isMoreFiltersOpen && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-500">Quick Filters:</span>
          <button
            type="button"
            onClick={() => setSelectedStatus('Feedback Pending')}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-amber-700 dark:text-amber-400 cursor-pointer"
          >
            Feedback Pending
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('Technical')}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-blue-600 dark:text-blue-400 cursor-pointer"
          >
            Technical Rounds
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedType('ALL');
              setSelectedStatus('ALL');
              setSelectedInterviewer('ALL');
              setDateRange('All Dates');
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
          >
            Reset All
          </button>
        </div>
      )}
    </div>
  );
};
