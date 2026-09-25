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
  InventoryIcon,
  AnalyticsIcon,
  AuditLogIcon,
} from '@/components/icons';

// Grouped so the sidebar doesn't turn into one long unscannable list as
// features grow — click a group to reveal its own tabs underneath it.
const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: <OverviewIcon /> },
  {
    href: '/admin/bookings',
    label: 'Operations',
    icon: <CustomersIcon />,
    children: [
      { href: '/admin/bookings', label: 'Customer Visits', icon: <CustomersIcon /> },
      { href: '/admin/rooms', label: 'Rooms', icon: <RoomsIcon /> },
      { href: '/admin/notifications', label: 'Notifications', icon: <NotificationsIcon /> },
    ],
  },
  {
    href: '/admin/services',
    label: 'Catalog',
    icon: <ServicesIcon />,
    children: [
      { href: '/admin/services', label: 'Services', icon: <ServicesIcon /> },
      { href: '/admin/payment-methods', label: 'Payment methods', icon: <PaymentIcon /> },
      { href: '/admin/branches', label: 'Branches', icon: <BranchesIcon /> },
    ],
  },
  { href: '/admin/inventory', label: 'Inventory', icon: <InventoryIcon /> },
  { href: '/admin/users', label: 'Staff accounts', icon: <StaffIcon /> },
  {
    href: '/admin/reports',
    label: 'Insights',
    icon: <AnalyticsIcon />,
    children: [
      { href: '/admin/analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
      { href: '/admin/reports', label: 'Reports', icon: <ReportsIcon /> },
      { href: '/admin/audit-log', label: 'Audit log', icon: <AuditLogIcon /> },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['admin']}>
      <DashboardShell navItems={NAV}>{children}</DashboardShell>
    </RoleGuard>
  );
}

