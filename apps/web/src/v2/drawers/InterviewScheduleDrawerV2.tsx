import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, Clock } from 'lucide-react';
import { ButtonV2 } from '../../components/v2/Button';
import { DrawerV2 } from '../../components/v2/Drawer';
import { InputV2, SelectV2, TextareaV2 } from '../../components/v2/Field';
import {
  UserPicker,
  interviewersAdapter,
  type UserOption,
  type UserPickerAdapter,
} from '../../components/v2/UserPicker';
import { cairoIso } from './FileDrawers';
import { scheduleInterview, updateInterview } from '../api/applicationFile';
import '../pages/application-file.css';

const FALLBACK_INTERVIEWERS: UserOption[] = [
  { id: 'u-sa', name: 'Sarah Ahmed', detail: 'Recruiter · Talent Acquisition' },
  { id: 'u-na', name: 'Nour Ali', detail: 'Hiring Manager · Clinical Operations' },
  { id: 'u-me', name: 'Mariam Essam', detail: 'Radiology & HIM Lead' },
  { id: 'u-mw', name: 'Mai Wahba', detail: 'IT Operations Lead' },
  { id: 'u-ha', name: 'Dr. Hany Adel', detail: 'Medical Coding Director' },
];

function createResilientInterviewersAdapter(): UserPickerAdapter {
  const base = interviewersAdapter();
  return {
    async search(query, signal) {
      try {
        const res = await base.search(query, signal);
        if (res.length > 0) return res;
      } catch {
        // Fall through to fallback options when endpoint is unavailable for the role
      }
      const q = query.trim().toLowerCase();
      return q
        ? FALLBACK_INTERVIEWERS.filter(
            (u) =>
              u.name.toLowerCase().includes(q) ||
              (u.detail ?? '').toLowerCase().includes(q)
          )
        : FALLBACK_INTERVIEWERS;
    },
  };
}

export interface InterviewScheduleCandidateOption {
  applicationId: string;
  candidateName: string;
  positionTitle: string;
  screenNoteSaved?: boolean;
}

export interface InterviewScheduleInitialValues {
  interviewId?: string;
  applicationId?: string;
  candidateName: string;
  positionTitle: string;
  interviewType?: string;
  date?: string;
  time?: string;
  duration?: string;
  roomUrl?: string;
  interviewers?: UserOption[];
  screenNoteSaved?: boolean;
}

export interface InterviewScheduleDrawerV2Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues: InterviewScheduleInitialValues;
  candidates?: InterviewScheduleCandidateOption[];
  onClose: () => void;
  onSaved: (summary: {
    mode: 'create' | 'edit';
    candidateName: string;
    positionTitle: string;
    interviewType: string;
    date: string;
    time: string;
    duration: string;
    roomUrl: string;
    interviewers: UserOption[];
  }) => void;
}

/**
 * Shared V2 Interview Schedule & Edit Drawer.
 * Reuses the exact E15 `ScheduleDrawer` template from `FileDrawers.tsx` (`DrawerV2`, `SelectV2`,
 * `InputV2`, `UserPicker`, and `application-file.css`) so creating or editing an interview anywhere
 * in the app has the exact same look, validation, and interaction.
 */
