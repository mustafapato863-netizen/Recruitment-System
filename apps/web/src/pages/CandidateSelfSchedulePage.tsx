import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type {
  SelfScheduleInvitationView,
  CandidateSelfScheduleSlot,
  BookSelfScheduleResult,
} from '@recruitflow/contracts';
import { getApi, postApi, ApiError } from '../api/client';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

export function CandidateSelfSchedulePage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<SelfScheduleInvitationView | null>(null);

  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<CandidateSelfScheduleSlot | null>(null);
  const [candidateNotes, setCandidateNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookSelfScheduleResult | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No scheduling token provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getApi<SelfScheduleInvitationView>(`/public/interviews/schedule/${token}`)
      .then((data) => {
        setInvitation(data);
        // Pre-select first date with available slots
        if (data.availableSlots && data.availableSlots.length > 0) {
          const firstDateKey = new Date(data.availableSlots[0].start).toDateString();
          setSelectedDateKey(firstDateKey);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unable to load scheduling details. This link may have expired.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  // Group available slots by date
  const slotsByDate = useMemo(() => {
    if (!invitation?.availableSlots) return new Map<string, CandidateSelfScheduleSlot[]>();
    const map = new Map<string, CandidateSelfScheduleSlot[]>();
    for (const slot of invitation.availableSlots) {
      const dKey = new Date(slot.start).toDateString();
      if (!map.has(dKey)) {
        map.set(dKey, []);
      }
      map.get(dKey)!.push(slot);
    }
    return map;
  }, [invitation]);

  const availableDateKeys = useMemo(() => {
    return Array.from(slotsByDate.keys());
  }, [slotsByDate]);

  const currentSlots = useMemo(() => {
    if (!selectedDateKey) return [];
    return slotsByDate.get(selectedDateKey) || [];
  }, [selectedDateKey, slotsByDate]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSlot) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await postApi<BookSelfScheduleResult>(`/public/interviews/schedule/${token}`, {
        selectedSlot: selectedSlot.start,
        timezone: 'Asia/Riyadh',
        candidateNotes: candidateNotes.trim() || undefined,
      });
      setBookingResult(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to book this slot. It may have just been reserved. Please try another time.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!bookingResult || !invitation || !selectedSlot) return;
    const start = new Date(selectedSlot.start);
    const end = new Date(selectedSlot.end);

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) =>
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      'Z';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Saudi German Health//RecruitFlow Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${bookingResult.interviewCode || 'interview'}@recruitflow.sghgroup.sa`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${invitation.interviewTitle} - Saudi German Health`,
      `DESCRIPTION:Interview with Saudi German Health for ${invitation.positionTitle}. Candidate: ${invitation.candidateName}`,
      'LOCATION:Saudi German Health • Teams Video Link',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-${bookingResult.interviewCode || 'schedule'}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-slate-100 flex flex-col font-sans">
      {/* Top Brand Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20 font-black text-white text-base">
              SGH
            </div>
            <div>
              <span className="font-extrabold text-white text-sm tracking-tight block">
                Saudi German Health
              </span>
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block">
                Recruitment Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50">
            <Icon name="lock" size={12} className="text-emerald-400" />
            <span>Encrypted Self-Schedule</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {loading ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto shadow-2xl backdrop-blur-sm animate-fade-in">
            <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-base font-bold text-white">Loading Available Time Slots...</h2>
            <p className="text-xs text-slate-400">Verifying recruiter calendar and checking availability.</p>
          </div>
        ) : error && !bookingResult ? (
          <div className="bg-slate-900/70 border border-rose-900/50 rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto shadow-2xl backdrop-blur-sm animate-fade-in">
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <h2 className="text-base font-bold text-white">Unable to Schedule</h2>
            <p className="text-xs text-rose-300/90 leading-relaxed">{error}</p>
            <div className="pt-2">
              <span className="text-[11px] text-slate-400 block">
                Please contact the Saudi German Health talent team if you require a new appointment link.
              </span>
            </div>
          </div>
        ) : bookingResult ? (
          /* Confirmation State */
          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-3xl p-8 sm:p-10 text-center space-y-6 max-w-lg mx-auto shadow-2xl backdrop-blur-md animate-scale-in">
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg shadow-emerald-500/20">
              <Icon name="check-circle" size={32} />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs rounded-full">
                Appointment Confirmed
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                You're All Set, Dr./Mr./Ms. {invitation?.candidateName}!
              </h1>
              <p className="text-xs text-slate-300">
                Your <strong className="text-white">{invitation?.interviewTitle}</strong> for{' '}
                <strong className="text-emerald-300">{invitation?.positionTitle}</strong> has been booked.
              </p>
            </div>

            <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 text-left space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Confirmation Code:</span>
                <span className="font-mono font-bold text-blue-400">{bookingResult.interviewCode}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Date &amp; Time:</span>
                <span className="font-bold text-white text-right">
                  {new Date(bookingResult.scheduledStart).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Riyadh',
                  })}{' '}
                  AST
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="font-semibold text-slate-200">{invitation?.durationMinutes} minutes</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadIcs}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="download" size={16} />
                <span>Add to Calendar (.ics)</span>
              </button>
              <p className="text-[11px] text-slate-400">
                A calendar invitation email has also been dispatched to your registered address.
              </p>
            </div>
          </div>
        ) : (
          /* Slot Selection State */
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-md space-y-8 animate-fade-in">
            {/* Header / Intro */}
            <div className="border-b border-slate-800/80 pb-6 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-bold text-[11px]">
                  {invitation?.interviewType} Round
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                  <Icon name="clock" size={11} />
                  {invitation?.durationMinutes} mins
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium text-[11px]">
                  Asia/Riyadh (AST)
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Schedule Your {invitation?.interviewTitle}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Welcome, <strong className="text-white">{invitation?.candidateName}</strong>. Please select your
                preferred consultation slot for the{' '}
                <strong className="text-emerald-300">{invitation?.positionTitle}</strong> vacancy at Saudi German Health.
              </p>
            </div>

            <form onSubmit={handleBook} className="space-y-6">
              {/* Step 1: Select Date */}
              <div className="space-y-3">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Step 1 &bull; Select Date
                </label>

                {availableDateKeys.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                    No available time slots found for the upcoming dates. Please contact your recruitment specialist.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {availableDateKeys.map((dKey) => {
                      const dateObj = new Date(dKey);
                      const isSelected = selectedDateKey === dKey;
                      const count = slotsByDate.get(dKey)?.length || 0;
                      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                      const dayMonth = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                      return (
                        <button
                          key={dKey}
                          type="button"
                          onClick={() => {
                            setSelectedDateKey(dKey);
                            setSelectedSlot(null);
                          }}
                          className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                            isSelected
                              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-400/40'
                              : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="text-[11px] font-semibold uppercase opacity-80">{weekday}</span>
                          <span className="text-sm font-extrabold">{dayMonth}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full mt-1 ${
                              isSelected ? 'bg-blue-800/80 text-blue-100' : 'bg-slate-800 text-emerald-400'
                            }`}
                          >
                            {count} slots
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 2: Select Time Slot */}
              {selectedDateKey && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Step 2 &bull; Select Time Slot
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Duration: <strong>{invitation?.durationMinutes} mins</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {currentSlots.map((slot) => {
                      const isSelected = selectedSlot?.start === slot.start;
                      const timeStr = new Date(slot.start).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Riyadh',
                      });

                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 rounded-xl border text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/50'
                              : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-slate-200'
                          }`}
                        >
                          <Icon name="clock" size={13} className={isSelected ? 'text-white' : 'text-slate-400'} />
                          <span>{timeStr} AST</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Candidate Notes */}
              {selectedSlot && (
                <div className="space-y-2 animate-fade-in">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Step 3 &bull; Additional Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={candidateNotes}
                    onChange={(e) => setCandidateNotes(e.target.value)}
                    placeholder="Provide any information for the clinical panel or questions you may have..."
                    className="w-full p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold">
                  {error}
                </div>
              )}

              {/* Confirmation Action */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  {selectedSlot ? (
                    <span>
                      Selected:{' '}
                      <strong className="text-emerald-400 font-bold">
                        {new Date(selectedSlot.start).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Riyadh',
                        })}{' '}
                        AST
                      </strong>
                    </span>
                  ) : (
                    <span>Please pick a time slot above to proceed.</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!selectedSlot || isSubmitting}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/20 transition cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirming Booking...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={16} />
                      <span>Confirm &amp; Book Appointment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-slate-900 text-center text-[11px] text-slate-400">
        &copy; {new Date().getFullYear()} Saudi German Health. Enterprise Healthcare Talent Coordination.
      </footer>
    </div>
  );
}

export default CandidateSelfSchedulePage;
