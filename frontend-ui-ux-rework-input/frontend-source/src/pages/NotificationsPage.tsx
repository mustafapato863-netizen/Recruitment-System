import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';

interface InboxNotification {
  id: string;
  title: string;
  sub: string;
  desc: string;
  time: string;
  isUnread: boolean;
  priority: 'Unread' | 'High' | 'Offer' | 'System' | 'Low';
  icon: string;
  iconBg: string;
  iconColor: string;
  details: {
    dateTime: string;
    jobTitle: string;
    interviewers: string;
    stage: string;
    location: string;
    interviewId: string;
    candidateName: string;
    candidateRole: string;
    messageText: string;
  };
}

const mockInboxItems: InboxNotification[] = [
  {
    id: '1',
    title: 'Interview Scheduled',
    sub: 'Omar Hassan – Hiring Manager Interview',
    desc: 'IT Support Specialist • May 12, 2024 at 10:00 AM',
    time: '10:02 AM',
    isUnread: true,
    priority: 'Unread',
    icon: 'calendar',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    details: {
      dateTime: 'May 12, 2024 at 10:00 AM (GST)',
      jobTitle: 'IT Support Specialist',
      interviewers: 'Omar Hassan (Hiring Manager), Yousef Hamdy (HR)',
      stage: 'Hiring Manager Interview',
      location: 'Zoom Video Call • Online',
      interviewId: 'INT-300789',
      candidateName: 'Omar Hassan',
      candidateRole: 'IT Support Specialist',
      messageText:
        'Please ensure you are available for the above interview. You will receive a calendar invite with the meeting link. Let us know if you need to reschedule.',
    },
  },
  {
    id: '2',
    title: 'New Application Received',
    sub: 'Sara Ahmed applied for Registered Nurse',
    desc: 'Registered Nurse • Application • APP-100987',
    time: '9:15 AM',
    isUnread: true,
    priority: 'High',
    icon: 'user',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    details: {
      dateTime: 'May 12, 2024 at 9:15 AM (GST)',
      jobTitle: 'Registered Nurse',
      interviewers: 'Recruitment Team',
      stage: 'Application Review',
      location: 'Main System',
      interviewId: 'APP-100987',
      candidateName: 'Sara Ahmed',
      candidateRole: 'Registered Nurse',
      messageText: 'Candidate has submitted a direct application via the Career Site. Complete screening review.',
    },
  },
  {
    id: '3',
    title: 'Offer Approved',
    sub: "Heba Salah's offer for Pharmacist has been approved",
    desc: 'Pharmacist • Offer • OFR-200456',
    time: 'Yesterday',
    isUnread: false,
    priority: 'Offer',
    icon: 'check-circle',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    details: {
      dateTime: 'May 11, 2024 at 2:45 PM (GST)',
      jobTitle: 'Pharmacist',
      interviewers: 'Finance & HR Approval Board',
      stage: 'Offer Approval',
      location: 'Internal Operations',
      interviewId: 'OFR-200456',
      candidateName: 'Heba Salah',
      candidateRole: 'Pharmacist',
      messageText: 'All executive approvals received. Formal employment offer letter is ready for candidate issuance.',
    },
  },
  {
    id: '4',
    title: 'Candidate Withdrew',
    sub: 'Yousef Hamdy withdrew from Medical Coder',
    desc: 'Medical Coder • Candidate withdrew',
    time: 'Yesterday',
    isUnread: false,
    priority: 'System',
    icon: 'user-x',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    details: {
      dateTime: 'May 11, 2024 at 11:20 AM (GST)',
      jobTitle: 'Medical Coder',
      interviewers: 'Recruitment Team',
      stage: 'Withdrawn',
      location: 'Online',
      interviewId: 'APP-100845',
      candidateName: 'Yousef Hamdy',
      candidateRole: 'Medical Coder',
      messageText: 'Candidate accepted another opportunity and withdrew their application.',
    },
  },
  {
    id: '5',
    title: 'Evaluation Submitted',
    sub: 'Omar Hassan submitted evaluation for Clinical Interview',
    desc: 'IT Support Specialist • Interview • May 7, 2024',
    time: 'May 7, 2:30 PM',
    isUnread: true,
    priority: 'Unread',
    icon: 'clipboard-check',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    details: {
      dateTime: 'May 7, 2024 at 2:30 PM (GST)',
      jobTitle: 'IT Support Specialist',
      interviewers: 'Omar Hassan (Hiring Manager)',
      stage: 'Clinical Evaluation',
      location: 'Zoom Video Call',
      interviewId: 'EVAL-900142',
      candidateName: 'Nour Ali',
      candidateRole: 'IT Support Specialist',
      messageText: 'Evaluation scorecard submitted with rating 4.5/5. Recommendation: Strong Hire.',
    },
  },
  {
    id: '6',
    title: 'Reminder: Join Interview',
    sub: 'Clinical Interview with Omar Hassan starts in 15 minutes',
    desc: 'IT Support Specialist • May 7, 2024 at 3:00 PM',
    time: 'May 7, 2:45 PM',
    isUnread: false,
    priority: 'High',
    icon: 'calendar',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    details: {
      dateTime: 'May 7, 2024 at 3:00 PM (GST)',
      jobTitle: 'IT Support Specialist',
      interviewers: 'Omar Hassan, Sara Ahmed',
      stage: 'Technical Interview',
      location: 'Zoom Video Call',
      interviewId: 'INT-300789',
      candidateName: 'Omar Hassan',
      candidateRole: 'IT Support Specialist',
      messageText: 'Automated 15-minute start reminder for upcoming scheduled interview panel.',
    },
  },
  {
    id: '7',
    title: 'Document Missing',
    sub: 'Heba Salah is missing required document: Nursing License',
    desc: 'Pharmacist • Document Request',
    time: 'May 7, 11:20 AM',
    isUnread: true,
    priority: 'Unread',
    icon: 'file-text',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    details: {
      dateTime: 'May 7, 2024 at 11:20 AM (GST)',
      jobTitle: 'Pharmacist',
      interviewers: 'Compliance Desk',
      stage: 'Pre-hire Credentialing',
      location: 'Verification Portal',
      interviewId: 'DOC-400921',
      candidateName: 'Heba Salah',
      candidateRole: 'Pharmacist',
      messageText: 'Candidate license credential expired or missing. Please issue request notification.',
    },
  },
  {
    id: '8',
    title: 'New Application Received',
    sub: 'Ahmed Farag applied for Radiology Technician',
    desc: 'Radiology Technician • Application • APP-100986',
    time: 'May 7, 10:05 AM',
    isUnread: false,
    priority: 'Low',
    icon: 'user',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    details: {
      dateTime: 'May 7, 2024 at 10:05 AM (GST)',
      jobTitle: 'Radiology Technician',
      interviewers: 'Recruitment Team',
      stage: 'New Applicant',
      location: 'Main System',
      interviewId: 'APP-100986',
      candidateName: 'Ahmed Farag',
      candidateRole: 'Radiology Technician',
      messageText: 'Candidate application submitted from Career Portal.',
    },
  },
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'All' | 'Unread' | 'Interviews' | 'Offers' | 'System'>('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('1');
  const [notifications, setNotifications] = useState<InboxNotification[]>(mockInboxItems);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await getApi<PaginatedResult<NotificationRecord>>('/notifications?page=1&pageSize=50');
        if (res?.data && res.data.length > 0) {
          const mapped: InboxNotification[] = res.data.map((n) => {
            const isInterview = n.title?.toLowerCase().includes('interview') || n.type?.toLowerCase().includes('interview');
            const isOffer = n.title?.toLowerCase().includes('offer') || n.type?.toLowerCase().includes('offer');
            return {
              id: n.id,
              title: n.title,
              sub: n.message,
              desc: `${n.entityType || 'Recruitment'} • ${new Date(n.createdAt).toLocaleDateString()}`,
              time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isUnread: !n.readAt,
              priority: isOffer ? 'Offer' : isInterview ? 'High' : n.readAt ? 'Low' : 'Unread',
              icon: isInterview ? 'calendar' : isOffer ? 'check-circle' : 'user',
              iconBg: isInterview ? 'bg-blue-50' : isOffer ? 'bg-emerald-50' : 'bg-gray-100',
              iconColor: isInterview ? 'text-blue-600' : isOffer ? 'text-emerald-600' : 'text-gray-700',
              details: {
                dateTime: new Date(n.createdAt).toLocaleString(),
                jobTitle: n.entityType || 'Recruitment Update',
                interviewers: 'Recruitment Team',
                stage: n.entityType || 'General',
                location: 'Main System',
                interviewId: n.entityId || n.id,
                candidateName: 'Candidate Profile',
                candidateRole: n.entityType || 'Specialist',
                messageText: n.message,
              },
            };
          });
          setNotifications(mapped);
          setSelectedId(mapped[0].id);
        }
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
    }
    void loadNotifications();
  }, []);

  const selectedItem = notifications.find((n) => n.id === selectedId) || notifications[0] || mockInboxItems[0];

  const handleMarkAllRead = async () => {
    try {
      await patchApi('/notifications/read-all', {});
    } catch {
      // safe fallback
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isUnread: false })));
  };

  const unreadCount = notifications.filter((n) => n.isUnread).length;

  const filteredItems = useMemo(() => {
    return notifications.filter((item) => {
      if (activeTab === 'Unread' && !item.isUnread) return false;
      if (activeTab === 'Interviews' && !item.title.toLowerCase().includes('interview')) return false;
      if (activeTab === 'Offers' && !item.title.toLowerCase().includes('offer')) return false;
      if (activeTab === 'System' && item.priority !== 'System') return false;

      if (search) {
        const match =
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.sub.toLowerCase().includes(search.toLowerCase()) ||
          item.desc.toLowerCase().includes(search.toLowerCase());
        if (!match) return false;
      }
      return true;
    });
  }, [notifications, activeTab, search]);

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Header Bar: Filter Tabs & Search (Panel 15) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('All')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'All'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('Unread')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'Unread'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                activeTab === 'Unread' ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>

          {(['Interviews', 'Offers', 'System'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[260px] flex-1 sm:flex-initial">
            <Icon name="search" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 shadow-2xs"
            />
          </div>

          <button
            type="button"
            onClick={handleMarkAllRead}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Icon name="check" size={13} /> Mark all as read
          </button>

          <button
            type="button"
            className="p-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl transition cursor-pointer shadow-2xs"
            title="Notification Filters"
          >
            <Icon name="sliders" size={15} />
          </button>
        </div>
      </div>

      {/* ── Main Two-Pane Split Layout (Panel 15) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Notification List (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* List Header */}
          <div className="p-3.5 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 bg-gray-50/50">
            <span className="flex items-center gap-1 cursor-pointer">
              Sort by: Newest <Icon name="chevron-down" size={12} className="text-gray-400" />
            </span>
            <div className="flex items-center gap-2 text-gray-500 font-semibold text-[11px]">
              <span>1–{filteredItems.length} of {notifications.length}</span>
              <div className="flex items-center gap-0.5">
                <button className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700">&lt;</button>
                <button className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700">&gt;</button>
              </div>
            </div>
          </div>

          {/* List Items */}
          <div className="divide-y divide-gray-100 max-h-[720px] overflow-y-auto rf-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                <Icon name="bell" size={24} className="mx-auto mb-2 opacity-40" />
                No notifications found
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`p-4 flex items-start gap-3 transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/30 border-l-4 border-blue-600'
                        : 'hover:bg-gray-50/70 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Notification Icon */}
                    <div className={`w-9 h-9 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon name={item.icon as any} size={16} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-gray-900 leading-tight truncate">{item.title}</h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.isUnread && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                          <span className="text-[10px] text-gray-400 font-semibold">{item.time}</span>
                        </div>
                      </div>

                      <p className="text-[11px] font-semibold text-gray-700 truncate mt-0.5">{item.sub}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.desc}</p>

                      {/* Badge */}
                      <div className="mt-2">
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                            item.priority === 'Unread'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : item.priority === 'High'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : item.priority === 'Offer'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* List Footer Pagination */}
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
            <span>Showing 1 to {filteredItems.length} of {notifications.length}</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-xs">&lt;</button>
              <button className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-xs">1</button>
              <button className="px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-xs">2</button>
              <button className="px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-xs">&gt;</button>
            </div>
          </div>
        </div>

        {/* Right Pane: Notification Detail View (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-6">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">{selectedItem.title}</h2>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <button className="p-1.5 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition" title="Mark Read">
                <Icon name="mail" size={15} />
              </button>
              <button className="p-1.5 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition" title="Star">
                <Icon name="star" size={15} />
              </button>
              <button className="p-1.5 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition" title="Options">
                <Icon name="more-horizontal" size={15} />
              </button>
            </div>
          </div>

          {/* Event Card Header */}
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-2xl ${selectedItem.iconBg} ${selectedItem.iconColor} flex items-center justify-center shrink-0`}>
              <Icon name={selectedItem.icon as any} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-gray-900 leading-tight">{selectedItem.sub}</h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 font-semibold">{selectedItem.details.jobTitle}</span>
                <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                  In Progress
                </span>
              </div>
            </div>
            <div className="text-right text-xs">
              <span className="text-gray-900 font-bold block">May 7, 2024</span>
              <span className="text-gray-400 font-medium block">{selectedItem.time}</span>
            </div>
          </div>

          <p className="text-xs text-gray-700 leading-relaxed font-medium">An interview has been scheduled.</p>

          {/* Event Metadata Grid (2x3) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50/60 rounded-xl border border-gray-200/80 text-xs">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interview Date &amp; Time</span>
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Icon name="calendar" size={13} className="text-gray-400" />
                <span>{selectedItem.details.dateTime}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Job</span>
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Icon name="briefcase" size={13} className="text-gray-400" />
                <span>{selectedItem.details.jobTitle}</span>
                <button
                  type="button"
                  onClick={() => navigate('/vacancies')}
                  className="text-[10px] text-blue-600 font-semibold hover:underline ml-1"
                >
                  View Job
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interviewers</span>
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Icon name="users" size={13} className="text-gray-400" />
                <span>{selectedItem.details.interviewers}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interview Stage</span>
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Icon name="tag" size={13} className="text-gray-400" />
                <span>{selectedItem.details.stage}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Location / Type</span>
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Icon name="video" size={13} className="text-gray-400" />
                <span>{selectedItem.details.location}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interview ID</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900">
                <Icon name="file-text" size={13} className="text-gray-400" />
                <span>{selectedItem.details.interviewId}</span>
              </div>
            </div>
          </div>

          {/* Candidate Profile Widget */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Candidate</span>
            <div className="p-3 bg-white rounded-xl border border-gray-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {selectedItem.details.candidateName.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">{selectedItem.details.candidateName}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 font-medium">{selectedItem.details.candidateRole}</span>
                    <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded">In Progress</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/candidates/1')}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                View Candidate Profile
              </button>
            </div>
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Message</span>
            <div className="p-3.5 bg-gray-50/70 border border-gray-200/80 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
              {selectedItem.details.messageText}
            </div>
          </div>

          {/* Quick Actions Footer */}
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Quick Actions</span>
            <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
              <button
                type="button"
                onClick={() => navigate('/candidates/1')}
                className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Icon name="user" size={13} className="text-blue-600" /> View Candidate
              </button>

              <button
                type="button"
                onClick={() => navigate('/interviews/1')}
                className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Icon name="calendar" size={13} className="text-emerald-600" /> Open Interview
              </button>

              <button
                type="button"
                onClick={() => navigate('/candidates/1')}
                className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Icon name="mail" size={13} className="text-blue-600" /> Reply
              </button>

              <button
                type="button"
                className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Icon name="clock" size={13} className="text-amber-600" /> Snooze
              </button>

              <button
                type="button"
                className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl flex items-center gap-1 transition cursor-pointer"
              >
                More <Icon name="chevron-down" size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
