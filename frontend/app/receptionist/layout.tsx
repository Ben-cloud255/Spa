'use client';

import { ReactNode } from 'react';
import RoleGuard from '@/components/RoleGuard';
import DashboardShell, { NavItem } from '@/components/DashboardShell';
import { RoomsIcon, HistoryIcon, ReportsIcon, NotificationsIcon, InventoryIcon } from '@/components/icons';

const NAV: NavItem[] = [
  { href: '/receptionist', label: 'Rooms', icon: <RoomsIcon /> },
  { href: '/receptionist/notifications', label: 'Notifications', icon: <NotificationsIcon /> },
  { href: '/receptionist/bookings', label: 'Booking history', icon: <HistoryIcon /> },
  { href: '/receptionist/inventory', label: 'Inventory', icon: <InventoryIcon /> },
  { href: '/receptionist/reports', label: 'Reports', icon: <ReportsIcon /> },
];

export default function ReceptionistLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['receptionist']}>
      <DashboardShell navItems={NAV}>{children}</DashboardShell>
    </RoleGuard>
  );
}
