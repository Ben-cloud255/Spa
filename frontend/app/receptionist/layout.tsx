'use client';

import { ReactNode } from 'react';
import RoleGuard from '@/components/RoleGuard';
import DashboardShell, { NavItem } from '@/components/DashboardShell';
import { RoomsIcon, RequestsIcon, HistoryIcon, ReportsIcon } from '@/components/icons';

const NAV: NavItem[] = [
  { href: '/receptionist', label: 'Rooms', icon: <RoomsIcon /> },
  { href: '/receptionist/appointments', label: 'Booking requests', icon: <RequestsIcon /> },
  { href: '/receptionist/bookings', label: 'Booking history', icon: <HistoryIcon /> },
  { href: '/receptionist/reports', label: 'Reports', icon: <ReportsIcon /> },
];

export default function ReceptionistLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['receptionist']}>
      <DashboardShell navItems={NAV}>{children}</DashboardShell>
    </RoleGuard>
  );
}
