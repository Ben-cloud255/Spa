// A small set of consistent line icons for the sidebar nav — no icon library
// dependency, matching the weight/style already used for the bell icon.

type IconProps = { className?: string };
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };

export function OverviewIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
export function ReportsIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M4 20V10M11 20V4M18 20v-6" strokeLinecap="round" />
    </svg>
  );
}
export function RequestsIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 8v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="8" />
      <path d="M9 3h6" strokeLinecap="round" />
    </svg>
  );
}
export function CustomersIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <path d="M16 9a2.8 2.8 0 1 0 0-5.6M18.5 20c0-2.6-1.7-4.8-4-5.6" strokeLinecap="round" />
    </svg>
  );
}
export function NotificationsIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function RoomsIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M4 21V7l8-4 8 4v14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21v-7h6v7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ServicesIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3a4 4 0 0 1 4 4c0 2-1.5 3-2 4.5L20 19l-1.5 1.5-7.5-6-7.5 6L2 19l6-7.5C7.5 10 6 9 6 7a4 4 0 0 1 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function StaffIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" strokeLinecap="round" />
    </svg>
  );
}
export function BranchesIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2v8M12 10 6 15M12 10l6 5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
export function HistoryIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
