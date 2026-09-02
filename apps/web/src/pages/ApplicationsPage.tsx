import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type { Application, PaginatedResult } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { CandidateSplitDrawer } from '../components/candidate/CandidateSplitDrawer';
import { Modal } from '../components/Modal';
import './PageEnhancementsV2.css';

interface KanbanCard {
  id: string;
  name: string;
  photoUrl: string;
  appliedText: string;
  owner: {
    name: string;
    initials: string;
    color: string;
  };
  nextAction: string;
  nextDue: string;
  nextDueTone: 'blue' | 'purple' | 'amber' | 'gray';
  lastActivity: string;
  lastActivityTime: string;
  stage: string;
}

interface KanbanColumn {
  id: string;
  name: string;
  stageKey: string;
  count: number;
  subtext: string;
  cards: KanbanCard[];
}

interface ListRowCandidate {
  id: string;
  name: string;
  avatar: string;
  appliedAgo: string;
  positionTitle: string;
  department: string;
  location: string;
  currentStage: string;
  stageColor: string;
  ownerName: string;
  ownerAvatar: string;
  sla: string;
  slaSub: string;
  slaTone: 'amber' | 'red' | 'green';
  lastActivity: string;
  lastActivityTime: string;
  source: string;
  fitScore: number;
  nextAction: string;
  nextActionTime: string;
  nextActionIcon: string;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  {
    id: 'new',
    name: 'New',
    stageKey: 'Applied',
    count: 8,
    subtext: '8 candidates',
    cards: [
      {
        id: 'app-1',
        name: 'Sara Mohamed',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 2 hours ago',
        owner: { name: 'Sarah Ahmed', initials: 'SA', color: 'bg-teal-600' },
        nextAction: 'Review CV',
        nextDue: 'Today',
        nextDueTone: 'blue',
        lastActivity: 'CV submitted',
        lastActivityTime: '2 hours ago',
        stage: 'Applied',
      },
      {
        id: 'app-2',
        name: 'Kareem Tarek',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 5 hours ago',
        owner: { name: 'Kareem Tarek', initials: 'KT', color: 'bg-teal-700' },
        nextAction: 'Initial review',
        nextDue: 'Today',
        nextDueTone: 'blue',
        lastActivity: 'Portfolio attached',
        lastActivityTime: '5 hours ago',
        stage: 'Applied',
      },
      {
        id: 'app-3',
        name: 'Heba Adel',
        photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 1 day ago',
        owner: { name: 'Heba Adel', initials: 'HA', color: 'bg-emerald-600' },
        nextAction: 'Check availability',
        nextDue: 'Tomorrow',
        nextDueTone: 'amber',
        lastActivity: 'LinkedIn profile imported',
        lastActivityTime: '1 day ago',
        stage: 'Applied',
      },
    ],
  },
  {
    id: 'screening',
    name: 'Screening',
    stageKey: 'Screening',
    count: 12,
    subtext: '12 candidates',
    cards: [
      {
        id: 'app-4',
        name: 'Mona Saleh',
        photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 3 days ago',
        owner: { name: 'Mona Saleh', initials: 'MS', color: 'bg-teal-600' },
        nextAction: 'Phone screen',
        nextDue: 'Today, 3:00 PM',
        nextDueTone: 'blue',
        lastActivity: 'Screening scheduled',
        lastActivityTime: 'Yesterday',
        stage: 'Screening',
      },
      {
        id: 'app-5',
        name: 'Omar Farouk',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 4 days ago',
        owner: { name: 'Omar Farouk', initials: 'OF', color: 'bg-teal-700' },
        nextAction: 'Send tech questionnaire',
        nextDue: 'Today',
        nextDueTone: 'blue',
        lastActivity: 'Phone screen completed',
        lastActivityTime: 'Today',
        stage: 'Screening',
      },
      {
        id: 'app-6',
        name: 'Yousef Ahmed',
        photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 5 days ago',
        owner: { name: 'Yousef Ahmed', initials: 'YA', color: 'bg-emerald-600' },
        nextAction: 'Awaiting questionnaire',
        nextDue: 'In 2 days',
        nextDueTone: 'gray',
        lastActivity: 'Questionnaire sent',
        lastActivityTime: '2 days ago',
        stage: 'Screening',
      },
    ],
  },
  {
    id: 'technical',
    name: 'Technical Interview',
    stageKey: 'Interview',
    count: 5,
    subtext: '5 candidates',
    cards: [
      {
        id: 'APP-02481',
        name: 'Ali Hassan',
        photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 6 days ago',
        owner: { name: 'Sarah Ahmed', initials: 'SA', color: 'bg-teal-600' },
        nextAction: 'Technical interview',
        nextDue: 'Today, 2:00 PM',
        nextDueTone: 'blue',
        lastActivity: 'Interview invitation sent',
        lastActivityTime: 'Today',
        stage: 'Interview',
      },
      {
        id: 'app-8',
        name: 'Khaled Mostafa',
        photoUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 8 days ago',
        owner: { name: 'Khaled Mostafa', initials: 'KM', color: 'bg-teal-700' },
        nextAction: 'Code review discussion',
        nextDue: 'Tomorrow, 11:00 AM',
        nextDueTone: 'purple',
        lastActivity: 'Assignment submitted',
        lastActivityTime: 'Yesterday',
        stage: 'Interview',
      },
      {
        id: 'app-9',
        name: 'Nourhan Sami',
        photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 9 days ago',
        owner: { name: 'Nourhan Sami', initials: 'NS', color: 'bg-emerald-600' },
        nextAction: 'System design session',
        nextDue: 'Tomorrow, 3:30 PM',
        nextDueTone: 'purple',
        lastActivity: 'Technical round 1 passed',
        lastActivityTime: '2 days ago',
        stage: 'Interview',
      },
    ],
  },
  {
    id: 'hm_interview',
    name: 'Hiring Manager',
    stageKey: 'Interview',
    count: 3,
    subtext: '3 candidates',
    cards: [
      {
        id: 'app-10',
        name: 'Tarek Ibrahim',
        photoUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 11 days ago',
        owner: { name: 'Tarek Ibrahim', initials: 'TI', color: 'bg-teal-600' },
        nextAction: 'HM interview',
        nextDue: 'Today, 4:30 PM',
        nextDueTone: 'blue',
        lastActivity: 'Technical feedback approved',
        lastActivityTime: 'Yesterday',
        stage: 'Interview',
      },
      {
        id: 'app-11',
        name: 'Fatima Zahra',
        photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 12 days ago',
        owner: { name: 'Fatima Zahra', initials: 'FZ', color: 'bg-teal-700' },
        nextAction: 'Culture fit chat',
        nextDue: 'Tomorrow',
        nextDueTone: 'amber',
        lastActivity: 'Panel interview completed',
        lastActivityTime: 'Yesterday',
        stage: 'Interview',
      },
    ],
  },
  {
    id: 'offer',
    name: 'Offer',
    stageKey: 'Offer',
    count: 2,
    subtext: '2 candidates',
    cards: [
      {
        id: 'app-13',
        name: 'Ahmed Samy',
        photoUrl: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 15 days ago',
        owner: { name: 'Ahmed Samy', initials: 'AS', color: 'bg-teal-600' },
        nextAction: 'Offer approval',
        nextDue: 'Today',
        nextDueTone: 'blue',
        lastActivity: 'Offer drafted',
        lastActivityTime: 'Yesterday',
        stage: 'Offer',
      },
      {
        id: 'app-14',
        name: 'Omar Ashraf',
        photoUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 16 days ago',
        owner: { name: 'Omar Ashraf', initials: 'OA', color: 'bg-teal-700' },
        nextAction: 'Offer discussion',
        nextDue: 'Tomorrow',
        nextDueTone: 'amber',
        lastActivity: 'Compensation review',
        lastActivityTime: '1 day ago',
        stage: 'Offer',
      },
    ],
  },
  {
    id: 'hired',
    name: 'Hired',
    stageKey: 'Joined',
    count: 1,
    subtext: '1 candidate',
    cards: [
      {
        id: 'app-15',
        name: 'Mariam Adel',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        appliedText: 'Applied 20 days ago',
        owner: { name: 'Mariam Adel', initials: 'MA', color: 'bg-teal-600' },
        nextAction: 'Onboarding prep',
        nextDue: 'Next week',
        nextDueTone: 'gray',
        lastActivity: 'Offer accepted',
        lastActivityTime: '2 days ago',
        stage: 'Joined',
      },
    ],
  },
];

