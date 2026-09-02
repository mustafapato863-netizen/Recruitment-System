import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Candidate } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';

interface ActivityItem {
  id: string;
  type: 'email' | 'sms' | 'call' | 'note' | 'system';
  badge?: string;
  timestamp: string;
  author: string;
  body: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

const mockActivityEvents: ActivityItem[] = [
  {
    id: '1',
    type: 'email',
    badge: 'RE: Interview Confirmation',
    timestamp: 'May 7, 2024 • 10:02 AM',
    author: 'You',
    body: 'Hi Nour, Thank you for your time today. This is to confirm your interview with Omar Hassan...',
    icon: 'mail',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    id: '2',
    type: 'email',
    badge: 'Automated Email',
    timestamp: 'May 6, 2024 • 9:00 AM',
    author: 'System',
    body: 'Reminder: Clinical Interview with Omar Hassan on May 7, 2024 at 10:00 AM (GST)',
    icon: 'calendar',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: '3',
    type: 'call',
    badge: 'Outbound Call',
    timestamp: 'May 6, 2024 • 4:15 PM',
    author: 'Omar Hassan',
    body: 'Spoke with Nour about the interview process and schedule. She confirmed availability.',
    icon: 'phone',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    id: '4',
    type: 'sms',
    badge: 'Interview Day Reminder',
    timestamp: 'May 6, 2024 • 6:00 PM',
    author: 'System',
    body: 'Hi Nour, this is a reminder for your interview tomorrow at 10:00 AM (GST).',
    icon: 'message-square',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    id: '5',
    type: 'note',
    timestamp: 'May 5, 2024 • 3:20 PM',
    author: 'Omar Hassan',
    body: 'Nour is very enthusiastic and asked about the onboarding timeline.',
    icon: 'file-text',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    id: '6',
    type: 'email',
    badge: 'Re: Documents',
    timestamp: 'May 5, 2024 • 11:18 AM',
    author: 'Nour Ali',
    body: 'Please find attached my updated CV and nursing license.',
    icon: 'mail',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: '7',
    type: 'system',
    timestamp: 'May 5, 2024 • 10:10 AM',
    author: 'System',
    body: "Stage changed from 'In Progress' to 'Interview'",
    icon: 'file',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
  {
    id: '8',
    type: 'email',
    badge: 'Application Acknowledgement',
    timestamp: 'May 1, 2024 • 9:05 AM',
    author: 'System',
    body: "Thank you for applying to Good Karma Health. We've received your application.",
    icon: 'mail',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
];

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  // Filter & Composer state
  const [activityTab, setActivityTab] = useState<'All Activity' | 'Email' | 'SMS' | 'Calls' | 'Notes' | 'System'>('All Activity');
  const [composerTab, setComposerTab] = useState<'Send Message' | 'Add Note' | 'Log Call'>('Send Message');
  const [channel, setChannel] = useState<'Email' | 'SMS' | 'WhatsApp'>('Email');
  const [template, setTemplate] = useState('Interview Confirmation');
  const [subject, setSubject] = useState('Interview Confirmation – Clinical Interview');
  const [message, setMessage] = useState(
    'Hi Nour,\n\nThank you for your time today.\n\nThis is to confirm your Clinical Interview with Omar Hassan for the Registered Nurse position.'
  );
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    async function loadCandidate() {
      if (!id) return;
      try {
        const c = await getApi<Candidate>(`/candidates/${id}`);
        if (c) setCandidate(c);
      } catch (err) {
        console.error('Failed to load candidate', err);
      }
    }
    void loadCandidate();
  }, [id]);

  const candidateName = candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Nour Ali';
  const candidateEmail = candidate?.email || 'nour.ali@example.com';
  const candidatePhone = candidate?.phone || '+968 9966 5432';
  const candidateLocation = candidate?.location || 'Muscat, Oman';

