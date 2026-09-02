import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Interview } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';

interface CalendarEvent {
  id: string;
  candidateName: string;
  role: string;
  dayIndex: number; // 0 = Sun, 1 = Mon ...
  startHour: number; // e.g. 10
  timeStr: string;
  duration: string;
  colorClass: string;
  interviewers: string;
  meetingLink: string;
}

const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    candidateName: 'Nour Ali',
    role: 'Registered Nurse',
    dayIndex: 1, // Mon
    startHour: 10,
    timeStr: '10:00 AM',
    duration: '10:00 AM – 11:00 AM (GST)',
    colorClass: 'bg-blue-50 border-blue-200 text-blue-900',
    interviewers: 'Omar Hassan (RN Lead), Sara Ahmed (Sr. Recruiter)',
    meetingLink: 'https://meet.recruitflow.com/123-456-789',
  },
  {
    id: '2',
    candidateName: 'Omar Hassan',
    role: 'Radiology Tech',
    dayIndex: 2, // Tue
    startHour: 11,
    timeStr: '11:00 AM',
    duration: '11:00 AM – 12:00 PM (GST)',
    colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    interviewers: 'Yousef Hamdy (Lead), Sara Ahmed',
    meetingLink: 'https://meet.recruitflow.com/234-567-890',
  },
  {
    id: '3',
    candidateName: 'Sara Ahmed',
    role: 'Pharmacist',
    dayIndex: 1, // Mon
    startHour: 13,
    timeStr: '1:00 PM',
    duration: '1:00 PM – 2:00 PM (GST)',
    colorClass: 'bg-amber-50 border-amber-200 text-amber-900',
    interviewers: 'Dr. Tarek, Omar Hassan',
    meetingLink: 'https://meet.recruitflow.com/345-678-901',
  },
  {
    id: '4',
    candidateName: 'Yousef Meqdy',
    role: 'IT Support Spec.',
    dayIndex: 4, // Thu
    startHour: 14,
    timeStr: '2:00 PM',
    duration: '2:00 PM – 3:00 PM (GST)',
    colorClass: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    interviewers: 'IT Dept Lead, Yousef Hamdy',
    meetingLink: 'https://meet.recruitflow.com/456-789-012',
  },
  {
    id: '5',
    candidateName: 'Lina Mostafa',
    role: 'Medical Coder',
    dayIndex: 5, // Fri
    startHour: 15.5,
    timeStr: '3:30 PM',
    duration: '3:30 PM – 4:30 PM (GST)',
    colorClass: 'bg-purple-50 border-purple-200 text-purple-900',
    interviewers: 'Mariam Saleh, Sara Ahmed',
    meetingLink: 'https://meet.recruitflow.com/567-890-123',
  },
];

