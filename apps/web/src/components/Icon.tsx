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
  | 'more'
  | 'logout'
  | 'menu'
  | 'close'
  | 'document'
  | 'user-check'
  | 'user'
  | 'clock'
  | 'check'
  | 'download'
  | 'alert-triangle'
  | 'upload'
  | 'refresh-cw'
  | 'check-circle'
  | 'plus'
  | 'eye'
  | 'eye-off'
  | 'sun'
  | 'moon';

const paths: Record<IconName, string[]> = {
  dashboard: ['M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z'],
  tasks: ['m9 11 2 2 4-4', 'M20 6v14H4V6', 'M8 4h8v4H8z'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  vacancy: ['M4 5h16v14H4z', 'M8 9h8', 'M8 13h5', 'M8 17h3'],
  inbox: ['M4 4h16v12H4z', 'm4 13 4 4h8l4-4', 'M9 8h6'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  database: ['M4 5c0 1.1 3.6 2 8 2s8-.9 8-2-3.6-2-8-2-8 .9-8 2Z', 'M4 5v7c0 1.1 3.6 2 8 2s8-.9 8-2V5', 'M4 12v7c0 1.1 3.6 2 8 2s8-.9 8-2v-7'],
  pipeline: ['M4 4h6v6H4z', 'M14 14h6v6h-6z', 'm10 7 4 10', 'M14 7h6v6h-6z', 'M4 14h6v6H4z'],
  calendar: ['M5 4h14v16H5z', 'M8 2v4', 'M16 2v4', 'M5 9h14'],
  offer: ['M4 5h16v14H4z', 'M8 9h8', 'M8 13h5'],
  hire: ['M12 3v18', 'M3 12h18', 'M5 5h14v14H5z'],
  report: ['M4 19V5', 'M4 19h16', 'm7 15 3-4 3 2 4-6'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.4v-.2a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.56-1.03H6v-2.4h.2A1.7 1.7 0 0 0 7.76 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06A1.7 1.7 0 0 0 11 6.1a1.7 1.7 0 0 0 1.03-1.56V4h2.4v.2A1.7 1.7 0 0 0 15.46 5.76a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0 0 18.7 9a1.7 1.7 0 0 0 1.56 1.03h.2v2.4h-.2A1.7 1.7 0 0 0 19.4 15Z'],
  integrations: ['M8 12h8', 'M12 8v8', 'M6 4h12v16H6z', 'M9 4V2h6v2'],
  audit: ['M5 4h14v16H5z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  search: ['m21 21-4.35-4.35', 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M21 19V5a2 2 0 0 0-2-2h-4'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['m6 6 12 12', 'm18 6-12 12'],
  document: ['M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z', 'M14 3v5h5', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  'user-check': ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'm16 11 2 2 4-4'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  clock: ['M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10Z', 'M12 6v6l4 2'],
  check: ['M20 6L9 17l-5-5'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  'alert-triangle': ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  'refresh-cw': ['M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16', 'M16 16h5v5'],
  'check-circle': ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
  plus: ['M12 5v14', 'M5 12h14'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye-off': ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24', 'M1 1l22 22'],
  sun: ['M12 4V2', 'M12 22v-2', 'm4.93 4.93-1.42-1.42', 'm18.49 18.49-1.42-1.42', 'M4 12H2', 'M22 12h-2', 'm4.93 19.07-1.42 1.42', 'm18.49 5.51-1.42 1.42', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z'],
};

export function Icon({ name, size = 16, ...props }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      {...props}
      aria-hidden={props['aria-label'] ? undefined : true}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name].map((path) => <path d={path} key={path} />)}
    </svg>
  );
}
