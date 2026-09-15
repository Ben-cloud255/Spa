'use client';

import { ReactNode } from 'react';
import RoleGuard from '@/components/RoleGuard';
import DashboardShell, { NavItem } from '@/components/DashboardShell';
import {
  OverviewIcon,
  ReportsIcon,
  CustomersIcon,
  NotificationsIcon,
  RoomsIcon,
  ServicesIcon,
  StaffIcon,
  BranchesIcon,
  PaymentIcon,
} from '@/components/icons';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: <OverviewIcon /> },
  { href: '/admin/bookings', label: 'Customers and services', icon: <CustomersIcon /> },
  { href: '/admin/notifications', label: 'Notifications', icon: <NotificationsIcon /> },
  { href: '/admin/rooms', label: 'Rooms', icon: <RoomsIcon /> },
  { href: '/admin/services', label: 'Services', icon: <ServicesIcon /> },
  { href: '/admin/payment-methods', label: 'Payment methods', icon: <PaymentIcon /> },
  { href: '/admin/users', label: 'Staff accounts', icon: <StaffIcon /> },
  { href: '/admin/branches', label: 'Branches', icon: <BranchesIcon /> },
  { href: '/admin/reports', label: 'Reports', icon: <ReportsIcon /> },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['admin']}>
      <DashboardShell navItems={NAV}>{children}</DashboardShell>
    </RoleGuard>
  );
}
