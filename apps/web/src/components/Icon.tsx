import type { SVGProps } from 'react';
import {
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
  List,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  Pencil,
  Phone,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Upload,
  User,
  UserCheck,
  UserCog,
  Users,
  Workflow,
  X,
  Clock3,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

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
  | 'logout'
  | 'menu'
  | 'close'
  | 'document'
  | 'user-check'
  | 'user-cog'
  | 'user'
  | 'clock'
  | 'check'
  | 'download'
  | 'alert-triangle'
  | 'upload'
  | 'refresh-cw'
  | 'check-circle'
  | 'circle'
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
  | 'file-text'
  | 'chat'
  | 'info'
  | 'layout'
  | 'history'
  | 'star'
  | 'shield-check'
  | 'trash-2';

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
  logout: LogOut,
  menu: Menu,
  close: X,
  document: FileText,
  'user-check': UserCheck,
  'user-cog': UserCog,
  user: User,
  clock: Clock3,
  check: Check,
  download: Download,
  'alert-triangle': AlertTriangle,
  upload: Upload,
  'refresh-cw': RefreshCw,
  'check-circle': CheckCircle2,
  circle: Circle,
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
  'file-text': FileText,
  chat: MessageSquare,
  info: Info,
  layout: LayoutTemplate,
  history: History,
  'shield-check': ShieldCheck,
  'trash-2': Trash2,
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