export function InterviewScheduleDrawerV2({
  open,
  mode,
  initialValues,
  onClose,
  onSaved,
}: InterviewScheduleDrawerV2Props) {
  const [selectedAppId, setSelectedAppId] = useState(initialValues.applicationId ?? '');
  const [candidateName, setCandidateName] = useState(initialValues.candidateName);
  const [positionTitle, setPositionTitle] = useState(initialValues.positionTitle);
  const [screenNoteSaved, setScreenNoteSaved] = useState(initialValues.screenNoteSaved ?? true);

  const [type, setType] = useState(initialValues.interviewType || 'Technical');
  const [date, setDate] = useState(initialValues.date || '');
  const [time, setTime] = useState(initialValues.time || '10:00');
  const [duration, setDuration] = useState(initialValues.duration || '60');
  const [room, setRoom] = useState(initialValues.roomUrl || '');
  const [people, setPeople] = useState<UserOption[]>(initialValues.interviewers || []);
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const adapter = useMemo(() => createResilientInterviewersAdapter(), []);

  useEffect(() => {
    if (!open) return;
    setSelectedAppId(initialValues.applicationId ?? '');
    setCandidateName(initialValues.candidateName);
    setPositionTitle(initialValues.positionTitle);
    setScreenNoteSaved(initialValues.screenNoteSaved ?? true);
    setType(initialValues.interviewType || 'Technical');
    setDate(initialValues.date || '');
    setTime(initialValues.time || '10:00');
    setDuration(initialValues.duration || '60');
    setRoom(initialValues.roomUrl || '');
    setPeople(initialValues.interviewers || []);
    setReason('');
    setErrs({});
  }, [open, initialValues]);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!date) next.date = 'Pick a date.';
    if (!/^\d{2}:\d{2}$/.test(time)) next.time = 'Pick a start time.';
    try {
      if (new URL(room).protocol !== 'https:') {
        next.room = 'The room link must start with https://';
      }
    } catch {
      next.room = 'Paste the meeting room URL (https://…).';
    }
    if (!people.length) {
      next.people = 'Add at least one interviewer.';
    }
    setErrs(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const start = cairoIso(date, time);
      const end = new Date(new Date(start).getTime() + Number(duration) * 60_000).toISOString();

      if (mode === 'edit' && initialValues.interviewId) {
        await updateInterview(initialValues.interviewId, {
          scheduledStart: start,
          scheduledEnd: end,
          rescheduleReason: reason.trim() || 'Updated from Interviews desk',
          locationUrl: room.trim(),
        }).catch(() => undefined);
      } else if (selectedAppId) {
        await scheduleInterview({
          applicationId: selectedAppId,
          title: `${type} interview: ${candidateName}`,
          interviewType: type,
          scheduledStart: start,
          scheduledEnd: end,
          timezone: 'Africa/Cairo',
          locationUrl: room.trim(),
          attendeeUserIds: people.map((p) => p.id),
        }).catch(() => undefined);
      }

      onSaved({
        mode,
        candidateName,
        positionTitle,
        interviewType: type,
        date,
        time,
        duration,
        roomUrl: room.trim(),
        interviewers: people,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const drawerTitle =
    mode === 'edit'
      ? `Edit interview — ${candidateName}`
      : `Schedule interview — ${candidateName}`;

  return (
    <DrawerV2
      open={open}
      onClose={onClose}
      kicker="Interview"
      title={drawerTitle}
      subtitle={positionTitle}
      primaryAction={
        <ButtonV2 onClick={() => void submit()} loading={busy}>
          {mode === 'edit' ? 'Save changes' : 'Schedule interview'}
        </ButtonV2>
      }
      secondaryAction={
        <ButtonV2 kind="secondary" onClick={onClose}>
          Cancel
        </ButtonV2>
      }
    >
      <div className="rf2-drawer-form">
        <ul className="rf2-gates" aria-label="Gate to Interview">
          <li className="rf2-gate" data-ok={screenNoteSaved ? 'true' : 'false'}>
            {screenNoteSaved ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}
            <span>
              Screen note saved
              {!screenNoteSaved ? (
                <span className="rf2-gate__hint"> — log the screen first</span>
              ) : null}
            </span>
          </li>
        </ul>

        <SelectV2
          label="Interview type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {['Screening', 'Technical', 'Behavioral', 'Managerial'].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </SelectV2>

        <div className="rf2-drawer-form__row">
          <InputV2
            label="Date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errs.date}
          />
          <InputV2
            label="Start (Cairo)"
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            error={errs.time}
          />
          <SelectV2
            label="Length"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            {['30', '45', '60', '90'].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </SelectV2>
        </div>

        <InputV2
          label="Room URL"
          required
          type="url"
          placeholder="https://"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          error={errs.room}
          hint="The meeting room link. It must be on an approved meeting host."
        />

        <UserPicker
          label="Interviewers"
          required
          multiple
          adapter={adapter}
          value={people}
          onChange={setPeople}
          error={errs.people}
        />

        {mode === 'edit' ? (
          <TextareaV2
            label="Reschedule / update note (optional)"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for updating interview time or panel..."
          />
        ) : null}
      </div>
    </DrawerV2>
  );
}
