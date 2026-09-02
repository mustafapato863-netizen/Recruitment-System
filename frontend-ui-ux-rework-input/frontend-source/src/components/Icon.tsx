import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  File,
  FileCheck,
  FileText,
  Files,
  Folder,
  FolderKanban,
  Grid2X2,
  Globe2,
  GripVertical,
  History,
  Inbox,
  Info,
  LayoutDashboard,
  LayoutTemplate,
  Link,
  List,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Pencil,
  Phone,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserCog,
  UserX,
  Users,
  Video,
  Workflow,
  X,
  Clock3,
  type LucideIcon,
} from 'lucide-react';

import type { SVGProps } from 'react';

export type IconName =
  | 'dashboard'
  | 'tasks'
  | 'bell'
  | 'vacancy'
  | 'inbox'
  | 'list'
  | 'users'
  | 'database'
  | 'pipeline'
  | 'calendar'
  | 'calendar-check'
  | 'calendar-clock'
  | 'offer'
  | 'hire'
  | 'report'
  | 'settings'
  | 'integrations'
  | 'audit'
  | 'search'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'arrow-left'
  | 'arrow-right'
  | 'more'
  | 'more-horizontal'
  | 'logout'
  | 'menu'
  | 'close'
  | 'document'
  | 'user-check'
  | 'user-cog'
  | 'user-x'
  | 'user'
  | 'clock'
  | 'check'
  | 'download'
  | 'alert-triangle'
  | 'upload'
  | 'refresh-cw'
  | 'refresh'
  | 'check-circle'
  | 'circle'
  | 'clipboard-check'
  | 'plus'
  | 'mail'
  | 'lock'
  | 'eye'
  | 'eye-off'
  | 'sun'
  | 'moon'
  | 'briefcase'
  | 'grid-squares'
  | 'grip'
  | 'building'
  | 'globe'
  | 'send'
  | 'phone'
  | 'folder'
  | 'folder-kanban'
  | 'cv'
  | 'copy'
  | 'edit'
  | 'sparkles'
  | 'star'
  | 'file'
  | 'file-text'
  | 'chat'
  | 'message-square'
  | 'info'
  | 'layout'
  | 'history'
  | 'shield-check'
  | 'trash'
  | 'trash-2'
  | 'video'
  | 'map-pin'
  | 'tag'
  | 'link'
  | 'sliders'
  | 'share-2'
  | 'activity';

const icons: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  tasks: ClipboardCheck,
  bell: Bell,
  vacancy: Briefcase,
  inbox: Inbox,
  list: List,
  users: Users,
  database: Database,
  pipeline: Workflow,
  calendar: CalendarDays,
  'calendar-check': CalendarCheck,
  'calendar-clock': CalendarClock,
  offer: FileCheck,
  hire: UserCheck,
  report: BarChart3,
  settings: Settings,
  integrations: Plug,
  audit: History,
  search: Search,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  more: Ellipsis,
  'more-horizontal': MoreHorizontal,
  logout: LogOut,
  menu: Menu,
  close: X,
  document: FileText,
  'user-check': UserCheck,
  'user-cog': UserCog,
  'user-x': UserX,
  user: User,
  clock: Clock3,
  check: Check,
  download: Download,
  'alert-triangle': AlertTriangle,
  upload: Upload,
  'refresh-cw': RefreshCw,
  refresh: RefreshCw,
  'check-circle': CheckCircle2,
  circle: Circle,
  'clipboard-check': ClipboardCheck,
  plus: Plus,
  mail: Mail,
  lock: LockKeyhole,
  eye: Eye,
  'eye-off': EyeOff,
  sun: Sun,
  moon: Moon,
  briefcase: Briefcase,
  'grid-squares': Grid2X2,
  grip: GripVertical,
  building: Building2,
  globe: Globe2,
  send: Send,
  phone: Phone,
  folder: Folder,
  'folder-kanban': FolderKanban,
  cv: Files,
  copy: Copy,
  edit: Pencil,
  sparkles: Sparkles,
  star: Star,
  file: File,
  'file-text': FileText,
  chat: MessageSquare,
  'message-square': MessageSquare,
  info: Info,
  layout: LayoutTemplate,
  history: History,
  'shield-check': ShieldCheck,
  trash: Trash2,
  'trash-2': Trash2,
  video: Video,
  'map-pin': MapPin,
  tag: Tag,
  link: Link,
  sliders: SlidersHorizontal,
  'share-2': Share2,
  activity: Activity,
};

export function Icon({
  name,
  size = 16,
  className = '',
  strokeWidth = 1.8,
  ...props
}: {
  name: IconName;
  size?: number;
} & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const Lucide = icons[name] ?? FileText;

  return (
    <Lucide
      aria-hidden={props['aria-label'] ? undefined : true}
      className={['shrink-0 inline-block align-middle', className].filter(Boolean).join(' ')}
      focusable="false"
      size={size}
      strokeWidth={strokeWidth as number}
      {...props}
    />
  );
}