  const filteredActivities = mockActivityEvents.filter((ev) => {
    if (activityTab === 'All Activity') return true;
    if (activityTab === 'Email' && ev.type === 'email') return true;
    if (activityTab === 'SMS' && ev.type === 'sms') return true;
    if (activityTab === 'Calls' && ev.type === 'call') return true;
    if (activityTab === 'Notes' && ev.type === 'note') return true;
    if (activityTab === 'System' && ev.type === 'system') return true;
    return false;
  });

  const handleSendMessage = () => {
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 3000);
  };

  const handleUseTemplate = (tmplName: string, subj: string, body: string) => {
    setTemplate(tmplName);
    setSubject(subj);
    setMessage(body);
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Top Back Button ── */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/candidates')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
        >
          &larr; Back to Candidates
        </button>
      </div>

      {/* ── Candidate Banner Card (Panel 16) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-lg flex items-center justify-center shrink-0 ring-4 ring-blue-50 shadow-xs">
            {candidateName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CA'}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight leading-tight">{candidateName}</h1>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Active
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-600 mt-0.5">Healthcare Specialist Candidate</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm lg:border-l lg:border-gray-200 lg:pl-6">
          <div>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Current Stage</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Interview
            </span>
          </div>

          <div>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Applied For</span>
            <span className="font-bold text-gray-900 text-sm">Clinical Requisition</span>
          </div>

          <div className="space-y-1 col-span-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <Icon name="mail" size={14} className="text-gray-400 shrink-0" />
              <span className="truncate">{candidateEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <Icon name="phone" size={14} className="text-gray-400 shrink-0" />
              <span>{candidatePhone}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <Icon name="map-pin" size={14} className="text-gray-400 shrink-0" />
              <span>{candidateLocation}</span>
            </div>
          </div>
        </div>

        {/* Odoo-style Smart Summary & Next Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/interviews')}
            className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Icon name="calendar" size={14} /> 1 Interview
          </button>
          <button
            type="button"
            onClick={() => navigate('/offers')}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Icon name="offer" size={14} /> Prepare Offer
          </button>
          <button
            type="button"
            onClick={() => setComposerTab('Add Note')}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Icon name="file-text" size={14} /> Add Note
          </button>
        </div>
      </div>

      {/* ── Main 3-Column Layout (Panel 16) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Activity Timeline Stream (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
          {/* Header & Filter Tabs */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
              {(['All Activity', 'Email', 'SMS', 'Calls', 'Notes', 'System'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActivityTab(tab)}
                  className={`pb-1 transition cursor-pointer whitespace-nowrap ${
                    activityTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold'
                      : 'text-gray-500 hover:text-gray-900 border-b-2 border-transparent'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Filter Activity">
              <Icon name="sliders" size={14} />
            </button>
          </div>

          {/* Activity Cards List */}
          <div className="space-y-3 max-h-[640px] overflow-y-auto rf-scrollbar pr-1">
            {filteredActivities.map((ev) => (
              <div key={ev.id} className="p-3.5 bg-gray-50/50 hover:bg-gray-50 rounded-xl border border-gray-200/70 space-y-1.5 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-lg ${ev.iconBg} ${ev.iconColor} flex items-center justify-center shrink-0`}>
                      <Icon name={ev.icon as any} size={13} />
                    </div>
                    <span className="font-bold text-gray-900 text-xs truncate">
                      {ev.type === 'email' ? 'Email Sent' : ev.type === 'call' ? 'Call Logged' : ev.type === 'sms' ? 'SMS Sent' : ev.type === 'note' ? 'Candidate Note Added' : 'System Note'}
                    </span>
                    {ev.badge && (
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 truncate">
                        {ev.badge}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed font-medium pl-8">{ev.body}</p>

                <div className="flex items-center justify-between text-[10px] text-gray-400 pl-8 pt-0.5">
                  <span>{ev.timestamp}</span>
                  <span className="font-semibold text-gray-500">{ev.author}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-center border-t border-gray-100">
            <button className="text-xs font-bold text-blue-600 hover:underline">
              Load more activity ▼
            </button>
          </div>
        </div>

        {/* Center Column: Multi-Channel Message Composer (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
          {/* Top Composer Tabs */}
          <div className="flex items-center gap-4 border-b border-gray-100 pb-2 text-xs font-bold">
            {(['Send Message', 'Add Note', 'Log Call'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setComposerTab(tab)}
                className={`pb-2 transition cursor-pointer ${
                  composerTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold'
                    : 'text-gray-500 hover:text-gray-900 border-b-2 border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Channel Selector */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Channel</label>
            <div className="grid grid-cols-3 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setChannel('Email')}
                className={`py-2 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  channel === 'Email' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon name="mail" size={13} /> Email
              </button>

              <button
                type="button"
                onClick={() => setChannel('SMS')}
                className={`py-2 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  channel === 'SMS' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon name="message-square" size={13} /> SMS
              </button>

              <button
                type="button"
                disabled
                className="py-2 px-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 flex items-center justify-center gap-1 text-[11px] cursor-not-allowed"
              >
                🟢 WhatsApp <span className="text-[9px] opacity-75">(Soon)</span>
              </button>
            </div>
          </div>

          {/* Template Selector */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Template</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-gray-50/70 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-600 font-medium"
            >
              <option value="Interview Confirmation">Interview Confirmation</option>
              <option value="Offer Follow-up">Offer Follow-up</option>
              <option value="Missing Documents">Missing Documents Request</option>
              <option value="Application Received">Application Received</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-gray-50/70 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-600 font-medium"
            />
          </div>

          {/* Message Area with Toolbar */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Message</label>
            <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-600">
              {/* Toolbar */}
              <div className="p-2 border-b border-gray-200 bg-gray-50/70 flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold text-gray-700">Inter ▼</span>
                <span className="font-semibold text-gray-700">14 ▼</span>
                <span className="h-4 w-px bg-gray-300 mx-1" />
                <button type="button" className="font-bold hover:text-gray-900">B</button>
                <button type="button" className="italic hover:text-gray-900">I</button>
                <button type="button" className="underline hover:text-gray-900">U</button>
                <span className="h-4 w-px bg-gray-300 mx-1" />
                <Icon name="list" size={13} />
                <Icon name="link" size={13} />
              </div>

              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-3 text-xs text-gray-800 leading-relaxed focus:outline-none resize-none bg-white font-medium"
              />

              <div className="p-2 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-xs text-gray-500">
                <button type="button" className="flex items-center gap-1 font-bold text-gray-600 hover:text-gray-900">
                  <span className="font-mono">{'{ }'}</span> Personalize ▼
                </button>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Attachments</span>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 text-xs">
              <Icon name="file" size={14} className="text-rose-500" />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-gray-900 truncate block">Interview_Details_May7.pdf</span>
                <span className="text-[10px] text-gray-400">PDF • 132 KB</span>
              </div>
              <button className="text-gray-400 hover:text-gray-600 text-xs font-bold p-1">✕</button>
            </div>

            <button type="button" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 pt-1">
              <Icon name="plus" size={12} /> Add Attachment
            </button>
          </div>

          {/* Send Button */}
          <div className="pt-2">
            {sentSuccess ? (
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-center text-xs font-bold border border-emerald-200">
                ✓ Message dispatched successfully!
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Icon name="send" size={13} /> Send Email
                </button>
                <div className="text-center">
                  <button type="button" className="text-[11px] text-gray-500 font-semibold hover:text-gray-800 flex items-center justify-center gap-1 mx-auto">
                    <Icon name="clock" size={12} /> Schedule for later
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Widgets (Upcoming Interview, Attachments, Templates, Actions) (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Widget 1: Upcoming Interview */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-2.5">
            <h3 className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
              <Icon name="calendar" size={14} className="text-blue-600" /> Upcoming Interview
            </h3>

            <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Clinical Interview</span>
                <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                  Confirmed
                </span>
              </div>
              <p className="text-[11px] text-gray-600">with Omar Hassan</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-gray-900">
                <Icon name="clock" size={11} className="text-gray-400" />
                <span>May 7, 2024 • 10:00 AM (GST)</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-blue-100/60 text-[11px]">
                <span className="text-gray-500">Zoom Video Call</span>
                <button
                  type="button"
                  onClick={() => navigate('/interviews/1')}
                  className="font-bold text-blue-600 hover:underline"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>

          {/* Widget 2: Recent Attachments */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                <Icon name="file" size={14} className="text-gray-400" /> Recent Attachments
              </h3>
              <button className="text-[10px] font-bold text-blue-600 hover:underline">View All</button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { name: 'Nour_Ali_CV_Updated.pdf', size: '245 KB', date: 'May 5, 2024' },
                { name: 'Nursing_License_Oman.pdf', size: '198 KB', date: 'May 5, 2024' },
                { name: 'Degree_Certificate.pdf', size: '156 KB', date: 'Apr 30, 2024' },
              ].map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50/60 rounded-xl border border-gray-200/70 hover:bg-gray-100/60 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="file-text" size={13} className="text-rose-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-gray-900 block truncate text-[11px]">{doc.name}</span>
                      <span className="text-[10px] text-gray-400">PDF • {doc.size} • {doc.date}</span>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-700 p-1">
                    <Icon name="download" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Widget 3: Suggested Templates */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                <Icon name="sparkles" size={14} className="text-amber-500" /> Suggested Templates
              </h3>
              <button className="text-[10px] font-bold text-blue-600 hover:underline">View All</button>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                {
                  title: 'Interview Confirmation',
                  desc: 'Confirm interview details with candidate.',
                  subj: 'Interview Confirmation – Clinical Interview',
                  body: 'Hi Nour,\n\nThank you for your time today.\n\nThis is to confirm your Clinical Interview with Omar Hassan.',
                },
                {
                  title: 'Offer Follow-up',
                  desc: 'Follow up after offer is sent.',
                  subj: 'Offer Follow-up – Employment Offer Details',
                  body: 'Hi Nour,\n\nWe wanted to follow up on your formal employment offer. Please let us know if you have questions.',
                },
                {
                  title: 'Missing Documents',
                  desc: 'Request missing documents from candidate.',
                  subj: 'Action Required: Missing Licensure Documents',
                  body: 'Hi Nour,\n\nPlease upload a copy of your valid nursing license so we can finalize compliance review.',
                },
              ].map((tmpl, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-[11px] font-bold text-gray-900">{tmpl.title}</h4>
                    <p className="text-[10px] text-gray-400 leading-snug">{tmpl.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUseTemplate(tmpl.title, tmpl.subj, tmpl.body)}
                    className="px-2.5 py-1 bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-bold shrink-0 transition cursor-pointer"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Widget 4: Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-extrabold text-gray-900 mb-2">Quick Actions</h3>

            <div className="space-y-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => navigate('/applications')}
                className="w-full py-2 px-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Icon name="arrow-right" size={13} className="text-blue-600" /> Move to Next Stage
                </span>
                <span className="text-gray-400">&gt;</span>
              </button>

              <button
                type="button"
                onClick={() => setComposerTab('Add Note')}
                className="w-full py-2 px-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                <Icon name="file-text" size={13} className="text-blue-600" /> Add Candidate Note
              </button>

              <button
                type="button"
                className="w-full py-2 px-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                <Icon name="upload" size={13} className="text-blue-600" /> Upload Document
              </button>

              <button
                type="button"
                onClick={() => navigate('/interviews/1')}
                className="w-full py-2 px-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                <Icon name="share-2" size={13} className="text-blue-600" /> Share Interview Feedback
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