const DAYS = ['Sun 5', 'Mon 6', 'Tue 7', 'Wed 8', 'Thu 9', 'Fri 10', 'Sat 11'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function InterviewCalendarPage() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('1');
  const [viewMode, setViewMode] = useState<'Week' | 'Month'>('Week');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadInterviews() {
      try {
        const res = await getApi<Interview[]>('/interviews');
        if (res && res.length > 0) setInterviews(res);
      } catch (err) {
        console.error('Failed to load calendar interviews', err);
      }
    }
    void loadInterviews();
  }, []);

  const events: CalendarEvent[] = useMemo(() => {
    if (interviews.length === 0) return mockEvents;
    return interviews.map((inv, idx) => {
      const startDate = new Date(inv.scheduledStart);
      return {
        id: inv.id,
        candidateName: inv.candidateName || 'Candidate',
        role: inv.positionTitle || 'Specialist',
        dayIndex: isNaN(startDate.getDay()) ? (idx % 7) : startDate.getDay(),
        startHour: isNaN(startDate.getHours()) ? 10 : startDate.getHours(),
        timeStr: isNaN(startDate.getTime()) ? '10:00 AM' : startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: '45 mins',
        colorClass: idx % 2 === 0 ? 'bg-blue-100 text-blue-900 border-l-4 border-blue-600' : 'bg-emerald-100 text-emerald-900 border-l-4 border-emerald-600',
        interviewers: inv.attendees?.map(a => a.userName || a.role).join(', ') || 'Hiring Panel',
        meetingLink: inv.locationUrl || 'https://zoom.us/j/9028471928',
      };
    });
  }, [interviews]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Header & Navigation Toolbar (Screen 7) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Interviews Calendar <span className="text-xs font-medium text-gray-400 font-normal">(Interviewer / Recruiter)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Coordinate panel interviews, video meeting links, and candidate evaluations in real time.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 pr-3 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 w-44 shadow-2xs"
            />
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1 shadow-2xs text-xs font-semibold">
            <button className="px-2 py-1 hover:bg-gray-50 rounded">&lt;</button>
            <button className="px-2.5 py-1 hover:bg-gray-50 rounded font-bold text-gray-800">Today</button>
            <button className="px-2 py-1 hover:bg-gray-50 rounded">&gt;</button>
            <span className="px-2 text-gray-700 font-bold">May 5 – May 11, 2024</span>
          </div>

          {/* View Switch */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-bold">
            <button
              onClick={() => setViewMode('Week')}
              className={`px-3 py-1 rounded-md transition ${viewMode === 'Week' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'}`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('Month')}
              className={`px-3 py-1 rounded-md transition ${viewMode === 'Month' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'}`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Calendar Grid (Left) + Selected Interview Sidebar (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Weekly Schedule Grid (9 cols) */}
        <div className="lg:col-span-9 bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50/80 text-center text-xs font-bold text-gray-700 py-2.5">
            <div className="text-gray-400 font-normal">GMT</div>
            {DAYS.map((d, i) => (
              <div key={i} className={i === 1 ? 'text-blue-600' : ''}>
                {d}
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div className="divide-y divide-gray-100 relative">
            {HOURS.map((hour) => {
              const displayHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
              return (
                <div key={hour} className="grid grid-cols-8 min-h-[56px]">
                  {/* Time label */}
                  <div className="p-2 text-[11px] font-semibold text-gray-400 text-right pr-3 border-r border-gray-100 select-none">
                    {displayHour}
                  </div>

                  {/* 7 Day slots */}
                  {Array.from({ length: 7 }).map((_, dayIdx) => {
                    const event = events.find(
                      (e) => e.dayIndex === dayIdx && Math.floor(e.startHour) === hour
                    );

                    return (
                      <div
                        key={dayIdx}
                        className="border-r border-gray-100 last:border-r-0 p-1 relative hover:bg-gray-50/50 transition cursor-pointer"
                        onClick={() => event && setSelectedEventId(event.id)}
                      >
                        {event && (
                          <div
                            className={`p-2 rounded-lg border text-xs font-semibold shadow-2xs transition hover:scale-[1.02] ${event.colorClass} ${
                              selectedEventId === event.id ? 'ring-2 ring-blue-600' : ''
                            }`}
                          >
                            <span className="block font-bold text-[11px] leading-tight">{event.timeStr}</span>
                            <span className="block font-bold truncate mt-0.5">{event.candidateName}</span>
                            <span className="block text-[10px] opacity-80 truncate">{event.role}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Interview Panel (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-900">Selected Interview</h2>
            <button
              onClick={() => navigate('/interviews')}
              className="text-[11px] text-blue-600 font-semibold hover:underline"
            >
              View calendar &gt;
            </button>
          </div>

          {/* Candidate Profile snippet */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
              {selectedEvent.candidateName.charAt(0)}
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900">{selectedEvent.candidateName}</h3>
              <p className="text-[11px] text-gray-500">{selectedEvent.role}</p>
            </div>
          </div>

          {/* Date & Time */}
          <div className="text-xs space-y-1 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-gray-700">
              <Icon name="calendar" size={13} className="text-gray-400" />
              <span>{selectedEvent.duration}</span>
            </div>
          </div>

          {/* Interviewers */}
          <div className="text-xs space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Interviewers</span>
            <div className="flex items-center gap-2 text-gray-700">
              <Icon name="users" size={13} className="text-gray-400" />
              <span className="text-[11px] font-medium">{selectedEvent.interviewers}</span>
            </div>
          </div>

          {/* Meeting Link */}
          <div className="text-xs space-y-1.5 pt-2 border-t border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Meeting Link</span>
            <div className="flex items-center gap-1.5 bg-gray-50 p-2 rounded-lg border border-gray-200">
              <Icon name="link" size={12} className="text-blue-600 shrink-0" />
              <span className="text-[11px] font-mono text-blue-600 truncate flex-1">{selectedEvent.meetingLink}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(selectedEvent.meetingLink)}
                className="text-[10px] text-gray-500 hover:text-gray-900 font-bold px-1.5 py-0.5 bg-white border border-gray-200 rounded"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-3 border-t border-gray-100 text-xs font-bold">
            <button
              type="button"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition cursor-pointer"
            >
              Reschedule
            </button>
            <button
              type="button"
              className="w-full py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              className="w-full py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition cursor-pointer"
            >
              Add Notes
            </button>
            <button
              type="button"
              className="w-full py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition cursor-pointer"
            >
              Send Reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