const DEFAULT_LIST_ROWS: ListRowCandidate[] = [
  {
    id: 'APP-02481',
    name: 'Ali Hassan',
    avatar: 'AH',
    appliedAgo: 'Applied 2 days ago',
    positionTitle: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Cairo, Egypt',
    currentStage: 'Technical Interview',
    stageColor: 'blue',
    ownerName: 'Sarah Ahmed',
    ownerAvatar: 'SA',
    sla: '5h left',
    slaSub: 'Due today 8:00 PM',
    slaTone: 'amber',
    lastActivity: 'Interview invitation sent',
    lastActivityTime: 'Today, 9:12 AM',
    source: 'Careers Site',
    fitScore: 85,
    nextAction: 'Interview',
    nextActionTime: 'Today, 2:00 PM',
    nextActionIcon: 'calendar',
  },
  {
    id: 'app-4',
    name: 'Mona Saleh',
    avatar: 'MS',
    appliedAgo: 'Applied 5 days ago',
    positionTitle: 'Registered Nurse – ICU',
    department: 'Clinical Ops',
    location: 'Jeddah, KSA',
    currentStage: 'Screening',
    stageColor: 'green',
    ownerName: 'Mona Saleh',
    ownerAvatar: 'MS',
    sla: '4h overdue',
    slaSub: 'Overdue since 4:15 PM',
    slaTone: 'red',
    lastActivity: 'Phone screen scheduled',
    lastActivityTime: 'Today, 10:30 AM',
    source: 'Employee Referral',
    fitScore: 62,
    nextAction: 'Phone Screen',
    nextActionTime: 'Tomorrow, 10:30 AM',
    nextActionIcon: 'phone',
  },
  {
    id: 'app-8',
    name: 'Khaled Mostafa',
    avatar: 'KM',
    appliedAgo: 'Applied 11 days ago',
    positionTitle: 'Product Designer',
    department: 'Design',
    location: 'Riyadh, KSA',
    currentStage: 'Panel Interview',
    stageColor: 'purple',
    ownerName: 'Khaled Mostafa',
    ownerAvatar: 'KM',
    sla: '2h left',
    slaSub: 'Due today 11:00 AM',
    slaTone: 'amber',
    lastActivity: 'Panel interview completed',
    lastActivityTime: 'Yesterday, 3:45 PM',
    source: 'Job Boards',
    fitScore: 90,
    nextAction: 'Offer Approval',
    nextActionTime: 'Today, 4:00 PM',
    nextActionIcon: 'award',
  },
  {
    id: 'app-13',
    name: 'Ahmed Samy',
    avatar: 'AS',
    appliedAgo: 'Applied 15 days ago',
    positionTitle: 'Backend Engineer',
    department: 'Engineering',
    location: 'Riyadh, KSA',
    currentStage: 'Offer',
    stageColor: 'orange',
    ownerName: 'Ahmed Samy',
    ownerAvatar: 'AS',
    sla: 'On track',
    slaSub: 'Due in 2 days',
    slaTone: 'green',
    lastActivity: 'Offer drafted',
    lastActivityTime: 'Today, 9:20 AM',
    source: 'LinkedIn',
    fitScore: 78,
    nextAction: 'Send Offer',
    nextActionTime: 'Tomorrow, 11:00 AM',
    nextActionIcon: 'send',
  },
  {
    id: 'app-16',
    name: 'Noha Farouk',
    avatar: 'NF',
    appliedAgo: 'Applied 18 days ago',
    positionTitle: 'UX Designer',
    department: 'Design',
    location: 'Cairo, Egypt',
    currentStage: 'Hiring Manager',
    stageColor: 'amber',
    ownerName: 'Noha Farouk',
    ownerAvatar: 'NF',
    sla: '1h overdue',
    slaSub: 'Overdue since 9:00 AM',
    slaTone: 'red',
    lastActivity: 'HM interview scheduled',
    lastActivityTime: 'Today, 9:00 AM',
    source: 'Careers Site',
    fitScore: 70,
    nextAction: 'HM Interview',
    nextActionTime: 'Today, 3:00 PM',
    nextActionIcon: 'users',
  },
  {
    id: 'app-5',
    name: 'Omar Farouk',
    avatar: 'OF',
    appliedAgo: 'Applied 12 days ago',
    positionTitle: 'Data Analyst',
    department: 'Strategy & Analytics',
    location: 'Cairo, EG',
    currentStage: 'Screening',
    stageColor: 'green',
    ownerName: 'Omar Farouk',
    ownerAvatar: 'OF',
    sla: 'On track',
    slaSub: 'Due in 3 days',
    slaTone: 'green',
    lastActivity: 'CV submitted',
    lastActivityTime: 'Yesterday, 2:10 PM',
    source: 'Employee Referral',
    fitScore: 75,
    nextAction: 'Phone Screen',
    nextActionTime: 'Tomorrow, 9:30 AM',
    nextActionIcon: 'phone',
  },
  {
    id: 'app-17',
    name: 'Ahmed Mostafa',
    avatar: 'AM',
    appliedAgo: 'Applied 16 days ago',
    positionTitle: 'Radiology Technologist',
    department: 'Imaging',
    location: 'Dammam, KSA',
    currentStage: 'Technical Interview',
    stageColor: 'blue',
    ownerName: 'Ahmed Mostafa',
    ownerAvatar: 'AM',
    sla: 'On track',
    slaSub: 'Due in 1 day',
    slaTone: 'green',
    lastActivity: 'Technical interview',
    lastActivityTime: 'Today, 8:45 AM',
    source: 'Job Boards',
    fitScore: 80,
    nextAction: 'Panel Interview',
    nextActionTime: 'Today, 1:00 PM',
    nextActionIcon: 'users',
  },
  {
    id: 'app-18',
    name: 'Sara Ahmed',
    avatar: 'SA',
    appliedAgo: 'Applied 9 days ago',
    positionTitle: 'HR Business Partner',
    department: 'People & Culture',
    location: 'Riyadh, KSA',
    currentStage: 'Offer',
    stageColor: 'orange',
    ownerName: 'Lina Hassan',
    ownerAvatar: 'LH',
    sla: 'On track',
    slaSub: 'Due in 2 days',
    slaTone: 'green',
    lastActivity: 'Offer approved by HR',
    lastActivityTime: 'Yesterday, 4:35 PM',
    source: 'LinkedIn',
    fitScore: 95,
    nextAction: 'Send Offer',
    nextActionTime: 'Today, 2:30 PM',
    nextActionIcon: 'send',
  },
  {
    id: 'app-6',
    name: 'Yousef Ahmed',
    avatar: 'YA',
    appliedAgo: 'Applied 6 days ago',
    positionTitle: 'DevOps Engineer',
    department: 'Engineering',
    location: 'Jeddah, KSA',
    currentStage: 'Screening',
    stageColor: 'green',
    ownerName: 'Yousef Ahmed',
    ownerAvatar: 'YA',
    sla: 'On track',
    slaSub: 'Due in 4 days',
    slaTone: 'green',
    lastActivity: 'CV reviewed',
    lastActivityTime: 'Today, 7:20 AM',
    source: 'Careers Site',
    fitScore: 65,
    nextAction: 'Screening Call',
    nextActionTime: 'Tomorrow, 11:00 AM',
    nextActionIcon: 'phone',
  },
  {
    id: 'app-19',
    name: 'Heba Mohamed',
    avatar: 'HM',
    appliedAgo: 'Applied 8 days ago',
    positionTitle: 'Medical Coder',
    department: 'Clinical Ops',
    location: 'Riyadh, KSA',
    currentStage: 'New',
    stageColor: 'slate',
    ownerName: 'Heba Mohamed',
    ownerAvatar: 'HM',
    sla: 'On track',
    slaSub: 'Due in 6 days',
    slaTone: 'green',
    lastActivity: 'Application received',
    lastActivityTime: 'Today, 6:15 AM',
    source: 'Job Boards',
    fitScore: 60,
    nextAction: 'Review CV',
    nextActionTime: 'Today, 10:00 AM',
    nextActionIcon: 'file-text',
  },
];

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vacancyId = searchParams.get('vacancyId');
  const [, setApiApplications] = useState<Application[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState('Senior Frontend Engineer');
  const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [selectedDrawerApp, setSelectedDrawerApp] = useState<Application | null>(null);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);

  // Mutable Kanban board state with live drag-and-drop
  const [boardColumns, setBoardColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; sourceColId: string } | null>(null);
  const [activeDropColId, setActiveDropColId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // List view state
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  const loadApplications = useCallback(() => {
    const url = vacancyId
      ? `/applications?vacancyId=${vacancyId}&page=1&pageSize=100`
      : '/applications?page=1&pageSize=100';
    getApi<PaginatedResult<Application>>(url)
      .then((res) => {
        const list = res?.data || [];
        setApiApplications(list);
        if (list.length > 0) {
          setBoardColumns((prev) => {
            return prev.map((col) => {
              const matchedApps = list.filter((a) => {
                if (col.id === 'screening') return a.stage === 'Screening';
                if (col.id === 'technical') return a.stage === 'Interview';
                if (col.id === 'hm_interview') return a.stage === 'Interview';
                if (col.id === 'offer') return a.stage === 'Offer';
                if (col.id === 'hired') return a.stage === 'Joined' || a.stage === 'Pre-Hire';
                return a.stage === 'Applied' || !a.stage;
              });

              if (matchedApps.length === 0) return col;

              const mappedCards: KanbanCard[] = matchedApps.map((a: any) => {
                const name = a.candidate ? `${a.candidate.firstName} ${a.candidate.lastName}` : (a.candidateName || 'Candidate');
                const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                return {
                  id: a.id,
                  name,
                  photoUrl: a.candidate?.avatarUrl || `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80`,
                  appliedText: a.appliedAt ? `Applied ${new Date(a.appliedAt).toLocaleDateString()}` : 'Applied recently',
                  owner: {
                    name: a.primaryRecruiterName || 'Recruiter',
                    initials,
                    color: 'bg-teal-600',
                  },
                  nextAction: col.id === 'screening' ? 'Review Application' : col.id === 'offer' ? 'Draft Offer' : 'Interview Evaluation',
                  nextDue: 'Today, 2:00 PM',
                  nextDueTone: 'blue',
                  lastActivity: 'Stage synced',
                  lastActivityTime: 'Today',
                  stage: a.stage || col.stageKey,
                };
              });

              return {
                ...col,
                count: mappedCards.length,
                subtext: `${mappedCards.length} candidates`,
                cards: mappedCards,
              };
            });
          });
        }
      })
      .catch(() => {});
  }, [vacancyId]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const columns = useMemo(() => {
    return boardColumns.map((col) => {
      let cards = col.cards;
      if (searchQuery.trim()) {
        cards = cards.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.nextAction.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      if (selectedStageFilter !== 'ALL' && col.id !== selectedStageFilter) {
        cards = [];
      }
      return {
        ...col,
        cards,
      };
    });
  }, [boardColumns, searchQuery, selectedStageFilter]);

  const handleCardClick = (cardId: string) => {
    navigate(`/applications/${cardId}`);
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, cardId: string, sourceColId: string) => {
    setDraggedCard({ cardId, sourceColId });
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId, sourceColId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropColId !== colId) {
      setActiveDropColId(colId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, colId: string) => {
    if (activeDropColId === colId) {
      setActiveDropColId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    setActiveDropColId(null);

    if (!draggedCard || draggedCard.sourceColId === targetColId) {
      setDraggedCard(null);
      return;
    }

    const { cardId, sourceColId } = draggedCard;

    setBoardColumns((prev) => {
      const newCols = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      const sourceCol = newCols.find((c) => c.id === sourceColId);
      const targetCol = newCols.find((c) => c.id === targetColId);

      if (!sourceCol || !targetCol) return prev;

      const cardIdx = sourceCol.cards.findIndex((c) => c.id === cardId);
      if (cardIdx === -1) return prev;

      const [card] = sourceCol.cards.splice(cardIdx, 1);
      targetCol.cards.unshift(card);

      sourceCol.count = sourceCol.cards.length;
      targetCol.count = targetCol.cards.length;

      // Toast feedback
      setToastMessage(`✓ ${card.name} moved to ${targetCol.name}`);
      setTimeout(() => setToastMessage(null), 3000);

      // Persist in background with audit and concurrency protection
      patchApi(`/applications/${card.id}/stage`, {
        stage: targetCol.stageKey,
        expectedStage: card.stage || sourceCol.stageKey,
        expectedVersion: 1,
      }).catch(() => {});

      return newCols;
    });

    setDraggedCard(null);
  };

  const getDueBadgeStyle = (tone: 'blue' | 'purple' | 'amber' | 'gray') => {
    switch (tone) {
      case 'blue':
        return 'text-blue-600 dark:text-blue-400 font-bold';
      case 'purple':
        return 'text-purple-600 dark:text-purple-400 font-bold';
      case 'amber':
        return 'text-amber-600 dark:text-amber-400 font-bold';
      case 'gray':
      default:
        return 'text-slate-400 font-medium';
    }
  };

  const toggleSelectAllList = () => {
    if (selectedListIds.length === DEFAULT_LIST_ROWS.length) {
      setSelectedListIds([]);
    } else {
      setSelectedListIds(DEFAULT_LIST_ROWS.map((r) => r.id));
    }
  };

  const toggleSelectOneList = (id: string) => {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumbs ── */}
      <div className="text-xs font-semibold text-slate-400">
        <span
          onClick={() => navigate('/applications')}
          className="hover:text-blue-600 cursor-pointer"
        >
          Applications
        </span>
        <span className="mx-2">/</span>
        <span className="text-slate-700 dark:text-slate-200">{selectedJob}</span>
      </div>

      {/* ── Page Header & Controls Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Applications
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Track and manage all candidate applications across your hiring pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Icon name="download" size={13} className="text-slate-400" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddCandidateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Add Application</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* All Positions dropdown */}
        <div className="relative">
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="Senior Frontend Engineer">Senior Frontend Engineer</option>
            <option value="Product Designer">Product Designer</option>
            <option value="Backend Engineer">Backend Engineer</option>
            <option value="Registered Nurse - ICU">Registered Nurse - ICU</option>
            <option value="All Positions">All Positions</option>
          </select>
          <Icon name="chevron-down" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* All Stages dropdown */}
        <div className="relative">
          <select
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Stages</option>
            <option value="new">New</option>
            <option value="screening">Screening</option>
            <option value="technical">Technical Interview</option>
            <option value="hm_interview">Hiring Manager</option>
            <option value="offer">Offer</option>
            <option value="hired">Hired</option>
          </select>
          <Icon name="chevron-down" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* All Owners */}
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs">
            <option value="ALL">All Owners</option>
            <option value="Sarah Ahmed">Sarah Ahmed</option>
            <option value="Ahmed Mostafa">Ahmed Mostafa</option>
          </select>
          <Icon name="chevron-down" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* More filters */}
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer"
        >
          <Icon name="filter" size={13} className="text-slate-400" />
          <span>More Filters</span>
        </button>

        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applications..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        {/* List / Board Toggle matching reference */}
        <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'list'
                ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="menu" size={13} />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'board'
                ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="layout" size={13} />
            <span>Kanban View</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── View Mode: List View matching 13-applications-list-view.png ── */}
      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 text-left">
                  <th className="p-3.5 pl-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedListIds.length === DEFAULT_LIST_ROWS.length}
                      onChange={toggleSelectAllList}
                      className="rounded border-slate-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-3">Candidate</th>
                  <th className="py-3.5 px-3">Position</th>
                  <th className="py-3.5 px-3">Current Stage</th>
                  <th className="py-3.5 px-3">Owner</th>
                  <th className="py-3.5 px-3">SLA</th>
                  <th className="py-3.5 px-3">Last Activity</th>
                  <th className="py-3.5 px-3">Source</th>
                  <th className="py-3.5 px-3">Fit Score</th>
                  <th className="py-3.5 px-3">Next Action</th>
                  <th className="py-3.5 pr-4 text-right">
                    <Icon name="settings" size={13} className="text-slate-400 inline" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {DEFAULT_LIST_ROWS.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleCardClick(row.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                  >
                    <td className="p-3.5 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedListIds.includes(row.id)}
                        onChange={() => toggleSelectOneList(row.id)}
                        className="rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </td>

                    {/* Candidate */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {row.avatar}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                            {row.name}
                          </span>
                          <span className="block text-[10.5px] text-slate-400">
                            {row.appliedAgo}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-3.5 px-3">
                      <div>
                        <span className="block font-bold text-slate-800 dark:text-slate-200">
                          {row.positionTitle}
                        </span>
                        <span className="block text-[10.5px] text-slate-400">
                          {row.department} &bull; {row.location}
                        </span>
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {row.currentStage}
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center shrink-0">
                          {row.ownerAvatar}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white leading-tight">
                          {row.ownerName}
                        </span>
                      </div>
                    </td>

                    {/* SLA */}
                    <td className="py-3.5 px-3">
                      <div>
                        <span
                          className={`block font-bold text-xs ${
                            row.slaTone === 'red'
                              ? 'text-rose-600'
                              : row.slaTone === 'amber'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {row.sla}
                        </span>
                        <span className="block text-[10px] text-slate-400">{row.slaSub}</span>
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="py-3.5 px-3">
                      <div>
                        <span className="block font-bold text-slate-800 dark:text-slate-200">
                          {row.lastActivity}
                        </span>
                        <span className="block text-[10.5px] text-slate-400">{row.lastActivityTime}</span>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-3">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {row.source}
                      </span>
                    </td>

                    {/* Fit Score */}
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {row.fitScore}%
                      </span>
                    </td>

                    {/* Next Action */}
                    <td className="py-3.5 px-3">
                      <div>
                        <span className="block font-bold text-blue-600 dark:text-blue-400 hover:underline">
                          {row.nextAction}
                        </span>
                        <span className="block text-[10px] text-slate-400">{row.nextActionTime}</span>
                      </div>
                    </td>

                    <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700">
                        <Icon name="more-horizontal" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* List Footer */}
          <div className="p-3.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            <span>Showing 1 to 10 of 278 applications</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg border text-slate-500 hover:bg-slate-50">&lt;</button>
                <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-600 text-white font-bold">1</button>
                <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg border text-slate-600 hover:bg-slate-50">2</button>
                <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg border text-slate-600 hover:bg-slate-50">3</button>
                <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg border text-slate-500 hover:bg-slate-50">&gt;</button>
              </div>
              <select className="border rounded-lg px-2 py-1 text-xs">
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        /* ── View Mode: Kanban Board with HTML5 Drag-and-Drop matching 04-applications-pipeline-kanban.png ── */
        <div className="overflow-x-auto pb-4 pt-1">
          <div className="flex gap-4 items-start min-w-[1720px]">
            {columns.map((column) => (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={(e) => handleDragLeave(e, column.id)}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`w-[280px] min-w-[280px] shrink-0 bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border transition-all p-3 flex flex-col space-y-3 ${
                  activeDropColId === column.id
                    ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20 bg-blue-50/20'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <h2 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {column.name}
                    </h2>
                    <span className="w-5 h-5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-black flex items-center justify-center">
                      {column.count}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      type="button"
                      onClick={() => setIsAddCandidateOpen(true)}
                      className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-md cursor-pointer transition"
                      title="Add candidate"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                    <button
                      type="button"
                      className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-md cursor-pointer transition"
                      title="Column options"
                    >
                      <Icon name="more-horizontal" size={13} />
                    </button>
                  </div>
                </div>

                {/* Candidate Cards in Column */}
                <div className="space-y-3 min-h-[400px]">
                  {column.cards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id, column.id)}
                      onClick={() => handleCardClick(card.id)}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition cursor-grab active:cursor-grabbing group space-y-3"
                    >
                      {/* Card Top: Candidate Photo Avatar, Name, Applied date & Menu */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={card.photoUrl}
                            alt={card.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition block leading-tight">
                              {card.name}
                            </span>
                            <span className="text-[10.5px] text-slate-400 block mt-0.5">
                              {card.appliedText}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div
                            className={`w-5 h-5 rounded-full ${card.owner.color} text-white text-[9px] font-extrabold flex items-center justify-center shadow-2xs`}
                            title={`Owner: ${card.owner.name}`}
                          >
                            {card.owner.initials}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/applications/${card.id}/transition`);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Move stage"
                          >
                            <Icon name="more-horizontal" size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Middle: Next Action & Due label */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate pr-2">
                          <span className="font-semibold text-slate-400">Next:</span>
                          <span className="truncate font-medium text-slate-700 dark:text-slate-300">{card.nextAction}</span>
                        </div>
                        <span className={`shrink-0 ${getDueBadgeStyle(card.nextDueTone)}`}>
                          {card.nextDue}
                        </span>
                      </div>

                      {/* Bottom: Last activity */}
                      <div className="text-[10.5px] text-slate-400 flex items-center justify-between pt-0.5">
                        <span className="truncate">Last: {card.lastActivity}</span>
                        <span className="shrink-0 text-slate-400">{card.lastActivityTime}</span>
                      </div>
                    </div>
                  ))}

                  {column.cards.length === 0 && (
                    <div className="h-28 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-400">
                      Drop candidate here
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      <Modal
        isOpen={isAddCandidateOpen}
        onClose={() => setIsAddCandidateOpen(false)}
        title="Add Candidate to Pipeline"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold block mb-1">Candidate Full Name</label>
            <input
              type="text"
              placeholder="e.g. Tarek Mansour"
              className="w-full p-2.5 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold block mb-1">Email Address</label>
            <input
              type="email"
              placeholder="candidate@example.com"
              className="w-full p-2.5 border rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setIsAddCandidateOpen(false)}
              className="px-3 py-1.5 text-slate-500 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsAddCandidateOpen(false)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Add to New Stage
            </button>
          </div>
        </div>
      </Modal>

      {/* Candidate Split Drawer */}
      {selectedDrawerApp && (
        <CandidateSplitDrawer
          application={selectedDrawerApp}
          isOpen={Boolean(selectedDrawerApp)}
          onClose={() => setSelectedDrawerApp(null)}
        />
      )}
    </div>
  );
}

export default ApplicationsPage;
